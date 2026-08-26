import type { ReactElement } from "react";
import Link from "next/link";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { DomainEmptyState } from "@/components/domain-empty-state";
import { WorkspaceShortcutLinks } from "@/components/workspace-shortcuts";
import { EnqueueEvaluationForm } from "@/modules/evaluations/components/enqueue-evaluation-form";
import { listPublishedCatalogTasks } from "@/modules/evaluations/server/catalog";
import { listEvaluationRunsForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import { requireOrganizationBySlug } from "@/modules/organizations/server/access";
import { canManageProjects } from "@/modules/projects/permissions";
import { listRecentProjects } from "@/modules/projects/server/projects";

function formatReward(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}

export default async function EvaluationsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web evaluations");
  const { organizationSlug } = await params;
  const organization = await requireOrganizationBySlug(organizationSlug);
  const canEnqueue = canManageProjects(organization.role);

  let runs: Awaited<ReturnType<typeof listEvaluationRunsForOrganization>> = [];
  let tasks: Awaited<ReturnType<typeof listPublishedCatalogTasks>> = [];
  let projects: Awaited<ReturnType<typeof listRecentProjects>> = [];
  let loadError: string | undefined;
  try {
    [runs, tasks, projects] = await Promise.all([
      listEvaluationRunsForOrganization(organization.id),
      listPublishedCatalogTasks(),
      listRecentProjects(organization.id, 50),
    ]);
  } catch {
    loadError = "Unable to load evaluation runs.";
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border flex flex-col gap-2 border-b pb-6">
        <h1 className="font-serif text-2xl tracking-tight">Evaluations</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Queue Oracle, NOP, reference, BYO, or multi-agent trials against a pinned catalog task. The
          control plane stores job metadata; the evaluator worker starts the sandbox.
        </p>
        <WorkspaceShortcutLinks
          organizationSlug={organization.slug}
          ids={["trials", "results", "reviews", "suites", "benchmarks"]}
        />
      </header>

      {loadError ? (
        <p role="alert" className="text-danger text-sm">
          {loadError}
        </p>
      ) : null}

      {canEnqueue ? (
        <section aria-labelledby="enqueue-heading" className="flex flex-col gap-3">
          <h2 id="enqueue-heading" className="font-serif text-lg tracking-tight">
            Queue a run
          </h2>
          <EnqueueEvaluationForm
            organizationSlug={organization.slug}
            projects={projects.map((project) => ({ slug: project.slug, name: project.name }))}
            tasks={tasks}
          />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Owner or admin role required to queue runs.</p>
      )}

      {runs.length === 0 ? (
        <DomainEmptyState
          title="No evaluation runs"
          description="Queue an oracle or NOP trial on a catalog task. Scores appear after the evaluator worker claims the job."
        />
      ) : (
        <ul className="border-border divide-border divide-y border-y">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/app/${organization.slug}/evaluations/${run.id}`}
                className="hover:bg-muted/50 flex flex-col gap-1 px-1 py-3 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium tracking-tight">
                    {run.projectSlug} / run {run.run_number}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {run.taskKey ?? "task"} · {run.agentName ?? "harness"}
                  </span>
                </span>
                <span className="text-muted-foreground flex gap-4 text-sm">
                  <span>{run.status}</span>
                  <span className="font-mono text-xs">reward {formatReward(run.meanReward)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
