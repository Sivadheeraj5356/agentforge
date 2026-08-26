import type { ReactElement } from "react";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DOCS_INDEX_SLUG, getDocsSection } from "@/modules/docs/content";
import { ProductDocs } from "@/modules/docs/product-docs";

export default async function DocsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web docs");
  const { organizationSlug } = await params;
  const overview = getDocsSection(DOCS_INDEX_SLUG);
  if (!overview) {
    throw new Error("Docs overview is missing.");
  }
  return (
    <ProductDocs
      section={overview}
      basePath={`/app/${organizationSlug}/docs`}
      workspaceHref={`/app/${organizationSlug}`}
    />
  );
}
