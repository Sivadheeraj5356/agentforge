import { z } from "zod";

const finiteOrNull = z.number().finite().nullable();

export const EvaluationJsonReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    product: z.literal("AgentForge"),
    protocol: z.literal("horizon-v1.0.0").optional(),
    run: z
      .object({
        id: z.string(),
        number: z.number().int(),
        status: z.string(),
        agentKind: z.string().nullable(),
        sandboxId: z.string().nullable(),
        agentGitSha: z.string().nullable(),
        agentConfigHash: z.string().nullable(),
      })
      .strict(),
    task: z
      .object({
        key: z.string().nullable(),
        version: z.string().nullable(),
      })
      .strict(),
    benchmark: z
      .object({
        key: z.string().nullable(),
        version: z.string().nullable(),
      })
      .strict(),
    agent: z
      .object({
        provider: z.string().nullable(),
        name: z.string().nullable(),
        version: z.string().nullable(),
      })
      .strict(),
    model: z
      .object({
        provider: z.string().nullable(),
        id: z.string().nullable(),
        snapshot: z.string().nullable(),
      })
      .strict(),
    artifactHash: z.string().nullable(),
    validatorVersion: z.string().nullable(),
    ruleset: z.string().nullable(),
    scores: z
      .object({
        passAt1: finiteOrNull,
        passAtK: finiteOrNull,
        meanReward: finiteOrNull,
        medianReward: finiteOrNull,
        meanLatencyMs: finiteOrNull,
        meanToolCalls: finiteOrNull,
      })
      .strict(),
    stageScores: z.record(z.string(), z.number().finite()),
    trajectory: z
      .object({
        artifactId: z.string().nullable(),
        stepCount: z.number().int().nonnegative(),
        steps: z.array(
          z
            .object({
              step: z.number().int(),
              tool: z.string(),
              command: z.string(),
              observation: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    failedRolloutsHref: z.literal("/api/v1/rollouts?kind=failed"),
    harness: z.string(),
    costUsd: finiteOrNull,
    promptTokens: finiteOrNull,
    completionTokens: finiteOrNull,
    labels: z
      .object({
        oracleFailIsNotAgentFail: z.string(),
        nopPassMeansVerifierIntegrity: z.string(),
        timeoutIsInfrastructure: z.string(),
      })
      .strict(),
  })
  .strict();

export type EvaluationJsonReport = z.infer<typeof EvaluationJsonReportSchema>;

export const HORIZON_PROTOCOL_VERSION = "horizon-v1.0.0" as const;
