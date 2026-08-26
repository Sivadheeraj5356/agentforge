import { z } from "zod";

export const FailureCategorySchema = z.enum([
  "planning",
  "tool_selection",
  "code_understanding",
  "environment_navigation",
  "verification",
  "recovery",
  "hallucinated_assumption",
  "timeout",
  "destructive_action",
  "none",
]);

export const RewardMetricNameSchema = z.enum([
  "critical_tests",
  "regression_tests",
  "api_contract",
  "diff_quality",
  "service_health",
  "efficiency",
  "safety",
  "correctness",
]);

const UNIT_INTERVAL = z.number().finite().min(0).max(1);

export const RewardBreakdownSchema = z
  .object({
    reward: UNIT_INTERVAL,
    critical_tests: UNIT_INTERVAL,
    regression_tests: UNIT_INTERVAL,
    api_contract: UNIT_INTERVAL,
    diff_quality: UNIT_INTERVAL,
    service_health: UNIT_INTERVAL,
    efficiency: UNIT_INTERVAL.optional(),
    safety: UNIT_INTERVAL.optional(),
    correctness: UNIT_INTERVAL.optional(),
  })
  .strict();

/** Weights for the continuous outcome recipe. Must sum to 1. */
export const CONTINUOUS_REWARD_WEIGHTS = {
  critical_tests: 0.5,
  regression_tests: 0.2,
  api_contract: 0.1,
  diff_quality: 0.1,
  service_health: 0.1,
} as const;

export const HYBRID_REWARD_WEIGHTS = {
  outcome: 0.6,
  efficiency: 0.15,
  safety: 0.1,
  correctness: 0.15,
} as const;

const WEIGHT_SUM_TOLERANCE = 1e-9;

function assertWeightsSumToOne(weights: Record<string, number>, label: string): void {
  const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    throw new Error(`${label} weights must sum to 1`);
  }
}

assertWeightsSumToOne(CONTINUOUS_REWARD_WEIGHTS, "continuous");
assertWeightsSumToOne(HYBRID_REWARD_WEIGHTS, "hybrid");

export type FailureCategory = z.infer<typeof FailureCategorySchema>;
export type RewardBreakdown = z.infer<typeof RewardBreakdownSchema>;

export function binaryReward(passed: boolean): number {
  return passed ? 1 : 0;
}

export function continuousOutcomeReward(input: {
  readonly critical_tests: number;
  readonly regression_tests: number;
  readonly api_contract: number;
  readonly diff_quality: number;
  readonly service_health: number;
}): number {
  return roundReward(
    CONTINUOUS_REWARD_WEIGHTS.critical_tests * input.critical_tests +
      CONTINUOUS_REWARD_WEIGHTS.regression_tests * input.regression_tests +
      CONTINUOUS_REWARD_WEIGHTS.api_contract * input.api_contract +
      CONTINUOUS_REWARD_WEIGHTS.diff_quality * input.diff_quality +
      CONTINUOUS_REWARD_WEIGHTS.service_health * input.service_health,
  );
}

export function hybridReward(input: {
  readonly outcome: number;
  readonly efficiency: number;
  readonly safety: number;
  readonly correctness: number;
}): number {
  return roundReward(
    HYBRID_REWARD_WEIGHTS.outcome * input.outcome +
      HYBRID_REWARD_WEIGHTS.efficiency * input.efficiency +
      HYBRID_REWARD_WEIGHTS.safety * input.safety +
      HYBRID_REWARD_WEIGHTS.correctness * input.correctness,
  );
}

export function roundReward(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}

/**
 * Unbiased pass@k (Chen et al.). n total attempts, c correct, k reported.
 * Correct means reward >= threshold (default 1.0 for binary; 1.0 still used
 * for "fully solved" even with continuous rewards).
 */
export function passAtK(n: number, c: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(c) || !Number.isInteger(k)) {
    throw new Error("pass@k requires integer n, c, k");
  }
  if (n < 1 || c < 0 || c > n || k < 1) {
    throw new Error("pass@k arguments out of range");
  }
  if (n - c < k) {
    return 1;
  }
  return 1 - combinations(n - c, k) / combinations(n, k);
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result *= n - (k - i);
    result /= i;
  }
  return result;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

export const EnqueueEvaluationInputSchema = z
  .object({
    organizationSlug: z.string().min(1),
    projectSlug: z.string().min(1),
    taskSlug: z.string().min(1).optional(),
    validationRunId: z.string().uuid().optional(),
    catalogTaskKey: z.string().min(1).max(128).optional(),
    packKey: z.string().min(1).max(64).optional(),
    scenarioKey: z.string().min(1).max(64).optional(),
    agentKind: z.enum(["oracle", "nop", "agent", "multi_agent", "byo"]).default("oracle"),
    attemptCount: z.number().int().min(1).max(8).default(1),
    rewardRecipe: z.enum(["binary", "continuous", "hybrid", "staged"]).default("binary"),
    sandboxProvider: z.enum(["harbor", "isolated", "fake", "work"]).default("isolated"),
    composition: z.enum(["single", "multi_agent"]).default("single"),
    ablationId: z.string().uuid().optional(),
    timeoutSeconds: z.number().int().positive().max(86_400).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.catalogTaskKey && !value.taskSlug && !value.validationRunId && !value.packKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A catalog task, pack key, task slug, or validation run is required",
        path: ["catalogTaskKey"],
      });
    }
  });

export type EnqueueEvaluationInput = z.infer<typeof EnqueueEvaluationInputSchema>;
