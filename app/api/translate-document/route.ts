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

// Функция для перевода rich-text структуры
async function translateRichText(
  node: any,
  apiKey: string,
  targetLocale: LocaleCode,
  sourceLocale: LocaleCode,
  stats: TranslationStats,
  fieldPath: string = ''
): Promise<any> {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // Если это текстовый узел - переводим содержимое
  if (shouldTranslateRichTextNode(node)) {
    const translatedText = await translateText(node.text, apiKey, targetLocale, sourceLocale, stats, fieldPath + '.text');
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
        node.children.map((child: any, index: number) => 
          translateRichText(child, apiKey, targetLocale, sourceLocale, stats, fieldPath + `.children[${index}]`)
        )
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
  targetLocale: LocaleCode,
  sourceLocale: LocaleCode,
  stats: TranslationStats,
  fieldPath: string = ''
): Promise<string> {
  const targetLanguage = LOCALES[targetLocale]?.name || targetLocale;
  const sourceLanguage = LOCALES[sourceLocale]?.name || sourceLocale;

  const systemPrompt = `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve all formatting, markdown syntax, line breaks, and special characters. Only return the translated text without any explanations or additional content.`;

  console.log('[TRANSLATE:FIELD]', fieldPath || 'unknown', '- начало перевода');
  console.log('[TRANSLATE:FIELD] Текст (первые 100 символов):', 
    text.length > 100 ? text.substring(0, 100) + '...' : text
  );

  const apiStartTime = Date.now();

  try {
    stats.apiCallCount++;
    
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
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    const apiDuration = Date.now() - apiStartTime;

    if (response.ok) {
      const data = await response.json();
      const translatedText = data.choices[0]?.message?.content || text;
      
      if (data.usage) {
        stats.totalTokens += data.usage.total_tokens || 0;
        console.log('[TRANSLATE:API] Вызов #' + stats.apiCallCount, {
          field: fieldPath,
          duration: apiDuration + 'ms',
          tokens: data.usage.total_tokens,
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
        });
      }
      
      console.log('[TRANSLATE:FIELD]', fieldPath || 'unknown', '- перевод завершен за', apiDuration, 'ms');
      
      return translatedText;
    } else {
      console.error('[TRANSLATE:FIELD] Ошибка API для', fieldPath, '- статус:', response.status);
    }
  } catch (error) {
    console.error('[TRANSLATE:FIELD] Ошибка перевода поля', fieldPath, ':', error);
  }
  
  return text;
}

// Рекурсивная функция для перевода полей на основе схемы
async function translateFields(
  obj: any,
  schemaFields: TinaField[],
  apiKey: string,
  targetLocale: LocaleCode,
  sourceLocale: LocaleCode,
  stats: TranslationStats,
  autoTranslatedFields: string[] = [],
  fieldPath: string = ''
): Promise<{ translated: any; autoTranslatedFields: string[] }> {
  if (typeof obj !== 'object' || obj === null) {
    return { translated: obj, autoTranslatedFields };
  }

  if (Array.isArray(obj)) {
    // Для массивов обрабатываем каждый элемент
    const translatedArray = [];
    for (let i = 0; i < obj.length; i++) {
      const result = await translateFields(
        obj[i], 
        schemaFields, 
        apiKey, 
        targetLocale, 
        sourceLocale, 
        stats,
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
      console.log('[TRANSLATE:FIELD] Обработка rich-text поля:', currentPath);
      if (isRichTextNode(value)) {
        // Структурированный rich-text узел
        translatedObj[key] = await translateRichText(value, apiKey, targetLocale, sourceLocale, stats, currentPath);
        fieldsToTrack.push(key);
        stats.fieldsTranslated++;
      } else if (typeof value === 'string' && value.trim()) {
        // Rich-text как markdown строка
        translatedObj[key] = await translateText(value, apiKey, targetLocale, sourceLocale, stats, currentPath);
        fieldsToTrack.push(key);
        stats.fieldsTranslated++;
      } else {
        translatedObj[key] = value;
      }
      continue;
    }

    // Обработка строковых полей
    if (typeof value === 'string' && value.trim()) {
      if (shouldTranslateFieldDef(fieldDef)) {
        console.log('[TRANSLATE:FIELD] Обработка текстового поля:', currentPath, '(тип:', fieldDef?.type || 'unknown', ')');
        translatedObj[key] = await translateText(value, apiKey, targetLocale, sourceLocale, stats, currentPath);
        fieldsToTrack.push(key);
        stats.fieldsTranslated++;
      } else {
        translatedObj[key] = value;
      }
      continue;
    }

    // Обработка объектов и массивов
    if (typeof value === 'object' && value !== null) {
      // Если это поле с templates (блоки)
      if (fieldDef && fieldDef.templates && Array.isArray(value)) {
        console.log('[TRANSLATE:FIELD] Обработка блоков:', currentPath, '(количество блоков:', value.length, ')');
        const translatedBlocks = [];
        for (let i = 0; i < value.length; i++) {
          const block = value[i];
          if (block && typeof block === 'object' && block._template) {
            console.log('[TRANSLATE:FIELD] Блок', i + 1, 'шаблон:', block._template);
            // Находим схему шаблона
            const template = findTemplate(fieldDef.templates, block._template);
            if (template) {
              const result = await translateFields(
                block,
                template.fields,
                apiKey,
                targetLocale,
                sourceLocale,
                stats,
                [],
                `${currentPath}[${i}]`
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
          for (let i = 0; i < value.length; i++) {
            const result = await translateFields(
              value[i],
              fieldDef.fields,
              apiKey,
              targetLocale,
              sourceLocale,
              stats,
              [],
              `${currentPath}[${i}]`
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
            stats,
            [],
            currentPath
          );
          translatedObj[key] = result.translated;
        }
        continue;
      }

      // Если определение не найдено, но это объект - пробуем обработать как есть
      if (isRichTextNode(value)) {
        translatedObj[key] = await translateRichText(value, apiKey, targetLocale, sourceLocale, stats, currentPath);
      } else {
        const result = await translateFields(value, [], apiKey, targetLocale, sourceLocale, stats, [], currentPath);
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

    // Инициализируем статистику
    const stats: TranslationStats = {
      apiCallCount: 0,
      fieldsTranslated: 0,
      totalTokens: 0,
    };

    console.log('[TRANSLATE] Начало обработки полей документа');

    // Переводим документ с использованием схемы
    const result = await translateFields(
      document,
      collectionSchema.fields,
      apiKey,
      targetLocale,
      sourceLocale,
      stats
    );

    const totalDuration = Date.now() - startTime;

    console.log('[TRANSLATE] ==========================================');
    console.log('[TRANSLATE] Перевод документа завершен успешно');
    console.log('[TRANSLATE] Статистика:', {
      duration: totalDuration + 'ms',
      fieldsTranslated: stats.fieldsTranslated,
      apiCalls: stats.apiCallCount,
      totalTokens: stats.totalTokens,
      avgTimePerField: stats.fieldsTranslated > 0 
        ? Math.round(totalDuration / stats.fieldsTranslated) + 'ms' 
        : 'N/A',
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

