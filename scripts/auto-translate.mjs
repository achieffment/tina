#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = process.env.PR_NUMBER;

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Функция для вызова OpenAI API
async function translateText(text, targetLocale, sourceLocale = 'ru') {
  const targetLanguage = targetLocale === 'en' ? 'English' : 'Russian';
  const sourceLanguage = sourceLocale === 'en' ? 'English' : 'Russian';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text from ${sourceLanguage} to ${targetLanguage}. Preserve all MDX/Markdown formatting, frontmatter structure, line breaks, and special characters. For YAML frontmatter, translate only the string values, not the keys. Only return the translated content without any explanations or additional content.`,
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
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || text;
}

// Функция для получения списка изменённых файлов из PR
async function getChangedFiles() {
  if (!GITHUB_TOKEN || !REPO || !PR_NUMBER) {
    console.log('GitHub environment variables not set, using local changed files');
    return [];
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/pulls/${PR_NUMBER}/files`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const files = await response.json();
    
    // Фильтруем только MDX файлы из content/ в локали ru
    return files
      .filter((file) => {
        const path = file.filename;
        return (
          path.startsWith('content/') &&
          (path.endsWith('.mdx') || path.endsWith('.md')) &&
          path.includes('/ru/')
        );
      })
      .map((file) => file.filename);
  } catch (error) {
    console.error('Error fetching changed files:', error);
    return [];
  }
}

// Функция для перевода файла
async function translateFile(filePath) {
  console.log(`Translating: ${filePath}`);

  const rootDir = join(__dirname, '..');
  const fullPath = join(rootDir, filePath);

  if (!existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return null;
  }

  // Читаем содержимое файла
  const content = readFileSync(fullPath, 'utf-8');

  // Определяем путь для переведённого файла (ru -> en)
  const targetPath = filePath.replace('/ru/', '/en/');
  const targetFullPath = join(rootDir, targetPath);

  // Проверяем, не существует ли уже переведённый файл
  if (existsSync(targetFullPath)) {
    console.log(`Translation already exists: ${targetPath}`);
    return null;
  }

  // Переводим содержимое
  try {
    const translatedContent = await translateText(content, 'en', 'ru');

    // Создаём директорию, если её нет
    const targetDir = dirname(targetFullPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Сохраняем переведённый файл
    writeFileSync(targetFullPath, translatedContent, 'utf-8');
    console.log(`✓ Created translation: ${targetPath}`);

    return targetPath;
  } catch (error) {
    console.error(`Error translating ${filePath}:`, error);
    return null;
  }
}

// Основная функция
async function main() {
  console.log('Starting auto-translation process...');

  const changedFiles = await getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('No files to translate');
    return;
  }

  console.log(`Found ${changedFiles.length} file(s) to translate:`);
  changedFiles.forEach((file) => console.log(`  - ${file}`));

  const translatedFiles = [];

  for (const file of changedFiles) {
    const translatedPath = await translateFile(file);
    if (translatedPath) {
      translatedFiles.push(translatedPath);
    }
    // Добавляем задержку между запросами, чтобы не превысить rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (translatedFiles.length > 0) {
    console.log(`\n✓ Successfully translated ${translatedFiles.length} file(s):`);
    translatedFiles.forEach((file) => console.log(`  - ${file}`));
  } else {
    console.log('\nNo new translations created');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

