import { advantageBlockSchema } from "@/components/blocks/advantage";
import type { Collection } from "tinacms";
import { wrapStringFields } from '@/tina/plugins/auto-translation-indicator';

const Service: Collection = {
    label: "Services",
    name: "service",
    path: "content/services",
    format: "mdx",
    ui: {
        router: ({ document }) => {
            // Breadcrumbs: [locale, ...path]
            const breadcrumbs = document._sys.breadcrumbs;
            const locale = breadcrumbs[0]; // ru or en
            const pathParts = breadcrumbs.slice(1);
            
            if (locale === 'ru') {
                return `/services/${pathParts.join('/')}`;
            }
            return `/${locale}/services/${pathParts.join('/')}`;
        },
    },
    fields: wrapStringFields([
        {
            type: "string",
            label: "Name",
            name: "name",
            isTitle: true,
            required: true,
        },
        {
            type: "string",
            label: "Description",
            name: "description",
        },
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
