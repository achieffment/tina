'use client';
import React, { useState } from 'react';
import { useCMS, FormMetaPlugin } from 'tinacms';

// Компонент кнопки перевода для левой панели
const TranslateButton: React.FC = () => {
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

      // Создаём файл напрямую через наш API endpoint
      const createFileResponse = await fetch('/api/create-translated-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          relativePath: newRelativePath,
          collection,
          document: translatedDocument,
        }),
      });

      if (!createFileResponse.ok) {
        const error = await createFileResponse.json();
        throw new Error(error.error || 'Failed to create file');
      }

      const { path: createdFilePath } = await createFileResponse.json();
      console.log('Created file:', createdFilePath);
      
      setStatus(`✅ Документ переведён на ${targetLocale.toUpperCase()}!`);
      setIsTranslating(false);
      
      // Ждём 2 секунды и предлагаем открыть
      setTimeout(() => {
        if (window.confirm('Хотите открыть переведённый документ?')) {
          const editUrl = `/admin/index.html#/collections/${collection}/${newRelativePath}`;
          window.location.href = editUrl;
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
      padding: '12px 16px',
      backgroundColor: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      marginBottom: '16px',
    }}>
      <button
        onClick={handleTranslate}
        disabled={isTranslating}
        style={{
          width: '100%',
          padding: '10px 16px',
          backgroundColor: isTranslating ? '#9ca3af' : '#2296fe',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isTranslating ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '16px' }}>🌐</span>
        <span>{isTranslating ? 'Перевод...' : 'Перевести документ'}</span>
      </button>

      {status && (
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          backgroundColor: status.includes('❌') ? '#fee2e2' : status.includes('✅') ? '#dcfce7' : '#dbeafe',
          borderRadius: '6px',
          fontSize: '13px',
          color: status.includes('❌') ? '#991b1b' : status.includes('✅') ? '#166534' : '#1e40af',
        }}>
          {status}
        </div>
      )}
    </div>
  );
};

// Создаём FormMetaPlugin для отображения кнопки в левой панели
export const TranslateFormMetaPlugin = new FormMetaPlugin({
  name: 'translate-document',
  Component: TranslateButton,
});

// Функция для добавления плагина в CMS
export const addTranslateButton = (cms: any) => {
  console.log('🌐 Adding Translate Button to TinaCMS sidebar');
  
  cms.plugins.add(TranslateFormMetaPlugin);
  console.log('✅ Translate Button added successfully');
  
  return cms;
};
