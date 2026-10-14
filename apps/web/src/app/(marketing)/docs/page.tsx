import type { Metadata } from "next";
import type { ReactElement } from "react";

import {
  DOCS_INDEX_SLUG,
  docsPageDescription,
  docsDocumentTitle,
  getDocsSection,
} from "@/modules/docs/content";
import { ProductDocs } from "@/modules/docs/product-docs";

const overview = getDocsSection(DOCS_INDEX_SLUG);

export const metadata: Metadata = {
  title: overview ? docsDocumentTitle(overview) : "Docs",
  description: overview
    ? docsPageDescription(overview)
    : "AgentForge docs for RL environments, RLVR, long-horizon evaluation, and private rollouts.",
};

export default function PublicDocsPage(): ReactElement {
  if (!overview) {
    throw new Error("Docs overview is missing.");
  }
  return (
    <div className="px-(--spacing-page) mx-auto w-full max-w-7xl py-12">
      <ProductDocs section={overview} basePath="/docs" />
    </div>
  );
}
