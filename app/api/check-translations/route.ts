import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';
import { ALL_LOCALE_CODES, type LocaleCode } from '@/lib/locales';

export const dynamic = 'force-dynamic';

interface CheckTranslationsRequest {
  collection: string;
  relativePath: string; // путь с локалью, например "en/home.mdx"
}

interface BatchCheckTranslationsRequest {
  items: Array<{
    collection: string;
    relativePath: string;
  }>;
}

interface TranslationInfo {
  locale: string;
  path: string;
  exists: boolean;
}

interface BatchTranslationResult {
  relativePath: string;
  currentLocale: string;
  filePathWithoutLocale: string;
  translations: TranslationInfo[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Проверяем, это батч-запрос или обычный
    if ('items' in body) {
      return handleBatchRequest(body as BatchCheckTranslationsRequest);
    }
    
    const { collection, relativePath } = body as CheckTranslationsRequest;

    if (!collection || !relativePath) {
      return NextResponse.json(
        { error: 'Collection and relativePath are required' },
        { status: 400 }
      );
    }

    // Извлекаем текущую локаль и путь файла без локали
    // relativePath может быть "en/home.mdx" или "en/posts/my-post.mdx"
    const pathParts = relativePath.split('/');
    const currentLocale = pathParts[0];
    const filePathWithoutLocale = pathParts.slice(1).join('/'); // "home.mdx" или "posts/my-post.mdx"

    if (!filePathWithoutLocale) {
      return NextResponse.json(
        { error: 'Invalid relativePath format' },
        { status: 400 }
      );
    }

    // Формируем коллекцию во множественном числе
    const collectionMap: Record<string, string> = {
      'page': 'pages',
      'post': 'posts',
      'service': 'services'
    };

    const collectionPlural = collectionMap[collection];
    if (!collectionPlural) {
      return NextResponse.json(
        { error: `Unknown collection: ${collection}` },
        { status: 400 }
      );
    }

    // Проверяем существование файлов для каждого языка
    const translations: TranslationInfo[] = [];
    const contentDir = path.join(process.cwd(), 'content');

    for (const localeCode of ALL_LOCALE_CODES) {
      const localePath = `${localeCode}/${filePathWithoutLocale}`;
      const fullPath = path.join(contentDir, collectionPlural, localePath);
      const exists = existsSync(fullPath);

      if (exists) {
        translations.push({
          locale: localeCode,
          path: localePath,
          exists: true,
        });
      }
    }

    return NextResponse.json({
      currentLocale,
      filePathWithoutLocale,
      translations,
    });
  } catch (error) {
    console.error('Check translations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Обработчик батч-запросов
async function handleBatchRequest(request: BatchCheckTranslationsRequest) {
  try {
    if (!request.items || !Array.isArray(request.items)) {
      return NextResponse.json(
        { error: 'Items array is required' },
        { status: 400 }
      );
    }

    const results: BatchTranslationResult[] = [];
    const contentDir = path.join(process.cwd(), 'content');

    // Формируем коллекцию во множественном числе
    const collectionMap: Record<string, string> = {
      'page': 'pages',
      'post': 'posts',
      'service': 'services'
    };

    for (const item of request.items) {
      const { collection, relativePath } = item;

      if (!collection || !relativePath) {
        continue; // пропускаем невалидные элементы
      }

      // Извлекаем текущую локаль и путь файла без локали
      const pathParts = relativePath.split('/');
      const currentLocale = pathParts[0];
      const filePathWithoutLocale = pathParts.slice(1).join('/');

      if (!filePathWithoutLocale) {
        continue;
      }

      const collectionPlural = collectionMap[collection];
      if (!collectionPlural) {
        continue;
      }

      // Проверяем существование файлов для каждого языка
      const translations: TranslationInfo[] = [];

      for (const localeCode of ALL_LOCALE_CODES) {
        const localePath = `${localeCode}/${filePathWithoutLocale}`;
        const fullPath = path.join(contentDir, collectionPlural, localePath);
        const exists = existsSync(fullPath);

        if (exists) {
          translations.push({
            locale: localeCode,
            path: localePath,
            exists: true,
          });
        }
      }

      results.push({
        relativePath,
        currentLocale,
        filePathWithoutLocale,
        translations,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch check translations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

