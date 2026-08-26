import type {
  ValidationConfiguration,
  Validator,
  ValidatorDescriptor,
  ValidatorId,
  ValidatorRegistry,
} from "@agentforge/contracts";

/**
 * Typed validator registry. Selection is driven by configuration, not by an
 * if/else chain, so adding a validator is a registration change.
 */
export function createValidatorRegistry(validators: readonly Validator[]): ValidatorRegistry {
  const byId = new Map<ValidatorId, Validator>();
  for (const validator of validators) {
    if (byId.has(validator.id)) {
      throw new Error(`Duplicate validator id registered: ${validator.id}`);
    }
    byId.set(validator.id, validator);
  }

  return {
    list(): readonly Validator[] {
      return validators;
    },
    get(id: ValidatorId): Validator | null {
      return byId.get(id) ?? null;
    },
    select(configuration: ValidationConfiguration): readonly Validator[] {
      const enabled = new Set<ValidatorId>(configuration.enabledValidators);
      return validators.filter((validator) => enabled.has(validator.id));
    },
    describe(): readonly ValidatorDescriptor[] {
      return validators.map((validator) => ({
        id: validator.id,
        name: validator.name,
        version: validator.version,
      }));
    },
  };
}
