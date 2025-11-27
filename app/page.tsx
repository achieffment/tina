import React from "react";
import client from "@/tina/__generated__/client";
import Layout from "@/components/layout/layout";
import ClientPage from "./[...urlSegments]/client-page";
import { DEFAULT_LOCALE } from "@/lib/locales";

export const revalidate = 300;

export default async function Home() {
  // По умолчанию показываем версию основного языка
  const data = await client.queries.page({
    relativePath: `${DEFAULT_LOCALE}/home.mdx`,
  });

  return (
    <Layout rawPageData={data}>
      <ClientPage {...data} />
    </Layout>
  );
}
