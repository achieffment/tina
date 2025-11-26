import type { Collection } from "tinacms";
import { wrapStringFields } from '@/tina/plugins/auto-translation-indicator';

const Tag: Collection = {
  label: "Tags",
  name: "tag",
  path: "content/tags",
  format: "mdx",
  fields: wrapStringFields([
    {
      type: "string",
      label: "Name",
      name: "name",
      isTitle: true,
      required: true,
    },
  ]),
};

export default Tag;
