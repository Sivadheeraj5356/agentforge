import { ANTI_CHEATING_SECTION } from "./sections/anti-cheating";
import { APP_CLONE_SECTION } from "./sections/app-clone";
import { ARCHITECTURE_SECTION } from "./sections/architecture";
import { BENCHMARK_SECTION } from "./sections/benchmark";
import { ENVIRONMENTS_SECTION } from "./sections/environments";
import { GET_STARTED_SECTION } from "./sections/get-started";
import { LONG_HORIZON_SECTION } from "./sections/long-horizon";
import { OVERVIEW_SECTION } from "./sections/overview";
import { PRIVATE_EVAL_SECTION } from "./sections/private-eval";
import { PRIVATE_RL_SECTION } from "./sections/private-rl";
import { PROVIDE_SECTION } from "./sections/provide";
import { RLVR_SECTION } from "./sections/rlvr";
import { blockPlainText, type DocsSection } from "./types";

export const DOCS_INDEX_SLUG = "overview";

export const PRODUCT_DOCS_SECTIONS: readonly DocsSection[] = [
  OVERVIEW_SECTION,
  GET_STARTED_SECTION,
  PROVIDE_SECTION,
  BENCHMARK_SECTION,
  ENVIRONMENTS_SECTION,
  RLVR_SECTION,
  LONG_HORIZON_SECTION,
  ANTI_CHEATING_SECTION,
  PRIVATE_RL_SECTION,
  APP_CLONE_SECTION,
  PRIVATE_EVAL_SECTION,
  ARCHITECTURE_SECTION,
];

const SECTION_BY_ID = new Map(PRODUCT_DOCS_SECTIONS.map((section) => [section.id, section]));

export function productDocsPlainText(): string {
  return PRODUCT_DOCS_SECTIONS.flatMap((section) => [
    section.title,
    section.summary,
    ...section.blocks.flatMap((block) => [...blockPlainText(block)]),
  ]).join("\n");
}

export function getDocsSection(slug: string): DocsSection | undefined {
  return SECTION_BY_ID.get(slug);
}

export function docsSectionSlugs(): readonly string[] {
  return PRODUCT_DOCS_SECTIONS.map((section) => section.id);
}

export function docsDocumentTitle(section: DocsSection): string {
  return section.id === DOCS_INDEX_SLUG ? "Docs" : `${section.title} · Docs`;
}

export function docsPageDescription(section: DocsSection): string {
  return section.summary;
}
