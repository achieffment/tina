import React from 'react';
import { notFound } from 'next/navigation';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import ClientPage from './client-page';
import { ALL_LOCALE_CODES, DEFAULT_LOCALE } from '@/lib/locales';

export const revalidate = 300;

export default async function Page({
  params,
}: {
  params: Promise<{ urlSegments: string[] }>;
}) {
  const resolvedParams = await params;
  const urlSegments = resolvedParams.urlSegments;
  
  // Определяем локаль и путь
  const firstSegment = urlSegments[0];
  const isLocaleSegment = ALL_LOCALE_CODES.includes(firstSegment as any);
  const locale = isLocaleSegment ? firstSegment : DEFAULT_LOCALE;
  
  // Формируем путь к файлу
  let filepath: string;
  if (isLocaleSegment) {
    // Для локализованных маршрутов: /ru -> ru/home.mdx, /de/about -> de/about.mdx
    if (urlSegments.length === 1) {
      // Только /{locale} - главная страница
      filepath = `${locale}/home`;
    } else {
      // /{locale}/about -> {locale}/about
      filepath = urlSegments.join('/');
    }
  } else {
    // Для маршрутов основного языка (английский): /about -> en/about.mdx
    filepath = `${DEFAULT_LOCALE}/${urlSegments.join('/')}`;
  }

  let data;
  try {
    data = await client.queries.page({
      relativePath: `${filepath}.mdx`,
    });
  } catch (error) {
    notFound();
  }

  return (
    <Layout rawPageData={data}>
      <Section>
        <ClientPage {...data} />
      </Section>
    </Layout>
  );
}

export async function generateStaticParams() {
  let pages = await client.queries.pageConnection();
  const allPages = pages;

  if (!allPages.data.pageConnection.edges) {
    return [];
  }

  while (pages.data.pageConnection.pageInfo.hasNextPage) {
    pages = await client.queries.pageConnection({
      after: pages.data.pageConnection.pageInfo.endCursor,
    });

    if (!pages.data.pageConnection.edges) {
      break;
    }

    allPages.data.pageConnection.edges.push(...pages.data.pageConnection.edges);
  }

  const params = allPages.data?.pageConnection.edges
    .map((edge) => {
      const breadcrumbs = edge?.node?._sys.breadcrumbs || [];
      // breadcrumbs: [locale, filename] например: ['ru', 'about'] или ['en', 'about']
      
      if (breadcrumbs.length === 0) return null;
      
      const locale = breadcrumbs[0];
      const pathParts = breadcrumbs.slice(1);
      
      // Для основного языка (английский): исключаем home (обрабатывается в app/page.tsx)
      if (locale === DEFAULT_LOCALE && pathParts.length === 1 && pathParts[0] === 'home') {
        return null;
      }
      
      // Для всех остальных локалей: home становится /{locale}
      if (locale !== DEFAULT_LOCALE && pathParts.length === 1 && pathParts[0] === 'home') {
        return { urlSegments: [locale] };
      }
      
      // Для маршрутов основного языка: en/about -> /about
      // Для маршрутов других локалей: ru/about -> /ru/about, de/about -> /de/about
      if (locale === DEFAULT_LOCALE) {
        return { urlSegments: pathParts };
      } else {
        return { urlSegments: [locale, ...pathParts] };
      }
    })
    .filter((x) => x !== null);

  return params;
}