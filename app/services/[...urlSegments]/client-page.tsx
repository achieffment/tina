'use client';
import React from 'react';
import { tinaField, useTina } from 'tinacms/dist/react';
import { ServiceQuery } from '@/tina/__generated__/types';
import { useLayout } from '@/components/layout/layout-context';
import { Section } from '@/components/layout/section';
import ErrorBoundary from '@/components/error-boundary';
import { Blocks } from '@/components/blocks';

const titleColorClasses = {
  blue: 'from-blue-400 to-blue-600 dark:from-blue-300 dark:to-blue-500',
  teal: 'from-teal-400 to-teal-600 dark:from-teal-300 dark:to-teal-500',
  green: 'from-green-400 to-green-600',
  red: 'from-red-400 to-red-600',
  pink: 'from-pink-300 to-pink-500',
  purple: 'from-purple-400 to-purple-600 dark:from-purple-300 dark:to-purple-500',
  orange: 'from-orange-300 to-orange-600 dark:from-orange-200 dark:to-orange-500',
  yellow: 'from-yellow-400 to-yellow-500 dark:from-yellow-300 dark:to-yellow-500',
};

interface ClientServiceProps {
  data: ServiceQuery;
  variables: {
    relativePath: string;
  };
  query: string;
}

export default function ServiceClientPage(props: ClientServiceProps) {
  const { theme } = useLayout();
  const { data } = useTina({ ...props });
  const service = data.service;

  const titleColour = titleColorClasses[theme!.color! as keyof typeof titleColorClasses];

  const backUrl = `/services`;

  return (
    <ErrorBoundary>
      <Section>
        <h2 data-tina-field={tinaField(service, 'name')} className={`w-full relative\tmb-8 text-6xl font-extrabold tracking-normal text-center title-font`}>
          <span className={`bg-clip-text text-transparent bg-linear-to-r ${titleColour}`}>{service.name}</span>
        </h2>
        <div data-tina-field={tinaField(service, 'description')} className='flex items-center justify-center mb-16'>
          <p
            data-tina-field={tinaField(service, 'description')}
            className='text-base text-gray-400 group-hover:text-gray-500 dark:text-gray-300 dark:group-hover:text-gray-150'
          >
            {service.description}
          </p>
        </div>
        <Blocks blocks={service.blocks} />
        <div>
          <a href={backUrl} className='text-blue-500 hover:text-blue-600'>Back to services</a>
        </div>
      </Section>
    </ErrorBoundary>
  );
}
