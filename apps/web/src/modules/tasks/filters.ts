import type { ValidationFindingCategory, ValidationSeverity } from "@agentforge/contracts";
import {
  VALIDATION_FINDING_CATEGORIES,
  VALIDATION_SEVERITY_ORDER,
  validationCategoryRank,
  validationSeverityRank,
} from "@agentforge/contracts";

import type { InspectorFinding } from "@/modules/tasks/model";

export const SEVERITY_FILTER_VALUES = ["all", ...VALIDATION_SEVERITY_ORDER] as const;
export type SeverityFilter = (typeof SEVERITY_FILTER_VALUES)[number];

export const CATEGORY_FILTER_VALUES = ["all", ...VALIDATION_FINDING_CATEGORIES] as const;
export type CategoryFilter = (typeof CATEGORY_FILTER_VALUES)[number];

/** Long enough to be useful, short enough that no one mistakes this for a search engine. */
export const MAX_SEARCH_LENGTH = 120;

export type FindingFilters = {
  readonly severity: SeverityFilter;
  readonly category: CategoryFilter;
  readonly search: string;
};

export const DEFAULT_FILTERS: FindingFilters = { severity: "all", category: "all", search: "" };

function isSeverityFilter(value: unknown): value is SeverityFilter {
  return typeof value === "string" && SEVERITY_FILTER_VALUES.includes(value as SeverityFilter);
}

function isCategoryFilter(value: unknown): value is CategoryFilter {
  return typeof value === "string" && CATEGORY_FILTER_VALUES.includes(value as CategoryFilter);
}

/**
 * Reads filters from a URL query so a report link carries exactly what the sender
 * was looking at. Unknown values fall back to `all` rather than erroring: a stale
 * or hand-edited link should still open the report.
 */
export function parseFindingFilters(query: {
  readonly severity?: string | string[];
  readonly category?: string | string[];
  readonly q?: string | string[];
}): FindingFilters {
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const severity = first(query.severity);
  const category = first(query.category);
  const search = first(query.q) ?? "";

  return {
    severity: isSeverityFilter(severity) ? severity : "all",
    category: isCategoryFilter(category) ? category : "all",
    search: search.slice(0, MAX_SEARCH_LENGTH),
  };
}

export function findingFiltersToQuery(filters: FindingFilters): Record<string, string> {
  const query: Record<string, string> = {};
  if (filters.severity !== "all") {
    query.severity = filters.severity;
  }
  if (filters.category !== "all") {
    query.category = filters.category;
  }
  const search = filters.search.trim();
  if (search.length > 0) {
    query.q = search.slice(0, MAX_SEARCH_LENGTH);
  }
  return query;
}

export function hasActiveFilters(filters: FindingFilters): boolean {
  return (
    filters.severity !== "all" || filters.category !== "all" || filters.search.trim().length > 0
  );
}

function matchesSearch(finding: InspectorFinding, needle: string): boolean {
  // A linear scan over at most MAX_FINDINGS_PER_RUN rows. Substring matching over
  // the fields a reviewer would actually type — no index, no ranking, no engine.
  const haystack = [
    finding.title,
    finding.code,
    finding.message,
    finding.category,
    finding.evidence.path ?? "",
    finding.evidence.fieldPath ?? "",
    finding.validatorId ?? "",
    finding.validatorName ?? "",
  ];
  return haystack.some((field) => field.toLowerCase().includes(needle));
}

export function filterFindings(
  findings: readonly InspectorFinding[],
  filters: FindingFilters,
): readonly InspectorFinding[] {
  const needle = filters.search.trim().toLowerCase();

  return findings.filter((finding) => {
    if (filters.severity !== "all" && finding.severity !== filters.severity) {
      return false;
    }
    if (filters.category !== "all" && finding.category !== filters.category) {
      return false;
    }
    return needle.length === 0 || matchesSearch(finding, needle);
  });
}

export type FacetCount<T extends string> = {
  readonly value: T;
  readonly count: number;
};

/**
 * Counts for one facet computed with the *other* facets applied, so the numbers a
 * reviewer sees match what a click would actually produce.
 */
export function severityFacets(
  findings: readonly InspectorFinding[],
  filters: FindingFilters,
): readonly FacetCount<ValidationSeverity>[] {
  const scoped = filterFindings(findings, { ...filters, severity: "all" });
  return VALIDATION_SEVERITY_ORDER.map((severity) => ({
    value: severity,
    count: scoped.filter((finding) => finding.severity === severity).length,
  }));
}

export function categoryFacets(
  findings: readonly InspectorFinding[],
  filters: FindingFilters,
): readonly FacetCount<ValidationFindingCategory>[] {
  const scoped = filterFindings(findings, { ...filters, category: "all" });
  const present = new Set(scoped.map((finding) => finding.category));
  return [...present]
    .sort((left, right) => validationCategoryRank(left) - validationCategoryRank(right))
    .map((category) => ({
      value: category,
      count: scoped.filter((finding) => finding.category === category).length,
    }));
}

/** Report order: severity first, then the persisted deterministic ordinal. */
export function sortFindingsForDisplay(
  findings: readonly InspectorFinding[],
): readonly InspectorFinding[] {
  return [...findings].sort((left, right) => {
    const bySeverity =
      validationSeverityRank(left.severity) - validationSeverityRank(right.severity);
    return bySeverity !== 0 ? bySeverity : left.ordinal - right.ordinal;
  });
}
