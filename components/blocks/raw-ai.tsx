import type { Template } from "tinacms";
import { tinaField } from "tinacms/dist/react";
import { PageBlocksRawAi } from "@/tina/__generated__/types";
import { Section } from "../layout/section";
import { sectionBlockSchemaField } from '../layout/section';
import Image from 'next/image';

export const RawAi = ({ data }: { data: PageBlocksRawAi }) => {
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

                    <p className="text-lg leading-relaxed whitespace-pre-wrap" data-tina-field={tinaField(data, 'text')}>
                        {data.text}
                    </p>

                </div>

                <div className="grid gap-8 items-center">

                    {data.image && data.image.src && (
                        <div
                            className="relative rounded-2xl overflow-hidden border shadow-lg"
                            data-tina-field={tinaField(data, 'image')}
                        >
                            <Image
                                src={data.image.src}
                                alt={data.image.alt || data.title || 'Raw Ai image'}
                                width={800}
                                height={600}
                                className="w-full h-auto"
                            />
                        </div>
                    )}

                </div>

            </div>
        </Section>
    )
}

export const rawAiBlockSchema: Template = {
    name: "rawAi",
    label: "Raw Ai",
    ui: {
        defaultItem: {
            suptitle: "Зарабатывайте бесплатные кредиты на ретушь",
            title: "Используйте наши AI-инструменты бесплатно",
            text: "Зарабатывайте кредиты на ретушь, отправляя нам свои RAW-фотографии для публикации в нашем публичном онлайн RAW-банке. Кредиты на ретушь позволят вам использовать наши AI-инструменты для улучшения своих фотографических навыков."
        },
    },
    fields: [
        sectionBlockSchemaField as any,
        {
            type: "string",
            label: "Suptitle",
            name: "suptitle",
        },
        {
            type: "string",
            label: "Title",
            name: "title",
        },
        {
            type: "string",
            label: "Text",
            name: "text",
        },
        {
            type: "object",
            label: "Image",
            name: "image",
            fields: [
                {
                    name: "src",
                    label: "Image Source",
                    type: "image",
                },
                {
                    name: "alt",
                    label: "Alt Text",
                    type: "string",
                }
            ],
        },
    ],
};