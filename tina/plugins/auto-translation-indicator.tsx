'use client';
import React, { useMemo, useCallback } from 'react';
import { wrapFieldsWithMeta } from 'tinacms';

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

// Вспомогательная функция для получения значения по пути
function getValueByPath(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Обертка для строковых полей с поддержкой детекции автоперевода на основе метаданных
export const AutoTranslatedStringInput = wrapFieldsWithMeta<any>(({ field, input, meta, form }) => {
  // Извлекаем имя поля и путь к родительскому блоку
  const { fieldName, parentPath } = useMemo(() => {
    // input.name может быть например "blocks.1.headline"
    const parts = input.name.split('.');
    return {
      fieldName: parts[parts.length - 1], // "headline"
      parentPath: parts.slice(0, -1).join('.'), // "blocks.1"
    };
  }, [input.name]);

  // Получаем список автопереведенных полей из родительского блока
  const autoTranslatedFields = useMemo(() => {
    try {
      // Пробуем через form.getState()
      if (form?.getState) {
        const formState = form.getState();
        if (formState.values && parentPath) {
          const parentValue = getValueByPath(formState.values, parentPath);
          return (parentValue?._autoTranslatedFields as string[]) || [];
        }
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }, [form, parentPath]);

  // Проверяем, является ли поле автопереведенным
  const hasAutoTranslation = useMemo(() => {
    return autoTranslatedFields.includes(fieldName);
  }, [autoTranslatedFields, fieldName]);

  // Обработчик изменения значения
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Сохраняем новое значение
    input.onChange(newValue);

    // Если поле было автопереведено, удаляем его из списка родительского блока
    if (hasAutoTranslation && form && parentPath) {
      const updatedFields = autoTranslatedFields.filter(f => f !== fieldName);
      form.change(`${parentPath}._autoTranslatedFields`, updatedFields);
    }
  }, [input, hasAutoTranslation, autoTranslatedFields, fieldName, parentPath, form]);

  // Определяем, является ли поле textarea
  const isTextarea = field.component === 'textarea' || field.ui?.component === 'textarea';

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
          value={input.value || ''}
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
          value={input.value || ''}
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

// Схема поля для хранения автопереведенных полей
const autoTranslatedFieldSchema = {
  type: 'string',
  name: '_autoTranslatedFields',
  list: true,
  ui: { component: () => null },
};

// Функция для автоматического применения компонента к строковым полям
export function wrapStringFields(fields: any[]): any[] {
  return fields.map((field) => {
    // Пропускаем служебные поля
    if (field.name === '_autoTranslated' || field.name === '_autoTranslatedFields') {
      return field;
    }

    // Если поле - это строка, применяем наш компонент
    if (field.type === 'string') {
      // Если уже есть кастомный компонент, пропускаем только специальные случаи
      const hasCustomComponent = field.ui?.component && 
        field.ui.component !== 'text' && 
        field.ui.component !== 'textarea';
      
      if (!hasCustomComponent) {
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

    // Обрабатываем templates - автоматически добавляем поле _autoTranslatedFields
    if (field.templates && Array.isArray(field.templates)) {
      return {
        ...field,
        templates: field.templates.map((template: any) => ({
          ...template,
          fields: [
            autoTranslatedFieldSchema,
            ...wrapStringFields(template.fields || []),
          ],
        })),
      };
    }

    return field;
  });
}
