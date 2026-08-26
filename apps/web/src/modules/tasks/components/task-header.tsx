import type { ReactElement } from "react";
import Link from "next/link";

import { OutcomeBadge } from "@/modules/tasks/components/severity";
import { shortenHash, type RunSummary, type TaskHeader } from "@/modules/tasks/model";

/**
 * Breadcrumbs and the facts a reviewer needs before reading a single finding.
 * Everything shown here is recorded on the run — there is no difficulty rating, no
 * pass rate, and no model score, because nothing in this product measures those.
 */

export type Crumb = { readonly label: string; readonly href?: string };

export function Breadcrumbs({ trail }: { trail: readonly Crumb[] }): ReactElement {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground/60">
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="hover:text-foreground rounded-sm underline-offset-4 hover:underline"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Fact({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
        {label}
      </dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "not recorded";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "not recorded"
    : parsed.toISOString().replace("T", " ").slice(0, 16);
}

export function TaskHeaderBlock({
  trail,
  task,
  run,
  completedAt,
  actions,
}: {
  trail: readonly Crumb[];
  task: TaskHeader;
  run: RunSummary;
  completedAt: string | null;
  actions?: ReactElement;
}): ReactElement {
  return (
    <header className="border-border flex flex-col gap-4 border-b pb-4">
      <Breadcrumbs trail={trail} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight">{task.name}</h1>
          <p className="text-muted-foreground font-mono text-xs">
            {task.externalKey}
            {task.taskVersion ? ` · version ${task.taskVersion}` : ""}
            {task.rootPath.length > 0 ? ` · ${task.rootPath}/` : ""}
          </p>
        </div>
        {actions}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
            Validation
          </dt>
          <dd className="text-xs">
            <OutcomeBadge outcome={run.outcome} status={run.status} />
          </dd>
        </div>
        <Fact
          label="Benchmark"
          value={
            run.benchmark
              ? `${run.benchmark}${run.benchmarkVersion ? ` ${run.benchmarkVersion}` : ""}`
              : "not detected"
          }
        />
        <Fact label="Run" value={`#${run.runNumber}`} />
        <Fact label="Last validated" value={formatTimestamp(completedAt ?? run.createdAt)} />
        <Fact label="Artifact" value={shortenHash(run.artifactContentHash) ?? "unrecorded"} />
        <Fact
          label="Findings"
          value={run.counts.total === 1 ? "1 finding" : `${run.counts.total} findings`}
        />
      </dl>
    </header>
  );
}
