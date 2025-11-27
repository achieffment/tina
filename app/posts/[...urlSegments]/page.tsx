import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import PostClientPage from './client-page';
import { ALL_LOCALE_CODES, DEFAULT_LOCALE } from '@/lib/locales';

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
  const isLocaleSegment = ALL_LOCALE_CODES.includes(firstSegment as any);
  const locale = isLocaleSegment ? firstSegment : DEFAULT_LOCALE;
  
  // Формируем путь к файлу
  let filepath: string;
  if (isLocaleSegment) {
    // /posts/{locale}/... - локализованная версия
    filepath = [locale, ...urlSegments.slice(1)].join('/');
  } else {
    // /posts/... - версия основного языка
    filepath = [DEFAULT_LOCALE, ...urlSegments].join('/');
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
      
      // Для маршрутов основного языка: en/post -> /posts/post
      // Для маршрутов других локалей: ru/post -> /posts/ru/post, de/post -> /posts/de/post
      if (locale === DEFAULT_LOCALE) {
        return { urlSegments: pathParts };
      } else {
        return { urlSegments: [locale, ...pathParts] };
      }
    })
    .filter((x) => x !== null) || [];

  return params;
}
