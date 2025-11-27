import { advantageBlockSchema } from "@/components/blocks/advantage";
import type { Collection } from "tinacms";
import { wrapStringFields } from '@/tina/plugins/auto-translation-indicator';
import { translatableString } from '@/tina/fields/translatable';

const Service: Collection = {
    label: "Services",
    name: "service",
    path: "content/services",
    format: "mdx",
    ui: {
        router: ({ document }) => {
            // Breadcrumbs: [locale, ...path]
            const breadcrumbs = document._sys.breadcrumbs;
            const locale = breadcrumbs[0]; // en or ru
            const pathParts = breadcrumbs.slice(1);
            
            if (locale === 'en') {
                return `/services/${pathParts.join('/')}`;
            }
            return `/${locale}/services/${pathParts.join('/')}`;
        },
    },
    fields: wrapStringFields([
        translatableString({
            label: "Name",
            name: "name",
            isTitle: true,
            required: true,
        }),
        translatableString({
            label: "Description",
            name: "description",
        }),
        {
            type: 'object',
            list: true,
            name: 'blocks',
            label: 'Sections',
            ui: {
                visualSelector: true,
            },
            templates: [
                advantageBlockSchema,
            ],
        },
    ]),
};
export default Service;
