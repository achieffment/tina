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

export async function POST(request: NextRequest) {
  try {
    const { relativePath, collection, document }: CreateFileRequest = await request.json();

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

    // Проверяем, не существует ли файл
    if (existsSync(contentPath)) {
      return NextResponse.json(
        { error: 'File already exists', path: contentPath },
        { status: 409 }
      );
    }

    // Создаём директорию, если её нет
    const dir = dirname(contentPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Разделяем body и frontmatter
    const { _body, ...frontmatter } = document;

    // Удаляем служебные поля из frontmatter
    delete frontmatter._collection;
    delete frontmatter._template;

    // Формируем содержимое MDX файла
    const fileContent = matter.stringify(_body || '', frontmatter);

    // Записываем файл
    writeFileSync(contentPath, fileContent, 'utf-8');

    return NextResponse.json({
      success: true,
      path: contentPath,
      relativePath,
    });

  } catch (error) {
    console.error('File creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create file', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

