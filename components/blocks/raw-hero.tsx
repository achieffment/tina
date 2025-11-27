import type { Template } from "tinacms";
import { tinaField } from "tinacms/dist/react";
import { PageBlocksRawHero } from "@/tina/__generated__/types";
import { Section } from "../layout/section";
import { sectionBlockSchemaField } from '../layout/section';
import Image from 'next/image';
import { Button } from "../ui/button";
import Link from "next/link";

export const RawHero = ({ data }: { data: PageBlocksRawHero }) => {
    return (
        <Section>
            <div className="mx-auto max-w-5xl space-y-8 px-6">
                <div className="grid gap-8 md:grid-cols-2 items-center">

                    {data.image && data.image.src && (
                        <div
                            className="relative rounded-2xl overflow-hidden border shadow-lg"
                            data-tina-field={tinaField(data, 'image')}
                        >
                            <Image
                                src={data.image.src}
                                alt={data.image.alt || data.title || 'Raw Hero image'}
                                width={800}
                                height={600}
                                className="w-full h-auto"
                            />
                        </div>
                    )}

                    <div className="space-y-6">
                        <h2
                            className="text-4xl font-medium lg:text-5xl"
                            data-tina-field={tinaField(data, 'title')}
                        >
                            {data.title}
                        </h2>
                        <div
                            className="text-lg leading-relaxed whitespace-pre-wrap"
                            data-tina-field={tinaField(data, 'text')}
                        >
                            {data.text}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {data.buttons && data.buttons.map((button) => (
                            <Button asChild size='lg' variant='default' className='rounded-xl px-5 text-base'>
                                <Link href={button!.link!}>
                                    <span className='text-nowrap'>{button!.label}</span>
                                </Link>
                            </Button>
                        ))}
                    </div>

                </div>
            </div>
        </Section>
    )
}

export const rawHeroBlockSchema: Template = {
    name: "rawHero",
    label: "Raw Hero",
    ui: {
        defaultItem: {
            title: "Обучайтесь! Скачивайте бесплатные Raw-файлы для редактирования.",
            text: "Используйте их для практики и изучения профессиональных AI-инструментов."
        },
    },
    fields: [
        sectionBlockSchemaField as any,
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
                    type: "string",
                    name: "alt",
                    label: "Alt Text",
                    translatable: true,
                }
            ],
        },
        {
            type: "string",
            label: "Title",
            name: "title",
            translatable: true,
        },
        {
            type: "string",
            label: "Text",
            name: "text",
            translatable: true,
        },
        {
            type: "object",
            label: "Actions",
            name: "buttons",
            fields: [
                {
                    type: "string",
                    label: "Label",
                    name: "label",
                    translatable: true,
                },
                {
                    type: "string",
                    label: "Link",
                    name: "link",
                },
            ],
            list: true,
        }
    ],
};