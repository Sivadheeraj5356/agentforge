import { DOCS_INDEX_SLUG, PRODUCT_DOCS_SECTIONS } from "./content";
import {
  DOCS_NAV_GROUP_IDS,
  DOCS_NAV_GROUP_LABELS,
  type DocsNavGroupId,
  type DocsSection,
} from "./types";

export type DocsNavGroup = {
  readonly id: DocsNavGroupId;
  readonly label: string;
  readonly sections: readonly DocsSection[];
};

export function docsPageHref(basePath: string, slug: string, headingId?: string): string {
  const path = slug === DOCS_INDEX_SLUG ? basePath : `${basePath}/${slug}`;
  return headingId ? `${path}#${headingId}` : path;
}

export function docsNavGroups(): readonly DocsNavGroup[] {
  return DOCS_NAV_GROUP_IDS.map((id) => ({
    id,
    label: DOCS_NAV_GROUP_LABELS[id],
    sections: PRODUCT_DOCS_SECTIONS.filter((section) => section.group === id),
  }));
}

export function adjacentDocsPages(slug: string): {
  readonly prev: DocsSection | undefined;
  readonly next: DocsSection | undefined;
} {
  const index = PRODUCT_DOCS_SECTIONS.findIndex((section) => section.id === slug);
  if (index < 0) {
    return { prev: undefined, next: undefined };
  }
  return {
    prev: PRODUCT_DOCS_SECTIONS[index - 1],
    next: PRODUCT_DOCS_SECTIONS[index + 1],
  };
}

export function isDocsSlug(slug: string): boolean {
  return PRODUCT_DOCS_SECTIONS.some((section) => section.id === slug);
}
