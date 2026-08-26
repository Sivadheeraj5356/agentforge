import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { TrajectoryViewer } from "@/modules/evaluations/components/trajectory-viewer";
import { listEvaluationRunsForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import { listTrialMatrix, listTrialsForOrganization } from "@/modules/evaluations/server/trials";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";

export default async function TrialsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web trials");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);

  let trials: Awaited<ReturnType<typeof listTrialsForOrganization>> = [];
  let matrix: Awaited<ReturnType<typeof listTrialMatrix>> = [];
  let loadError: string | undefined;
  try {
    const runs = await listEvaluationRunsForOrganization(organization.id);
    trials = await listTrialsForOrganization(organization.id);
    matrix = await listTrialMatrix(runs, trials);
  } catch {
    loadError = "Unable to load trials.";
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Trials</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Model × task rewards from stored trial rows. Empty cells mean the pair has not been run.
          Failure categories are assigned by deterministic rules, not an LLM.
        </p>
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {matrix.length === 0 ? (
        <DomainEmptyState
          title="No trials yet"
          description="Queue an evaluation and run the evaluator worker. This table is filled from evaluation_trials, never from invented scores."
        />
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Mean reward by harness and task</caption>
          <thead>
            <tr className="border-border border-b">
              <th className="py-2 pr-4 font-medium">Harness</th>
              <th className="py-2 pr-4 font-medium">Task</th>
              <th className="py-2 pr-4 font-medium">Mean reward</th>
              <th className="py-2 font-medium">Trials</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((cell) => (
              <tr key={`${cell.agentName}-${cell.taskKey}`} className="border-border border-b">
                <td className="py-2 pr-4 font-mono text-xs">{cell.agentName}</td>
                <td className="py-2 pr-4 font-mono text-xs">{cell.taskKey}</td>
                <td className="py-2 pr-4 font-mono text-xs">{cell.meanReward.toFixed(4)}</td>
                <td className="py-2 font-mono text-xs">{cell.trialCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {trials.length > 0 ? (
        <section aria-labelledby="recent-trials-heading" className="flex flex-col gap-3">
          <h2 id="recent-trials-heading" className="font-serif text-lg tracking-tight">
            Recent attempts
          </h2>
          <ul className="border-border divide-border divide-y border-y">
            {trials.slice(0, 20).map((trial) => (
              <li key={trial.id} className="flex flex-col gap-2 px-1 py-3">
                <div className="flex items-baseline justify-between gap-4">
                  <Link
                    href={`/app/${organization.slug}/evaluations/${trial.evaluation_run_id}`}
                    className="font-mono text-xs underline-offset-4 hover:underline"
                  >
                    attempt {trial.attempt_index}
                  </Link>
                  <span className="text-muted-foreground text-sm">
                    {trial.failure_category ?? "—"} · {trial.reward ?? "queued"}
                  </span>
                </div>
                {trial.steps.length > 0 ? <TrajectoryViewer steps={trial.steps} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
