import type { ValidationFinding, ValidationFindingDraft } from "@agentforge/contracts";
import { validationCategoryRank, validationSeverityRank } from "@agentforge/contracts";

import { sha256Hex } from "../hash";

const FINGERPRINT_SEPARATOR = "\u0000";

/**
 * Stable logical identity of a finding: code + location + validator.
 * Independent of run id, timestamps, and ordering, so two runs of the same
 * package produce the same fingerprints and can be diffed later.
 */
export function fingerprintFinding(
  draft: Pick<
    ValidationFindingDraft,
    "code" | "validatorId" | "evidencePath" | "evidenceLine" | "evidenceFieldPath"
  >,
): string {
  const parts = [
    draft.code,
    draft.validatorId ?? "",
    draft.evidencePath ?? "",
    draft.evidenceLine === null ? "" : String(draft.evidenceLine),
    draft.evidenceFieldPath ?? "",
  ];
  return sha256Hex(new TextEncoder().encode(parts.join(FINGERPRINT_SEPARATOR)));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Documented total order: severity (most severe first) → category → validator id
 * → finding code → source location (path, then line, then field path).
 */
export function compareFindings(
  left: ValidationFindingDraft,
  right: ValidationFindingDraft,
): number {
  const bySeverity = validationSeverityRank(left.severity) - validationSeverityRank(right.severity);
  if (bySeverity !== 0) return bySeverity;

  const byCategory = validationCategoryRank(left.category) - validationCategoryRank(right.category);
  if (byCategory !== 0) return byCategory;

  const byValidator = compareText(left.validatorId ?? "", right.validatorId ?? "");
  if (byValidator !== 0) return byValidator;

  const byCode = compareText(left.code, right.code);
  if (byCode !== 0) return byCode;

  const byPath = compareText(left.evidencePath ?? "", right.evidencePath ?? "");
  if (byPath !== 0) return byPath;

  const byLine = (left.evidenceLine ?? 0) - (right.evidenceLine ?? 0);
  if (byLine !== 0) return byLine;

  return compareText(left.evidenceFieldPath ?? "", right.evidenceFieldPath ?? "");
}

export type NormalizationResult = {
  readonly findings: readonly ValidationFinding[];
  /** Findings dropped by the per-run ceiling. Zero in normal packages. */
  readonly droppedCount: number;
};

/**
 * Deduplicates by fingerprint (keeping the most severe duplicate), applies the
 * deterministic order, and assigns contiguous ordinals used for persistence and
 * display.
 */
export function normalizeFindings(
  drafts: readonly ValidationFindingDraft[],
  maxFindings: number,
): NormalizationResult {
  const byFingerprint = new Map<string, ValidationFindingDraft>();
  for (const draft of drafts) {
    const fingerprint = fingerprintFinding(draft);
    const existing = byFingerprint.get(fingerprint);
    if (
      !existing ||
      validationSeverityRank(draft.severity) < validationSeverityRank(existing.severity)
    ) {
      byFingerprint.set(fingerprint, draft);
    }
  }

  const ordered = [...byFingerprint.values()].sort(compareFindings);
  const kept = ordered.slice(0, maxFindings);

  return {
    findings: kept.map((draft, index) => ({
      ...draft,
      fingerprint: fingerprintFinding(draft),
      ordinal: index,
    })),
    droppedCount: ordered.length - kept.length,
  };
}
