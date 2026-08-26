import type {
  SourceLocation,
  ValidationFindingCategory,
  ValidationFindingDraft,
  ValidationSeverity,
  ValidatorId,
  ValidatorOptions,
} from "@agentforge/contracts";

import type { FindingCodeName } from "../finding-codes";

export type FindingInput = {
  readonly code: FindingCodeName;
  readonly severity: ValidationSeverity;
  readonly title: string;
  readonly message: string;
  /** Omit or pass null when no file can be cited. Line stays null unless derived. */
  readonly location?: SourceLocation | null;
  readonly excerpt?: string | null;
  readonly remediation?: string | null;
};

export type FindingEmitter = (input: FindingInput) => ValidationFindingDraft;

function buildDraft(
  input: FindingInput,
  category: ValidationFindingCategory,
  validatorId: ValidatorId | null,
  options: ValidatorOptions,
): ValidationFindingDraft {
  const excerpt = input.excerpt ?? null;
  return {
    code: input.code,
    category,
    severity: input.severity,
    title: input.title,
    message: input.message,
    evidencePath: input.location?.path ?? null,
    evidenceLine: input.location?.line ?? null,
    evidenceFieldPath: input.location?.fieldPath ?? null,
    excerpt: excerpt === null ? null : excerpt.slice(0, options.maxExcerptCharacters),
    remediation: input.remediation ?? null,
    validatorId,
  };
}

/**
 * Binds a validator's identity and category to every finding it emits, so a
 * validator cannot mislabel its own findings.
 */
export function createFindingEmitter(
  validator: { readonly id: ValidatorId; readonly category: ValidationFindingCategory },
  options: ValidatorOptions,
): FindingEmitter {
  return (input: FindingInput) => buildDraft(input, validator.category, validator.id, options);
}

/** Findings raised by the pipeline itself (archive rejection, detection, limits). */
export function createPipelineFinding(
  input: FindingInput,
  category: ValidationFindingCategory,
  options: ValidatorOptions,
): ValidationFindingDraft {
  return buildDraft(input, category, null, options);
}

/** Convenience for the common "cite a whole file" case. */
export function atPath(path: string): SourceLocation {
  return { path, line: null, fieldPath: null };
}

export function atLine(path: string, line: number | null): SourceLocation {
  return { path, line, fieldPath: null };
}
