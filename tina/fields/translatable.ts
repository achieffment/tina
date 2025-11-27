/**
 * Helper для создания переводимого строкового поля
 */

interface StringFieldConfig {
  label?: string;
  name: string;
  description?: string;
  required?: boolean;
  isTitle?: boolean;
  ui?: any;
  [key: string]: any;
}

/**
 * Создает переводимое строковое поле
 * ТОЛЬКО эти поля будут переводиться автоматически
 */
export function translatableString(config: StringFieldConfig) {
  return {
    type: 'string' as const,
    ...config,
    translatable: true,
  };
}

/**
 * Создает переводимое rich-text поле
 */
export function translatableRichText(config: Omit<StringFieldConfig, 'type'>) {
  return {
    type: 'rich-text' as const,
    ...config,
    translatable: true,
  };
}

