import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import PostClientPage from './client-page';

export const revalidate = 300;

export default async function PostPage({
  params,
}: {
  params: Promise<{ urlSegments: string[] }>;
}) {
  const resolvedParams = await params;
  const urlSegments = resolvedParams.urlSegments;
  
  // Определяем, является ли первый сегмент локалью
  const firstSegment = urlSegments[0];
  const locale = firstSegment === 'ru' ? 'ru' : 'en';
  
  // Формируем путь к файлу
  let filepath: string;
  if (firstSegment === 'ru') {
    // /posts/ru/... - русская версия, убираем 'ru' из пути
    filepath = ['ru', ...urlSegments.slice(1)].join('/');
  } else {
    // /posts/... - английская версия
    filepath = ['en', ...urlSegments].join('/');
  }
  
  const data = await client.queries.post({
    relativePath: `${filepath}.mdx`,
  });

  return (
    <Layout rawPageData={data}>
      <PostClientPage {...data} />
    </Layout>
  );
}

export async function generateStaticParams() {
  let posts = await client.queries.postConnection();
  const allPosts = posts;

  if (!allPosts.data.postConnection.edges) {
    return [];
  }

  while (posts.data?.postConnection.pageInfo.hasNextPage) {
    posts = await client.queries.postConnection({
      after: posts.data.postConnection.pageInfo.endCursor,
    });

    if (!posts.data.postConnection.edges) {
      break;
    }

    allPosts.data.postConnection.edges.push(...posts.data.postConnection.edges);
  }

  const params =
    allPosts.data?.postConnection.edges.map((edge) => {
      const breadcrumbs = edge?.node?._sys.breadcrumbs || [];
      // breadcrumbs: [locale, ...path] например: ['ru', 'june', 'post'] или ['en', 'post']
      
      if (breadcrumbs.length === 0) return null;
      
      const locale = breadcrumbs[0];
      const pathParts = breadcrumbs.slice(1);
      
      // Для английских маршрутов: en/post -> /posts/post
      // Для русских маршрутов: ru/post -> /posts/ru/post
      if (locale === 'en') {
        return { urlSegments: pathParts };
      } else {
        return { urlSegments: [locale, ...pathParts] };
      }
    })
    .filter((x) => x !== null) || [];

  return params;
}
