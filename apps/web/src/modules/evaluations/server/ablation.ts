import type { Json } from "@agentforge/contracts";

export type AblationScoreRow = {
  readonly runId: string;
  readonly runNumber: number;
  readonly recipe: string;
  readonly status: string;
  readonly meanReward: number | null;
  readonly passAt1: number | null;
};

export type AblationGroup = {
  readonly ablationId: string;
  readonly rows: readonly AblationScoreRow[];
};

function asRecord(value: Json): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value;
}

export function ablationIdFromConfig(config: Json): string | null {
  const record = asRecord(config);
  const id = record?.ablationId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function rewardRecipeFromConfig(config: Json): string {
  const record = asRecord(config);
  const recipe = record?.rewardRecipe;
  return typeof recipe === "string" ? recipe : "binary";
}

export function groupAblationRuns(
  runs: readonly {
    readonly id: string;
    readonly run_number: number;
    readonly status: string;
    readonly evaluator_configuration: Json;
    readonly meanReward: number | null;
    readonly passAt1: number | null;
  }[],
): AblationGroup[] {
  const groups = new Map<string, AblationScoreRow[]>();
  for (const run of runs) {
    const ablationId = ablationIdFromConfig(run.evaluator_configuration);
    if (!ablationId) {
      continue;
    }
    const rows = groups.get(ablationId) ?? [];
    rows.push({
      runId: run.id,
      runNumber: run.run_number,
      recipe: rewardRecipeFromConfig(run.evaluator_configuration),
      status: run.status,
      meanReward: run.meanReward,
      passAt1: run.passAt1,
    });
    groups.set(ablationId, rows);
  }
  return [...groups.entries()].map(([ablationId, rows]) => ({
    ablationId,
    rows: rows.sort((left, right) => left.recipe.localeCompare(right.recipe)),
  }));
}
