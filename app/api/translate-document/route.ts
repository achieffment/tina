import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TranslateDocumentRequest {
  document: any;
  targetLocale: 'ru' | 'en';
  sourceLocale?: 'ru' | 'en';
  collection: string;
}

// Рекурсивная функция для перевода всех строковых полей в объекте
async function translateFields(
  obj: any,
  apiKey: string,
  targetLocale: 'ru' | 'en',
  sourceLocale: 'ru' | 'en',
  autoTranslatedFields: string[] = []
): Promise<{ translated: any; autoTranslatedFields: string[] }> {
  if (typeof obj !== 'object' || obj === null) {
    return { translated: obj, autoTranslatedFields };
  }

  if (Array.isArray(obj)) {
    const translatedArray = [];
    for (const item of obj) {
      const result = await translateFields(item, apiKey, targetLocale, sourceLocale, []);
      translatedArray.push(result.translated);
    }
    return { translated: translatedArray, autoTranslatedFields };
  }

  const translatedObj: any = {};
  const fieldsToTrack: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    // Пропускаем служебные поля
    if (key.startsWith('_') || key === 'id') {
      translatedObj[key] = value;
      continue;
    }

    // Если это строка, переводим
    if (typeof value === 'string' && value.trim()) {
      try {
        const targetLanguage = targetLocale === 'en' ? 'English' : 'Russian';
        const sourceLanguage = sourceLocale === 'en' ? 'English' : 'Russian';

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
                content: value,
              },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          translatedObj[key] = data.choices[0]?.message?.content || value;
          fieldsToTrack.push(key);
        } else {
          translatedObj[key] = value;
        }
      } catch (error) {
        console.error(`Error translating field ${key}:`, error);
        translatedObj[key] = value;
      }
    }
    // Если это объект или массив, рекурсивно обрабатываем
    else if (typeof value === 'object' && value !== null) {
      const result = await translateFields(value, apiKey, targetLocale, sourceLocale, []);
      translatedObj[key] = result.translated;
      
      // Для блоков добавляем _autoTranslatedFields
      if (key === 'blocks' && Array.isArray(result.translated)) {
        translatedObj[key] = result.translated.map((block: any) => {
          if (block._autoTranslatedFields && block._autoTranslatedFields.length > 0) {
            return block;
          }
          // Определяем переведённые поля в блоке
          const blockFields: string[] = [];
          for (const blockKey of Object.keys(block)) {
            if (typeof block[blockKey] === 'string' && !blockKey.startsWith('_')) {
              blockFields.push(blockKey);
            }
          }
          return {
            ...block,
            _autoTranslatedFields: blockFields,
          };
        });
      }
    } else {
      translatedObj[key] = value;
    }
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

    // Переводим документ
    const result = await translateFields(document, apiKey, targetLocale, sourceLocale);

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

