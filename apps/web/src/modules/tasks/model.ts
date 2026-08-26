import type {
  ValidationFindingCategory,
  ValidationFindingStatus,
  ValidationOutcome,
  ValidationPolicyId,
  ValidationRunStatus,
  ValidationSeverity,
  ValidatorId,
} from "@agentforge/contracts";
import {
  ValidationFindingCategorySchema,
  ValidationOutcomeSchema,
  ValidationPolicyIdSchema,
  ValidationRunStatusSchema,
  ValidationSeveritySchema,
  ValidatorIdSchema,
} from "@agentforge/contracts";

/**
 * View model for the inspector. Server components project database rows into
 * these shapes once; client components receive nothing wider. Keeping the
 * projection here (rather than in a component) is what makes it unit-testable and
 * what will let a future CI or API surface reuse the same report shape.
 */

export type FindingEvidence = {
  readonly path: string | null;
  readonly line: number | null;
  readonly fieldPath: string | null;
  readonly excerpt: string | null;
};

export type InspectorFinding = {
  readonly id: string;
  readonly ordinal: number;
  readonly fingerprint: string;
  readonly code: string;
  readonly category: ValidationFindingCategory;
  readonly severity: ValidationSeverity;
  /** Deterministic findings are always `open`; nothing writes another value yet. */
  readonly status: ValidationFindingStatus;
  readonly title: string;
  readonly message: string;
  readonly remediation: string | null;
  readonly validatorId: ValidatorId | null;
  readonly validatorName: string | null;
  readonly validatorVersion: string | null;
  readonly evidence: FindingEvidence;
};

export type ValidatorCheck = {
  readonly id: ValidatorId;
  readonly name: string;
  readonly version: string;
  readonly findingCount: number;
};

export type FindingCounts = {
  readonly total: number;
  readonly critical: number;
  readonly error: number;
  readonly warning: number;
  readonly info: number;
};

export type RunProvenance = {
  readonly benchmark: string | null;
  readonly benchmarkVersion: string | null;
  readonly artifactContentHash: string | null;
  readonly artifactByteSize: number | null;
  readonly policy: ValidationPolicyId;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly validators: readonly ValidatorCheck[];
};

export type RunSummary = {
  /** Per-project display identifier. The run UUID never reaches the client. */
  readonly runNumber: number;
  readonly status: ValidationRunStatus;
  readonly outcome: ValidationOutcome | null;
  readonly createdAt: string;
  readonly counts: FindingCounts;
  readonly validatorErrorCount: number;
  readonly artifactContentHash: string | null;
  readonly benchmark: string | null;
  readonly benchmarkVersion: string | null;
};

/** A run in a task's history, flagged with whether that run contained the task. */
export type RunHistoryEntry = RunSummary & {
  readonly hasTask: boolean;
};

export type TaskHeader = {
  readonly slug: string;
  readonly name: string;
  readonly externalKey: string;
  readonly rootPath: string;
  readonly taskVersion: string | null;
};

/** Row shape the projection needs. Structural, so a test does not need a database. */
export type ValidatorDescriptorRow = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
};

export function shortenHash(hash: string | null, length = 12): string | null {
  if (!hash) {
    return null;
  }
  return hash.length <= length ? hash : hash.slice(0, length);
}

/**
 * Narrows a jsonb value to a plain record without an unchecked cast. Returns null
 * for anything that is not a JSON object, so a malformed column degrades to
 * "no data" instead of throwing.
 */
function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

/**
 * `validators` is stored as jsonb. Parse defensively: a row written by an older
 * or newer build must never crash the report.
 */
export function readValidatorDescriptors(value: unknown): readonly ValidatorDescriptorRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const descriptors: ValidatorDescriptorRow[] = [];
  for (const entry of value) {
    const record = toRecord(entry);
    if (!record) {
      continue;
    }
    if (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.version === "string"
    ) {
      descriptors.push({ id: record.id, name: record.name, version: record.version });
    }
  }
  return descriptors;
}

export function readEvidence(value: unknown): FindingEvidence {
  const record = toRecord(value);
  if (!record) {
    return { path: null, line: null, fieldPath: null, excerpt: null };
  }
  const path = typeof record.path === "string" && record.path.length > 0 ? record.path : null;
  const line =
    typeof record.line === "number" && Number.isInteger(record.line) && record.line > 0
      ? record.line
      : null;
  return {
    path,
    line,
    fieldPath: typeof record.fieldPath === "string" ? record.fieldPath : null,
    excerpt: typeof record.excerpt === "string" ? record.excerpt : null,
  };
}

/** Finding row shape the projection needs, independent of the generated DB types. */
export type FindingRow = {
  readonly id: string;
  readonly ordinal: number;
  readonly fingerprint: string;
  readonly code: string;
  readonly category: string;
  readonly severity: string;
  readonly title: string;
  readonly message: string;
  readonly remediation: string | null;
  readonly validator_id: string | null;
  readonly evidence: unknown;
};

export function projectFinding(
  row: FindingRow,
  validators: readonly ValidatorDescriptorRow[],
): InspectorFinding {
  const validatorId = ValidatorIdSchema.safeParse(row.validator_id);
  const descriptor = validatorId.success
    ? (validators.find((entry) => entry.id === validatorId.data) ?? null)
    : null;
  const category = ValidationFindingCategorySchema.safeParse(row.category);
  const severity = ValidationSeveritySchema.safeParse(row.severity);

  return {
    id: row.id,
    ordinal: row.ordinal,
    fingerprint: row.fingerprint,
    code: row.code,
    // A category or severity the running build does not know is a data-shape
    // problem, not a reason to hide evidence. Fall back to the least specific value.
    category: category.success ? category.data : "structure",
    severity: severity.success ? severity.data : "info",
    status: "open",
    title: row.title,
    message: row.message,
    remediation: row.remediation,
    validatorId: validatorId.success ? validatorId.data : null,
    validatorName: descriptor?.name ?? null,
    validatorVersion: descriptor?.version ?? null,
    evidence: readEvidence(row.evidence),
  };
}

/** Run row shape the projection needs, independent of the generated DB types. */
export type RunRow = {
  readonly run_number: number;
  readonly status: string;
  readonly outcome: string | null;
  readonly policy: string;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly duration_ms: number | null;
  readonly adapter_id: string | null;
  readonly adapter_version: string | null;
  readonly artifact_content_hash: string | null;
  readonly critical_count: number;
  readonly error_count: number;
  readonly warning_count: number;
  readonly info_count: number;
  readonly validator_error_count: number;
  readonly validators: unknown;
};

export function projectCounts(row: RunRow): FindingCounts {
  return {
    total: row.critical_count + row.error_count + row.warning_count + row.info_count,
    critical: row.critical_count,
    error: row.error_count,
    warning: row.warning_count,
    info: row.info_count,
  };
}

export function projectRunSummary(row: RunRow): RunSummary {
  const outcome = ValidationOutcomeSchema.safeParse(row.outcome);
  const status = ValidationRunStatusSchema.safeParse(row.status);
  return {
    runNumber: row.run_number,
    status: status.success ? status.data : "failed",
    outcome: outcome.success ? outcome.data : null,
    createdAt: row.created_at,
    counts: projectCounts(row),
    validatorErrorCount: row.validator_error_count,
    artifactContentHash: row.artifact_content_hash,
    benchmark: row.adapter_id,
    benchmarkVersion: row.adapter_version,
  };
}

/**
 * Provenance is what a reviewer needs to trust the report: which package, which
 * digest, which checks, and when. Execution is deliberately absent — see
 * `EXECUTION_DISCLOSURE`.
 */
export function projectProvenance(
  row: RunRow,
  findings: readonly InspectorFinding[],
  artifactByteSize: number | null,
): RunProvenance {
  const descriptors = readValidatorDescriptors(row.validators);
  const policy = ValidationPolicyIdSchema.safeParse(row.policy);

  return {
    benchmark: row.adapter_id,
    benchmarkVersion: row.adapter_version,
    artifactContentHash: row.artifact_content_hash,
    artifactByteSize,
    policy: policy.success ? policy.data : "strict",
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    validators: descriptors.map((descriptor) => {
      const id = ValidatorIdSchema.safeParse(descriptor.id);
      return {
        id: id.success ? id.data : "task-structure",
        name: descriptor.name,
        version: descriptor.version,
        findingCount: findings.filter((finding) => finding.validatorId === descriptor.id).length,
      };
    }),
  };
}

/**
 * The one sentence this product must never soften: static inspection is not
 * execution. Kept as a constant so every surface says exactly the same thing.
 */
export const EXECUTION_DISCLOSURE =
  "Functional execution is not part of this validation run. Nothing in the package was built, installed, or run.";
