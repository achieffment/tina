'use client';
import React, { useMemo } from 'react';
import { wrapFieldsWithMeta } from 'tinacms';

// Эмодзи маркер для определения автоматически переведенных полей
const AUTO_TRANSLATION_EMOJI = '🤖';

// Компонент индикатора автоматического перевода
const AutoTranslationBadge: React.FC = () => {
  return (
    <div className="auto-translation-badge" style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      backgroundColor: '#E3F2FD',
      border: '1px solid #2196F3',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '500',
      color: '#1976D2',
      marginLeft: '8px',
    }}>
      <span>🌐</span>
      <span>Автоматический перевод</span>
    </div>
  );
};

// Простая утилита для очистки эмодзи из текста
export function clean(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(new RegExp(AUTO_TRANSLATION_EMOJI, 'g'), '');
}

// Обертка для строковых полей с поддержкой детекции автоперевода
export const AutoTranslatedStringInput = wrapFieldsWithMeta<any>(({ field, input, meta }) => {
  // Проверяем, содержит ли ИСХОДНОЕ значение эмодзи маркер
  const hasAutoTranslation = useMemo(() => {
    return typeof input.value === 'string' && input.value.includes(AUTO_TRANSLATION_EMOJI);
  }, [input.value]);

  // Обработчик изменения значения
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Сохраняем новое значение в форму напрямую
    input.onChange(e.target.value);
  };

  // Определяем, является ли поле textarea
  const isTextarea = field.component === 'textarea' || field.ui?.component === 'textarea';

  // Отображаем очищенное значение (без эмодзи) для удобства редактирования
  const displayValue = clean(input.value);

  return (
    <div className="auto-translation-field-wrapper">
      {/* Лейбл с индикатором */}
      {field.label && (
        <label 
          htmlFor={input.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#333',
          }}
        >
          {field.label}
          {field.required && <span style={{ color: '#DC2626', marginLeft: '4px' }}>*</span>}
          {hasAutoTranslation && <AutoTranslationBadge />}
        </label>
      )}

      {/* Описание поля, если есть */}
      {field.description && (
        <p style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '8px',
          marginTop: '-4px',
        }}>
          {field.description}
        </p>
      )}

      {/* Поле ввода */}
      {isTextarea ? (
        <textarea
          id={input.name}
          name={input.name}
          value={displayValue}
          onChange={handleChange}
          onBlur={input.onBlur}
          onFocus={input.onFocus}
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          className="tina-textarea"
        />
      ) : (
        <input
          type="text"
          id={input.name}
          name={input.name}
          value={displayValue}
          onChange={handleChange}
          onBlur={input.onBlur}
          onFocus={input.onFocus}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          className="tina-input"
        />
      )}

      {/* Ошибки валидации */}
      {meta.error && meta.touched && (
        <div style={{
          marginTop: '4px',
          fontSize: '12px',
          color: '#DC2626',
        }}>
          {meta.error}
        </div>
      )}
    </div>
  );
});

// Функция для автоматического применения компонента к строковым полям
export function wrapStringFields(fields: any[]): any[] {
  return fields.map((field) => {
    // Если поле - это строка, применяем наш компонент
    if (field.type === 'string') {
      // Если уже есть кастомный компонент, пропускаем только специальные случаи
      const hasCustomComponent = field.ui?.component && 
        field.ui.component !== 'text' && 
        field.ui.component !== 'textarea';
      
      if (hasCustomComponent) {
        // Пропускаем поля с реально кастомными компонентами
        if (process.env.NODE_ENV === 'development') {
          console.log('[AutoTranslation] Skipping field with custom component:', field.name, field.ui.component);
        }
      } else {
        return {
          ...field,
          ui: {
            ...field.ui,
            component: AutoTranslatedStringInput,
          },
        };
      }
    }

    // Рекурсивно обрабатываем вложенные поля (для object и других типов)
    if (field.fields && Array.isArray(field.fields)) {
      return {
        ...field,
        fields: wrapStringFields(field.fields),
      };
    }

    // Обрабатываем templates (для rich-text и других сложных типов)
    if (field.templates && Array.isArray(field.templates)) {
      return {
        ...field,
        templates: field.templates.map((template: any) => {
          if (template.fields) {
            return {
              ...template,
              fields: wrapStringFields(template.fields),
            };
          }
          return template;
        }),
      };
    }

    return field;
  });
}

// Экспорт утилит для использования в конфигурации
export { AUTO_TRANSLATION_EMOJI };
