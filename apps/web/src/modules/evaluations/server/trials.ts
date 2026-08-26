import type { Database, Json } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type EvaluationTrial = Database["public"]["Tables"]["evaluation_trials"]["Row"];

export type TrialStep = {
  readonly step: number;
  readonly tool: string;
  readonly command: string;
  readonly observation: string;
};

export type TrialView = EvaluationTrial & {
  readonly steps: readonly TrialStep[];
};

function asRecord(value: Json): Record<string, Json | undefined> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value;
}

export function stepsFromMetrics(metrics: Json): TrialStep[] {
  const record = asRecord(metrics);
  const raw = record?.steps;
  if (!Array.isArray(raw)) {
    return [];
  }
  const steps: TrialStep[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const step = item.step;
    const tool = item.tool;
    const command = item.command;
    const observation = item.observation;
    if (
      typeof step === "number" &&
      typeof tool === "string" &&
      typeof command === "string" &&
      typeof observation === "string"
    ) {
      steps.push({ step, tool, command, observation });
    }
  }
  return steps;
}

export async function listTrialsForOrganization(organizationId: string): Promise<TrialView[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluation_trials")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load trials.");
  }
  return (data ?? []).map((row) => ({ ...row, steps: stepsFromMetrics(row.metrics) }));
}

export async function listTrialsForRun(runId: string): Promise<TrialView[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluation_trials")
    .select("*")
    .eq("evaluation_run_id", runId)
    .order("attempt_index", { ascending: true });

  if (error) {
    throw new Error("Unable to load trials.");
  }
  return (data ?? []).map((row) => ({ ...row, steps: stepsFromMetrics(row.metrics) }));
}

export type TrialMatrixCell = {
  readonly agentName: string;
  readonly taskKey: string;
  readonly meanReward: number;
  readonly trialCount: number;
};

export async function listTrialMatrix(
  runs: readonly {
    readonly id: string;
    readonly agentName: string | null;
    readonly taskKey: string | null;
  }[],
  trials: readonly EvaluationTrial[],
): Promise<TrialMatrixCell[]> {
  const runById = new Map(runs.map((run) => [run.id, run]));
  const buckets = new Map<string, { rewards: number[]; agentName: string; taskKey: string }>();
  for (const trial of trials) {
    const run = runById.get(trial.evaluation_run_id);
    if (!run || run.agentName === null || run.taskKey === null || trial.reward === null) {
      continue;
    }
    const key = `${run.agentName}::${run.taskKey}`;
    const bucket = buckets.get(key) ?? {
      rewards: [],
      agentName: run.agentName,
      taskKey: run.taskKey,
    };
    bucket.rewards.push(Number(trial.reward));
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({
    agentName: bucket.agentName,
    taskKey: bucket.taskKey,
    meanReward:
      bucket.rewards.reduce((sum, value) => sum + value, 0) / Math.max(bucket.rewards.length, 1),
    trialCount: bucket.rewards.length,
  }));
}
