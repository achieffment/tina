import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TranslateRequest {
  text: string;
  targetLocale: 'ru' | 'en';
  sourceLocale?: 'ru' | 'en';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { text, targetLocale, sourceLocale = 'ru' }: TranslateRequest = await request.json();

    console.log('[TRANSLATE] ==========================================');
    console.log('[TRANSLATE] Начало перевода текста');
    console.log('[TRANSLATE] Параметры:', {
      sourceLocale,
      targetLocale,
      textLength: text?.length || 0,
      timestamp: new Date().toISOString(),
    });

    if (!text || !targetLocale) {
      return NextResponse.json(
        { error: 'Text and targetLocale are required' },
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

    // Определяем язык перевода
    const targetLanguage = targetLocale === 'en' ? 'English' : 'Russian';
    const sourceLanguage = sourceLocale === 'en' ? 'English' : 'Russian';

    // Подготовка промпта
    const systemPrompt = `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve all formatting, line breaks, and special characters. Only return the translated text without any explanations or additional content.`;

    const model = 'gpt-4o-mini';
    const temperature = 0.3;

    console.log('[TRANSLATE:API] Подготовка запроса к OpenAI');
    console.log('[TRANSLATE:API] Модель:', model);
    console.log('[TRANSLATE:API] Temperature:', temperature);
    console.log('[TRANSLATE:API] Системный промпт:', systemPrompt);
    console.log('[TRANSLATE:API] Исходный текст (первые 200 символов):', 
      text.length > 200 ? text.substring(0, 200) + '...' : text
    );

    const apiStartTime = Date.now();

    // Вызов OpenAI API для перевода
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
        temperature,
      }),
    });

    const apiEndTime = Date.now();
    const apiDuration = apiEndTime - apiStartTime;

    console.log('[TRANSLATE:API] Ответ получен за', apiDuration, 'ms');

    if (!response.ok) {
      const error = await response.json();
      console.error('[TRANSLATE:API] Ошибка OpenAI API:', error);
      return NextResponse.json(
        { error: 'Translation failed', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content || '';

    console.log('[TRANSLATE:API] Переведенный текст (первые 200 символов):', 
      translatedText.length > 200 ? translatedText.substring(0, 200) + '...' : translatedText
    );
    
    if (data.usage) {
      console.log('[TRANSLATE:API] Использование токенов:', {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log('[TRANSLATE] Перевод завершен успешно за', totalDuration, 'ms');
    console.log('[TRANSLATE] ==========================================');

    return NextResponse.json({ translatedText });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[TRANSLATE] Ошибка перевода (после', totalDuration, 'ms):', error);
    console.error('[TRANSLATE] ==========================================');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

