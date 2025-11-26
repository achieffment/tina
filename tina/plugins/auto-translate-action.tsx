'use client';
import React, { useState } from 'react';

// Компонент Screen для перевода
const TranslateScreen: React.FC<{ close: () => void }> = ({ close }) => {
  const [status, setStatus] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setStatus('Получение данных...');

    try {
      // Получаем CMS через window
      const cms = (window as any).tinacms;
      
      if (!cms) {
        throw new Error('CMS not available');
      }

      // Получаем активную форму
      const activeForms = cms.state.forms || [];
      if (activeForms.length === 0) {
        throw new Error('No document is currently being edited');
      }

      const form = activeForms[0].tinaForm;
      if (!form) {
        throw new Error('Cannot access current form');
      }

      // @ts-ignore
      const collection = form.crudType;
      const supportedCollections = ['page', 'post', 'service'];
      
      if (!collection || !supportedCollections.includes(collection)) {
        throw new Error('Translation not supported for this collection');
      }

      // Получаем текущие значения формы
      const currentValues = form.finalForm.getState().values;
      const relativePath = form.id.split(':')[1]; // format: "collection:path"
      
      // Определяем текущую и целевую локаль
      const pathParts = relativePath.split('/');
      const currentLocale = pathParts[0]; // ru или en
      const targetLocale = currentLocale === 'ru' ? 'en' : 'ru';

      setStatus(`Перевод на ${targetLocale === 'en' ? 'английский' : 'русский'}...`);

      // Вызываем API для перевода документа
      const response = await fetch('/api/translate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: currentValues,
          targetLocale,
          sourceLocale: currentLocale,
          collection,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Translation failed');
      }

      const { translatedDocument } = await response.json();

      setStatus('Создание нового документа...');

      // Формируем путь для нового документа
      const newPathParts = [...pathParts];
      newPathParts[0] = targetLocale;
      const newRelativePath = newPathParts.join('/');

      // Создаём новый документ через TinaCMS API
      if (!cms.api?.tina) {
        throw new Error('TinaCMS API not available');
      }
      
      await cms.api.tina.request(
        `
        mutation CreateDocument($collection: String!, $relativePath: String!, $params: DocumentMutation!) {
          createDocument(collection: $collection, relativePath: $relativePath, params: $params) {
            __typename
            ... on Document {
              _sys {
                filename
                path
                relativePath
              }
            }
          }
        }
      `,
        {
          variables: {
            collection,
            relativePath: newRelativePath,
            params: translatedDocument,
          },
        }
      );
      
      setStatus(`✅ Документ переведён на ${targetLocale.toUpperCase()}!`);
      setIsTranslating(false);
      
      // Ждём 2 секунды и предлагаем открыть
      setTimeout(() => {
        if (window.confirm('Хотите открыть переведённый документ?')) {
          const editUrl = `/admin/index.html#/collections/${collection}/${newRelativePath}`;
          window.location.href = editUrl;
        } else {
          close();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Translation error:', error);
      setStatus(`❌ Ошибка: ${error instanceof Error ? error.message : 'Translation failed'}`);
      setIsTranslating(false);
    }
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span>🌐</span>
        <span>Автоперевод документа</span>
      </h2>

      <p style={{
        marginBottom: '30px',
        color: '#666',
        lineHeight: '1.6',
      }}>
        Этот инструмент переведёт текущий документ на другой язык с помощью OpenAI GPT-4o-mini.
        Переведённый документ будет создан в соответствующей папке локализации.
      </p>

      {status && (
        <div style={{
          padding: '15px',
          backgroundColor: status.includes('❌') ? '#fee' : status.includes('✅') ? '#efe' : '#e3f2fd',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px',
        }}>
          {status}
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '30px',
      }}>
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          style={{
            flex: 1,
            padding: '12px 24px',
            backgroundColor: isTranslating ? '#ccc' : '#2296fe',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: isTranslating ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {isTranslating ? 'Перевод...' : '🌐 Перевести'}
        </button>
        
        <button
          onClick={close}
          disabled={isTranslating}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: isTranslating ? 'not-allowed' : 'pointer',
          }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
};

// Экспорт Screen Plugin
export const TranslateScreenPlugin = {
  __type: 'screen' as const,
  name: 'translate-document',
  Component: TranslateScreen,
  Icon: () => <span style={{ fontSize: '20px' }}>🌐</span>,
  layout: 'popup' as const,
};

// Функция для добавления Screen Plugin в CMS
export const addTranslateScreen = (cms: any) => {
  console.log('🌐 Adding Translate Screen Plugin to TinaCMS');
  
  cms.plugins.add(TranslateScreenPlugin);
  console.log('✅ Translate Screen Plugin added successfully');
  
  return cms;
};
