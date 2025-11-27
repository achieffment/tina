import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import ServiceClientPage from './client-page';
import { ALL_LOCALE_CODES, DEFAULT_LOCALE } from '@/lib/locales';

export const revalidate = 300;

export default async function ServicePage({
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
    // /services/{locale}/... - локализованная версия
    filepath = [locale, ...urlSegments.slice(1)].join('/');
  } else {
    // /services/... - версия основного языка
    filepath = [DEFAULT_LOCALE, ...urlSegments].join('/');
  }
  
  const data = await client.queries.service({
    relativePath: `${filepath}.mdx`,
  });

  return (
    <Layout rawPageData={data}>
      <ServiceClientPage {...data} />
    </Layout>
  );
}

export async function generateStaticParams() {
  let services = await client.queries.serviceConnection();
  const allServices = services;

  if (!allServices.data.serviceConnection.edges) {
    return [];
  }

  while (services.data?.serviceConnection.pageInfo.hasNextPage) {
    services = await client.queries.serviceConnection({
      after: services.data.serviceConnection.pageInfo.endCursor,
    });

    if (!services.data.serviceConnection.edges) {
      break;
    }

    allServices.data.serviceConnection.edges.push(...services.data.serviceConnection.edges);
  }

  const params =
    allServices.data?.serviceConnection.edges.map((edge) => {
      const breadcrumbs = edge?.node?._sys.breadcrumbs || [];
      // breadcrumbs: [locale, ...path] например: ['ru', 'service'] или ['en', 'service']
      
      if (breadcrumbs.length === 0) return null;
      
      const locale = breadcrumbs[0];
      const pathParts = breadcrumbs.slice(1);
      
      // Для маршрутов основного языка: en/service -> /services/service
      // Для маршрутов других локалей: ru/service -> /services/ru/service, de/service -> /services/de/service
      if (locale === DEFAULT_LOCALE) {
        return { urlSegments: pathParts };
      } else {
        return { urlSegments: [locale, ...pathParts] };
      }
    })
    .filter((x) => x !== null) || [];

  return params;
}
