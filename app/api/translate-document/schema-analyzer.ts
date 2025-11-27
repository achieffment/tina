/**
 * Schema Analyzer для определения переводимых полей в TinaCMS
 * Использует сгенерированную схему для определения типов полей
 */

import tinaSchema from '@/tina/__generated__/_schema.json';

// Типы полей TinaCMS
interface TinaField {
  type: string;
  name: string;
  label?: string;
  options?: any[];
  fields?: TinaField[];
  templates?: TinaTemplate[];
  list?: boolean;
  isBody?: boolean;
  translatable?: boolean;
}

interface TinaTemplate {
  name: string;
  label?: string;
  fields: TinaField[];
}

interface TinaCollection {
  name: string;
  label: string;
  fields: TinaField[];
}

/**
 * Получает схему коллекции по имени
 */
export function getCollectionSchema(collectionName: string): TinaCollection | null {
  const collection = tinaSchema.collections.find(
    (col: any) => col.name === collectionName
  );
  return collection || null;
}

/**
 * Проверяет, нужно ли переводить поле на основе его определения в схеме
 * OPT-IN стратегия: переводим ТОЛЬКО явно помеченные поля
 * @param fieldDef - определение поля из схемы TinaCMS
 * @returns true если поле нужно переводить
 */
export function shouldTranslateFieldDef(fieldDef: TinaField | undefined): boolean {
  if (!fieldDef) {
    // Без схемы НЕ переводим
    return false;
  }

  // OPT-IN: переводим ТОЛЬКО с явным флагом translatable
  if (fieldDef.translatable === true) {
    return true;
  }

  // Rich-text переводим всегда (содержимое текстовых узлов)
  if (fieldDef.type === 'rich-text') {
    return true;
  }

  // Всё остальное НЕ переводим
  return false;
}


/**
 * Находит определение поля в схеме по имени
 */
export function findFieldDef(fields: TinaField[], fieldName: string): TinaField | undefined {
  return fields.find((f) => f.name === fieldName);
}

/**
 * Находит шаблон в списке templates по имени
 */
export function findTemplate(templates: TinaTemplate[], templateName: string): TinaTemplate | undefined {
  return templates.find((t) => t.name === templateName);
}

/**
 * Проверяет, является ли объект rich-text узлом
 */
export function isRichTextNode(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj.type === 'root' || obj.type === 'p' || obj.type === 'text' || obj.type === 'a' || obj.type === 'h1' || obj.type === 'h2' || obj.type === 'h3')
  );
}

/**
 * Проверяет, нужно ли переводить rich-text узел
 */
export function shouldTranslateRichTextNode(node: any): boolean {
  // Переводим только текстовые узлы с непустым содержимым
  return node.type === 'text' && node.text && typeof node.text === 'string' && node.text.trim().length > 0;
}

/**
 * Экспортируем типы для использования в других модулях
 */
export type { TinaField, TinaTemplate, TinaCollection };

