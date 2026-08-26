import { PRODUCT_DOCS_SECTIONS } from "./content";
import { blockPlainText, sectionHeadings, type DocsSection } from "./types";

export const DOCS_SEARCH_QUERY_MAX = 120;
export const DOCS_SEARCH_RESULT_LIMIT = 12;

export type DocsSearchEntry = {
  readonly slug: string;
  readonly pageTitle: string;
  readonly headingId: string | null;
  readonly headingTitle: string | null;
  readonly haystack: string;
};

export type DocsSearchHit = {
  readonly slug: string;
  readonly pageTitle: string;
  readonly headingId: string | null;
  readonly headingTitle: string | null;
  readonly score: number;
};

function pageHaystack(section: DocsSection): string {
  return [section.title, section.summary, ...section.blocks.flatMap((block) => blockPlainText(block))]
    .join("\n")
    .toLowerCase();
}

export function buildDocsSearchIndex(
  sections: readonly DocsSection[] = PRODUCT_DOCS_SECTIONS,
): readonly DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = [];
  for (const section of sections) {
    entries.push({
      slug: section.id,
      pageTitle: section.title,
      headingId: null,
      headingTitle: null,
      haystack: pageHaystack(section),
    });
    for (const heading of sectionHeadings(section)) {
      entries.push({
        slug: section.id,
        pageTitle: section.title,
        headingId: heading.id,
        headingTitle: heading.title,
        haystack: `${section.title}\n${heading.title}`.toLowerCase(),
      });
    }
  }
  return entries;
}

export const DOCS_SEARCH_INDEX: readonly DocsSearchEntry[] = buildDocsSearchIndex();

export function normalizeDocsQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, DOCS_SEARCH_QUERY_MAX);
}

function tokensOf(query: string): readonly string[] {
  return query
    .toLowerCase()
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function scoreEntry(entry: DocsSearchEntry, tokens: readonly string[]): number {
  if (tokens.length === 0) {
    return 0;
  }
  if (!tokens.every((token) => entry.haystack.includes(token))) {
    return 0;
  }
  const joined = tokens.join(" ");
  let score = 10;
  const title = entry.pageTitle.toLowerCase();
  const heading = (entry.headingTitle ?? "").toLowerCase();
  if (title.includes(joined) || tokens.every((token) => title.includes(token))) {
    score += 100;
  }
  if (heading && (heading.includes(joined) || tokens.every((token) => heading.includes(token)))) {
    score += 50;
  }
  if (entry.headingId === null) {
    score += 5;
  }
  return score;
}

export function searchDocs(
  rawQuery: string,
  index: readonly DocsSearchEntry[] = DOCS_SEARCH_INDEX,
): readonly DocsSearchHit[] {
  const query = normalizeDocsQuery(rawQuery);
  const tokens = tokensOf(query);
  if (tokens.length === 0) {
    return [];
  }
  const ranked = index
    .map((entry) => ({
      slug: entry.slug,
      pageTitle: entry.pageTitle,
      headingId: entry.headingId,
      headingTitle: entry.headingTitle,
      score: scoreEntry(entry, tokens),
    }))
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || left.pageTitle.localeCompare(right.pageTitle));

  const seen = new Set<string>();
  const unique: DocsSearchHit[] = [];
  for (const hit of ranked) {
    const key = `${hit.slug}#${hit.headingId ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(hit);
    if (unique.length >= DOCS_SEARCH_RESULT_LIMIT) {
      break;
    }
  }
  return unique;
}
