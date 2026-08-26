import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { AblationScoreTable } from "@/modules/evaluations/components/ablation-score-table";
import { PlanExperimentForm } from "@/modules/evaluations/components/plan-experiment-form";
import { groupAblationRuns } from "@/modules/evaluations/server/ablation";
import { listEvaluationRunsForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import { listTrainingExperiments } from "@/modules/evaluations/server/experiments";
import { listEvaluationResultsForOrganization } from "@/modules/evaluations/server/results";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { listRecentProjects } from "@/modules/projects/server/projects";

function payloadSummary(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return "result";
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.summary === "string") {
    return record.summary;
  }
  if (typeof record.meanReward === "number") {
    return `mean reward ${record.meanReward.toFixed(4)}`;
  }
  return "result";
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web results");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canPlan = canManageProjects(organization.role);

  let results: Awaited<ReturnType<typeof listEvaluationResultsForOrganization>> = [];
  let experiments: Awaited<ReturnType<typeof listTrainingExperiments>> = [];
  let projects: Awaited<ReturnType<typeof listRecentProjects>> = [];
  let ablationGroups: ReturnType<typeof groupAblationRuns> = [];
  let loadError: string | undefined;
  try {
    const [resultRows, experimentRows, projectRows, runs] = await Promise.all([
      listEvaluationResultsForOrganization(organization.id),
      listTrainingExperiments(organization.id),
      listRecentProjects(organization.id, 50),
      listEvaluationRunsForOrganization(organization.id),
    ]);
    results = resultRows;
    experiments = experimentRows;
    projects = projectRows;
    ablationGroups = groupAblationRuns(runs);
  } catch {
    loadError = "Unable to load results.";
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Results</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Scores written by the evaluator worker. Training experiment rows can be planned here;
          metrics stay empty until `services/training --execute` and a held-out evaluator run.
        </p>
        <Link
          href={`/app/${organizationSlug}/results/protocol`}
          className="text-sm underline underline-offset-4"
        >
          Horizon v1 recorded protocol
        </Link>
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {results.length === 0 ? (
        <DomainEmptyState
          title="No results yet"
          description="Result rows attach to an evaluation run after the worker grades a trial."
        />
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {results.map((result) => (
            <li key={result.id} className="flex items-baseline justify-between gap-4 px-1 py-3">
              <span className="text-sm">{payloadSummary(result.payload)}</span>
              <span className="text-muted-foreground text-sm">{result.result_kind}</span>
            </li>
          ))}
        </ul>
      )}

      <AblationScoreTable groups={ablationGroups} />

      <section aria-labelledby="experiments-heading" className="flex flex-col gap-4">
        <h2 id="experiments-heading" className="font-serif text-lg tracking-tight">
          Training experiments
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Planned SFT/GRPO records with a train vs held-out split. Do not treat empty metrics as a
          published score.
        </p>
        {experiments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No experiments recorded.</p>
        ) : (
          <ul className="border-border divide-border divide-y border-y">
            {experiments.map((experiment) => (
              <li key={experiment.id} className="flex flex-col gap-1 px-1 py-3">
                <span className="font-medium tracking-tight">{experiment.name}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {experiment.stage} · {experiment.status} · train {experiment.train_task_count} /
                  held-out {experiment.held_out_task_count}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canPlan ? (
          <PlanExperimentForm
            organizationSlug={organization.slug}
            projects={projects.map((project) => ({ slug: project.slug, name: project.name }))}
          />
        ) : null}
      </section>
    </div>
  );
}
