import type { ValidatorRegistry } from "@agentforge/contracts";

import { documentationValidator } from "../validators/documentation";
import { environmentValidator } from "../validators/environment";
import { instructionValidator } from "../validators/instruction";
import { metadataValidator } from "../validators/metadata";
import { createValidatorRegistry } from "../validators/registry";
import { reproducibilityValidator } from "../validators/reproducibility";
import { securityValidator } from "../validators/security";
import { taskStructureValidator } from "../validators/task-structure";
import { testValidator } from "../validators/test";
import { verifierValidator } from "../validators/verifier";

/**
 * Validators the Terminus adapter registers. Registration order is the tie-break
 * for reporting order; `compareFindings` still owns the final report order.
 */
export function createTerminusValidatorRegistry(): ValidatorRegistry {
  return createValidatorRegistry([
    taskStructureValidator,
    metadataValidator,
    instructionValidator,
    environmentValidator,
    verifierValidator,
    testValidator,
    documentationValidator,
    securityValidator,
    reproducibilityValidator,
  ]);
}
