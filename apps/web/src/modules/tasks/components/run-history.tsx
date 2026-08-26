import type { ReactElement } from "react";
import Link from "next/link";
import { cn } from "@agentforge/ui";

import { OutcomeBadge } from "@/modules/tasks/components/severity";
import { shortenHash, type RunHistoryEntry } from "@/modules/tasks/model";

/**
 * Run history for one task. Runs are immutable, so an older entry opens the same
 * inspector with that run's own findings, manifest, and provenance.
 *
 * Runs are cited by their per-project number. The UUID stays server-side.
 */

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "unknown"
    : parsed.toISOString().slice(0, 16).replace("T", " ");
}

export function RunHistory({
  history,
  activeRunNumber,
  taskBasePath,
}: {
  history: readonly RunHistoryEntry[];
  activeRunNumber: number;
  taskBasePath: string;
}): ReactElement | null {
  const runs = history.filter((entry) => entry.hasTask);
  if (runs.length <= 1) {
    return null;
  }

  return (
    <details className="border-border group rounded-md border">
      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
        <span
          aria-hidden="true"
          className="text-muted-foreground transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
        >
          ›
        </span>
        <span>Run history</span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">{runs.length}</span>
        <span className="text-muted-foreground ms-auto font-mono text-xs">
          viewing run {activeRunNumber}
        </span>
      </summary>

      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <caption className="sr-only">Validation runs that contain this task</caption>
          <thead className="text-muted-foreground border-border border-y">
            <tr>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Run
              </th>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Created
              </th>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Result
              </th>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Findings
              </th>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Benchmark
              </th>
              <th scope="col" className="px-3 py-1.5 text-start font-normal">
                Artifact
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {runs.map((run) => (
              <tr
                key={run.runNumber}
                className={cn(run.runNumber === activeRunNumber && "bg-accent/8")}
              >
                <th scope="row" className="px-3 py-1.5 text-start font-medium">
                  <Link
                    href={`${taskBasePath}/runs/${run.runNumber}`}
                    aria-current={run.runNumber === activeRunNumber ? "page" : undefined}
                    className="rounded-sm underline-offset-4 hover:underline"
                  >
                    #{run.runNumber}
                  </Link>
                </th>
                <td className="text-muted-foreground px-3 py-1.5 font-mono tabular-nums">
                  {formatDate(run.createdAt)}
                </td>
                <td className="px-3 py-1.5">
                  <OutcomeBadge outcome={run.outcome} status={run.status} />
                </td>
                <td className="px-3 py-1.5 font-mono tabular-nums">{run.counts.total}</td>
                <td className="text-muted-foreground px-3 py-1.5 font-mono">
                  {run.benchmark ?? "—"}
                  {run.benchmarkVersion ? ` ${run.benchmarkVersion}` : ""}
                </td>
                <td className="text-muted-foreground px-3 py-1.5 font-mono">
                  {shortenHash(run.artifactContentHash, 10) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
