import type { ReactElement } from "react";
import Link from "next/link";
import type { ValidationSeverity } from "@agentforge/contracts";
import { VALIDATION_SEVERITY_ORDER, ValidationOutcomeSchema } from "@agentforge/contracts";

import type { ValidationFinding, ValidationRun } from "@/modules/validation/server/validation-runs";

const SEVERITY_LABEL: Record<ValidationSeverity, string> = {
  critical: "Critical",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

/** Severity is never conveyed by colour alone. */
const SEVERITY_MARK: Record<ValidationSeverity, string> = {
  critical: "!!",
  error: "!",
  warning: "▲",
  info: "i",
};

const SEVERITY_TONE: Record<ValidationSeverity, string> = {
  critical: "text-danger",
  error: "text-danger",
  warning: "text-warning",
  info: "text-muted-foreground",
};

const OUTCOME_COPY = {
  pass: {
    label: "Passed",
    detail: "Every enabled check ran without reporting a finding.",
  },
  warn: {
    label: "Passed with warnings",
    detail: "The package is usable, but some checks reported advisory findings.",
  },
  fail: {
    label: "Failed",
    detail: "At least one check reported a finding that the current policy fails on.",
  },
} as const;

type SeverityFilter = ValidationSeverity | "all";

const FILTERS: readonly SeverityFilter[] = ["all", ...VALIDATION_SEVERITY_ORDER];

function isSeverityFilter(value: string | undefined): value is SeverityFilter {
  return value !== undefined && FILTERS.includes(value as SeverityFilter);
}

export function parseSeverityFilter(value: string | undefined): SeverityFilter {
  return isSeverityFilter(value) ? value : "all";
}

type Evidence = {
  readonly path: string | null;
  readonly line: number | null;
  readonly fieldPath: string | null;
  readonly excerpt: string | null;
};

function readEvidence(finding: ValidationFinding): Evidence {
  const evidence = finding.evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return { path: null, line: null, fieldPath: null, excerpt: null };
  }
  const record: Record<string, unknown> = evidence;
  return {
    path: typeof record.path === "string" && record.path.length > 0 ? record.path : null,
    line: typeof record.line === "number" ? record.line : null,
    fieldPath: typeof record.fieldPath === "string" ? record.fieldPath : null,
    excerpt: typeof record.excerpt === "string" ? record.excerpt : null,
  };
}

function evidenceLabel(evidence: Evidence): string {
  if (!evidence.path) {
    return "Whole package";
  }
  return evidence.line === null ? evidence.path : `${evidence.path}:${evidence.line}`;
}

function SeverityBadge({ severity }: { severity: ValidationSeverity }): ReactElement {
  return (
    <span className={`flex items-center gap-1.5 text-sm ${SEVERITY_TONE[severity]}`}>
      <span aria-hidden="true" className="font-mono text-xs">
        {SEVERITY_MARK[severity]}
      </span>
      <span>{SEVERITY_LABEL[severity]}</span>
    </span>
  );
}

function SummaryCounts({ run }: { run: ValidationRun }): ReactElement {
  const counts: readonly { severity: ValidationSeverity; count: number }[] = [
    { severity: "critical", count: run.critical_count },
    { severity: "error", count: run.error_count },
    { severity: "warning", count: run.warning_count },
    { severity: "info", count: run.info_count },
  ];

  return (
    <dl className="border-border divide-border divide-y border-y">
      {counts.map((row) => (
        <div key={row.severity} className="flex items-baseline justify-between gap-4 py-2">
          <dt>
            <SeverityBadge severity={row.severity} />
          </dt>
          <dd className="font-mono text-sm tabular-nums">{row.count}</dd>
        </div>
      ))}
    </dl>
  );
}

function SeverityFilterBar({
  basePath,
  active,
  findings,
}: {
  basePath: string;
  active: SeverityFilter;
  findings: readonly ValidationFinding[];
}): ReactElement {
  const countFor = (filter: SeverityFilter): number =>
    filter === "all"
      ? findings.length
      : findings.filter((finding) => finding.severity === filter).length;

  return (
    <nav aria-label="Filter findings by severity" className="flex flex-wrap gap-x-4 gap-y-2">
      {FILTERS.filter((filter) => filter === "all" || countFor(filter) > 0).map((filter) => {
        const isActive = filter === active;
        return (
          <Link
            key={filter}
            href={filter === "all" ? basePath : `${basePath}?severity=${filter}`}
            aria-current={isActive ? "true" : undefined}
            className={`rounded-sm text-sm underline-offset-4 ${
              isActive
                ? "text-foreground font-medium underline"
                : "text-muted-foreground hover:underline"
            }`}
          >
            {filter === "all" ? "All" : SEVERITY_LABEL[filter]}
            <span className="ml-1 font-mono text-xs tabular-nums">{countFor(filter)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function FindingItem({ finding }: { finding: ValidationFinding }): ReactElement {
  const evidence = readEvidence(finding);
  const hasDetail = Boolean(finding.remediation || evidence.excerpt || evidence.fieldPath);

  return (
    <li className="border-border border-t py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-muted-foreground font-mono text-xs tracking-wide">
          {finding.code}
          <span aria-hidden="true"> · </span>
          <span className="uppercase">{finding.category}</span>
        </p>
        <SeverityBadge severity={finding.severity} />
      </div>
      <h3 className="mt-2 text-sm font-medium tracking-tight">{finding.title}</h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{finding.message}</p>
      <p className="mt-2 font-mono text-xs">
        <span className="text-muted-foreground">Evidence </span>
        {evidenceLabel(evidence)}
      </p>

      {hasDetail ? (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none rounded-sm text-sm underline underline-offset-4">
            <span className="group-open:hidden">Show detail</span>
            <span className="hidden group-open:inline">Hide detail</span>
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {evidence.fieldPath ? (
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">Field </span>
                {evidence.fieldPath}
              </p>
            ) : null}
            {evidence.excerpt ? (
              <pre className="border-border bg-muted/40 overflow-x-auto border-l px-3 py-2 font-mono text-xs leading-relaxed">
                {evidence.excerpt}
              </pre>
            ) : null}
            {finding.remediation ? (
              <p className="text-sm leading-relaxed">
                <span className="text-muted-foreground">Recommendation </span>
                {finding.remediation}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}
    </li>
  );
}

export function ValidationFindingsReport({
  run,
  findings,
  basePath,
  severityFilter,
}: {
  run: ValidationRun;
  findings: ValidationFinding[];
  basePath: string;
  severityFilter: SeverityFilter;
}): ReactElement {
  const visible =
    severityFilter === "all"
      ? findings
      : findings.filter((finding) => finding.severity === severityFilter);

  const outcome = ValidationOutcomeSchema.safeParse(run.outcome);
  // A run only has a trustworthy verdict when the job finished and recorded one.
  const completed = run.status === "failed" || !outcome.success ? null : OUTCOME_COPY[outcome.data];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="validation-summary-heading" className="flex flex-col gap-4">
        <h2 id="validation-summary-heading" className="font-serif text-lg tracking-tight">
          Summary
        </h2>

        {completed ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{completed.label}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{completed.detail}</p>
          </div>
        ) : (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-danger text-sm font-medium">Validation could not be completed.</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {run.error_message ??
                "The run stopped before a report was produced. No findings were recorded."}
            </p>
            <p className="text-sm leading-relaxed">
              Upload the package again from the project page. If it keeps failing, share the
              reference above with support.
            </p>
          </div>
        )}

        <dl className="text-muted-foreground grid gap-1 font-mono text-xs sm:grid-cols-2">
          <div className="flex gap-2">
            <dt>Benchmark</dt>
            <dd className="text-foreground">
              {run.adapter_id ?? "not detected"}
              {run.adapter_version ? ` ${run.adapter_version}` : ""}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>Policy</dt>
            <dd className="text-foreground">{run.policy}</dd>
          </div>
          <div className="flex gap-2">
            <dt>Artifact</dt>
            <dd className="text-foreground break-all">
              {run.artifact_content_hash?.slice(0, 16) ?? "unrecorded"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>Duration</dt>
            <dd className="text-foreground">
              {run.duration_ms === null ? "unrecorded" : `${run.duration_ms} ms`}
            </dd>
          </div>
        </dl>

        {completed ? <SummaryCounts run={run} /> : null}

        {run.validator_error_count > 0 ? (
          <p role="status" className="text-warning text-sm leading-relaxed">
            {run.validator_error_count} validator
            {run.validator_error_count === 1 ? "" : "s"} did not finish, so this report is
            incomplete. The failure was logged for operators.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="validation-findings-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="validation-findings-heading" className="font-serif text-lg tracking-tight">
            Findings
          </h2>
          {findings.length > 0 ? (
            <SeverityFilterBar basePath={basePath} active={severityFilter} findings={findings} />
          ) : null}
        </div>

        {findings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {completed
              ? "No validation issues found."
              : "No findings were recorded before the run stopped."}
          </p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground text-sm">No findings match this severity filter.</p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((finding) => (
              <FindingItem key={finding.id} finding={finding} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
