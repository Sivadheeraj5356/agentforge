import type { ValidationOutcome } from "@agentforge/contracts";

import { FINDING_CODES, type FindingCodeName } from "../finding-codes";
import type { FixtureId } from "./packages";

/**
 * Expected result per fixture under the default (strict) policy. Kept next to the
 * fixtures so a validator change that shifts an outcome fails loudly.
 */
export type FixtureExpectation = {
  readonly outcome: ValidationOutcome;
  /** Every code the fixture must produce, and no others. */
  readonly codes: readonly FindingCodeName[];
};

export const FIXTURE_EXPECTATIONS: Record<FixtureId, FixtureExpectation> = {
  valid: {
    outcome: "pass",
    codes: [],
  },
  "missing-metadata": {
    outcome: "fail",
    codes: [
      FINDING_CODES.TASK_STRUCTURE_MISSING_METADATA,
      FINDING_CODES.TASK_METADATA_MISSING,
      FINDING_CODES.TASK_REPRODUCIBILITY_TASK_VERSION_MISSING,
      FINDING_CODES.TASK_REPRODUCIBILITY_TIMEOUT_UNDECLARED,
    ],
  },
  "invalid-structure": {
    outcome: "fail",
    codes: [
      FINDING_CODES.TASK_STRUCTURE_MISSING_INSTRUCTION,
      FINDING_CODES.TASK_INSTRUCTION_EMPTY,
      FINDING_CODES.TASK_VERIFIER_MISSING,
      FINDING_CODES.TASK_TEST_ENTRYPOINT_MISSING,
    ],
  },
  "invalid-environment": {
    outcome: "fail",
    codes: [
      FINDING_CODES.TASK_ENVIRONMENT_INVALID_CONFIGURATION,
      FINDING_CODES.TASK_ENVIRONMENT_SOLUTION_LEAK,
      FINDING_CODES.TASK_ENVIRONMENT_WORKDIR_MISSING,
    ],
  },
  "invalid-verifier": {
    outcome: "fail",
    codes: [FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION],
  },
  "security-invalid": {
    outcome: "fail",
    codes: [
      FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET,
      FINDING_CODES.TASK_SECURITY_PRIVILEGED,
      FINDING_CODES.TASK_SECURITY_PIPE_SHELL,
      FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_IMAGE_REF,
    ],
  },
};

export function fixtureExpectation(id: FixtureId): FixtureExpectation {
  return FIXTURE_EXPECTATIONS[id];
}
