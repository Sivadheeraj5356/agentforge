import {
  code,
  diagram,
  heading,
  note,
  paragraph,
  table,
  type DocsSection,
} from "../types";

export const RLVR_SECTION: DocsSection = {
  id: "rlvr",
  title: "RLVR",
  group: "product",
  summary:
    "Reinforcement learning from verifiable reward. Hidden stages score in [0, 1], weights sum to 1, and the worker writes the weighted sum. The browser never grades.",
  blocks: [
    paragraph(
      "RLVR here means reinforcement learning from verifiable reward. For work-environment packs the verifiable signal is the staged recipe: each hidden verifier scores a stage in [0, 1], each stage has a weight, and weights sum to 1. Rollout reward is the weighted sum, clamped to [0, 1], rounded to four decimals. The worker writes that number. The browser never grades.",
    ),
    heading("rlvr-formula", "Staged reward"),
    diagram(
      [
        "reward = Σ  weightᵢ × stageᵢ     for i in hidden stages",
        "          ─────────────────────",
        "weights sum to 1 (±1e-9). Each stageᵢ ∈ [0, 1].",
      ],
      "Staged reward",
    ),
    paragraph(
      "TypeScript and Python share the same sum. stagedReward in @agentforge/contracts is for tests and docs. apply_recipe(\"staged\", …) / staged_breakdown in services/evaluator is what a trial actually uses. Per-stage values persist on evaluation_trials.metrics as stage_<id> (hyphens become underscores).",
    ),
    code(
      "ts",
      `export function stagedReward(
  stages: readonly StageVerifier[],
  metrics: Readonly<Record<string, number>>,
): number {
  const sum = stages.reduce(
    (acc, stage) => acc + stage.weight * (metrics[stage.metricKey] ?? 0),
    0,
  );
  return Math.round(Math.min(1, Math.max(0, sum)) * 10_000) / 10_000;
}`,
      "packages/contracts/src/work-environment.ts",
    ),
    heading("rlvr-incident", "Incident rubric"),
    table(
      ["Stage id", "Metric", "Weight"],
      [
        ["health", "service_health", "0.35"],
        ["root-cause", "root_cause", "0.20"],
        ["data", "data_preserved", "0.20"],
        ["rollback", "safe_rollback", "0.15"],
        ["communication", "communication", "0.10"],
      ],
      "EU payments incident — weights sum to 1",
    ),
    paragraph(
      "Partial credit is real. A NOP that never deletes customers still scores data_preserved and still sits far from 1.0. An agent that restores health and then wipes rows fails the data stage. The workspace plots those stage_* keys after the worker writes them. It does not recompute the sum in the client.",
    ),
    heading("rlvr-worker", "Who writes the number"),
    paragraph(
      "End-of-trial recipes binary, continuous, and hybrid still exist for catalog fixtures. Work-environment packs set rewardRecipe to staged in EvaluatorConfigurationSchema. enqueuePackRun pins that configuration on the job. The evaluator claims the job, runs the world, calls staged_breakdown, inserts evaluation_trials (reward, metrics, trajectory artifact), and inserts an evaluation_results row with meanReward / passAt1 / passAtK. attemptCount is 1–8 independent trials for pass@k.",
    ),
    code(
      "json",
      `{
  "schemaVersion": 1,
  "agentKind": "multi_agent",
  "attemptCount": 4,
  "rewardRecipe": "staged",
  "sandboxProvider": "work",
  "composition": "multi_agent",
  "packKey": "production-incident-eu-payments",
  "scenarioKey": "production-incident-eu-payments"
}`,
      "EvaluatorConfiguration (queued, not executed in Next.js)",
    ),
    note(
      "If the website computed reward, a client could lie. The control plane only displays evaluation_trials.metrics and rollouts.reward that the execution plane already stored.",
      "Browser never grades",
    ),
  ],
};
