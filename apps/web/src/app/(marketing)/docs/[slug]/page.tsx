import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";

import {
  DOCS_INDEX_SLUG,
  docsDocumentTitle,
  docsPageDescription,
  docsSectionSlugs,
  getDocsSection,
} from "@/modules/docs/content";
import { ProductDocs } from "@/modules/docs/product-docs";

type DocsSlugParams = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): { slug: string }[] {
  return docsSectionSlugs()
    .filter((slug) => slug !== DOCS_INDEX_SLUG)
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DocsSlugParams): Promise<Metadata> {
  const { slug } = await params;
  const section = getDocsSection(slug);
  if (!section) {
    return { title: "Docs" };
  }
  return {
    title: docsDocumentTitle(section),
    description: docsPageDescription(section),
  };
}

export default async function PublicDocsSlugPage({
  params,
}: DocsSlugParams): Promise<ReactElement> {
  const { slug } = await params;
  if (slug === DOCS_INDEX_SLUG) {
    redirect("/docs");
  }
  const section = getDocsSection(slug);
  if (!section) {
    notFound();
  }
  return (
    <div className="px-(--spacing-page) mx-auto w-full max-w-7xl py-12">
      <ProductDocs section={section} basePath="/docs" />
    </div>
  );
}
