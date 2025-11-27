import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import matter from 'gray-matter';

export const dynamic = 'force-dynamic';

interface CreateFileRequest {
  relativePath: string; // "en/home.mdx"
  collection: string; // "page", "post", "service"
  document: any;
}

// Функции конвертации rich-text больше не нужны - GPT уже вернул готовый Markdown

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { relativePath, collection, document }: CreateFileRequest = await request.json();

    console.log('[TRANSLATE:FILE] ==========================================');
    console.log('[TRANSLATE:FILE] Начало создания файла');
    console.log('[TRANSLATE:FILE] Параметры:', {
      relativePath,
      collection,
      timestamp: new Date().toISOString(),
    });

    if (!relativePath || !collection || !document) {
      return NextResponse.json(
        { error: 'relativePath, collection, and document are required' },
        { status: 400 }
      );
    }

    // Определяем папку коллекции
    const collectionFolderMap: Record<string, string> = {
      'page': 'pages',
      'post': 'posts',
      'service': 'services',
    };

    const collectionFolder = collectionFolderMap[collection];
    if (!collectionFolder) {
      return NextResponse.json(
        { error: `Unknown collection: ${collection}` },
        { status: 400 }
      );
    }

    // Формируем полный путь к файлу
    const contentPath = join(process.cwd(), 'content', collectionFolder, relativePath);
    console.log('[TRANSLATE:FILE] Целевой путь:', contentPath);

    // Проверяем, не существует ли файл
    if (existsSync(contentPath)) {
      console.log('[TRANSLATE:FILE] Файл уже существует');
      return NextResponse.json(
        { error: 'File already exists', path: contentPath },
        { status: 409 }
      );
    }

    // Создаём директорию, если её нет
    const dir = dirname(contentPath);
    if (!existsSync(dir)) {
      console.log('[TRANSLATE:FILE] Создание директории:', dir);
      mkdirSync(dir, { recursive: true });
    }

    // Документ уже содержит готовые Markdown строки от GPT, обработка не нужна
    console.log('[TRANSLATE:FILE] Подготовка документа к записи');

    // Разделяем body и frontmatter
    const { _body, ...frontmatter } = document;

    // Удаляем служебные поля из frontmatter
    delete frontmatter._collection;
    delete frontmatter._template;

    // Формируем содержимое MDX файла
    const fileContent = matter.stringify(_body || '', frontmatter);
    const fileSize = Buffer.byteLength(fileContent, 'utf-8');

    console.log('[TRANSLATE:FILE] Размер файла:', fileSize, 'байт');

    // Записываем файл
    writeFileSync(contentPath, fileContent, 'utf-8');

    const totalDuration = Date.now() - startTime;

    console.log('[TRANSLATE:FILE] Файл успешно создан за', totalDuration, 'ms');
    console.log('[TRANSLATE:FILE] ==========================================');

    return NextResponse.json({
      success: true,
      path: contentPath,
      relativePath,
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[TRANSLATE:FILE] Ошибка создания файла (после', totalDuration, 'ms):', error);
    console.error('[TRANSLATE:FILE] ==========================================');
    return NextResponse.json(
      { 
        error: 'Failed to create file', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

