import type {
  FindingSummary,
  ValidationConfiguration,
  ValidationOutcome,
  ValidationPolicyId,
  ValidationSeverity,
} from "@agentforge/contracts";

/**
 * Validators produce evidence; policy decides PASS / WARN / FAIL. Never
 * `findings.length > 0 => failed`, and never by mutating severities.
 *
 * `failsOn` / `warnsOn` are severity sets. CI thresholds and scores can be added
 * later as extra fields on this type plus a new policy id — validators stay untouched.
 */
export type ValidationPolicy = {
  readonly id: ValidationPolicyId;
  readonly failsOn: readonly ValidationSeverity[];
  readonly warnsOn: readonly ValidationSeverity[];
};

export const STRICT_POLICY: ValidationPolicy = {
  id: "strict",
  failsOn: ["critical", "error"],
  warnsOn: ["warning"],
};

export const LENIENT_POLICY: ValidationPolicy = {
  id: "lenient",
  failsOn: ["critical"],
  warnsOn: ["error", "warning"],
};

const POLICIES: Record<ValidationPolicyId, ValidationPolicy> = {
  strict: STRICT_POLICY,
  lenient: LENIENT_POLICY,
};

/**
 * Resolves the policy for a run. `strictMode` is a policy modifier that also
 * fails on warnings; it never changes the severity of a finding.
 */
export function resolvePolicy(configuration: ValidationConfiguration): ValidationPolicy {
  const base = POLICIES[configuration.policy];
  if (!configuration.strictMode) {
    return base;
  }
  return {
    id: base.id,
    failsOn: [...new Set<ValidationSeverity>([...base.failsOn, "warning"])],
    warnsOn: base.warnsOn.filter((severity) => severity !== "warning"),
  };
}

export type PolicyDecisionInput = {
  readonly summary: FindingSummary;
  /** Validators that threw. Evidence is incomplete, so the run cannot claim PASS. */
  readonly validatorErrorCount: number;
};

export function decideOutcome(
  policy: ValidationPolicy,
  input: PolicyDecisionInput,
): ValidationOutcome {
  const count = (severity: ValidationSeverity): number => input.summary[severity];

  if (policy.failsOn.some((severity) => count(severity) > 0)) {
    return "fail";
  }
  if (input.validatorErrorCount > 0) {
    return "warn";
  }
  return policy.warnsOn.some((severity) => count(severity) > 0) ? "warn" : "pass";
}
