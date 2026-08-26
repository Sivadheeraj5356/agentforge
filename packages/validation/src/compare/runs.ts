import type { ValidationFinding, ValidationSeverity } from "@agentforge/contracts";
import { validationSeverityRank } from "@agentforge/contracts";

/**
 * The finding fields a comparison needs. Deliberately narrower than
 * `ValidationFinding` so a database row, a live report, or a CI payload can be
 * compared without first being widened into the full contract type.
 */
export type ComparableFinding = Pick<
  ValidationFinding,
  "fingerprint" | "severity" | "code" | "category" | "title" | "validatorId" | "ordinal"
> & {
  readonly evidencePath: string | null;
  readonly evidenceLine: number | null;
};

export type ComparableRun = {
  /** Opaque run identity. Never rendered — the UI shows a run number instead. */
  readonly runId: string;
  readonly findings: readonly ComparableFinding[];
};

export type ChangedFinding = {
  readonly fingerprint: string;
  readonly previous: ComparableFinding;
  readonly current: ComparableFinding;
};

export type ValidationRunComparison = {
  readonly previousRunId: string;
  readonly currentRunId: string;
  /** Present in the current run only. */
  readonly newFindings: readonly ComparableFinding[];
  /** Present in the previous run only. */
  readonly resolvedFindings: readonly ComparableFinding[];
  /** Same fingerprint, same severity. */
  readonly unchangedFindings: readonly ComparableFinding[];
  /** Same fingerprint, different severity. */
  readonly changedFindings: readonly ChangedFinding[];
};

function byOrdinalThenFingerprint(left: ComparableFinding, right: ComparableFinding): number {
  if (left.ordinal !== right.ordinal) {
    return left.ordinal - right.ordinal;
  }
  return left.fingerprint < right.fingerprint ? -1 : left.fingerprint > right.fingerprint ? 1 : 0;
}

function indexByFingerprint(
  findings: readonly ComparableFinding[],
): ReadonlyMap<string, ComparableFinding> {
  const index = new Map<string, ComparableFinding>();
  for (const finding of findings) {
    // Fingerprints are unique per run after normalization. If a caller supplies a
    // duplicate anyway, keep the earlier ordinal so the result stays deterministic.
    if (!index.has(finding.fingerprint)) {
      index.set(finding.fingerprint, finding);
    }
  }
  return index;
}

/**
 * Diffs two validation runs by finding fingerprint.
 *
 * Fingerprints are the stable logical identity assigned during normalization
 * (code + validator + evidence location), so this compares normalized data and
 * never rendered UI. Pure and dependency-free, so a CI gate, an analytics job, or
 * the inspector can all call it.
 */
export function compareValidationRuns(
  previous: ComparableRun,
  current: ComparableRun,
): ValidationRunComparison {
  const previousByFingerprint = indexByFingerprint(previous.findings);
  const currentByFingerprint = indexByFingerprint(current.findings);

  const newFindings: ComparableFinding[] = [];
  const unchangedFindings: ComparableFinding[] = [];
  const changedFindings: ChangedFinding[] = [];

  for (const finding of currentByFingerprint.values()) {
    const before = previousByFingerprint.get(finding.fingerprint);
    if (!before) {
      newFindings.push(finding);
    } else if (before.severity === finding.severity) {
      unchangedFindings.push(finding);
    } else {
      changedFindings.push({
        fingerprint: finding.fingerprint,
        previous: before,
        current: finding,
      });
    }
  }

  const resolvedFindings = [...previousByFingerprint.values()].filter(
    (finding) => !currentByFingerprint.has(finding.fingerprint),
  );

  return {
    previousRunId: previous.runId,
    currentRunId: current.runId,
    newFindings: newFindings.sort(byOrdinalThenFingerprint),
    resolvedFindings: resolvedFindings.sort(byOrdinalThenFingerprint),
    unchangedFindings: unchangedFindings.sort(byOrdinalThenFingerprint),
    changedFindings: changedFindings.sort((left, right) =>
      byOrdinalThenFingerprint(left.current, right.current),
    ),
  };
}

export type SeverityDrift = "worse" | "better";

/** Direction of a severity change. `worse` means the evidence got more severe. */
export function severityDrift(
  previous: ValidationSeverity,
  current: ValidationSeverity,
): SeverityDrift | null {
  const delta = validationSeverityRank(current) - validationSeverityRank(previous);
  if (delta === 0) {
    return null;
  }
  return delta < 0 ? "worse" : "better";
}
