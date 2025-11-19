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
  const filepath = resolvedParams.urlSegments.join('/');
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
    allServices.data?.serviceConnection.edges.map((edge) => ({
      urlSegments: edge?.node?._sys.breadcrumbs,
    })) || [];

  return params;
}
