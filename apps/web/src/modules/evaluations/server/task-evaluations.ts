import type { Json } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import {
  getEvaluationRunForOrganization,
  type EvaluationRunListItem,
} from "@/modules/evaluations/server/evaluation-runs";
import { listTrialsForRun, type TrialView } from "@/modules/evaluations/server/trials";

export type TaskEvaluationBundle = {
  readonly runs: readonly EvaluationRunListItem[];
  readonly trialsByRunId: ReadonlyMap<string, readonly TrialView[]>;
};

function agentKind(config: Json): string {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return "oracle";
  }
  const kind = (config as { agentKind?: unknown }).agentKind;
  return typeof kind === "string" ? kind : "oracle";
}

export async function listEvaluationsForTaskKey(
  organizationId: string,
  projectId: string,
  taskKey: string,
): Promise<TaskEvaluationBundle> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data: tasks, error: taskError } = await supabase
    .from("tasks")
    .select("id")
    .eq("external_key", taskKey);
  if (taskError) {
    throw new Error("Unable to load catalog tasks.");
  }
  const taskIds = (tasks ?? []).map((row) => row.id);
  if (taskIds.length === 0) {
    return { runs: [], trialsByRunId: new Map() };
  }
  const { data: versions, error: versionError } = await supabase
    .from("task_versions")
    .select("id")
    .in("task_id", taskIds);
  if (versionError) {
    throw new Error("Unable to load task versions.");
  }
  const versionIds = (versions ?? []).map((row) => row.id);
  if (versionIds.length === 0) {
    return { runs: [], trialsByRunId: new Map() };
  }

  const { data: runRows, error: runError } = await supabase
    .from("evaluation_runs")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId)
    .in("task_version_id", versionIds)
    .order("created_at", { ascending: false });
  if (runError) {
    throw new Error("Unable to load evaluation runs.");
  }

  const runs: EvaluationRunListItem[] = [];
  const trialsByRunId = new Map<string, readonly TrialView[]>();
  for (const row of runRows ?? []) {
    const run = await getEvaluationRunForOrganization(organizationId, row.id);
    if (!run) {
      continue;
    }
    runs.push(run);
    trialsByRunId.set(run.id, await listTrialsForRun(run.id));
  }
  return { runs, trialsByRunId };
}

export function classifyFailure(run: EvaluationRunListItem, trial: TrialView | undefined): string {
  const kind = agentKind(run.evaluator_configuration);
  if (trial?.failure_category === "timeout" || run.status === "failed") {
    if (trial?.failure_category === "timeout") {
      return "Infrastructure timeout — not a model score.";
    }
  }
  if (kind === "oracle" && trial && Number(trial.reward) < 1) {
    return "Oracle fail — task or verifier problem, not an agent fail.";
  }
  if (kind === "nop" && trial && Number(trial.reward) >= 1) {
    return "NOP pass — verifier integrity is compromised.";
  }
  if (kind === "nop" && trial && Number(trial.reward) === 0) {
    return "NOP fail — verifier rejected a no-op, as expected.";
  }
  return trial?.failure_category ?? run.status;
}

export type ModelComparisonRow = {
  readonly modelSnapshot: string;
  readonly agentName: string;
  readonly passAt1: number | null;
  readonly meanReward: number | null;
  readonly meanLatencyMs: number | null;
  readonly costUsd: null;
};

export function modelComparisonFromRuns(
  runs: readonly EvaluationRunListItem[],
  trialsByRunId: ReadonlyMap<string, readonly TrialView[]>,
): ModelComparisonRow[] {
  const rows: ModelComparisonRow[] = [];
  for (const run of runs) {
    if (run.passAt1 === null && run.meanReward === null) {
      continue;
    }
    const trials = trialsByRunId.get(run.id) ?? [];
    const snapshotTrial = trials[0] as
      (TrialView & { model_snapshot?: string | null; latency_ms?: number | null }) | undefined;
    const latencies = trials
      .map((trial) => {
        const extra = trial as TrialView & { latency_ms?: number | null };
        return extra.latency_ms;
      })
      .filter((value): value is number => typeof value === "number");
    rows.push({
      modelSnapshot: snapshotTrial?.model_snapshot ?? run.agentName ?? "harness",
      agentName: run.agentName ?? "harness",
      passAt1: run.passAt1,
      meanReward: run.meanReward,
      meanLatencyMs:
        latencies.length > 0
          ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
          : null,
      costUsd: null,
    });
  }
  return rows;
}
