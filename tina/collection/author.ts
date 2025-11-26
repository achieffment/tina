import type { Collection } from "tinacms";
import { wrapStringFields } from '@/tina/plugins/auto-translation-indicator';

const Author: Collection = {
  label: "Authors",
  name: "author",
  path: "content/authors",
  format: "md",
  fields: wrapStringFields([
    {
      type: "string",
      label: "Name",
      name: "name",
      isTitle: true,
      required: true,
    },
    {
      type: "image",
      label: "Avatar",
      name: "avatar",
      // @ts-ignore
      uploadDir: () => "authors",
    },
  ]),
};
export default Author;
