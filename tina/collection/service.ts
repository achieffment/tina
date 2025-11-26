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
            return `/services/${document._sys.breadcrumbs.join('/')}`;
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
