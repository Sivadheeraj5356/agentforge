import { mean, type Json } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { stageScoresFromMetrics } from "@/modules/environments/server/packs";
import { getEvaluationRunForOrganization } from "@/modules/evaluations/server/evaluation-runs";
import {
  finiteNumber,
  harnessLabel,
  medianOrNull,
} from "@/modules/evaluations/server/report-metrics";
import { listTrialsForRun } from "@/modules/evaluations/server/trials";

export type EvaluationJsonReport = {
  readonly schemaVersion: 1;
  readonly product: "AgentForge";
  readonly protocol: "horizon-v1.0.0";
  readonly run: {
    readonly id: string;
    readonly number: number;
    readonly status: string;
    readonly agentKind: string | null;
    readonly sandboxId: string | null;
    readonly agentGitSha: string | null;
    readonly agentConfigHash: string | null;
  };
  readonly task: {
    readonly key: string | null;
    readonly version: string | null;
  };
  readonly benchmark: {
    readonly key: string | null;
    readonly version: string | null;
  };
  readonly agent: {
    readonly provider: string | null;
    readonly name: string | null;
    readonly version: string | null;
  };
  readonly model: {
    readonly provider: string | null;
    readonly id: string | null;
    readonly snapshot: string | null;
  };
  readonly artifactHash: string | null;
  readonly validatorVersion: string | null;
  readonly ruleset: string | null;
  readonly scores: {
    readonly passAt1: number | null;
    readonly passAtK: number | null;
    readonly meanReward: number | null;
    readonly medianReward: number | null;
    readonly meanLatencyMs: number | null;
    readonly meanToolCalls: number | null;
  };
  readonly stageScores: Readonly<Record<string, number>>;
  readonly trajectory: {
    readonly artifactId: string | null;
    readonly stepCount: number;
    readonly steps: readonly {
      readonly step: number;
      readonly tool: string;
      readonly command: string;
      readonly observation: string;
    }[];
  };
  readonly failedRolloutsHref: "/api/v1/rollouts?kind=failed";
  readonly harness: string;
  readonly costUsd: number | null;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly labels: {
    readonly oracleFailIsNotAgentFail: string;
    readonly nopPassMeansVerifierIntegrity: string;
    readonly timeoutIsInfrastructure: string;
  };
};

function asRecord(value: Json): Record<string, Json | undefined> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value;
}

function numberOrNull(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function buildEvaluationJsonReport(
  organizationId: string,
  runId: string,
): Promise<EvaluationJsonReport | null> {
  await requireAuthenticatedUser();
  const run = await getEvaluationRunForOrganization(organizationId, runId);
  if (!run) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const trials = await listTrialsForRun(run.id);
  const config = asRecord(run.evaluator_configuration);
  const firstTrial = trials[0];
  const trialRecord = firstTrial
    ? (firstTrial as {
        model_provider?: string | null;
        model_id?: string | null;
        model_snapshot?: string | null;
      })
    : null;

  const { data: result } = await supabase
    .from("evaluation_results")
    .select("payload")
    .eq("evaluation_run_id", run.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payload = result ? asRecord(result.payload) : null;

  const { data: taskVersion } = await supabase
    .from("task_versions")
    .select("version, task_id")
    .eq("id", run.task_version_id)
    .maybeSingle();
  const { data: task } = taskVersion
    ? await supabase
        .from("tasks")
        .select("external_key, benchmark_version_id")
        .eq("id", taskVersion.task_id)
        .maybeSingle()
    : { data: null };
  const { data: benchmarkVersion } = task
    ? await supabase
        .from("benchmark_versions")
        .select("version, benchmark_id")
        .eq("id", task.benchmark_version_id)
        .maybeSingle()
    : { data: null };
  const { data: benchmark } = benchmarkVersion
    ? await supabase
        .from("benchmarks")
        .select("key")
        .eq("id", benchmarkVersion.benchmark_id)
        .maybeSingle()
    : { data: null };
  const { data: agent } = run.agent_id
    ? await supabase
        .from("agents")
        .select("provider, name, version")
        .eq("id", run.agent_id)
        .maybeSingle()
    : { data: null };

  const { data: artifact } = firstTrial?.trajectory_artifact_id
    ? await supabase
        .from("artifacts")
        .select("content_hash")
        .eq("id", firstTrial.trajectory_artifact_id)
        .maybeSingle()
    : { data: null };

  const runExtra = run as typeof run & {
    agent_git_sha?: string | null;
    agent_config_hash?: string | null;
  };

  const agentKind = typeof config?.agentKind === "string" ? config.agentKind : null;
  const rewards = trials
    .map((trial) => finiteNumber(trial.reward))
    .filter((value): value is number => value !== null);
  const latencies = trials
    .map((trial) => finiteNumber(trial.latency_ms))
    .filter((value): value is number => value !== null);
  const toolCounts = trials.map((trial) => {
    const fromMetrics = finiteNumber(asRecord(trial.metrics)?.tool_calls);
    return fromMetrics ?? trial.steps.length;
  });
  const stageScores = {
    ...stageScoresFromMetrics((payload as Json | null) ?? null),
    ...stageScoresFromMetrics(firstTrial?.metrics ?? null),
  };
  const recordedCost = finiteNumber(payload?.costUsd) ?? finiteNumber(firstTrial?.cost_usd) ?? null;
  const recordedPrompt =
    finiteNumber(payload?.promptTokens) ?? finiteNumber(firstTrial?.prompt_tokens) ?? null;
  const recordedCompletion =
    finiteNumber(payload?.completionTokens) ?? finiteNumber(firstTrial?.completion_tokens) ?? null;

  return {
    schemaVersion: 1,
    product: "AgentForge",
    protocol: "horizon-v1.0.0",
    run: {
      id: run.id,
      number: run.run_number,
      status: run.status,
      agentKind,
      sandboxId: typeof config?.sandboxProvider === "string" ? config.sandboxProvider : null,
      agentGitSha: runExtra.agent_git_sha ?? null,
      agentConfigHash: runExtra.agent_config_hash ?? null,
    },
    task: {
      key: task?.external_key ?? run.taskKey,
      version: taskVersion?.version ?? null,
    },
    benchmark: {
      key: benchmark?.key ?? null,
      version: benchmarkVersion?.version ?? null,
    },
    agent: {
      provider: agent?.provider ?? null,
      name: agent?.name ?? run.agentName,
      version: agent?.version ?? null,
    },
    model: {
      provider: trialRecord?.model_provider ?? null,
      id: trialRecord?.model_id ?? null,
      snapshot: trialRecord?.model_snapshot ?? null,
    },
    artifactHash: artifact?.content_hash ?? null,
    validatorVersion: null,
    ruleset: typeof config?.rewardRecipe === "string" ? config.rewardRecipe : null,
    scores: {
      passAt1: numberOrNull(payload?.passAt1) ?? run.passAt1,
      passAtK: numberOrNull(payload?.passAtK),
      meanReward: numberOrNull(payload?.meanReward) ?? run.meanReward,
      medianReward: numberOrNull(payload?.medianReward) ?? medianOrNull(rewards),
      meanLatencyMs:
        numberOrNull(payload?.meanLatencyMs) ?? (latencies.length === 0 ? null : mean(latencies)),
      meanToolCalls:
        numberOrNull(payload?.meanToolCalls) ??
        (toolCounts.length === 0
          ? null
          : toolCounts.reduce((sum, value) => sum + value, 0) / toolCounts.length),
    },
    stageScores,
    trajectory: {
      artifactId: firstTrial?.trajectory_artifact_id ?? null,
      stepCount: firstTrial?.steps.length ?? 0,
      steps: firstTrial?.steps ?? [],
    },
    failedRolloutsHref: "/api/v1/rollouts?kind=failed",
    harness: harnessLabel(agentKind, agent?.name ?? run.agentName),
    costUsd: recordedCost,
    promptTokens: recordedPrompt,
    completionTokens: recordedCompletion,
    labels: {
      oracleFailIsNotAgentFail: "An Oracle fail is a task/verifier problem, not an agent failure.",
      nopPassMeansVerifierIntegrity:
        "A NOP pass means the verifier accepted an empty or no-op trajectory and is not intact.",
      timeoutIsInfrastructure: "A timeout is infrastructure, not a model score.",
    },
  };
}
