import type { Template } from "tinacms";
import { tinaField } from "tinacms/dist/react";
import { PageBlocksAdvantage, ServiceBlocksAdvantage } from "@/tina/__generated__/types";
import { Section } from "../layout/section";
import { sectionBlockSchemaField } from '../layout/section';
import Image from 'next/image';

export const Advantage = ({ data }: { data: PageBlocksAdvantage | ServiceBlocksAdvantage }) => {
    return (
        <Section>
            <div className="mx-auto max-w-5xl space-y-8 px-6">
                <div className="grid gap-8 md:grid-cols-2 items-center">
                    {/* Text Column */}
                    <div className="space-y-6">
                        <h2
                            className="text-4xl font-medium lg:text-5xl"
                            data-tina-field={tinaField(data, 'title')}
                        >
                            {data.title}
                        </h2>
                        <div
                            className="text-lg leading-relaxed whitespace-pre-wrap"
                            data-tina-field={tinaField(data, 'description')}
                        >
                            {data.description}
                        </div>
                    </div>

                    {/* Image Column */}
                    {data.image && data.image.src && (
                        <div
                            className="relative rounded-2xl overflow-hidden border shadow-lg"
                            data-tina-field={tinaField(data, 'image')}
                        >
                            <Image
                                src={data.image.src}
                                alt={data.image.alt || data.title || 'Advantage image'}
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

export const advantageBlockSchema: Template = {
    name: "advantage",
    label: "Advantage",
    ui: {
        previewSrc: "/blocks/stats.png",
        defaultItem: {
            title: "Why Choose Us",
            description: "We provide exceptional service and cutting-edge solutions that help your business grow. Our team is dedicated to delivering results that exceed expectations.\n\nWith years of experience and a commitment to excellence, we're the partner you can trust."
        },
    },
    fields: [
        sectionBlockSchemaField as any,
        {
            type: "string",
            label: "Title",
            name: "title",
        },
        {
            type: "string",
            label: "Description",
            name: "description",
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