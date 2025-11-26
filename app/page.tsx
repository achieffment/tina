import React from "react";
import client from "@/tina/__generated__/client";
import Layout from "@/components/layout/layout";
import ClientPage from "./[...urlSegments]/client-page";

export const revalidate = 300;

export default async function Home() {
  // По умолчанию показываем русскую версию
  const data = await client.queries.page({
    relativePath: `ru/home.mdx`,
  });

  return (
    <Layout rawPageData={data}>
      <ClientPage {...data} />
    </Layout>
  );
}
