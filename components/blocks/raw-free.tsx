import type { Template } from "tinacms";
import { tinaField } from "tinacms/dist/react";
import { PageBlocksRawFree } from "@/tina/__generated__/types";
import { Section } from "../layout/section";
import { sectionBlockSchemaField } from '../layout/section';
import Image from 'next/image';
import { translatableString } from '@/tina/fields/translatable';

export const RawFree = ({ data }: { data: PageBlocksRawFree }) => {
    return (
        <Section>
            <div className="mx-auto max-w-5xl space-y-8 px-6">

                <div className="space-y-6">

                    <p
                        className="text-sm font-medium uppercase tracking-widest lg:text-base"
                        data-tina-field={tinaField(data, 'suptitle')}
                    >
                        {data.suptitle}
                    </p>

                    <h2
                        className="text-4xl font-medium lg:text-5xl"
                        data-tina-field={tinaField(data, 'title')}
                    >
                        {data.title}
                    </h2>

                </div>

                <div className="grid gap-8 md:grid-cols-3 items-center">

                    {data.images && data.images.map((image) => (
                        <div
                            className="relative rounded-2xl overflow-hidden border shadow-lg"
                            data-tina-field={tinaField(image)}
                        >
                            <Image
                                src={image!.src!}
                                alt={image!.alt || 'Raw Free image'}
                                width={800}
                                height={600}
                                className="w-full h-auto"
                            />
                        </div>
                    ))}

                </div>
            </div>
        </Section>
    )
}

export const rawFreeBlockSchema: Template = {
    name: "rawFree",
    label: "Raw Free",
    ui: {
        defaultItem: {
            suptitle: "Для некоммерческого/образовательного использования. В портфолио — с указанием raw.retouch4.me и автора.",
            title: "Скачать бесплатный RAW",
        },
    },
    fields: [
        sectionBlockSchemaField as any,
        translatableString({
            label: "Suptitle",
            name: "suptitle",
        }),
        translatableString({
            label: "Title",
            name: "title",
        }),
        {
            type: "object",
            label: "Images",
            name: "images",
            fields: [
                {
                    name: "src",
                    label: "Image Source",
                    type: "image",
                },
                translatableString({
                    name: "alt",
                    label: "Alt Text",
                })
            ],
            list: true,
        },
    ],
};