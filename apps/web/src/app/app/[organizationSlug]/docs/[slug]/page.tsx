import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DOCS_INDEX_SLUG, getDocsSection } from "@/modules/docs/content";
import { ProductDocs } from "@/modules/docs/product-docs";

type InAppDocsSlugParams = {
  params: Promise<{ organizationSlug: string; slug: string }>;
};

export default async function InAppDocsSlugPage({
  params,
}: InAppDocsSlugParams): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web docs");
  const { organizationSlug, slug } = await params;
  const basePath = `/app/${organizationSlug}/docs`;
  if (slug === DOCS_INDEX_SLUG) {
    redirect(basePath);
  }
  const section = getDocsSection(slug);
  if (!section) {
    notFound();
  }
  return (
    <ProductDocs
      section={section}
      basePath={basePath}
      workspaceHref={`/app/${organizationSlug}`}
    />
  );
}
