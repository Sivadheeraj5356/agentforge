import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { listEvaluationRunsForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import { recordedProtocolRuns } from "@/modules/evaluations/server/protocol-runs";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export default async function ProtocolResultsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web protocol results");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);

  let rows: ReturnType<typeof recordedProtocolRuns> = [];
  let loadError: string | undefined;
  try {
    const runs = await listEvaluationRunsForOrganization(organization.id);
    rows = recordedProtocolRuns(runs);
  } catch {
    loadError = "Unable to load protocol runs.";
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Horizon v1 protocol</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Recorded oracle, NOP, BYO, and reference rows only. Empty means no protocol runs have
          been written — not 0%. This is not a Fable 5 board.
        </p>
        <Link href={`/app/${organization.slug}/results`} className="text-sm underline underline-offset-4">
          All results
        </Link>
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <DomainEmptyState
          title="No recorded protocol runs"
          description="Run oracle, NOP, or the example BYO agent on Horizon v1 tasks. Scores appear here after the evaluator worker writes them."
        />
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {rows.map((run) => (
            <li key={run.id} className="flex flex-col gap-1 px-1 py-3">
              <Link
                href={`/app/${organization.slug}/evaluations/${run.id}`}
                className="font-medium tracking-tight underline-offset-4 hover:underline"
              >
                {run.taskKey ?? "task"} · {run.agentName}
              </Link>
              <span className="text-muted-foreground font-mono text-xs">
                {run.passAt1 !== null
                  ? `pass@1 ${run.passAt1.toFixed(4)}`
                  : `mean ${run.meanReward?.toFixed(4) ?? "—"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
