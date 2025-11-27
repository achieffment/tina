import { NextRequest, NextResponse } from 'next/server';
import { 
  getCollectionSchema,
  shouldTranslateFieldDef,
  findFieldDef,
  findTemplate,
  isRichTextNode, 
  shouldTranslateRichTextNode,
  type TinaField,
  type TinaTemplate
} from './schema-analyzer';
import { LOCALES, type LocaleCode } from '@/lib/locales';

export const dynamic = 'force-dynamic';

interface TranslateDocumentRequest {
  document: any;
  targetLocale: LocaleCode;
  sourceLocale?: LocaleCode;
  collection: string;
}

// Статистика перевода
interface TranslationStats {
  apiCallCount: number;
  fieldsTranslated: number;
  totalTokens: number;
}

// Интерфейс для собранных текстов
interface CollectedText {
  path: string;
  text: string;
  index: number;
}

// Функция для генерации JSON Schema для Structured Outputs
function generateTranslationSchema(textCount: number) {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  for (let i = 0; i < textCount; i++) {
    const key = i.toString();
    properties[key] = {
      type: "string",
      description: `Translation of text at index ${i}`
    };
    required.push(key);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

// НОВЫЙ ПОДХОД: Батчинг переводов
// Функция для сбора всех текстов для перевода
function collectTextsForTranslation(
  obj: any,
  schemaFields: TinaField[],
  collected: CollectedText[] = [],
  fieldPath: string = ''
): CollectedText[] {
  if (typeof obj !== 'object' || obj === null) {
    return collected;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      collectTextsForTranslation(obj[i], schemaFields, collected, `${fieldPath}[${i}]`);
    }
    return collected;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = fieldPath ? `${fieldPath}.${key}` : key;
    
    // Пропускаем служебные поля
    if (key === '_collection' || key === 'id' || key === '_template' || 
        key === '_autoTranslatedFields' || (key.startsWith('_') && key !== '_body')) {
      continue;
    }

    const fieldDef = findFieldDef(schemaFields, key);

    // Обработка rich-text полей
    if (fieldDef && fieldDef.type === 'rich-text') {
      if (isRichTextNode(value)) {
        // Собираем тексты из rich-text узлов
        collectRichTextNodes(value, collected, currentPath);
      } else if (typeof value === 'string' && value.trim()) {
        collected.push({
          path: currentPath,
          text: value,
          index: collected.length
        });
      }
      continue;
    }

    // Обработка строковых полей
    if (typeof value === 'string' && value.trim()) {
      if (shouldTranslateFieldDef(fieldDef)) {
        collected.push({
          path: currentPath,
          text: value,
          index: collected.length
        });
      }
      continue;
    }

    // Обработка объектов и массивов
    if (typeof value === 'object' && value !== null) {
      // Если это поле с templates (блоки)
      if (fieldDef && fieldDef.templates && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const block = value[i];
          if (block && typeof block === 'object' && block._template) {
            const template = findTemplate(fieldDef.templates, block._template);
            if (template) {
              collectTextsForTranslation(block, template.fields, collected, `${currentPath}[${i}]`);
            }
          }
        }
        continue;
      }

      // Если это объект с вложенными полями
      if (fieldDef && fieldDef.fields) {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            collectTextsForTranslation(value[i], fieldDef.fields, collected, `${currentPath}[${i}]`);
          }
        } else {
          collectTextsForTranslation(value, fieldDef.fields, collected, currentPath);
        }
        continue;
      }

      // Если определение не найдено, но это rich-text узел
      if (isRichTextNode(value)) {
        collectRichTextNodes(value, collected, currentPath);
      } else {
        collectTextsForTranslation(value, [], collected, currentPath);
      }
    }
  }

  return collected;
}

// Вспомогательная функция для сбора текстов из rich-text узлов
function collectRichTextNodes(
  node: any,
  collected: CollectedText[],
  fieldPath: string
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Если это текстовый узел с переводимым текстом
  if (shouldTranslateRichTextNode(node) && node.text && node.text.trim()) {
    collected.push({
      path: `${fieldPath}.text`,
      text: node.text,
      index: collected.length
    });
  }

  // Рекурсивно обрабатываем children
  if (Array.isArray(node.children)) {
    node.children.forEach((child: any, index: number) => {
      collectRichTextNodes(child, collected, `${fieldPath}.children[${index}]`);
    });
  }
}

// Функция для батч-перевода всех текстов одним запросом
async function batchTranslateTexts(
  texts: CollectedText[],
  apiKey: string,
  targetLocale: LocaleCode,
  sourceLocale: LocaleCode
): Promise<Map<string, string>> {
  const targetLanguage = LOCALES[targetLocale]?.name || targetLocale;
  const sourceLanguage = LOCALES[sourceLocale]?.name || sourceLocale;

  console.log('[TRANSLATE:BATCH] Начало батч-перевода');
  console.log('[TRANSLATE:BATCH] Количество текстов:', texts.length);

  // Создаем объект для отправки в OpenAI
  const textsToTranslate: Record<string, string> = {};
  texts.forEach((item) => {
    textsToTranslate[item.index.toString()] = item.text;
  });

  // Подсчитываем примерное количество токенов (грубая оценка: ~4 символа = 1 токен)
  const totalChars = texts.reduce((sum, item) => sum + item.text.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  console.log('[TRANSLATE:BATCH] Примерное количество токенов:', estimatedTokens);

  // Упрощенный системный промпт - схема сама обеспечивает структуру
  const systemPrompt = `You are a professional translator. Translate each value in the JSON object from ${sourceLanguage} to ${targetLanguage}. Preserve all formatting, markdown syntax, line breaks, and special characters.`;

  console.log('[TRANSLATE:BATCH] Системный промпт:', systemPrompt);
  console.log('[TRANSLATE:BATCH] Использование: Structured Outputs (JSON Schema)');
  console.log('[TRANSLATE:BATCH] Схема:', texts.length, 'полей с strict mode');
  
  // Генерируем JSON Schema для Structured Outputs
  const translationSchema = generateTranslationSchema(texts.length);
  
  const apiStartTime = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: JSON.stringify(textsToTranslate, null, 2),
          },
        ],
        temperature: 0.3,
        response_format: { 
          type: "json_schema",
          json_schema: {
            name: "translation_batch_response",
            strict: true,
            schema: translationSchema
          }
        }
      }),
    });

    const apiDuration = Date.now() - apiStartTime;

    if (!response.ok) {
      const error = await response.json();
      console.error('[TRANSLATE:BATCH] Ошибка API:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedContent = data.choices[0]?.message?.content || '{}';
    
    console.log('[TRANSLATE:BATCH] Ответ получен за', apiDuration, 'ms');
    
    if (data.usage) {
      console.log('[TRANSLATE:BATCH] Использование токенов:', {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      });
    }

    // Парсим JSON ответ - Structured Outputs гарантирует корректный JSON
    const translatedTexts: Record<string, string> = JSON.parse(translatedContent);

    // Создаем карту переводов по путям
    // Structured Outputs гарантирует наличие всех ключей, проверка на undefined не нужна
    const translationMap = new Map<string, string>();
    texts.forEach((item) => {
      const translated = translatedTexts[item.index.toString()];
      translationMap.set(item.path, translated);
    });

    console.log('[TRANSLATE:BATCH] Успешно переведено:', translationMap.size, 'текстов');
    
    return translationMap;

  } catch (error) {
    const apiDuration = Date.now() - apiStartTime;
    console.error('[TRANSLATE:BATCH] Ошибка батч-перевода после', apiDuration, 'ms:', error);
    throw error;
  }
}

// Функция для применения переводов к документу
function applyTranslations(
  obj: any,
  translations: Map<string, string>,
  schemaFields: TinaField[],
  autoTranslatedFields: string[] = [],
  fieldPath: string = ''
): { translated: any; autoTranslatedFields: string[] } {
  if (typeof obj !== 'object' || obj === null) {
    return { translated: obj, autoTranslatedFields };
  }

  if (Array.isArray(obj)) {
    const translatedArray = [];
    for (let i = 0; i < obj.length; i++) {
      const result = applyTranslations(
        obj[i],
        translations,
        schemaFields,
        [],
        `${fieldPath}[${i}]`
      );
      translatedArray.push(result.translated);
    }
    return { translated: translatedArray, autoTranslatedFields };
  }

  const translatedObj: any = {};
  const fieldsToTrack: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = fieldPath ? `${fieldPath}.${key}` : key;

    // Пропускаем служебные поля GraphQL
    if (key === '_collection' || key === 'id') {
      continue;
    }

    // Сохраняем _template
    if (key === '_template') {
      translatedObj[key] = value;
      continue;
    }

    // Сохраняем _autoTranslatedFields
    if (key === '_autoTranslatedFields') {
      translatedObj[key] = value;
      continue;
    }

    // Пропускаем другие служебные поля
    if (key.startsWith('_') && key !== '_body') {
      continue;
    }

    const fieldDef = findFieldDef(schemaFields, key);

    // Обработка rich-text полей
    if (fieldDef && fieldDef.type === 'rich-text') {
      if (isRichTextNode(value)) {
        // Применяем переводы к rich-text узлам
        translatedObj[key] = applyTranslationsToRichText(value, translations, currentPath);
        fieldsToTrack.push(key);
      } else if (typeof value === 'string' && value.trim()) {
        // Применяем перевод к markdown строке
        const translated = translations.get(currentPath);
        translatedObj[key] = translated || value;
        if (translated) {
          fieldsToTrack.push(key);
        }
      } else {
        translatedObj[key] = value;
      }
      continue;
    }

    // Обработка строковых полей
    if (typeof value === 'string' && value.trim()) {
      if (shouldTranslateFieldDef(fieldDef)) {
        const translated = translations.get(currentPath);
        translatedObj[key] = translated || value;
        if (translated) {
          fieldsToTrack.push(key);
        }
      } else {
        translatedObj[key] = value;
      }
      continue;
    }

    // Обработка объектов и массивов
    if (typeof value === 'object' && value !== null) {
      // Если это поле с templates (блоки)
      if (fieldDef && fieldDef.templates && Array.isArray(value)) {
        const translatedBlocks = [];
        for (let i = 0; i < value.length; i++) {
          const block = value[i];
          if (block && typeof block === 'object' && block._template) {
            const template = findTemplate(fieldDef.templates, block._template);
            if (template) {
              const result = applyTranslations(
                block,
                translations,
                template.fields,
                [],
                `${currentPath}[${i}]`
              );
              translatedBlocks.push({
                ...result.translated,
                _autoTranslatedFields: result.autoTranslatedFields,
              });
            } else {
              translatedBlocks.push(block);
            }
          } else {
            translatedBlocks.push(block);
          }
        }
        translatedObj[key] = translatedBlocks;
        continue;
      }

      // Если это объект с вложенными полями
      if (fieldDef && fieldDef.fields) {
        if (Array.isArray(value)) {
          const translatedArray = [];
          for (let i = 0; i < value.length; i++) {
            const result = applyTranslations(
              value[i],
              translations,
              fieldDef.fields,
              [],
              `${currentPath}[${i}]`
            );
            translatedArray.push(result.translated);
          }
          translatedObj[key] = translatedArray;
        } else {
          const result = applyTranslations(
            value,
            translations,
            fieldDef.fields,
            [],
            currentPath
          );
          translatedObj[key] = result.translated;
        }
        continue;
      }

      // Если определение не найдено, но это rich-text узел
      if (isRichTextNode(value)) {
        translatedObj[key] = applyTranslationsToRichText(value, translations, currentPath);
      } else {
        const result = applyTranslations(value, translations, [], [], currentPath);
        translatedObj[key] = result.translated;
      }
      continue;
    }

    // Остальные типы копируем как есть
    translatedObj[key] = value;
  }

  return {
    translated: translatedObj,
    autoTranslatedFields: fieldsToTrack,
  };
}

// Вспомогательная функция для применения переводов к rich-text узлам
function applyTranslationsToRichText(
  node: any,
  translations: Map<string, string>,
  fieldPath: string
): any {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // Если это текстовый узел с переводом
  if (shouldTranslateRichTextNode(node) && node.text) {
    const textPath = `${fieldPath}.text`;
    const translated = translations.get(textPath);
    return {
      ...node,
      text: translated || node.text,
    };
  }

  // Рекурсивно обрабатываем children
  if (Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map((child: any, index: number) =>
        applyTranslationsToRichText(child, translations, `${fieldPath}.children[${index}]`)
      ),
    };
  }

  return node;
}

// СТАРЫЕ ФУНКЦИИ УДАЛЕНЫ - используется новый батчинг подход
// Старые функции: translateText, translateRichText, translateFields

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { document, targetLocale, sourceLocale = 'en', collection }: TranslateDocumentRequest = await request.json();

    console.log('[TRANSLATE] ==========================================');
    console.log('[TRANSLATE] Начало перевода документа');
    console.log('[TRANSLATE] Параметры:', {
      collection,
      sourceLocale,
      targetLocale,
      timestamp: new Date().toISOString(),
    });

    if (!document || !targetLocale || !collection) {
      return NextResponse.json(
        { error: 'Document, targetLocale, and collection are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Получаем схему коллекции
    const collectionSchema = getCollectionSchema(collection);
    if (!collectionSchema) {
      return NextResponse.json(
        { error: `Collection schema not found: ${collection}` },
        { status: 400 }
      );
    }

    console.log('[TRANSLATE] Схема коллекции загружена:', {
      collection,
      fieldsCount: collectionSchema.fields.length,
    });

    // НОВЫЙ ПОДХОД: Батчинг
    // Шаг 1: Собираем все тексты для перевода
    const collectStartTime = Date.now();
    console.log('[TRANSLATE] Шаг 1: Сбор текстов для перевода');
    
    const textsToTranslate = collectTextsForTranslation(
      document,
      collectionSchema.fields
    );
    
    const collectDuration = Date.now() - collectStartTime;
    console.log('[TRANSLATE] Собрано текстов:', textsToTranslate.length, 'за', collectDuration, 'ms');
    
    if (textsToTranslate.length > 0) {
      console.log('[TRANSLATE] Примеры путей:', textsToTranslate.slice(0, 5).map(t => t.path));
    }

    // Шаг 2: Батч-перевод всех текстов одним запросом
    let translations: Map<string, string>;
    
    if (textsToTranslate.length === 0) {
      console.log('[TRANSLATE] Нет текстов для перевода');
      translations = new Map();
    } else {
      console.log('[TRANSLATE] Шаг 2: Батч-перевод всех текстов');
      translations = await batchTranslateTexts(
        textsToTranslate,
        apiKey,
        targetLocale,
        sourceLocale
      );
    }

    // Шаг 3: Применяем переводы к документу
    const applyStartTime = Date.now();
    console.log('[TRANSLATE] Шаг 3: Применение переводов к документу');
    
    const result = applyTranslations(
      document,
      translations,
      collectionSchema.fields
    );
    
    const applyDuration = Date.now() - applyStartTime;
    console.log('[TRANSLATE] Переводы применены за', applyDuration, 'ms');

    const totalDuration = Date.now() - startTime;

    console.log('[TRANSLATE] ==========================================');
    console.log('[TRANSLATE] Перевод документа завершен успешно (БАТЧИНГ)');
    console.log('[TRANSLATE] Статистика:', {
      totalDuration: totalDuration + 'ms',
      textsCollected: textsToTranslate.length,
      textsTranslated: translations.size,
      collectTime: collectDuration + 'ms',
      translateTime: '~' + (totalDuration - collectDuration - applyDuration) + 'ms',
      applyTime: applyDuration + 'ms',
      apiCalls: 1,
      improvement: textsToTranslate.length > 0 
        ? `${textsToTranslate.length} вызовов → 1 вызов (экономия ~${Math.round((textsToTranslate.length - 1) * 800)}ms)` 
        : 'N/A'
    });
    console.log('[TRANSLATE] ==========================================');

    return NextResponse.json({
      translatedDocument: result.translated,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[TRANSLATE] Ошибка перевода документа (после', totalDuration, 'ms):', error);
    console.error('[TRANSLATE] ==========================================');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

