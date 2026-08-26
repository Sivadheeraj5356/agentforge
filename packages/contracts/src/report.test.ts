import { describe, expect, it } from "vitest";

import { EvaluationJsonReportSchema, HORIZON_PROTOCOL_VERSION } from "./report";

describe("EvaluationJsonReportSchema", () => {
  it("accepts a recorded report with null cost", () => {
    const parsed = EvaluationJsonReportSchema.parse({
      schemaVersion: 1,
      product: "AgentForge",
      protocol: HORIZON_PROTOCOL_VERSION,
      run: {
        id: "run-1",
        number: 1,
        status: "succeeded",
        agentKind: "oracle",
        sandboxId: "isolated",
        agentGitSha: null,
        agentConfigHash: null,
      },
      task: { key: "broken-orders-api", version: "1.0.0" },
      benchmark: { key: "agentforge-internal", version: "1.0.0" },
      agent: { provider: "agentforge", name: "oracle", version: "1.0.0" },
      model: { provider: null, id: null, snapshot: null },
      artifactHash: null,
      validatorVersion: null,
      ruleset: "binary",
      scores: {
        passAt1: 1,
        passAtK: 1,
        meanReward: 1,
        medianReward: 1,
        meanLatencyMs: 12,
        meanToolCalls: 1,
      },
      stageScores: {},
      trajectory: { artifactId: null, stepCount: 0, steps: [] },
      failedRolloutsHref: "/api/v1/rollouts?kind=failed",
      harness: "oracle",
      costUsd: null,
      promptTokens: null,
      completionTokens: null,
      labels: {
        oracleFailIsNotAgentFail: "An Oracle fail is a task/verifier problem, not an agent failure.",
        nopPassMeansVerifierIntegrity:
          "A NOP pass means the verifier accepted an empty or no-op trajectory and is not intact.",
        timeoutIsInfrastructure: "A timeout is infrastructure, not a model score.",
      },
    });
    expect(parsed.protocol).toBe("horizon-v1.0.0");
    expect(parsed.costUsd).toBeNull();
  });
});
