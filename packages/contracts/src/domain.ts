import { z } from "zod";

/** Catalog key (benchmarks, providers): lowercase kebab. */
export const CatalogKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid catalog key");

/** Version identity for pinned benchmark/task/agent versions — never "latest". */
export const VersionIdentitySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/, "Invalid version identity")
  .refine((value) => value.toLowerCase() !== "latest", 'Version must be pinned, not "latest"');

export const TaskExternalKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/, "Invalid task external key");

export const Sha256HexSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/, "Invalid SHA-256 hex digest");

export const AuditActionSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/, "Invalid audit action");

export const FindingCategorySchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid finding category");

export const BenchmarkStatusSchema = z.enum(["draft", "published", "retired"]);
export const SubmissionKindSchema = z.enum([
  "uploaded_archive",
  "git_repository",
  "git_commit",
  "generated_task",
  "benchmark_provided",
  "internal_package",
]);
export const EvaluationRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export const ArtifactKindSchema = z.enum(["archive", "log", "trace", "image", "json", "other"]);
export const EvaluationResultKindSchema = z.enum(["score", "pass_fail", "raw", "other"]);
export const AgentTypeSchema = z.enum(["model", "harness", "composite"]);
export const ReviewStatusSchema = z.enum(["open", "resolved", "dismissed"]);
export const FindingSeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export const FindingStatusSchema = z.enum(["open", "acknowledged", "resolved", "dismissed"]);
export const FindingSourceSchema = z.enum(["human", "system", "adapter"]);

const JsonObjectSchema = z.record(z.string(), z.unknown());

function assertJsonObjectSize(value: Record<string, unknown>, maxBytes: number, label: string) {
  const size = new TextEncoder().encode(JSON.stringify(value)).length;
  if (size > maxBytes) {
    throw new Error(`${label} exceeds ${maxBytes} bytes`);
  }
  return value;
}

/** Pinned benchmark version manifest. Adapter-specific fields live in extensions. */
export const BenchmarkManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    adapterHint: CatalogKeySchema.optional(),
    summary: z.string().trim().max(2000).optional(),
    extensions: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      assertJsonObjectSize(value, 65536, "Manifest");
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Manifest too large",
      });
    }
  });

export const EvaluationAgentKindSchema = z.enum([
  "oracle",
  "nop",
  "agent",
  "multi_agent",
  "byo",
]);

export function harnessCatalogLookup(kind: EvaluationAgentKind): {
  readonly provider: string;
  readonly name: string;
} {
  if (kind === "agent") {
    return { provider: "agentforge", name: "reference" };
  }
  if (kind === "byo") {
    return { provider: "agentforge", name: "byo" };
  }
  if (kind === "multi_agent") {
    return { provider: "agentforge", name: "multi-agent" };
  }
  return { provider: "agentforge", name: kind };
}
export const RewardRecipeSchema = z.enum(["binary", "continuous", "hybrid", "staged"]);
export const SandboxProviderIdSchema = z.enum(["harbor", "isolated", "fake", "work"]);
export const AgentCompositionSchema = z.enum(["single", "multi_agent"]);

export const EvaluatorConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    timeoutSeconds: z.number().int().positive().max(86_400).optional(),
    notes: z.string().trim().max(2000).optional(),
    /** Which harness the execution plane should run. Default oracle. */
    agentKind: EvaluationAgentKindSchema.optional(),
    /** Independent attempts for pass@k. Default 1, max 8. */
    attemptCount: z.number().int().min(1).max(8).optional(),
    rewardRecipe: RewardRecipeSchema.optional(),
    sandboxProvider: SandboxProviderIdSchema.optional(),
    composition: AgentCompositionSchema.optional(),
    ablationId: z.string().uuid().optional(),
    experimentId: z.string().uuid().optional(),
    suiteRunId: z.string().uuid().optional(),
    environmentVersionId: z.string().uuid().optional(),
    packKey: CatalogKeySchema.optional(),
    scenarioKey: CatalogKeySchema.optional(),
    heldOut: z.boolean().optional(),
    extensions: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    try {
      assertJsonObjectSize(value, 16384, "Evaluator configuration");
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Configuration too large",
      });
    }
  });

export const EvaluationResultPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    summary: z.string().trim().max(2000).optional(),
    passed: z.boolean().optional(),
    score: z.number().finite().min(0).max(1).optional(),
    passAt1: z.number().finite().min(0).max(1).optional(),
    passAtK: z.number().finite().min(0).max(1).optional(),
    k: z.number().int().min(1).max(8).optional(),
    meanReward: z.number().finite().min(0).max(1).optional(),
    medianReward: z.number().finite().min(0).max(1).optional(),
    meanLatencyMs: z.number().finite().nonnegative().optional(),
    p95LatencyMs: z.number().finite().nonnegative().optional(),
    meanToolCalls: z.number().finite().nonnegative().optional(),
    costUsd: z.number().finite().nonnegative().nullable().optional(),
    promptTokens: z.number().int().nonnegative().nullable().optional(),
    completionTokens: z.number().int().nonnegative().nullable().optional(),
    extensions: JsonObjectSchema.optional(),
  })
  .strict();

const AUDIT_FORBIDDEN_KEYS = /password|secret|token|authorization|apikey|service.?role|cookie/i;

export const AuditMetadataSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
  )
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (AUDIT_FORBIDDEN_KEYS.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Audit metadata must not include secret-shaped keys",
          path: [key],
        });
      }
    }
    try {
      assertJsonObjectSize(value, 4096, "Audit metadata");
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Audit metadata too large",
      });
    }
  });

export const SubmissionMetadataSchema = JsonObjectSchema.superRefine((value, ctx) => {
  try {
    assertJsonObjectSize(value, 8192, "Submission metadata");
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Submission metadata too large",
    });
  }
});

export const ArtifactStorageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes("..") && !value.startsWith("/"), "Unsafe storage key");

export const ContentTypeSchema = z.string().trim().min(3).max(255);

export type CatalogKey = z.infer<typeof CatalogKeySchema>;
export type VersionIdentity = z.infer<typeof VersionIdentitySchema>;
export type TaskExternalKey = z.infer<typeof TaskExternalKeySchema>;
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
export type BenchmarkStatus = z.infer<typeof BenchmarkStatusSchema>;
export type SubmissionKind = z.infer<typeof SubmissionKindSchema>;
export type EvaluationRunStatus = z.infer<typeof EvaluationRunStatusSchema>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export type EvaluationResultKind = z.infer<typeof EvaluationResultKindSchema>;
export type AgentType = z.infer<typeof AgentTypeSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type FindingSource = z.infer<typeof FindingSourceSchema>;
export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;
export type EvaluationAgentKind = z.infer<typeof EvaluationAgentKindSchema>;
export type RewardRecipe = z.infer<typeof RewardRecipeSchema>;
export type SandboxProviderId = z.infer<typeof SandboxProviderIdSchema>;
export type AgentComposition = z.infer<typeof AgentCompositionSchema>;
export type EvaluatorConfiguration = z.infer<typeof EvaluatorConfigurationSchema>;
export type EvaluationResultPayload = z.infer<typeof EvaluationResultPayloadSchema>;
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;
