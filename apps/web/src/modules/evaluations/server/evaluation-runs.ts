import type { Database, Json } from "@agentforge/contracts";
import { EvaluatorConfigurationSchema } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type EvaluationRun = Database["public"]["Tables"]["evaluation_runs"]["Row"];

export type EvaluationRunListItem = EvaluationRun & {
  readonly projectSlug: string;
  readonly projectName: string;
  readonly agentName: string | null;
  readonly taskKey: string | null;
  readonly meanReward: number | null;
  readonly passAt1: number | null;
};

type ResultPayload = {
  readonly meanReward?: unknown;
  readonly passAt1?: unknown;
};

function payloadNumbers(payload: Json): { meanReward: number | null; passAt1: number | null } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { meanReward: null, passAt1: null };
  }
  const record = payload as ResultPayload;
  return {
    meanReward: typeof record.meanReward === "number" ? record.meanReward : null,
    passAt1: typeof record.passAt1 === "number" ? record.passAt1 : null,
  };
}

export async function listEvaluationRunsForOrganization(
  organizationId: string,
): Promise<EvaluationRunListItem[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data: runs, error } = await supabase
    .from("evaluation_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load evaluation runs.");
  }
  if (!runs || runs.length === 0) {
    return [];
  }

  const projectIds = [...new Set(runs.map((run) => run.project_id))];
  const agentIds = [
    ...new Set(runs.map((run) => run.agent_id).filter((id): id is string => id !== null)),
  ];
  const taskVersionIds = [...new Set(runs.map((run) => run.task_version_id))];
  const runIds = runs.map((run) => run.id);

  const [{ data: projects }, { data: agents }, { data: taskVersions }, { data: results }] =
    await Promise.all([
      supabase.from("projects").select("id, slug, name").in("id", projectIds),
      agentIds.length > 0
        ? supabase.from("agents").select("id, name").in("id", agentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      supabase.from("task_versions").select("id, task_id").in("id", taskVersionIds),
      supabase
        .from("evaluation_results")
        .select("evaluation_run_id, payload, created_at")
        .in("evaluation_run_id", runIds)
        .order("created_at", { ascending: true }),
    ]);

  const taskIds = [...new Set((taskVersions ?? []).map((row) => row.task_id))];
  const { data: tasks } =
    taskIds.length > 0
      ? await supabase.from("tasks").select("id, external_key").in("id", taskIds)
      : { data: [] as Array<{ id: string; external_key: string }> };

  const projectById = new Map((projects ?? []).map((row) => [row.id, row]));
  const agentById = new Map((agents ?? []).map((row) => [row.id, row]));
  const taskVersionById = new Map((taskVersions ?? []).map((row) => [row.id, row]));
  const taskById = new Map((tasks ?? []).map((row) => [row.id, row]));
  const latestResultByRun = new Map<string, Json>();
  for (const result of results ?? []) {
    latestResultByRun.set(result.evaluation_run_id, result.payload);
  }

  return runs.map((run) => {
    const project = projectById.get(run.project_id);
    const agent = run.agent_id ? agentById.get(run.agent_id) : undefined;
    const taskVersion = taskVersionById.get(run.task_version_id);
    const task = taskVersion ? taskById.get(taskVersion.task_id) : undefined;
    const numbers = payloadNumbers(latestResultByRun.get(run.id) ?? {});
    return {
      ...run,
      projectSlug: project?.slug ?? "project",
      projectName: project?.name ?? "Project",
      agentName: agent?.name ?? null,
      taskKey: task?.external_key ?? null,
      meanReward: numbers.meanReward,
      passAt1: numbers.passAt1,
    };
  });
}

export async function getEvaluationRunForOrganization(
  organizationId: string,
  runId: string,
): Promise<EvaluationRunListItem | null> {
  const runs = await listEvaluationRunsForOrganization(organizationId);
  return runs.find((run) => run.id === runId) ?? null;
}

export async function enqueueEvaluationRun(input: {
  projectId: string;
  kind: "internal_package" | "benchmark_provided";
  metadata: Json;
  benchmarkVersionId: string;
  taskVersionId: string;
  agentId: string;
  evaluatorConfiguration: unknown;
}): Promise<EvaluationRun> {
  await requireAuthenticatedUser();
  const evaluatorConfiguration = EvaluatorConfigurationSchema.parse(input.evaluatorConfiguration);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("enqueue_evaluation", {
    p_project_id: input.projectId,
    p_kind: input.kind,
    p_metadata: input.metadata,
    p_benchmark_version_id: input.benchmarkVersionId,
    p_task_version_id: input.taskVersionId,
    p_agent_id: input.agentId,
    p_evaluator_configuration: evaluatorConfiguration as Json,
  });

  if (error || !data) {
    throw new Error("Unable to enqueue evaluation.");
  }
  const environmentVersionId = evaluatorConfiguration.environmentVersionId;
  if (environmentVersionId) {
    await supabase
      .from("evaluation_runs")
      .update({ environment_version_id: environmentVersionId })
      .eq("id", data.id);
  }
  return data;
}

export async function cancelEvaluationRun(runId: string): Promise<void> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_evaluation_run", { p_run_id: runId });
  if (error) {
    throw new Error("Unable to cancel evaluation.");
  }
}
