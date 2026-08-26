"use client";

import { useId, useMemo, useRef, type KeyboardEvent, type ReactElement } from "react";
import type { ValidationOutcome, ValidationRunStatus } from "@agentforge/contracts";
import { cn, Input } from "@agentforge/ui";

import {
  categoryFacets,
  hasActiveFilters,
  severityFacets,
  sortFindingsForDisplay,
  type FindingFilters,
} from "@/modules/tasks/filters";
import { OutcomeBadge, SEVERITY_LABEL, SeverityBadge } from "@/modules/tasks/components/severity";
import type { FindingCounts, InspectorFinding } from "@/modules/tasks/model";

/**
 * Summary, filters, and the finding list. Filters are pure functions of props, so
 * this component holds no derived state and the counts can never drift from what a
 * click would produce.
 */

export type FindingsPanelProps = {
  readonly findings: readonly InspectorFinding[];
  readonly visibleFindings: readonly InspectorFinding[];
  readonly filters: FindingFilters;
  readonly counts: FindingCounts;
  readonly outcome: ValidationOutcome | null;
  readonly status: ValidationRunStatus;
  readonly errorMessage: string | null;
  readonly activeFindingId: string | null;
  readonly onFiltersChange: (filters: FindingFilters) => void;
  readonly onOpenFinding: (finding: InspectorFinding) => void;
};

export function FindingsPanel({
  findings,
  visibleFindings,
  filters,
  counts,
  outcome,
  status,
  errorMessage,
  activeFindingId,
  onFiltersChange,
  onOpenFinding,
}: FindingsPanelProps): ReactElement {
  const searchId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const severities = useMemo(() => severityFacets(findings, filters), [findings, filters]);
  const categories = useMemo(() => categoryFacets(findings, filters), [findings, filters]);
  const ordered = useMemo(() => sortFindingsForDisplay(visibleFindings), [visibleFindings]);

  const moveFocus = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    const buttons = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-finding-trigger]") ?? []),
    ];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[current + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <section aria-labelledby="run-summary-heading" className="flex flex-col gap-3">
        <h2
          id="run-summary-heading"
          className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]"
        >
          Result
        </h2>

        {status === "failed" ? (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-danger text-sm font-medium">Validation could not be completed.</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {errorMessage ?? "The run stopped before a report was produced."}
            </p>
          </div>
        ) : (
          <OutcomeBadge outcome={outcome} status={status} className="text-sm font-medium" />
        )}

        <dl className="border-border divide-border grid grid-cols-4 divide-x border-y">
          {severities.map((facet) => (
            <div key={facet.value} className="flex flex-col items-start gap-0.5 px-2 py-1.5">
              <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {SEVERITY_LABEL[facet.value]}
              </dt>
              <dd className="font-mono text-sm tabular-nums">{counts[facet.value]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="findings-heading" className="flex min-h-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="findings-heading" className="font-serif text-base tracking-tight">
            Findings
          </h2>
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            {ordered.length === counts.total
              ? `${counts.total}`
              : `${ordered.length} of ${counts.total}`}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={searchId} className="sr-only">
            Search findings
          </label>
          <Input
            id={searchId}
            type="search"
            value={filters.search}
            placeholder="Search title, code, path, validator"
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value.slice(0, 120) })
            }
            className="h-8 text-xs"
          />

          <FilterRow
            label="Severity"
            options={[
              { value: "all", label: "All", count: counts.total },
              ...severities
                .filter((facet) => facet.count > 0)
                .map((facet) => ({
                  value: facet.value,
                  label: SEVERITY_LABEL[facet.value],
                  count: facet.count,
                })),
            ]}
            active={filters.severity}
            onSelect={(value) =>
              onFiltersChange({ ...filters, severity: value as FindingFilters["severity"] })
            }
          />

          {categories.length > 1 ? (
            <FilterRow
              label="Category"
              options={[
                { value: "all", label: "All", count: counts.total },
                ...categories.map((facet) => ({
                  value: facet.value,
                  label: facet.value,
                  count: facet.count,
                })),
              ]}
              active={filters.category}
              onSelect={(value) =>
                onFiltersChange({ ...filters, category: value as FindingFilters["category"] })
              }
            />
          ) : null}
        </div>

        {counts.total === 0 ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {status === "failed"
              ? "No findings were recorded before the run stopped."
              : "No findings. Every enabled check ran and reported nothing."}
          </p>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground text-sm">No findings match these filters.</p>
            {hasActiveFilters(filters) ? (
              <button
                type="button"
                className="text-sm underline underline-offset-4"
                onClick={() => onFiltersChange({ severity: "all", category: "all", search: "" })}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <ul
            ref={listRef}
            onKeyDown={moveFocus}
            className="border-border divide-border divide-y border-t"
          >
            {ordered.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                expanded={finding.id === activeFindingId}
                onOpen={() => onOpenFinding(finding)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilterRow({
  label,
  options,
  active,
  onSelect,
}: {
  label: string;
  options: readonly { value: string; label: string; count: number }[];
  active: string;
  onSelect: (value: string) => void;
}): ReactElement {
  const labelId = useId();

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
    >
      <span
        id={labelId}
        className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]"
      >
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === active}
          onClick={() => onSelect(option.value)}
          className={cn(
            "rounded-sm text-xs underline-offset-4",
            option.value === active
              ? "text-foreground font-medium underline"
              : "text-muted-foreground hover:text-foreground hover:underline",
          )}
        >
          {option.label}
          <span className="ms-1 font-mono tabular-nums">{option.count}</span>
        </button>
      ))}
    </div>
  );
}

function FindingRow({
  finding,
  expanded,
  onOpen,
}: {
  finding: InspectorFinding;
  expanded: boolean;
  onOpen: () => void;
}): ReactElement {
  const detailId = `finding-detail-${finding.id}`;
  const location = finding.evidence.path
    ? finding.evidence.line === null
      ? finding.evidence.path
      : `${finding.evidence.path}:${finding.evidence.line}`
    : "Whole package";

  return (
    <li>
      <button
        type="button"
        data-finding-trigger
        data-finding-id={finding.id}
        aria-expanded={expanded}
        aria-controls={expanded ? detailId : undefined}
        onClick={onOpen}
        className={cn(
          "hover:bg-muted/50 flex w-full flex-col items-start gap-1 px-1 py-2.5 text-start",
          expanded && "bg-accent/8",
        )}
      >
        <span className="flex w-full items-baseline justify-between gap-2">
          <SeverityBadge severity={finding.severity} className="text-xs" />
          <span className="text-muted-foreground truncate font-mono text-[10px]">
            {finding.code}
          </span>
        </span>
        <span className="text-sm font-medium leading-snug">{finding.title}</span>
        <span className="text-muted-foreground truncate font-mono text-[10px]">{location}</span>
      </button>

      {expanded ? (
        <div id={detailId} className="flex flex-col gap-3 px-1 pb-4 pt-1">
          <p className="text-muted-foreground text-sm leading-relaxed">{finding.message}</p>

          {finding.evidence.excerpt ? (
            <pre className="border-border bg-muted/40 overflow-x-auto whitespace-pre-wrap border-s px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {finding.evidence.excerpt}
            </pre>
          ) : null}

          {finding.remediation ? (
            <p className="text-sm leading-relaxed">
              <span className="text-muted-foreground">Recommendation. </span>
              {finding.remediation}
            </p>
          ) : null}

          <details className="group">
            <summary className="text-muted-foreground cursor-pointer list-none rounded-sm text-xs underline underline-offset-4">
              <span className="group-open:hidden">Show metadata</span>
              <span className="hidden group-open:inline">Hide metadata</span>
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10px]">
              <dt className="text-muted-foreground">Category</dt>
              <dd>{finding.category}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{finding.status}</dd>
              <dt className="text-muted-foreground">Check</dt>
              <dd>
                {finding.validatorId ?? "pipeline"}
                {finding.validatorVersion ? ` ${finding.validatorVersion}` : ""}
              </dd>
              {finding.evidence.fieldPath ? (
                <>
                  <dt className="text-muted-foreground">Field</dt>
                  <dd className="break-all">{finding.evidence.fieldPath}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Fingerprint</dt>
              <dd className="break-all">{finding.fingerprint.slice(0, 16)}</dd>
            </dl>
          </details>
        </div>
      ) : null}
    </li>
  );
}
