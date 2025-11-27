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

export const dynamic = 'force-dynamic';

interface TranslateDocumentRequest {
  document: any;
  targetLocale: 'ru' | 'en';
  sourceLocale?: 'ru' | 'en';
  collection: string;
}

// Функция для перевода rich-text структуры
async function translateRichText(
  node: any,
  apiKey: string,
  targetLocale: 'ru' | 'en',
  sourceLocale: 'ru' | 'en'
): Promise<any> {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // Если это текстовый узел - переводим содержимое
  if (shouldTranslateRichTextNode(node)) {
    const translatedText = await translateText(node.text, apiKey, targetLocale, sourceLocale);
    return {
      ...node,
      text: translatedText,
    };
  }

  // Если есть children - рекурсивно обрабатываем
  if (Array.isArray(node.children)) {
    return {
      ...node,
      children: await Promise.all(
        node.children.map((child: any) => translateRichText(child, apiKey, targetLocale, sourceLocale))
      ),
    };
  }

  // Возвращаем узел без изменений (type, url, title и т.д. не переводим)
  return node;
}

// Вспомогательная функция для перевода текста через OpenAI
async function translateText(
  text: string,
  apiKey: string,
  targetLocale: 'ru' | 'en',
  sourceLocale: 'ru' | 'en'
): Promise<string> {
  const targetLanguage = targetLocale === 'en' ? 'English' : 'Russian';
  const sourceLanguage = sourceLocale === 'en' ? 'English' : 'Russian';

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
            content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve all formatting, markdown syntax, line breaks, and special characters. Only return the translated text without any explanations or additional content.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || text;
    }
  } catch (error) {
    console.error('Error translating text:', error);
  }
  
  return text;
}

// Рекурсивная функция для перевода полей на основе схемы
async function translateFields(
  obj: any,
  schemaFields: TinaField[],
  apiKey: string,
  targetLocale: 'ru' | 'en',
  sourceLocale: 'ru' | 'en',
  autoTranslatedFields: string[] = []
): Promise<{ translated: any; autoTranslatedFields: string[] }> {
  if (typeof obj !== 'object' || obj === null) {
    return { translated: obj, autoTranslatedFields };
  }

  if (Array.isArray(obj)) {
    // Для массивов обрабатываем каждый элемент
    const translatedArray = [];
    for (const item of obj) {
      const result = await translateFields(item, schemaFields, apiKey, targetLocale, sourceLocale, []);
      translatedArray.push(result.translated);
    }
    return { translated: translatedArray, autoTranslatedFields };
  }

  const translatedObj: any = {};
  const fieldsToTrack: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    // Пропускаем служебные поля GraphQL
    if (key === '_collection' || key === 'id') {
      continue;
    }

    // Сохраняем _template (нужен для определения схемы блоков)
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

    // Находим определение поля в схеме
    const fieldDef = findFieldDef(schemaFields, key);

    // Обработка rich-text полей
    if (fieldDef && fieldDef.type === 'rich-text') {
      if (isRichTextNode(value)) {
        // Структурированный rich-text узел
        translatedObj[key] = await translateRichText(value, apiKey, targetLocale, sourceLocale);
        fieldsToTrack.push(key);
      } else if (typeof value === 'string' && value.trim()) {
        // Rich-text как markdown строка
        translatedObj[key] = await translateText(value, apiKey, targetLocale, sourceLocale);
        fieldsToTrack.push(key);
      } else {
        translatedObj[key] = value;
      }
      continue;
    }

    // Обработка строковых полей
    if (typeof value === 'string' && value.trim()) {
      if (shouldTranslateFieldDef(fieldDef)) {
        translatedObj[key] = await translateText(value, apiKey, targetLocale, sourceLocale);
        fieldsToTrack.push(key);
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
        for (const block of value) {
          if (block && typeof block === 'object' && block._template) {
            // Находим схему шаблона
            const template = findTemplate(fieldDef.templates, block._template);
            if (template) {
              const result = await translateFields(
                block,
                template.fields,
                apiKey,
                targetLocale,
                sourceLocale,
                []
              );
              
              // Добавляем _autoTranslatedFields для блока
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
          // Массив объектов
          const translatedArray = [];
          for (const item of value) {
            const result = await translateFields(
              item,
              fieldDef.fields,
              apiKey,
              targetLocale,
              sourceLocale,
              []
            );
            translatedArray.push(result.translated);
          }
          translatedObj[key] = translatedArray;
        } else {
          // Одиночный объект
          const result = await translateFields(
            value,
            fieldDef.fields,
            apiKey,
            targetLocale,
            sourceLocale,
            []
          );
          translatedObj[key] = result.translated;
        }
        continue;
      }

      // Если определение не найдено, но это объект - пробуем обработать как есть
      if (isRichTextNode(value)) {
        translatedObj[key] = await translateRichText(value, apiKey, targetLocale, sourceLocale);
      } else {
        const result = await translateFields(value, [], apiKey, targetLocale, sourceLocale, []);
        translatedObj[key] = result.translated;
      }
      continue;
    }

    // Остальные типы (number, boolean, null) копируем как есть
    translatedObj[key] = value;
  }

  return {
    translated: translatedObj,
    autoTranslatedFields: fieldsToTrack,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { document, targetLocale, sourceLocale = 'ru', collection }: TranslateDocumentRequest = await request.json();

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

    // Переводим документ с использованием схемы
    const result = await translateFields(
      document,
      collectionSchema.fields,
      apiKey,
      targetLocale,
      sourceLocale
    );

    return NextResponse.json({
      translatedDocument: result.translated,
    });
  } catch (error) {
    console.error('Document translation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

