import { describe, expect, it } from "vitest";

import {
  filterRollouts,
  groupFailureCategories,
  preferencePairs,
  stageScoresFromMetrics,
} from "./packs";

describe("groupFailureCategories", () => {
  it("counts real categories and ignores none", () => {
    expect(
      groupFailureCategories([
        { failure_category: "recovery" },
        { failure_category: "recovery" },
        { failure_category: "none" },
        { failure_category: null },
        { failure_category: "verification" },
      ]),
    ).toEqual([
      { category: "recovery", count: 2 },
      { category: "verification", count: 1 },
    ]);
  });
});

describe("rollout export kinds", () => {
  const rows = [
    { id: "a", reward: 1, environmentVersionId: "env", evaluationRunId: "r1", seed: 0 },
    { id: "b", reward: 0.2, environmentVersionId: "env", evaluationRunId: "r2", seed: 1 },
    { id: "c", reward: null, environmentVersionId: "env", evaluationRunId: "r3", seed: 2 },
  ];

  it("splits successful, failed, and recovery without inventing percents", () => {
    expect(filterRollouts(rows, "successful").map((row) => row.id)).toEqual(["a"]);
    expect(filterRollouts(rows, "failed").map((row) => row.id)).toEqual(["b"]);
    expect(filterRollouts(rows, "recovery").map((row) => row.id)).toEqual(["b"]);
  });

  it("emits a preference pair only when two scored rollouts exist", () => {
    const pairs = preferencePairs(rows);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.preferred.id).toBe("a");
    expect(pairs[0]?.rejected.id).toBe("b");
    expect(preferencePairs(rows.slice(0, 1))).toEqual([]);
  });
});

describe("stageScoresFromMetrics", () => {
  it("reads worker-written stage keys only", () => {
    expect(stageScoresFromMetrics({ stage_health: 1, reward: 0.35, steps: [] })).toEqual({
      stage_health: 1,
    });
  });
});
