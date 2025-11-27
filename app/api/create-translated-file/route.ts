import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import matter from 'gray-matter';
import { getCollectionSchema, type TinaField, type TinaTemplate } from '../translate-document/schema-analyzer';

export const dynamic = 'force-dynamic';

interface CreateFileRequest {
  relativePath: string; // "en/home.mdx"
  collection: string; // "page", "post", "service"
  document: any;
}

/**
 * Конвертирует rich-text узел TinaCMS в markdown-строку
 */
function richTextToMarkdown(node: any): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  // Текстовый узел
  if (node.type === 'text') {
    return node.text || '';
  }

  // Узел со ссылкой
  if (node.type === 'a') {
    const linkText = node.children 
      ? node.children.map((child: any) => richTextToMarkdown(child)).join('')
      : '';
    const url = node.url || '';
    return `[${linkText}](${url})`;
  }

  // Узлы с children (p, root, и т.д.)
  if (Array.isArray(node.children)) {
    return node.children
      .map((child: any) => richTextToMarkdown(child))
      .join('');
  }

  return '';
}

/**
 * Проверяет, является ли значение rich-text структурой
 */
function isRichTextStructure(value: any): boolean {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'type' in value &&
    (value.type === 'root' || value.type === 'p')
  );
}

/**
 * Находит определение поля в схеме
 */
function findFieldDef(fields: TinaField[], fieldName: string): TinaField | undefined {
  return fields.find((f) => f.name === fieldName);
}

/**
 * Находит шаблон по имени
 */
function findTemplate(templates: TinaTemplate[], templateName: string): TinaTemplate | undefined {
  return templates.find((t) => t.name === templateName);
}

/**
 * Рекурсивно обрабатывает объект, конвертируя rich-text поля в markdown-строки
 */
function processRichTextFields(
  obj: any, 
  schemaFields: TinaField[], 
  stats: { richTextFieldsProcessed: number } = { richTextFieldsProcessed: 0 },
  fieldPath: string = ''
): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => processRichTextFields(item, schemaFields, stats, `${fieldPath}[${index}]`));
  }

  const processed: any = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = fieldPath ? `${fieldPath}.${key}` : key;
    
    // Пропускаем служебные поля
    if (key === '_collection' || key === 'id') {
      continue;
    }

    // Сохраняем _template и другие мета-поля
    if (key.startsWith('_')) {
      processed[key] = value;
      continue;
    }

    // Находим определение поля в схеме
    const fieldDef = findFieldDef(schemaFields, key);

    // Если это rich-text поле и значение - структура, конвертируем в markdown
    if (fieldDef && fieldDef.type === 'rich-text' && isRichTextStructure(value)) {
      console.log('[TRANSLATE:FILE] Конвертация rich-text в markdown:', currentPath);
      processed[key] = richTextToMarkdown(value);
      stats.richTextFieldsProcessed++;
      continue;
    }

    // Если это поле с templates (блоки)
    if (fieldDef && fieldDef.templates && Array.isArray(value)) {
      console.log('[TRANSLATE:FILE] Обработка блоков:', currentPath, '(количество:', value.length, ')');
      processed[key] = value.map((block, index) => {
        if (block && typeof block === 'object' && block._template) {
          const template = findTemplate(fieldDef.templates!, block._template);
          if (template) {
            return processRichTextFields(block, template.fields, stats, `${currentPath}[${index}]`);
          }
        }
        return block;
      });
      continue;
    }

    // Если это объект с вложенными полями
    if (fieldDef && fieldDef.fields) {
      if (Array.isArray(value)) {
        processed[key] = value.map((item, index) =>
          processRichTextFields(item, fieldDef.fields!, stats, `${currentPath}[${index}]`)
        );
      } else if (typeof value === 'object' && value !== null) {
        processed[key] = processRichTextFields(value, fieldDef.fields!, stats, currentPath);
      } else {
        processed[key] = value;
      }
      continue;
    }

    // Рекурсивная обработка для объектов без явной схемы
    if (typeof value === 'object' && value !== null && !isRichTextStructure(value)) {
      processed[key] = processRichTextFields(value, [], stats, currentPath);
    } else {
      processed[key] = value;
    }
  }

  return processed;
}

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

    // Получаем схему коллекции для обработки rich-text полей
    const collectionSchema = getCollectionSchema(collection);
    
    // Статистика обработки
    const stats = { richTextFieldsProcessed: 0 };
    
    console.log('[TRANSLATE:FILE] Начало обработки документа');
    
    // Конвертируем rich-text поля в markdown-строки
    const processedDocument = collectionSchema
      ? processRichTextFields(document, collectionSchema.fields, stats)
      : document;

    console.log('[TRANSLATE:FILE] Обработано rich-text полей:', stats.richTextFieldsProcessed);

    // Разделяем body и frontmatter
    const { _body, ...frontmatter } = processedDocument;

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

