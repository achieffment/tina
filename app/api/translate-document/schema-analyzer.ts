/**
 * Schema Analyzer для определения переводимых полей в TinaCMS
 */

// Технические поля - НИКОГДА не переводить
const TECHNICAL_FIELDS = new Set([
  'type',
  'name',
  'icon',
  'color',
  'style',
  'link',
  'url',
  'background',
  'videoUrl',
  'src',
  'alt',
  '_template',
  '_collection',
  '_autoTranslatedFields',
  'id',
]);

// Контентные поля - ВСЕГДА переводить
const CONTENT_FIELDS = new Set([
  'title',
  'description',
  'headline',
  'tagline',
  'text',
  'quote',
  'author',
  'role',
  'label',
  'body',
  'content',
  'stat',
]);

// Типы полей, которые не переводятся
const NON_TRANSLATABLE_TYPES = new Set([
  'image',
  'reference',
  'boolean',
  'number',
  'date',
]);

/**
 * Проверяет, является ли поле техническим (не должно переводиться)
 */
export function isTechnicalField(fieldName: string): boolean {
  return TECHNICAL_FIELDS.has(fieldName);
}

/**
 * Проверяет, является ли поле контентным (должно переводиться)
 */
export function isContentField(fieldName: string): boolean {
  return CONTENT_FIELDS.has(fieldName);
}

/**
 * Проверяет, нужно ли переводить строковое поле
 * @param fieldName - имя поля
 * @param value - значение поля
 * @returns true если поле нужно переводить
 */
export function shouldTranslateField(fieldName: string, value: any): boolean {
  // Пропускаем служебные поля
  if (fieldName.startsWith('_')) {
    return fieldName === '_body'; // Только _body может переводиться
  }

  // Технические поля не переводим
  if (isTechnicalField(fieldName)) {
    return false;
  }

  // Контентные поля переводим
  if (isContentField(fieldName)) {
    return true;
  }

  // Если значение похоже на URL или путь - не переводим
  if (typeof value === 'string') {
    // Проверяем URL
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
      return false;
    }
    
    // Проверяем путь
    if (value.startsWith('/') || value.includes('./') || value.includes('../')) {
      return false;
    }

    // Проверяем Tailwind классы
    if (value.startsWith('bg-') || value.includes('text-') || value.includes('hover:')) {
      return false;
    }

    // Проверяем пустые строки
    if (!value.trim()) {
      return false;
    }
  }

  // По умолчанию переводим строковые значения
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Проверяет, является ли объект rich-text узлом
 */
export function isRichTextNode(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    'type' in obj &&
    (obj.type === 'root' || obj.type === 'p' || obj.type === 'text' || obj.type === 'a')
  );
}

/**
 * Проверяет, нужно ли переводить rich-text узел
 */
export function shouldTranslateRichTextNode(node: any): boolean {
  // Переводим только текстовые узлы с непустым содержимым
  return node.type === 'text' && node.text && typeof node.text === 'string' && node.text.trim().length > 0;
}

