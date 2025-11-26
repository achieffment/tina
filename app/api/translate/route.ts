import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface TranslateRequest {
  text: string;
  targetLocale: 'ru' | 'en';
  sourceLocale?: 'ru' | 'en';
}

export async function POST(request: NextRequest) {
  try {
    const { text, targetLocale, sourceLocale = 'ru' }: TranslateRequest = await request.json();

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

    // Вызов OpenAI API для перевода
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
            content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve all formatting, line breaks, and special characters. Only return the translated text without any explanations or additional content.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Translation failed', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content || '';

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

