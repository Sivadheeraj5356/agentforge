import { z } from "zod";

import { CatalogKeySchema, Sha256HexSchema, VersionIdentitySchema } from "./domain";

export const ValidationSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

/** Run lifecycle status. Not the pass/fail decision — see `ValidationOutcomeSchema`. */
export const ValidationRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

/** Policy decision derived from findings. Not the job lifecycle status. */
export const ValidationOutcomeSchema = z.enum(["pass", "warn", "fail"]);

export const ValidationPolicyIdSchema = z.enum(["strict", "lenient"]);

/**
 * Review state of a single finding. Deterministic findings are always produced as
 * `open`; the other states exist so a later collaborative review can record a
 * decision without a schema change. Nothing writes them today.
 */
export const ValidationFindingStatusSchema = z.enum([
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
]);

/**
 * Per-project, human-readable run identifier. The UUID stays internal; a reviewer
 * cites "run 12", not a 36-character opaque string.
 */
export const ValidationRunNumberSchema = z.coerce.number().int().min(1).max(1_000_000_000);

/** URL segment identifying a task discovered inside a validated package. */
export const TaskSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid task slug");

/**
 * A caller-supplied path into an extracted package. Shape only — confinement is
 * still enforced by the workspace path rules and by the run's file manifest.
 */
export const WorkspaceRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.includes("\0"), "Path must not contain a NUL byte");

export const VALIDATOR_IDS = [
  "task-structure",
  "metadata",
  "instruction",
  "environment",
  "verifier",
  "test",
  "documentation",
  "security",
  "reproducibility",
] as const;

export const ValidatorIdSchema = z.enum(VALIDATOR_IDS);

/**
 * Finding categories. Declaration order is the deterministic sort rank.
 * Only categories actually emitted today are listed.
 */
export const VALIDATION_FINDING_CATEGORIES = [
  "archive",
  "configuration",
  "structure",
  "metadata",
  "instructions",
  "environment",
  "tests",
  "verifier",
  "documentation",
  "security",
  "reproducibility",
] as const;

export const ValidationFindingCategorySchema = z.enum(VALIDATION_FINDING_CATEGORIES);

export const ValidationFindingCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/, "Invalid finding code");

export const WorkspaceEntryKindSchema = z.enum(["file", "directory"]);

export const WorkspaceEntrySchema = z
  .object({
    relativePath: z.string().min(1).max(1024),
    kind: WorkspaceEntryKindSchema,
    byteSize: z.number().int().nonnegative(),
  })
  .strict();

export const DEFAULT_MIN_INSTRUCTION_CHARACTERS = 40;
export const DEFAULT_MAX_EXCERPT_CHARACTERS = 400;
export const DEFAULT_MAX_EXCERPT_LINES = 12;

/** Tunable validator thresholds. Persisted with the run so a report is reproducible. */
export const ValidatorOptionsSchema = z
  .object({
    schemaVersion: z.literal(1),
    minInstructionCharacters: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .default(DEFAULT_MIN_INSTRUCTION_CHARACTERS),
    maxExcerptCharacters: z
      .number()
      .int()
      .min(40)
      .max(2000)
      .default(DEFAULT_MAX_EXCERPT_CHARACTERS),
    maxExcerptLines: z.number().int().min(1).max(64).default(DEFAULT_MAX_EXCERPT_LINES),
  })
  .strict();

export const ValidationConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    /** Policy modifier: warnings also fail the run. Never mutates finding severity. */
    strictMode: z.boolean().default(false),
    policy: ValidationPolicyIdSchema.default("strict"),
    enabledValidators: z
      .array(ValidatorIdSchema)
      .min(1)
      .default([...VALIDATOR_IDS]),
    benchmarkVersion: VersionIdentitySchema.default("harbor-3"),
    validatorOptions: ValidatorOptionsSchema.default({ schemaVersion: 1 }),
  })
  .strict();

/**
 * Persisted evidence. `line` and `fieldPath` are present only when the parser
 * genuinely derived them; they are never guessed.
 */
export const ValidationFindingEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    path: z.string().max(1024).nullable(),
    line: z.number().int().positive().optional(),
    fieldPath: z.string().max(200).optional(),
    excerpt: z.string().max(2000).optional(),
  })
  .strict();

export const ValidationFindingDraftSchema = z
  .object({
    code: ValidationFindingCodeSchema,
    category: ValidationFindingCategorySchema,
    severity: ValidationSeveritySchema,
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(4000),
    evidencePath: z.string().max(1024).nullable(),
    evidenceLine: z.number().int().positive().nullable(),
    evidenceFieldPath: z.string().max(200).nullable(),
    excerpt: z.string().max(2000).nullable(),
    remediation: z.string().trim().max(4000).nullable(),
    validatorId: ValidatorIdSchema.nullable(),
  })
  .strict();

/** A draft plus its stable logical identity and deterministic position. */
export const ValidationFindingSchema = ValidationFindingDraftSchema.extend({
  fingerprint: Sha256HexSchema,
  ordinal: z.number().int().nonnegative(),
}).strict();

export const DetectionResultSchema = z
  .object({
    matched: z.boolean(),
    adapterId: CatalogKeySchema.nullable(),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().max(200)).max(32),
  })
  .strict();

export const NormalizedTaskMetadataSchema = z
  .object({
    externalKey: z.string().min(1).max(128),
    name: z.string().min(1).max(200),
    difficulty: z.string().max(64).nullable(),
    category: z.string().max(128).nullable(),
    tags: z.array(z.string().max(64)).max(32),
    authorName: z.string().max(200).nullable(),
    version: z.string().max(64).nullable(),
  })
  .strict();

export const DiscoveredTaskSchema = z
  .object({
    rootPath: z.string().max(1024),
    externalKey: z.string().min(1).max(128),
  })
  .strict();

export const ValidationArtifactRefSchema = z
  .object({
    contentHash: Sha256HexSchema,
    byteSize: z.number().int().nonnegative(),
  })
  .strict();

/** Where a finding came from. `line` is null unless the parser derived it. */
export const SourceLocationSchema = z
  .object({
    path: z.string().min(1).max(1024),
    line: z.number().int().positive().nullable(),
    fieldPath: z.string().max(200).nullable(),
  })
  .strict();

export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;
export type ValidationRunStatus = z.infer<typeof ValidationRunStatusSchema>;
export type ValidationOutcome = z.infer<typeof ValidationOutcomeSchema>;
export type ValidationPolicyId = z.infer<typeof ValidationPolicyIdSchema>;
export type ValidationFindingStatus = z.infer<typeof ValidationFindingStatusSchema>;
export type ValidationRunNumber = z.infer<typeof ValidationRunNumberSchema>;
export type TaskSlug = z.infer<typeof TaskSlugSchema>;
export type WorkspaceRelativePath = z.infer<typeof WorkspaceRelativePathSchema>;
export type ValidatorId = z.infer<typeof ValidatorIdSchema>;
export type ValidationFindingCategory = z.infer<typeof ValidationFindingCategorySchema>;
export type ValidationFindingCode = z.infer<typeof ValidationFindingCodeSchema>;
export type WorkspaceEntryKind = z.infer<typeof WorkspaceEntryKindSchema>;
export type WorkspaceEntry = z.infer<typeof WorkspaceEntrySchema>;
export type ValidatorOptions = z.infer<typeof ValidatorOptionsSchema>;
export type ValidationConfiguration = z.infer<typeof ValidationConfigurationSchema>;
/** Configuration as callers supply it, before defaults are applied. */
export type ValidationConfigurationInput = z.input<typeof ValidationConfigurationSchema>;
export type ValidationFindingEvidence = z.infer<typeof ValidationFindingEvidenceSchema>;
export type ValidationFindingDraft = z.infer<typeof ValidationFindingDraftSchema>;
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
export type NormalizedTaskMetadata = z.infer<typeof NormalizedTaskMetadataSchema>;
export type DiscoveredTask = z.infer<typeof DiscoveredTaskSchema>;
export type ValidationArtifactRef = z.infer<typeof ValidationArtifactRefSchema>;
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

/**
 * Read-only view of an extracted task package. Every path is workspace-relative;
 * implementations confine access to the workspace root. Validators receive this
 * instead of the host filesystem, a database client, or a session.
 */
export interface WorkspaceReader {
  /** Normalizes and confines a path, throwing when it would escape the workspace. */
  resolveSafePath(relativePath: string): string;
  exists(relativePath: string): boolean;
  stat(relativePath: string): WorkspaceEntry | null;
  /** Text content, or null when the path is absent, binary, or over the text limit. */
  readText(relativePath: string): string | null;
  /** Parsed JSON, or null when absent. Throws when the file is not valid JSON. */
  readJson(relativePath: string): unknown;
  listFiles(directoryPath?: string): readonly string[];
  listDirectories(directoryPath?: string): readonly string[];
}

export type TaskDocumentFormat = "toml" | "yaml";

/**
 * `parse` means the file could not be read as its declared format.
 * `schema` means it parsed but a field failed the runtime schema.
 */
export type TaskDocumentIssueKind = "parse" | "schema";

export type TaskDocumentIssue = {
  readonly kind: TaskDocumentIssueKind;
  readonly message: string;
  readonly location: SourceLocation;
};

/** Parsed task metadata document with the source information findings can cite. */
export type TaskDocument = {
  readonly path: string;
  readonly format: TaskDocumentFormat;
  readonly raw: Readonly<Record<string, unknown>>;
  /** Location of a dotted field path, e.g. `metadata.author_name`. */
  locate(fieldPath: string): SourceLocation;
  readonly issues: readonly TaskDocumentIssue[];
};

export type TaskInstruction = {
  readonly text: string;
  readonly source: SourceLocation;
};

/** Result of the single parse phase for one discovered task. */
export type TaskDefinition = {
  readonly rootPath: string;
  readonly externalKey: string;
  readonly metadata: NormalizedTaskMetadata;
  readonly instruction: TaskInstruction | null;
};

/**
 * Everything a validator is allowed to see. No database client, no session,
 * no auth object, no host filesystem, no model provider.
 */
export type ValidationContext = {
  readonly artifact: ValidationArtifactRef;
  readonly benchmark: string;
  readonly benchmarkVersion: string;
  readonly task: TaskDefinition;
  readonly taskVersion: string | null;
  readonly workspace: WorkspaceReader;
  /** Files in scope for this task: task-root files plus files outside every task root. */
  readonly files: readonly string[];
  readonly metadata: TaskDocument | null;
  readonly configuration: ValidationConfiguration;
  readonly options: ValidatorOptions;
};

/** Deterministic static check. Must never call a model, shell, or network. */
export type Validator = {
  readonly id: ValidatorId;
  readonly name: string;
  readonly category: ValidationFindingCategory;
  readonly version: string;
  validate(context: ValidationContext): readonly ValidationFindingDraft[];
};

export type ValidatorDescriptor = {
  readonly id: ValidatorId;
  readonly name: string;
  readonly version: string;
};

export type ValidatorRegistry = {
  list(): readonly Validator[];
  get(id: ValidatorId): Validator | null;
  /** Validators enabled by configuration, in registration order. */
  select(configuration: ValidationConfiguration): readonly Validator[];
  describe(): readonly ValidatorDescriptor[];
};

/** A validator threw. Distinct from a finding: evidence is missing, not present. */
export type ValidatorExecutionError = {
  readonly validatorId: ValidatorId;
  readonly validatorVersion: string;
  readonly taskRootPath: string;
  /** Operator-facing summary. Never a stack trace, never rendered raw to end users. */
  readonly message: string;
};

export type ValidationReportTask = {
  readonly rootPath: string;
  readonly externalKey: string;
  readonly name: string;
  readonly version: string | null;
};

export type FindingSummary = {
  readonly total: number;
  readonly critical: number;
  readonly error: number;
  readonly warning: number;
  readonly info: number;
};

export type ValidationReport = {
  readonly schemaVersion: 1;
  readonly benchmark: string | null;
  readonly benchmarkVersion: string | null;
  readonly artifact: ValidationArtifactRef;
  readonly detection: DetectionResult;
  readonly tasks: readonly ValidationReportTask[];
  /** Policy decision. `validation_runs.status` remains the job lifecycle. */
  readonly outcome: ValidationOutcome;
  readonly policy: ValidationPolicyId;
  readonly summary: FindingSummary;
  readonly findings: readonly ValidationFinding[];
  readonly validators: readonly ValidatorDescriptor[];
  readonly validatorErrors: readonly ValidatorExecutionError[];
  readonly durationMs: number;
  readonly configuration: ValidationConfiguration;
};

/** Most severe first. Index is the deterministic severity sort rank. */
export const VALIDATION_SEVERITY_ORDER: readonly ValidationSeverity[] = [
  "critical",
  "error",
  "warning",
  "info",
];

export function validationSeverityRank(severity: ValidationSeverity): number {
  return VALIDATION_SEVERITY_ORDER.indexOf(severity);
}

export function validationCategoryRank(category: ValidationFindingCategory): number {
  return VALIDATION_FINDING_CATEGORIES.indexOf(category);
}

export function summarizeFindings(
  findings: readonly Pick<ValidationFindingDraft, "severity">[],
): FindingSummary {
  const counts = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return { total: findings.length, ...counts };
}
