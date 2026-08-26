import type { ReactElement } from "react";
import Link from "next/link";
import { buildFileTree } from "@agentforge/validation";

import { ChecksDisclosure, ProvenanceDisclosure } from "@/modules/tasks/components/disclosures";
import { RunHistory } from "@/modules/tasks/components/run-history";
import { TaskHeaderBlock } from "@/modules/tasks/components/task-header";
import { TaskInspector } from "@/modules/tasks/components/task-inspector";
import { parseFindingFilters } from "@/modules/tasks/filters";
import { projectCounts, projectRunSummary } from "@/modules/tasks/model";
import { loadTaskManifest } from "@/modules/tasks/server/file-content";
import {
  listRunHistoryForTask,
  loadRunFindings,
  loadRunProvenance,
  requireTaskRunContext,
} from "@/modules/tasks/server/task-runs";
import { TaskEvaluationDashboard } from "@/modules/evaluations/components/task-evaluation-dashboard";
import { listEvaluationsForTaskKey } from "@/modules/evaluations/server/task-evaluations";

export type InspectorSearchParams = {
  readonly severity?: string | string[];
  readonly category?: string | string[];
  readonly q?: string | string[];
  readonly file?: string | string[];
  readonly line?: string | string[];
  readonly section?: string | string[];
};

function firstValue(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === undefined || raw.length === 0 ? null : raw;
}

function parseLine(value: string | string[] | undefined): number | null {
  const raw = firstValue(value);
  if (raw === null) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The inspector, rendered on the server.
 *
 * Everything a reviewer needs to read the report — task, run, findings,
 * provenance, and the file manifest — is loaded here. The client receives the
 * projection and fetches exactly one thing on its own: the body of the file the
 * reviewer opened.
 */
export async function TaskInspectorPage({
  organizationSlug,
  projectSlug,
  taskSlug,
  runNumber,
  searchParams,
}: {
  organizationSlug: string;
  projectSlug: string;
  taskSlug: string;
  runNumber?: string;
  searchParams: InspectorSearchParams;
}): Promise<ReactElement> {
  const context = await requireTaskRunContext({
    organizationSlug,
    projectSlug,
    taskSlug,
    runNumber,
  });
  const { organization, project, task, run } = context;

  const [findings, manifest, history, evaluations] = await Promise.all([
    loadRunFindings(run.id, run.validators),
    loadTaskManifest(context, context.siblingTaskRootPaths),
    listRunHistoryForTask(project.id, task.slug),
    listEvaluationsForTaskKey(organization.id, project.id, task.externalKey),
  ]);
  const provenance = await loadRunProvenance(run, findings);

  const summary = projectRunSummary(run);
  const projectPath = `/app/${organization.slug}/projects/${project.slug}`;
  const runBasePath = `${context.taskBasePath}/runs/${run.run_number}`;
  const isLatestRun = history.find((entry) => entry.hasTask)?.runNumber === run.run_number;

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <TaskHeaderBlock
        trail={[
          { label: "Projects", href: `/app/${organization.slug}/projects` },
          { label: project.name, href: projectPath },
          { label: "Tasks", href: `${projectPath}/tasks` },
          { label: task.name },
        ]}
        task={task}
        run={summary}
        completedAt={run.completed_at}
        actions={
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {isLatestRun ? null : (
              <Link href={context.taskBasePath} className="underline underline-offset-4">
                Latest run
              </Link>
            )}
            <Link
              href={`${context.taskBasePath}/runs/compare`}
              className="underline underline-offset-4"
            >
              Compare runs
            </Link>
          </div>
        }
      />

      <RunHistory
        history={history}
        activeRunNumber={run.run_number}
        taskBasePath={context.taskBasePath}
      />

      <TaskEvaluationDashboard
        organizationSlug={organization.slug}
        taskBasePath={context.taskBasePath}
        section={firstValue(searchParams.section)}
        runs={evaluations.runs}
        trialsByRunId={evaluations.trialsByRunId}
      />

      {evaluations.runs.length > 0 ? (
        <p className="text-sm">
          <Link
            href={`/app/${organization.slug}/evaluations/${evaluations.runs[0]?.id}/report`}
            className="underline underline-offset-4"
          >
            Download JSON report
          </Link>
        </p>
      ) : null}

      <TaskInspector
        fileEndpoint={`${runBasePath}/file`}
        tree={buildFileTree(manifest)}
        findings={findings}
        counts={projectCounts(run)}
        outcome={summary.outcome}
        status={summary.status}
        errorMessage={run.error_message}
        initialFilters={parseFindingFilters(searchParams)}
        initialPath={firstValue(searchParams.file)}
        initialLine={parseLine(searchParams.line)}
        disclosures={
          <>
            <ChecksDisclosure
              provenance={provenance}
              validatorErrorCount={run.validator_error_count}
            />
            <ProvenanceDisclosure
              provenance={provenance}
              artifactName={`${task.externalKey}.zip`}
            />
          </>
        }
      />
    </div>
  );
}
