'use client';
import React, { useState } from 'react';
import { useCMS } from 'tinacms';

// Компонент Screen для перевода
const TranslateScreen: React.FC<{ close: () => void }> = ({ close }) => {
  const cms = useCMS();
  const [status, setStatus] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setStatus('Получение данных...');

    try {
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

      // Получаем путь из form.id (формат: "content/pages/ru/home.mdx")
      const formId = form.id || '';
      console.log('Form ID:', formId);
      
      // Извлекаем collection и relative path из полного пути
      // Формат: content/{collection}s/{locale}/{file}.mdx
      const pathMatch = formId.match(/^content\/(pages|posts|services)\/(.+)$/);
      
      if (!pathMatch) {
        throw new Error(`Cannot parse form ID: "${formId}"`);
      }
      
      const collectionPlural = pathMatch[1]; // "pages", "posts", "services"
      const relativePath = pathMatch[2]; // "ru/home.mdx"
      
      // Преобразуем множественное число в единственное
      const collectionMap: Record<string, string> = {
        'pages': 'page',
        'posts': 'post',
        'services': 'service'
      };
      
      const collection = collectionMap[collectionPlural];
      
      console.log('Collection:', collection);
      console.log('Relative path:', relativePath);
      
      if (!collection) {
        throw new Error(`Unknown collection: "${collectionPlural}"`);
      }

      // Получаем текущие значения формы
      const currentValues = form.finalForm.getState().values;
      
      // Определяем текущую и целевую локаль из relativePath
      const relativePathParts = relativePath.split('/');
      const currentLocale = relativePathParts[0]; // ru или en
      const targetLocale = currentLocale === 'ru' ? 'en' : 'ru';
      
      console.log('Current locale:', currentLocale);
      console.log('Target locale:', targetLocale);

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
      const newPathParts = [...relativePathParts];
      newPathParts[0] = targetLocale;
      const newRelativePath = newPathParts.join('/');
      
      console.log('New relative path:', newRelativePath);

      // Очищаем документ от служебных полей, которые не принимает GraphQL
      const cleanDocument = { ...translatedDocument };
      delete cleanDocument._collection;
      delete cleanDocument._template;
      
      console.log('Clean document:', cleanDocument);

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
            params: cleanDocument,
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
