import { describe, expect, it } from "vitest";

import { groupAblationRuns } from "./ablation";

describe("groupAblationRuns", () => {
  it("groups real scores by ablationId and ignores other runs", () => {
    const groups = groupAblationRuns([
      {
        id: "r1",
        run_number: 1,
        status: "succeeded",
        evaluator_configuration: {
          schemaVersion: 1,
          ablationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          rewardRecipe: "hybrid",
        },
        meanReward: 0.7,
        passAt1: 0,
      },
      {
        id: "r2",
        run_number: 2,
        status: "queued",
        evaluator_configuration: { schemaVersion: 1, agentKind: "oracle" },
        meanReward: null,
        passAt1: null,
      },
      {
        id: "r3",
        run_number: 3,
        status: "succeeded",
        evaluator_configuration: {
          schemaVersion: 1,
          ablationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          rewardRecipe: "binary",
        },
        meanReward: 1,
        passAt1: 1,
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.ablationId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(groups[0]?.rows.map((row) => row.recipe)).toEqual(["binary", "hybrid"]);
    expect(groups[0]?.rows[0]?.meanReward).toBe(1);
  });
});
