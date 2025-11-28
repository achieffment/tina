import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import matter from 'gray-matter';

export const dynamic = 'force-dynamic';

interface TranslatedFile {
  relativePath: string; // "ru/home.mdx"
  collection: string; // "page", "post", "service"
  document: any;
  locale: string; // "ru", "de", etc.
}

interface BatchCreateRequest {
  files: TranslatedFile[];
  sourceLocale: string;
  sourceDocumentPath: string;
}

// Локальное сохранение файлов
async function writeFilesLocally(files: TranslatedFile[]): Promise<void> {
  const { writeFileSync, mkdirSync, existsSync } = await import('fs');
  const { dirname, join } = await import('path');
  
  const collectionFolderMap: Record<string, string> = {
    'page': 'pages',
    'post': 'posts',
    'service': 'services',
  };
  
  for (const file of files) {
    const collectionFolder = collectionFolderMap[file.collection];
    const fullPath = join(process.cwd(), 'content', collectionFolder, file.relativePath);
    const dir = dirname(fullPath);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    const { _body, ...frontmatter } = file.document;
    delete frontmatter._collection;
    delete frontmatter._template;
    
    const fileContent = matter.stringify(_body || '', frontmatter);
    writeFileSync(fullPath, fileContent, 'utf-8');
  }
}

// Создание batch коммита через GitHub API
async function createBatchCommit(files: TranslatedFile[], commitMessage: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) {
    throw new Error('GitHub credentials not configured');
  }

  const octokit = new Octokit({ auth: token });
  
  const collectionFolderMap: Record<string, string> = {
    'page': 'pages',
    'post': 'posts',
    'service': 'services',
  };

  // Получаем текущий commit SHA для ветки
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const currentCommitSha = refData.object.sha;

  // Получаем текущий tree SHA
  const { data: currentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const baseTreeSha = currentCommit.tree.sha;

  // Создаём blobs для всех файлов
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const collectionFolder = collectionFolderMap[file.collection];
      const filePath = `content/${collectionFolder}/${file.relativePath}`;
      
      const { _body, ...frontmatter } = file.document;
      delete frontmatter._collection;
      delete frontmatter._template;
      
      const fileContent = matter.stringify(_body || '', frontmatter);
      
      // Создаём blob
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(fileContent).toString('base64'),
        encoding: 'base64',
      });

      return {
        path: filePath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      };
    })
  );

  // Создаём новый tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Создаём коммит
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: newTree.sha,
    parents: [currentCommitSha],
    author: {
      name: 'TinaCMS Auto-Translation',
      email: 'noreply@tinacms.org',
    },
  });

  // Обновляем референс ветки
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { files, sourceLocale, sourceDocumentPath }: BatchCreateRequest = await request.json();

    console.log('[TRANSLATE:BATCH] ==========================================');
    console.log('[TRANSLATE:BATCH] Начало batch создания файлов');
    console.log('[TRANSLATE:BATCH] Параметры:', {
      filesCount: files.length,
      locales: files.map(f => f.locale).join(', '),
      sourceLocale,
      sourceDocumentPath,
      timestamp: new Date().toISOString(),
    });

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'files array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Сохраняем все файлы локально для немедленного доступа
    console.log('[TRANSLATE:BATCH] Сохранение файлов локально...');
    await writeFilesLocally(files);
    const localDuration = Date.now() - startTime;
    console.log('[TRANSLATE:BATCH] ✓ Все файлы сохранены локально за', localDuration, 'ms');

    // Создаём batch коммит в GitHub
    const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    
    if (token && process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
      console.log('[TRANSLATE:BATCH] Создание batch коммита в GitHub...');
      
      try {
        const localesList = files.map(f => f.locale).join(', ');
        const commitMessage = `Add translations to ${localesList}: ${sourceDocumentPath}`;
        
        await createBatchCommit(files, commitMessage);
        
        const totalDuration = Date.now() - startTime;
        console.log('[TRANSLATE:BATCH] ✓ Batch коммит создан в GitHub за', totalDuration - localDuration, 'ms');
        console.log('[TRANSLATE:BATCH] ==========================================');

        return NextResponse.json({
          success: true,
          filesCreated: files.length,
          locales: files.map(f => f.locale),
          method: 'github+local',
          committed: true,
        });
      } catch (githubError) {
        console.error('[TRANSLATE:BATCH] ⚠️ Не удалось создать коммит в GitHub:', githubError);
        console.log('[TRANSLATE:BATCH] Файлы сохранены локально, но коммит не создан');
      }
    } else {
      console.log('[TRANSLATE:BATCH] GitHub не настроен, файлы только локально');
    }

    const totalDuration = Date.now() - startTime;
    console.log('[TRANSLATE:BATCH] ==========================================');

    return NextResponse.json({
      success: true,
      filesCreated: files.length,
      locales: files.map(f => f.locale),
      method: 'local',
      committed: false,
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('[TRANSLATE:BATCH] Ошибка batch создания файлов (после', totalDuration, 'ms):', error);
    console.error('[TRANSLATE:BATCH] ==========================================');
    return NextResponse.json(
      { 
        error: 'Failed to create files', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

