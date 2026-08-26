import type { ReactElement } from "react";
import Link from "next/link";
import type { ComparableFinding, ValidationRunComparison } from "@agentforge/validation/browser";
import { severityDrift } from "@agentforge/validation/browser";

import { SEVERITY_LABEL, SeverityBadge } from "@/modules/tasks/components/severity";

/**
 * Minimal diff view over `compareValidationRuns`. The comparison itself is domain
 * logic in `@agentforge/validation`; this only renders its four buckets.
 */

function findingLocation(finding: ComparableFinding): string {
  if (!finding.evidencePath) {
    return "whole package";
  }
  return finding.evidenceLine === null
    ? finding.evidencePath
    : `${finding.evidencePath}:${finding.evidenceLine}`;
}

function FindingLine({
  finding,
  href,
}: {
  finding: ComparableFinding;
  href: string | null;
}): ReactElement {
  const body = (
    <>
      <SeverityBadge severity={finding.severity} className="text-xs" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{finding.title}</span>
        <span className="text-muted-foreground block truncate font-mono text-[10px]">
          {finding.code} · {findingLocation(finding)}
        </span>
      </span>
    </>
  );

  return (
    <li className="border-border border-t first:border-t-0">
      {href ? (
        <Link
          href={href}
          className="hover:bg-muted/50 flex items-baseline gap-3 px-1 py-2 no-underline"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-baseline gap-3 px-1 py-2">{body}</div>
      )}
    </li>
  );
}

function Bucket({
  title,
  description,
  findings,
  hrefFor,
}: {
  title: string;
  description: string;
  findings: readonly ComparableFinding[];
  hrefFor: ((finding: ComparableFinding) => string) | null;
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <h3 className="font-serif text-base tracking-tight">{title}</h3>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {findings.length}
        </span>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
      {findings.length === 0 ? (
        <p className="text-muted-foreground border-border border-t py-2 text-sm">None.</p>
      ) : (
        <ul className="border-border border-t">
          {findings.map((finding) => (
            <FindingLine
              key={finding.fingerprint}
              finding={finding}
              href={hrefFor ? hrefFor(finding) : null}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RunComparisonView({
  comparison,
  previousRunNumber,
  currentRunNumber,
  taskBasePath,
}: {
  comparison: ValidationRunComparison;
  previousRunNumber: number;
  currentRunNumber: number;
  taskBasePath: string;
}): ReactElement {
  const currentHref = (finding: ComparableFinding): string => {
    const params = new URLSearchParams();
    if (finding.evidencePath) {
      params.set("file", finding.evidencePath);
    }
    if (finding.evidenceLine !== null) {
      params.set("line", String(finding.evidenceLine));
    }
    const query = params.toString();
    return `${taskBasePath}/runs/${currentRunNumber}${query.length > 0 ? `?${query}` : ""}`;
  };

  const previousHref = (finding: ComparableFinding): string => {
    const params = new URLSearchParams();
    if (finding.evidencePath) {
      params.set("file", finding.evidencePath);
    }
    if (finding.evidenceLine !== null) {
      params.set("line", String(finding.evidenceLine));
    }
    const query = params.toString();
    return `${taskBasePath}/runs/${previousRunNumber}${query.length > 0 ? `?${query}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-2">
        <Bucket
          title="New"
          description={`Reported in run ${currentRunNumber} and not in run ${previousRunNumber}.`}
          findings={comparison.newFindings}
          hrefFor={currentHref}
        />
        <Bucket
          title="Resolved"
          description={`Reported in run ${previousRunNumber} and no longer reported.`}
          findings={comparison.resolvedFindings}
          hrefFor={previousHref}
        />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h3 className="font-serif text-base tracking-tight">Severity changed</h3>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {comparison.changedFindings.length}
          </span>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Same finding, different severity. Matched on fingerprint, so a re-ordered report is not a
          change.
        </p>
        {comparison.changedFindings.length === 0 ? (
          <p className="text-muted-foreground border-border border-t py-2 text-sm">None.</p>
        ) : (
          <ul className="border-border border-t">
            {comparison.changedFindings.map((change) => {
              const drift = severityDrift(change.previous.severity, change.current.severity);
              return (
                <li
                  key={change.fingerprint}
                  className="border-border flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t px-1 py-2 first:border-t-0"
                >
                  <SeverityBadge severity={change.current.severity} className="text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{change.current.title}</span>
                    <span className="text-muted-foreground block truncate font-mono text-[10px]">
                      {change.current.code} · {findingLocation(change.current)}
                    </span>
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {SEVERITY_LABEL[change.previous.severity]} →{" "}
                    {SEVERITY_LABEL[change.current.severity]}
                    {drift === null ? "" : ` (${drift})`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        {comparison.unchangedFindings.length === 1
          ? "1 finding is unchanged between these runs."
          : `${comparison.unchangedFindings.length} findings are unchanged between these runs.`}
      </p>
    </div>
  );
}
