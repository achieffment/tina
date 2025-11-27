import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';
import { ALL_LOCALE_CODES, type LocaleCode } from '@/lib/locales';

export const dynamic = 'force-dynamic';

interface CheckTranslationsRequest {
  collection: string;
  relativePath: string; // путь с локалью, например "en/home.mdx"
}

interface TranslationInfo {
  locale: string;
  path: string;
  exists: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { collection, relativePath }: CheckTranslationsRequest = await request.json();

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

