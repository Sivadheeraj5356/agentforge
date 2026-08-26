import { describe, expect, it } from "vitest";

import {
  binaryReward,
  continuousOutcomeReward,
  EnqueueEvaluationInputSchema,
  hybridReward,
  mean,
  median,
  passAtK,
  RewardBreakdownSchema,
} from "./evaluation";
import { stagedReward, getExperiencePack } from "./work-environment";

describe("reward recipes", () => {
  it("maps pass/fail to 0 or 1", () => {
    expect(binaryReward(true)).toBe(1);
    expect(binaryReward(false)).toBe(0);
  });

  it("weights continuous outcome criteria", () => {
    expect(
      continuousOutcomeReward({
        critical_tests: 1,
        regression_tests: 0.75,
        api_contract: 1,
        diff_quality: 0.5,
        service_health: 1,
      }),
    ).toBe(0.9);
  });

  it("never exceeds 1", () => {
    expect(
      continuousOutcomeReward({
        critical_tests: 1,
        regression_tests: 1,
        api_contract: 1,
        diff_quality: 1,
        service_health: 1,
      }),
    ).toBe(1);
  });

  it("mixes outcome with process terms in hybrid", () => {
    expect(
      hybridReward({
        outcome: 1,
        efficiency: 0,
        safety: 1,
        correctness: 0,
      }),
    ).toBe(0.7);
  });

  it("sums staged weights from pack verifiers", () => {
    const pack = getExperiencePack("orders-ops");
    expect(pack).toBeDefined();
    if (!pack) {
      return;
    }
    expect(
      stagedReward(pack.stages, {
        service_health: 1,
        critical_tests: 1,
        api_contract: 1,
        diff_quality: 1,
      }),
    ).toBe(1);
  });

  it("rejects metric payloads outside unit interval", () => {
    expect(() =>
      RewardBreakdownSchema.parse({
        reward: 1.2,
        critical_tests: 1,
        regression_tests: 1,
        api_contract: 1,
        diff_quality: 1,
        service_health: 1,
      }),
    ).toThrow();
  });
});

describe("pass@k", () => {
  it("is 1 when every attempt succeeded", () => {
    expect(passAtK(3, 3, 1)).toBe(1);
    expect(passAtK(3, 3, 3)).toBe(1);
  });

  it("is 0 when nothing succeeded and k <= n", () => {
    expect(passAtK(3, 0, 1)).toBe(0);
  });

  it("matches the unbiased estimator for mixed attempts", () => {
    // n=3, c=1, k=1 → 1/3
    expect(passAtK(3, 1, 1)).toBeCloseTo(1 / 3, 10);
  });

  it("rejects impossible arguments", () => {
    expect(() => passAtK(0, 0, 1)).toThrow();
    expect(() => passAtK(2, 3, 1)).toThrow();
  });
});

describe("enqueue input", () => {
  it("requires a task identifier", () => {
    expect(() =>
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
      }),
    ).toThrow();
  });

  it("defaults sandbox to isolated when omitted", () => {
    expect(
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        catalogTaskKey: "broken-orders-api",
      }).sandboxProvider,
    ).toBe("isolated");
  });

  it("accepts a pack key without a catalog task", () => {
    expect(
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        packKey: "orders-ops",
        rewardRecipe: "staged",
        sandboxProvider: "isolated",
      }).packKey,
    ).toBe("orders-ops");
  });

  it("accepts reference and byo agent kinds", () => {
    expect(
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        catalogTaskKey: "broken-orders-api",
        agentKind: "agent",
        sandboxProvider: "isolated",
      }).agentKind,
    ).toBe("agent");
    expect(
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        catalogTaskKey: "broken-orders-api",
        agentKind: "byo",
      }).agentKind,
    ).toBe("byo");
    expect(
      EnqueueEvaluationInputSchema.parse({
        organizationSlug: "acme",
        projectSlug: "demo",
        catalogTaskKey: "broken-orders-api",
        agentKind: "multi_agent",
      }).agentKind,
    ).toBe("multi_agent");
  });
});

describe("summaries", () => {
  it("computes mean and median", () => {
    expect(mean([0, 1, 0.5])).toBeCloseTo(0.5);
    expect(median([0, 1, 0.5])).toBe(0.5);
    expect(median([0, 1])).toBe(0.5);
    expect(mean([])).toBe(0);
  });
});
