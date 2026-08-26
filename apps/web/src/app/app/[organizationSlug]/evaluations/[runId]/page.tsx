import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { assertNeverExecutesUserCode } from "@agentforge/security";
import { Button } from "@agentforge/ui";

import { cancelEvaluationAction } from "@/modules/evaluations/actions";
import { TrajectoryViewer } from "@/modules/evaluations/components/trajectory-viewer";
import { OpenReviewForm } from "@/modules/reviews/components/open-review-form";
import { getEvaluationRunForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import { buildEvaluationJsonReport } from "@/modules/evaluations/server/report";
import { listTrialsForRun } from "@/modules/evaluations/server/trials";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";

function formatReward(value: string | number | null): string {
  if (value === null) {
    return "—";
  }
  return Number(value).toFixed(4);
}

export default async function EvaluationRunPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; runId: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web evaluation run");
  const { organizationSlug, runId } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const run = await getEvaluationRunForOrganization(organization.id, runId);
  if (!run) {
    notFound();
  }
  const trials = await listTrialsForRun(run.id);
  const report = await buildEvaluationJsonReport(organization.id, runId);
  const canCancel =
    canManageProjects(organization.role) && (run.status === "queued" || run.status === "running");

  return (
    <div className="flex flex-col gap-6">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.14em]">
          <Link
            href={`/app/${organization.slug}/evaluations`}
            className="underline-offset-4 hover:underline"
          >
            Evaluations
          </Link>
          <span aria-hidden="true"> / </span>
          run {run.run_number}
        </p>
        <h1 className="font-serif text-2xl tracking-tight">
          {run.projectName} run {run.run_number}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {run.taskKey ?? "catalog task"} · {report?.harness ?? run.agentName ?? "harness"} ·{" "}
          {run.status}
        </p>
        {report ? (
          <dl className="text-muted-foreground grid max-w-3xl gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">pass@1 / pass@k</dt>
              <dd className="font-mono text-xs">
                {formatReward(report.scores.passAt1)} / {formatReward(report.scores.passAtK)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">mean / median reward</dt>
              <dd className="font-mono text-xs">
                {formatReward(report.scores.meanReward)} / {formatReward(report.scores.medianReward)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">latency / tool calls</dt>
              <dd className="font-mono text-xs">
                {report.scores.meanLatencyMs === null
                  ? "—"
                  : `${Math.round(report.scores.meanLatencyMs)} ms`}{" "}
                / {formatReward(report.scores.meanToolCalls)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">cost / tokens</dt>
              <dd className="font-mono text-xs">
                {report.costUsd === null ? "—" : `$${report.costUsd.toFixed(4)}`} /{" "}
                {report.promptTokens ?? "—"} / {report.completionTokens ?? "—"}
              </dd>
            </div>
          </dl>
        ) : null}
        {report && Object.keys(report.stageScores).length > 0 ? (
          <p className="font-mono text-muted-foreground text-xs">
            stages:{" "}
            {Object.entries(report.stageScores)
              .map(([key, value]) => `${key}=${value.toFixed(2)}`)
              .join(" · ")}
          </p>
        ) : null}
        <p className="text-sm">
          <Link
            href={`/app/${organization.slug}/evaluations/${run.id}/report`}
            className="underline underline-offset-4"
          >
            JSON report
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href={report?.failedRolloutsHref ?? "/api/v1/rollouts?kind=failed"} className="underline underline-offset-4">
            Failed rollouts
          </Link>
        </p>
      </header>

      {canCancel ? (
        <form action={cancelEvaluationAction}>
          <input type="hidden" name="organizationSlug" value={organization.slug} />
          <input type="hidden" name="runId" value={run.id} />
          <Button type="submit" variant="outline">
            Cancel run
          </Button>
        </form>
      ) : null}

      <OpenReviewForm organizationSlug={organization.slug} evaluationRunId={run.id} />

      {trials.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No trials yet. Start `python -m evaluator worker` with the service role to claim this job.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {trials.map((trial) => (
            <li key={trial.id} className="border-border rounded-lg border px-4 py-3">
              <p className="text-sm font-medium">
                Attempt {trial.attempt_index} · reward {formatReward(trial.reward)} ·{" "}
                {trial.failure_category ?? "unclassified"}
              </p>
              {trial.steps.length > 0 ? (
                <TrajectoryViewer steps={trial.steps} />
              ) : (
                <p className="text-muted-foreground mt-2 text-xs">No trajectory steps recorded.</p>
              )}
              {trial.trajectory_artifact_id ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Full trajectory JSON is stored as artifact {trial.trajectory_artifact_id}. Metrics
                  keep up to 256 steps.
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
