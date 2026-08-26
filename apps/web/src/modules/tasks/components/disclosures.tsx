import type { ReactElement } from "react";

import { EXECUTION_DISCLOSURE, type RunProvenance } from "@/modules/tasks/model";

/**
 * What ran, what did not, and against what.
 *
 * The "not verified" half matters as much as the verified half: a reviewer who
 * reads a green report must not walk away believing the task was executed.
 */

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "not recorded";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "not recorded"
    : parsed.toISOString().replace("T", " ").slice(0, 19);
}

function formatBytes(byteSize: number | null): string {
  if (byteSize === null) {
    return "not recorded";
  }
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.round(byteSize / 1024)} KB`;
  }
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactElement;
}): ReactElement {
  return (
    <details className="border-border group border-b last:border-b-0">
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs">
        <span
          aria-hidden="true"
          className="text-muted-foreground transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
        >
          ›
        </span>
        <span className="font-mono uppercase tracking-[0.14em]">{summary}</span>
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

export function ChecksDisclosure({
  provenance,
  validatorErrorCount,
}: {
  provenance: RunProvenance;
  validatorErrorCount: number;
}): ReactElement {
  return (
    <Disclosure summary={`Checks (${provenance.validators.length})`}>
      <div className="flex flex-col gap-3">
        {validatorErrorCount > 0 ? (
          <p role="status" className="text-warning text-xs leading-relaxed">
            {validatorErrorCount === 1
              ? "1 check did not finish, so this report is incomplete."
              : `${validatorErrorCount} checks did not finish, so this report is incomplete.`}{" "}
            A check that fails produces no evidence — it is not the same as a check that passed. The
            failure was logged for operators.
          </p>
        ) : null}

        {provenance.validators.length === 0 ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            No checks were recorded for this run.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y border-y">
            {provenance.validators.map((validator) => (
              <li
                key={validator.id}
                className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
              >
                <span className="min-w-0">
                  <span className="block truncate">{validator.name}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {validator.id} {validator.version}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 font-mono tabular-nums">
                  {validator.findingCount === 0 ? "clean" : `${validator.findingCount}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-warning/40 bg-warning/5 flex flex-col gap-1 border-s-2 px-3 py-2">
          <p className="text-xs font-medium">Not verified</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{EXECUTION_DISCLOSURE}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            A passing report means the package is well-formed, not that the task works.
          </p>
        </div>
      </div>
    </Disclosure>
  );
}

export function ProvenanceDisclosure({
  provenance,
  artifactName,
}: {
  provenance: RunProvenance;
  artifactName: string;
}): ReactElement {
  return (
    <Disclosure summary="Provenance">
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">Benchmark</dt>
        <dd>{provenance.benchmark ?? "not detected"}</dd>

        <dt className="text-muted-foreground">Version</dt>
        <dd>{provenance.benchmarkVersion ?? "not recorded"}</dd>

        <dt className="text-muted-foreground">Artifact</dt>
        <dd className="break-all">{artifactName}</dd>

        <dt className="text-muted-foreground">SHA-256</dt>
        <dd className="break-all font-mono text-[10px]">
          {provenance.artifactContentHash ?? "not recorded"}
        </dd>

        <dt className="text-muted-foreground">Size</dt>
        <dd>{formatBytes(provenance.artifactByteSize)}</dd>

        <dt className="text-muted-foreground">Policy</dt>
        <dd>{provenance.policy}</dd>

        <dt className="text-muted-foreground">Checks</dt>
        <dd>
          {provenance.validators.length === 0
            ? "none recorded"
            : provenance.validators.map((validator) => validator.id).join(", ")}
        </dd>

        <dt className="text-muted-foreground">Started</dt>
        <dd>{formatTimestamp(provenance.startedAt)}</dd>

        <dt className="text-muted-foreground">Completed</dt>
        <dd>{formatTimestamp(provenance.completedAt)}</dd>

        <dt className="text-muted-foreground">Duration</dt>
        <dd>{provenance.durationMs === null ? "not recorded" : `${provenance.durationMs} ms`}</dd>

        <dt className="text-muted-foreground">Execution</dt>
        <dd className="text-warning">Not performed</dd>
      </dl>
    </Disclosure>
  );
}
