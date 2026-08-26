import { describe, expect, it } from "vitest";

import {
  categoryFacets,
  DEFAULT_FILTERS,
  filterFindings,
  findingFiltersToQuery,
  hasActiveFilters,
  MAX_SEARCH_LENGTH,
  parseFindingFilters,
  severityFacets,
  sortFindingsForDisplay,
} from "@/modules/tasks/filters";
import type { InspectorFinding } from "@/modules/tasks/model";

function finding(overrides: Partial<InspectorFinding> & { id: string }): InspectorFinding {
  return {
    id: overrides.id,
    ordinal: overrides.ordinal ?? 0,
    fingerprint: overrides.fingerprint ?? `fp-${overrides.id}`,
    code: overrides.code ?? "TASK_METADATA_MISSING",
    category: overrides.category ?? "metadata",
    severity: overrides.severity ?? "error",
    status: "open",
    title: overrides.title ?? "Metadata is missing",
    message: overrides.message ?? "task.toml was not found in the package.",
    remediation: overrides.remediation ?? null,
    validatorId: overrides.validatorId ?? "metadata",
    validatorName: overrides.validatorName ?? "Task metadata",
    validatorVersion: overrides.validatorVersion ?? "2.0.0",
    evidence: overrides.evidence ?? {
      path: "task.toml",
      line: null,
      fieldPath: null,
      excerpt: null,
    },
  };
}

const FINDINGS: readonly InspectorFinding[] = [
  finding({
    id: "a",
    severity: "critical",
    category: "security",
    code: "TASK_SECURITY_DOCKER_SOCKET",
    ordinal: 0,
  }),
  finding({ id: "b", severity: "error", category: "metadata", ordinal: 1 }),
  finding({
    id: "c",
    severity: "warning",
    category: "environment",
    code: "TASK_ENVIRONMENT_WORKDIR_MISSING",
    title: "No WORKDIR",
    message: "The Dockerfile declares no WORKDIR.",
    validatorId: "environment",
    validatorName: "Environment",
    ordinal: 2,
    evidence: { path: "environment/Dockerfile", line: 4, fieldPath: null, excerpt: null },
  }),
  finding({
    id: "d",
    severity: "info",
    category: "documentation",
    code: "TASK_DOCUMENTATION_README_MISSING",
    ordinal: 3,
  }),
];

describe("parseFindingFilters", () => {
  it("reads a shareable query", () => {
    expect(parseFindingFilters({ severity: "error", category: "verifier", q: "docker" })).toEqual({
      severity: "error",
      category: "verifier",
      search: "docker",
    });
  });

  it("falls back to `all` for unknown values instead of failing the page", () => {
    expect(parseFindingFilters({ severity: "urgent", category: "vibes" })).toEqual(DEFAULT_FILTERS);
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parseFindingFilters({ severity: ["warning", "info"] }).severity).toBe("warning");
  });

  it("caps the search term", () => {
    const filters = parseFindingFilters({ q: "x".repeat(500) });
    expect(filters.search).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("round-trips back to a query with defaults omitted", () => {
    expect(findingFiltersToQuery(DEFAULT_FILTERS)).toEqual({});
    expect(
      findingFiltersToQuery({ severity: "error", category: "metadata", search: " docker " }),
    ).toEqual({ severity: "error", category: "metadata", q: "docker" });
  });

  it("knows when a reviewer has narrowed the report", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: "  " })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, severity: "info" })).toBe(true);
  });
});

describe("filterFindings", () => {
  it("filters by severity and by category", () => {
    expect(
      filterFindings(FINDINGS, { ...DEFAULT_FILTERS, severity: "warning" }).map((f) => f.id),
    ).toEqual(["c"]);
    expect(
      filterFindings(FINDINGS, { ...DEFAULT_FILTERS, category: "security" }).map((f) => f.id),
    ).toEqual(["a"]);
  });

  it("combines severity, category, and search", () => {
    expect(
      filterFindings(FINDINGS, {
        severity: "warning",
        category: "environment",
        search: "workdir",
      }).map((f) => f.id),
    ).toEqual(["c"]);
    expect(
      filterFindings(FINDINGS, { severity: "error", category: "environment", search: "" }),
    ).toEqual([]);
  });

  it("searches title, code, message, path, and validator", () => {
    const search = (term: string): string[] =>
      filterFindings(FINDINGS, { ...DEFAULT_FILTERS, search: term }).map((f) => f.id);

    expect(search("no workdir")).toEqual(["c"]);
    expect(search("DOCKER_SOCKET")).toEqual(["a"]);
    expect(search("task.toml was not found")).toEqual(["a", "b", "d"]);
    expect(search("environment/Dockerfile")).toEqual(["c"]);
    expect(search("Task metadata")).toEqual(["a", "b", "d"]);
    expect(search("   ")).toHaveLength(FINDINGS.length);
    expect(search("nothing here")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(
      filterFindings(FINDINGS, { ...DEFAULT_FILTERS, search: "wOrKdIr" }).map((f) => f.id),
    ).toEqual(["c"]);
  });
});

describe("facets", () => {
  it("counts severities against the other active filters", () => {
    const all = severityFacets(FINDINGS, DEFAULT_FILTERS);
    expect(all).toEqual([
      { value: "critical", count: 1 },
      { value: "error", count: 1 },
      { value: "warning", count: 1 },
      { value: "info", count: 1 },
    ]);

    const scoped = severityFacets(FINDINGS, { ...DEFAULT_FILTERS, category: "security" });
    expect(scoped.find((facet) => facet.value === "critical")?.count).toBe(1);
    expect(scoped.find((facet) => facet.value === "error")?.count).toBe(0);
  });

  it("lists only categories that are present, in declaration order", () => {
    expect(categoryFacets(FINDINGS, DEFAULT_FILTERS).map((facet) => facet.value)).toEqual([
      "metadata",
      "environment",
      "documentation",
      "security",
    ]);
  });
});

describe("sortFindingsForDisplay", () => {
  it("orders by severity, then by the persisted deterministic ordinal", () => {
    const shuffled = [FINDINGS[3], FINDINGS[1], FINDINGS[0], FINDINGS[2]].filter(
      (entry): entry is InspectorFinding => entry !== undefined,
    );
    expect(sortFindingsForDisplay(shuffled).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not mutate its input", () => {
    const input = [...FINDINGS].reverse();
    const before = input.map((f) => f.id);
    sortFindingsForDisplay(input);
    expect(input.map((f) => f.id)).toEqual(before);
  });
});
