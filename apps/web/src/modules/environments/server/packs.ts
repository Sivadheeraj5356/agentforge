import {
  EvaluatorConfigurationSchema,
  getExperiencePack,
  harnessCatalogLookup,
  type EvaluationAgentKind,
  type ExperiencePack,
  type Json,
} from "@agentforge/contracts";

import { toJson } from "@/lib/json";
import type { ApiSupabase } from "@/modules/api/v1/session";

async function catalogTask(supabase: ApiSupabase, taskKey: string) {
  const { data: task } = await supabase
    .from("tasks")
    .select("id, external_key, benchmark_version_id")
    .eq("external_key", taskKey)
    .limit(1)
    .maybeSingle();
  if (!task) {
    return null;
  }
  const { data: version } = await supabase
    .from("task_versions")
    .select("id, version")
    .eq("task_id", task.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version) {
    return null;
  }
  return { task, version };
}

async function harnessAgent(supabase: ApiSupabase, kind: EvaluationAgentKind) {
  const lookup = harnessCatalogLookup(kind);
  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("provider", lookup.provider)
    .eq("name", lookup.name)
    .eq("version", "1.0.0")
    .maybeSingle();
  return data;
}

export async function ensureEnvironmentVersion(
  supabase: ApiSupabase,
  organizationId: string,
  pack: ExperiencePack,
): Promise<string> {
  const adapterId = pack.sandboxProvider === "work" ? "work" : pack.sandboxProvider === "harbor" ? "harbor" : "isolated";
  const { data: existing } = await supabase
    .from("environment_versions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("adapter_id", adapterId)
    .eq("version", pack.environmentVersion)
    .maybeSingle();
  if (existing) {
    return existing.id;
  }
  const { data, error } = await supabase
    .from("environment_versions")
    .insert({
      organization_id: organizationId,
      adapter_id: adapterId,
      version: pack.environmentVersion,
      spec: toJson({
        schemaVersion: 1,
        packKey: pack.key,
        family: pack.family,
        simulated: pack.simulated,
      }),
    })
    .select("id")
    .single();
  if (error || !data) {
    const { data: raced } = await supabase
      .from("environment_versions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("adapter_id", adapterId)
      .eq("version", pack.environmentVersion)
      .maybeSingle();
    if (raced) {
      return raced.id;
    }
    throw new Error("Environment version could not be created.");
  }
  return data.id;
}

export async function ensurePackScenario(
  supabase: ApiSupabase,
  input: {
    organizationId: string;
    projectId: string;
    userId: string;
    pack: ExperiencePack;
  },
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("eval_scenarios")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("key", input.pack.key)
    .maybeSingle();
  if (existing) {
    return existing.id;
  }
  const { data, error } = await supabase
    .from("eval_scenarios")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId,
      key: input.pack.key,
      name: input.pack.title,
      request_text: input.pack.instruction,
      difficulty: "hard",
      authoring_source: "human",
      trusted: false,
      starting_state: toJson({ packKey: input.pack.key }),
      expected_outcome: toJson({ stages: input.pack.stages.map((stage) => stage.id) }),
      verifier_pointer: `environments/packs/${input.pack.key}.json`,
      created_by: input.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return null;
  }
  return data.id;
}

export async function enqueuePackRun(input: {
  organizationId: string;
  projectId: string;
  userId: string;
  packKey: string;
  agentKind: EvaluationAgentKind;
  environmentVersionId?: string;
  supabase: ApiSupabase;
}): Promise<{ runId: string; environmentVersionId: string }> {
  const pack = getExperiencePack(input.packKey);
  if (!pack) {
    throw new Error("Unknown experience pack.");
  }
  const catalog = await catalogTask(input.supabase, pack.catalogTaskKey);
  const agent = await harnessAgent(input.supabase, input.agentKind);
  if (!catalog || !agent) {
    throw new Error("Pack catalog task or harness agent is missing.");
  }
  const environmentVersionId =
    input.environmentVersionId ??
    (await ensureEnvironmentVersion(input.supabase, input.organizationId, pack));
  await ensurePackScenario(input.supabase, {
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    pack,
  });
  const evaluatorConfiguration = EvaluatorConfigurationSchema.parse({
    schemaVersion: 1,
    agentKind: input.agentKind,
    attemptCount: 1,
    rewardRecipe: "staged",
    sandboxProvider: pack.sandboxProvider,
    composition: input.agentKind === "multi_agent" ? "multi_agent" : "single",
    environmentVersionId,
    packKey: pack.key,
    scenarioKey: pack.key,
  });
  const { data, error } = await input.supabase.rpc("enqueue_evaluation", {
    p_project_id: input.projectId,
    p_kind: "internal_package",
    p_metadata: toJson({ schemaVersion: 1, packKey: pack.key, catalogTaskKey: pack.catalogTaskKey }),
    p_benchmark_version_id: catalog.task.benchmark_version_id,
    p_task_version_id: catalog.version.id,
    p_agent_id: agent.id,
    p_evaluator_configuration: toJson(evaluatorConfiguration),
  });
  if (error || !data) {
    throw new Error("Unable to enqueue pack run.");
  }
  const runId = typeof data === "object" && data !== null && "id" in data ? String(data.id) : "";
  if (!runId) {
    throw new Error("Unable to enqueue pack run.");
  }
    return { runId, environmentVersionId };
}

export type FailureCategoryCount = {
  readonly category: string;
  readonly count: number;
};

export function groupFailureCategories(
  rows: readonly { failure_category: string | null }[],
): FailureCategoryCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const category = row.failure_category;
    if (!category || category === "none") {
      continue;
    }
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

export type ScoredRollout = {
  readonly id: string;
  readonly reward: number | null;
  readonly environmentVersionId: string;
  readonly evaluationRunId: string | null;
  readonly seed: number;
};

export function filterRollouts(
  rows: readonly ScoredRollout[],
  kind: "all" | "successful" | "failed" | "recovery",
): ScoredRollout[] {
  if (kind === "successful") {
    return rows.filter((row) => row.reward === 1);
  }
  if (kind === "failed") {
    return rows.filter((row) => row.reward !== null && row.reward < 1);
  }
  if (kind === "recovery") {
    return rows.filter((row) => row.reward !== null && row.reward > 0 && row.reward < 1);
  }
  return [...rows];
}

export function preferencePairs(
  rows: readonly ScoredRollout[],
): Array<{ preferred: ScoredRollout; rejected: ScoredRollout }> {
  const byEnv = new Map<string, ScoredRollout[]>();
  for (const row of rows) {
    if (row.reward === null) {
      continue;
    }
    const list = byEnv.get(row.environmentVersionId) ?? [];
    list.push(row);
    byEnv.set(row.environmentVersionId, list);
  }
  const pairs: Array<{ preferred: ScoredRollout; rejected: ScoredRollout }> = [];
  for (const group of byEnv.values()) {
    const scored = [...group].sort((left, right) => (right.reward ?? 0) - (left.reward ?? 0));
    if (scored.length < 2) {
      continue;
    }
    const preferred = scored[0];
    const rejected = scored[scored.length - 1];
    if (!preferred || !rejected || preferred.id === rejected.id) {
      continue;
    }
    if ((preferred.reward ?? 0) <= (rejected.reward ?? 0)) {
      continue;
    }
    pairs.push({ preferred, rejected });
  }
  return pairs;
}

export function stageScoresFromMetrics(metrics: Json | null): Record<string, number> {
  if (typeof metrics !== "object" || metrics === null || Array.isArray(metrics)) {
    return {};
  }
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (key.startsWith("stage_") && typeof value === "number") {
      scores[key] = value;
    }
  }
  return scores;
}
