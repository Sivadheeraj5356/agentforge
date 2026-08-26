import type {
  ValidationContext,
  ValidationFindingCategory,
  ValidationFindingDraft,
  Validator,
  ValidatorId,
} from "@agentforge/contracts";

import { createFindingEmitter, type FindingEmitter } from "../findings/factory";

export type ValidatorDefinition = {
  readonly id: ValidatorId;
  readonly name: string;
  readonly category: ValidationFindingCategory;
  /** Bump when the checks change, so reports stay explainable across versions. */
  readonly version: string;
  check(context: ValidationContext, emit: FindingEmitter): readonly ValidationFindingDraft[] | void;
};

/**
 * Wraps a definition into a `Validator`, binding the emitter so every finding
 * carries the validator's id and category. Validators receive only the context.
 */
export function defineValidator(definition: ValidatorDefinition): Validator {
  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    version: definition.version,
    validate(context: ValidationContext): readonly ValidationFindingDraft[] {
      const emitter: FindingEmitter = createFindingEmitter(
        { id: definition.id, category: definition.category },
        context.options,
      );
      return definition.check(context, emitter) ?? [];
    },
  };
}
