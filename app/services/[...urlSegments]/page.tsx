import React from 'react';
import client from '@/tina/__generated__/client';
import Layout from '@/components/layout/layout';
import ServiceClientPage from './client-page';

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
  const locale = firstSegment === 'ru' ? 'ru' : 'en';
  
  // Формируем путь к файлу
  let filepath: string;
  if (firstSegment === 'ru') {
    // /services/ru/... - русская версия
    filepath = ['ru', ...urlSegments.slice(1)].join('/');
  } else {
    // /services/... - английская версия
    filepath = ['en', ...urlSegments].join('/');
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
      
      // Для английских маршрутов: en/service -> /services/service
      // Для русских маршрутов: ru/service -> /services/ru/service
      if (locale === 'en') {
        return { urlSegments: pathParts };
      } else {
        return { urlSegments: [locale, ...pathParts] };
      }
    })
    .filter((x) => x !== null) || [];

  return params;
}
