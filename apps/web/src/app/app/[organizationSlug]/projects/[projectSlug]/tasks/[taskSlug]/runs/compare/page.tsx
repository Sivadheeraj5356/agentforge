import type { ReactElement } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compareValidationRuns, type ComparableFinding } from "@agentforge/validation";
import { assertNeverExecutesUserCode } from "@agentforge/security";
import { Button } from "@agentforge/ui";

import { RunComparisonView } from "@/modules/tasks/components/run-comparison";
import { Breadcrumbs } from "@/modules/tasks/components/task-header";
import type { InspectorFinding } from "@/modules/tasks/model";
import {
  listRunHistoryForTask,
  loadRunFindings,
  requireTaskRunContext,
  resolveTaskRunContext,
} from "@/modules/tasks/server/task-runs";

function toComparable(finding: InspectorFinding): ComparableFinding {
  return {
    fingerprint: finding.fingerprint,
    severity: finding.severity,
    code: finding.code,
    category: finding.category,
    title: finding.title,
    validatorId: finding.validatorId,
    ordinal: finding.ordinal,
    evidencePath: finding.evidence.path,
    evidenceLine: finding.evidence.line,
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Compares two runs of the same task. The diff itself is
 * `compareValidationRuns` from `@agentforge/validation` — the same function a future
 * CI gate or analytics job would call, operating on persisted fingerprints rather
 * than on anything rendered here.
 */
export default async function CompareRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; projectSlug: string; taskSlug: string }>;
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}): Promise<ReactElement> {
  assertNeverExecutesUserCode("apps/web run comparison");
  const [{ organizationSlug, projectSlug, taskSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);

  const latest = await requireTaskRunContext({ organizationSlug, projectSlug, taskSlug });
  const { organization, project, task, taskBasePath } = latest;
  const history = (await listRunHistoryForTask(project.id, task.slug)).filter(
    (entry) => entry.hasTask,
  );

  const projectPath = `/app/${organization.slug}/projects/${project.slug}`;
  const defaultTo = history[0]?.runNumber;
  const defaultFrom = history[1]?.runNumber;
  const requestedTo =
    firstValue(query.to) ?? (defaultTo === undefined ? undefined : String(defaultTo));
  const requestedFrom =
    firstValue(query.from) ?? (defaultFrom === undefined ? undefined : String(defaultFrom));

  const header = (
    <header className="border-border flex flex-col gap-3 border-b pb-5">
      <Breadcrumbs
        trail={[
          { label: "Projects", href: `/app/${organization.slug}/projects` },
          { label: project.name, href: projectPath },
          { label: "Tasks", href: `${projectPath}/tasks` },
          { label: task.name, href: taskBasePath },
          { label: "Compare" },
        ]}
      />
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Compare runs</h1>
      <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
        Findings are matched by fingerprint — the finding code plus its validator and evidence
        location — so a re-ordered report reads as unchanged.
      </p>
    </header>
  );

  if (history.length < 2 || requestedFrom === undefined || requestedTo === undefined) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="border-border flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-8">
          <p className="text-sm font-medium">Nothing to compare yet</p>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            This task has been validated once. Upload the package again after a change and the two
            runs can be compared here.
          </p>
          <Link href={taskBasePath} className="text-sm underline underline-offset-4">
            Back to {task.name}
          </Link>
        </div>
      </div>
    );
  }

  const [previous, current] = await Promise.all([
    resolveTaskRunContext({ organizationSlug, projectSlug, taskSlug, runNumber: requestedFrom }),
    resolveTaskRunContext({ organizationSlug, projectSlug, taskSlug, runNumber: requestedTo }),
  ]);

  if (!previous || !current) {
    notFound();
  }

  const [previousFindings, currentFindings] = await Promise.all([
    loadRunFindings(previous.run.id, previous.run.validators),
    loadRunFindings(current.run.id, current.run.validators),
  ]);

  const comparison = compareValidationRuns(
    { runId: previous.run.id, findings: previousFindings.map(toComparable) },
    { runId: current.run.id, findings: currentFindings.map(toComparable) },
  );

  return (
    <div className="flex flex-col gap-6">
      {header}

      <form method="get" className="flex flex-wrap items-end gap-4">
        <RunSelect
          name="from"
          label="Baseline run"
          runs={history}
          selected={previous.run.run_number}
        />
        <RunSelect
          name="to"
          label="Compared run"
          runs={history}
          selected={current.run.run_number}
        />
        <Button type="submit" variant="outline" size="sm">
          Compare
        </Button>
      </form>

      <RunComparisonView
        comparison={comparison}
        previousRunNumber={previous.run.run_number}
        currentRunNumber={current.run.run_number}
        taskBasePath={taskBasePath}
      />
    </div>
  );
}

function RunSelect({
  name,
  label,
  runs,
  selected,
}: {
  name: string;
  label: string;
  runs: readonly { runNumber: number; createdAt: string }[];
  selected: number;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`compare-${name}`} className="text-muted-foreground text-xs">
        {label}
      </label>
      <select
        id={`compare-${name}`}
        name={name}
        defaultValue={String(selected)}
        className="border-border bg-surface h-(--height-control) rounded-md border px-2 text-sm"
      >
        {runs.map((run) => (
          <option key={run.runNumber} value={run.runNumber}>
            {`Run ${run.runNumber} · ${run.createdAt.slice(0, 10)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
