import Layout from '@/components/layout/layout';
import client from '@/tina/__generated__/client';
import ServicesClientPage from './client-page';

export const revalidate = 300;

export default async function ServicesPage() {
  let services = await client.queries.serviceConnection({
    last: 1
  });
  const allServices = services;

  if (!allServices.data.serviceConnection.edges) {
    return [];
  }

  while (services.data?.serviceConnection.pageInfo.hasPreviousPage) {
    services = await client.queries.serviceConnection({
      sort: 'date',
      before: services.data.serviceConnection.pageInfo.endCursor,
    });

    if (!services.data.serviceConnection.edges) {
      break;
    }

    allServices.data.serviceConnection.edges.push(...services.data.serviceConnection.edges.reverse());
  }

  return (
    <Layout rawPageData={allServices.data}>
      <ServicesClientPage {...allServices} />
    </Layout>
  );
}
