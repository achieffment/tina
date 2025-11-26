import type { Collection } from 'tinacms';
import { heroBlockSchema } from '@/components/blocks/hero';
import { contentBlockSchema } from '@/components/blocks/content';
import { testimonialBlockSchema } from '@/components/blocks/testimonial';
import { featureBlockSchema } from '@/components/blocks/features';
import { videoBlockSchema } from '@/components/blocks/video';
import { calloutBlockSchema } from '@/components/blocks/callout';
import { statsBlockSchema } from '@/components/blocks/stats';
import { ctaBlockSchema } from '@/components/blocks/call-to-action';
import { advantageBlockSchema } from '@/components/blocks/advantage';
import { rawHeroBlockSchema } from '@/components/blocks/raw-hero';
import { rawFreeBlockSchema } from '@/components/blocks/raw-free';
import { rawAiBlockSchema } from '@/components/blocks/raw-ai';
import { wrapStringFields } from '@/tina/plugins/auto-translation-indicator';

const Page: Collection = {
  label: 'Pages',
  name: 'page',
  path: 'content/pages',
  format: 'mdx',
  ui: {
    router: ({ document }) => {
      // Breadcrumbs: [locale, filename] or [filename]
      const breadcrumbs = document._sys.breadcrumbs;
      const locale = breadcrumbs[0]; // en or ru
      const filename = breadcrumbs[breadcrumbs.length - 1];
      
      if (filename === 'home') {
        return locale === 'en' ? '/' : `/${locale}`;
      }
      return locale === 'en' ? `/${filename}` : `/${locale}/${filename}`;
    },
  },
  fields: wrapStringFields([
    {
      type: 'object',
      list: true,
      name: 'blocks',
      label: 'Sections',
      ui: {
        visualSelector: true,
      },
      templates: [
        heroBlockSchema,
        calloutBlockSchema,
        featureBlockSchema,
        statsBlockSchema,
        ctaBlockSchema,
        contentBlockSchema,
        testimonialBlockSchema,
        videoBlockSchema,
        advantageBlockSchema,
        rawHeroBlockSchema,
        rawFreeBlockSchema,
        rawAiBlockSchema,
      ],
    },
  ]),
};

export default Page;
