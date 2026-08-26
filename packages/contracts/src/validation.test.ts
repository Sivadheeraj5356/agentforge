import { describe, expect, it } from "vitest";

import {
  DEFAULT_MIN_INSTRUCTION_CHARACTERS,
  VALIDATION_FINDING_CATEGORIES,
  ValidationConfigurationSchema,
  ValidationFindingDraftSchema,
  ValidationSeveritySchema,
  summarizeFindings,
  validationCategoryRank,
  validationSeverityRank,
} from "./validation";

describe("ValidationConfigurationSchema", () => {
  it("applies defaults without hardcoding every future rule", () => {
    const parsed = ValidationConfigurationSchema.parse({ schemaVersion: 1 });
    expect(parsed.strictMode).toBe(false);
    expect(parsed.policy).toBe("strict");
    expect(parsed.enabledValidators).toContain("security");
    expect(parsed.enabledValidators).toContain("reproducibility");
    expect(parsed.benchmarkVersion).toBe("harbor-3");
    expect(parsed.validatorOptions.minInstructionCharacters).toBe(
      DEFAULT_MIN_INSTRUCTION_CHARACTERS,
    );
  });

  it("rejects unknown configuration keys", () => {
    expect(
      ValidationConfigurationSchema.safeParse({ schemaVersion: 1, runShellScripts: true }).success,
    ).toBe(false);
  });
});

describe("summarizeFindings", () => {
  it("counts validation severities and the total", () => {
    expect(ValidationSeveritySchema.parse("warning")).toBe("warning");
    expect(
      summarizeFindings([{ severity: "error" }, { severity: "error" }, { severity: "info" }]),
    ).toEqual({ total: 3, critical: 0, error: 2, warning: 0, info: 1 });
  });
});

describe("deterministic ranks", () => {
  it("orders severity from most to least severe", () => {
    expect(validationSeverityRank("critical")).toBeLessThan(validationSeverityRank("error"));
    expect(validationSeverityRank("error")).toBeLessThan(validationSeverityRank("warning"));
    expect(validationSeverityRank("warning")).toBeLessThan(validationSeverityRank("info"));
  });

  it("gives every category a distinct rank", () => {
    const ranks = VALIDATION_FINDING_CATEGORIES.map(validationCategoryRank);
    expect(new Set(ranks).size).toBe(VALIDATION_FINDING_CATEGORIES.length);
  });
});

describe("ValidationFindingDraftSchema", () => {
  it("requires a category and an explicit null line when unknown", () => {
    const draft = {
      code: "TASK_METADATA_MISSING",
      category: "metadata" as const,
      severity: "error" as const,
      title: "Task metadata file is not present",
      message: "No task.toml or task.yaml was found at the task root.",
      evidencePath: "task.toml",
      evidenceLine: null,
      evidenceFieldPath: null,
      excerpt: null,
      remediation: "Add task.toml or task.yaml.",
      validatorId: "metadata" as const,
    };
    expect(ValidationFindingDraftSchema.parse(draft).evidenceLine).toBeNull();
    expect(ValidationFindingDraftSchema.safeParse({ ...draft, category: "vibes" }).success).toBe(
      false,
    );
  });
});
