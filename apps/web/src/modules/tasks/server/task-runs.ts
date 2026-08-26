import { cache } from "react";
import { notFound } from "next/navigation";
import type { Database } from "@agentforge/contracts";
import { TaskSlugSchema, ValidationRunNumberSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { requireProjectBySlug, type Project } from "@/modules/projects/server/projects";
import type { AccessibleOrganization } from "@/modules/organizations/server/access";
import {
  projectFinding,
  projectProvenance,
  projectRunSummary,
  readValidatorDescriptors,
  type InspectorFinding,
  type RunHistoryEntry,
  type RunProvenance,
  type RunSummary,
  type TaskHeader,
} from "@/modules/tasks/model";

type ValidationRunRow = Database["public"]["Tables"]["validation_runs"]["Row"];
type ValidationRunTaskRow = Database["public"]["Tables"]["validation_run_tasks"]["Row"];

/**
 * How many runs of a project the inspector indexes. History is bounded so a
 * project with thousands of runs cannot turn a page load into a full scan; the
 * newest runs are the ones a reviewer opens.
 */
const MAX_INDEXED_RUNS = 200;

export type TaskRunContext = {
  readonly organization: AccessibleOrganization;
  readonly project: Project;
  readonly task: TaskHeader;
  readonly run: ValidationRunRow;
  readonly taskBasePath: string;
  /** Roots of the run's other tasks, so this task's file scope excludes them. */
  readonly siblingTaskRootPaths: readonly string[];
};

export type TaskListEntry = {
  readonly slug: string;
  readonly name: string;
  readonly latestRun: RunSummary;
  readonly runCount: number;
};

type ProjectRunIndex = {
  readonly runs: readonly ValidationRunRow[];
  readonly tasksByRunId: ReadonlyMap<string, readonly ValidationRunTaskRow[]>;
};

/**
 * One bounded read of a project's recent runs plus the tasks each contained.
 * Cached per request so the header, the history list, and the task resolver do
 * not each hit the database.
 */
const loadProjectRunIndex = cache(async (projectId: string): Promise<ProjectRunIndex> => {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data: runs, error: runsError } = await supabase
    .from("validation_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("run_number", { ascending: false })
    .limit(MAX_INDEXED_RUNS);

  if (runsError) {
    throw new Error("Unable to load validation runs for this project.");
  }
  if (!runs || runs.length === 0) {
    return { runs: [], tasksByRunId: new Map() };
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("validation_run_tasks")
    .select("*")
    .in(
      "validation_run_id",
      runs.map((run) => run.id),
    )
    .order("ordinal", { ascending: true });

  if (tasksError) {
    throw new Error("Unable to load tasks for this project.");
  }

  const tasksByRunId = new Map<string, ValidationRunTaskRow[]>();
  for (const task of tasks ?? []) {
    const existing = tasksByRunId.get(task.validation_run_id);
    if (existing) {
      existing.push(task);
    } else {
      tasksByRunId.set(task.validation_run_id, [task]);
    }
  }

  return { runs, tasksByRunId };
});

function toTaskHeader(row: ValidationRunTaskRow): TaskHeader {
  return {
    slug: row.slug,
    name: row.name,
    externalKey: row.external_key,
    rootPath: row.root_path,
    taskVersion: row.task_version,
  };
}

/** Tasks a project has validated, newest run first. Empty until a package is validated. */
export async function listProjectTasks(projectId: string): Promise<readonly TaskListEntry[]> {
  const { runs, tasksByRunId } = await loadProjectRunIndex(projectId);
  const entries = new Map<string, { entry: TaskListEntry; count: number }>();

  for (const run of runs) {
    for (const task of tasksByRunId.get(run.id) ?? []) {
      const existing = entries.get(task.slug);
      if (existing) {
        entries.set(task.slug, { entry: existing.entry, count: existing.count + 1 });
        continue;
      }
      entries.set(task.slug, {
        entry: {
          slug: task.slug,
          name: task.name,
          latestRun: projectRunSummary(run),
          runCount: 1,
        },
        count: 1,
      });
    }
  }

  return [...entries.values()]
    .map(({ entry, count }) => ({ ...entry, runCount: count }))
    .sort((left, right) => right.latestRun.runNumber - left.latestRun.runNumber);
}

/**
 * Resolves organization → project → task → run, or returns null.
 *
 * Returning null rather than throwing lets the route handler answer with a plain
 * 404: a task in another organization must be indistinguishable from one that does
 * not exist. `requireProjectBySlug` already enforces membership through RLS, and
 * every follow-up query is scoped to that project.
 */
export async function resolveTaskRunContext(input: {
  readonly organizationSlug: string;
  readonly projectSlug: string;
  readonly taskSlug: string;
  /** Per-project display number. Absent means "the newest run that has this task". */
  readonly runNumber?: string | number;
}): Promise<TaskRunContext | null> {
  const slug = TaskSlugSchema.safeParse(input.taskSlug);
  if (!slug.success) {
    return null;
  }

  const { organization, project } = await requireProjectBySlug(
    input.organizationSlug,
    input.projectSlug,
  );
  const { runs, tasksByRunId } = await loadProjectRunIndex(project.id);

  const candidates =
    input.runNumber === undefined
      ? runs
      : (() => {
          const parsed = ValidationRunNumberSchema.safeParse(input.runNumber);
          return parsed.success ? runs.filter((run) => run.run_number === parsed.data) : [];
        })();

  for (const run of candidates) {
    const runTasks = tasksByRunId.get(run.id) ?? [];
    const task = runTasks.find((entry) => entry.slug === slug.data);
    if (task) {
      return {
        organization,
        project,
        task: toTaskHeader(task),
        run,
        taskBasePath: `/app/${organization.slug}/projects/${project.slug}/tasks/${slug.data}`,
        siblingTaskRootPaths: runTasks
          .filter((entry) => entry.slug !== slug.data)
          .map((entry) => entry.root_path),
      };
    }
  }

  return null;
}

export async function requireTaskRunContext(input: {
  readonly organizationSlug: string;
  readonly projectSlug: string;
  readonly taskSlug: string;
  readonly runNumber?: string | number;
}): Promise<TaskRunContext> {
  const context = await resolveTaskRunContext(input);
  if (!context) {
    notFound();
  }
  return context;
}

/** Every indexed run of this project, flagged with whether it contains the task. */
export async function listRunHistoryForTask(
  projectId: string,
  taskSlug: string,
): Promise<readonly RunHistoryEntry[]> {
  const { runs, tasksByRunId } = await loadProjectRunIndex(projectId);
  return runs.map((run) => ({
    ...projectRunSummary(run),
    hasTask: (tasksByRunId.get(run.id) ?? []).some((task) => task.slug === taskSlug),
  }));
}

/** Findings in the deterministic order the pipeline assigned. */
export const loadRunFindings = cache(
  async (runId: string, validators: unknown): Promise<readonly InspectorFinding[]> => {
    await requireAuthenticatedUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("validation_findings")
      .select("*")
      .eq("validation_run_id", runId)
      .order("ordinal", { ascending: true });

    if (error) {
      throw new Error("Unable to load validation findings.");
    }

    const descriptors = readValidatorDescriptors(validators);
    return (data ?? []).map((row) => projectFinding(row, descriptors));
  },
);

export async function loadRunProvenance(
  run: ValidationRunRow,
  findings: readonly InspectorFinding[],
): Promise<RunProvenance> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("artifacts")
    .select("byte_size")
    .eq("id", run.artifact_id)
    .maybeSingle();

  return projectProvenance(run, findings, data?.byte_size ?? null);
}
