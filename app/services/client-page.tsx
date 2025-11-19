'use client';
import React from 'react';
import Link from 'next/link';
import { ServiceConnectionQuery, ServiceConnectionQueryVariables } from '@/tina/__generated__/types';
import ErrorBoundary from '@/components/error-boundary';
import { Card } from '@/components/ui/card';
import { Section } from '@/components/layout/section';

interface ClientServiceProps {
  data: ServiceConnectionQuery;
  variables: ServiceConnectionQueryVariables;
  query: string;
}

export default function ServicesClientPage(props: ClientServiceProps) {
  const services = props.data?.serviceConnection.edges!.map((serviceData) => {
    const service = serviceData!.node!;

    return {
      id: service.id,
      url: `/services/${service._sys.breadcrumbs.join('/')}`,
      name: service.name,
      description: service.description,
    }
  });

  return (
    <ErrorBoundary>
      <Section>
        <div className="container flex flex-col items-center gap-16">
          <div className="text-center">
            <h2 className="mx-auto mb-6 text-pretty text-3xl font-semibold md:text-4xl lg:max-w-3xl">
              Services
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground md:text-lg">
              Discover the services we offer.
            </p>
          </div>

          <div className="grid gap-y-10 sm:grid-cols-12 sm:gap-y-12 md:gap-y-16 lg:gap-y-20">
            {services.map((service) => (
              <Card
                key={service.id}
                className="order-last border-0 bg-transparent shadow-none sm:order-first sm:col-span-12 lg:col-span-10 lg:col-start-2"
              >
                <div className="grid gap-y-6 sm:grid-cols-10 sm:gap-x-5 sm:gap-y-0 md:items-center md:gap-x-8 lg:gap-x-12">
                  <div className="sm:col-span-5">
                    <h3 className="text-xl font-semibold md:text-2xl lg:text-3xl">
                      <Link
                        href={service.url}
                        className="hover:underline"
                      >
                        {service.name}
                      </Link>
                    </h3>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Section>
    </ErrorBoundary>
  );
}
