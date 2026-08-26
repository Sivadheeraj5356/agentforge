import type { FindingSummary } from "@agentforge/contracts";
import { ValidationConfigurationSchema } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { decideOutcome, LENIENT_POLICY, resolvePolicy, STRICT_POLICY } from "./policy";

function summary(overrides: Partial<FindingSummary> = {}): FindingSummary {
  const counts = { critical: 0, error: 0, warning: 0, info: 0, ...overrides };
  return {
    ...counts,
    total: counts.critical + counts.error + counts.warning + counts.info,
  };
}

function configuration(overrides: Record<string, unknown> = {}) {
  return ValidationConfigurationSchema.parse({ schemaVersion: 1, ...overrides });
}

describe("resolvePolicy", () => {
  it("defaults to strict", () => {
    expect(resolvePolicy(configuration()).id).toBe("strict");
    expect(resolvePolicy(configuration()).failsOn).toEqual(STRICT_POLICY.failsOn);
  });

  it("selects the lenient policy when configured", () => {
    expect(resolvePolicy(configuration({ policy: "lenient" })).failsOn).toEqual(
      LENIENT_POLICY.failsOn,
    );
  });

  it("adds warnings to the failing set under strictMode without touching severities", () => {
    const policy = resolvePolicy(configuration({ strictMode: true }));
    expect(policy.failsOn).toContain("warning");
    expect(policy.warnsOn).not.toContain("warning");
  });
});

describe("decideOutcome", () => {
  it("passes a clean run", () => {
    expect(decideOutcome(STRICT_POLICY, { summary: summary(), validatorErrorCount: 0 })).toBe(
      "pass",
    );
  });

  it("does not fail merely because findings exist", () => {
    expect(
      decideOutcome(STRICT_POLICY, { summary: summary({ info: 9 }), validatorErrorCount: 0 }),
    ).toBe("pass");
    expect(
      decideOutcome(STRICT_POLICY, { summary: summary({ warning: 3 }), validatorErrorCount: 0 }),
    ).toBe("warn");
  });

  it("fails on errors under strict and only on critical under lenient", () => {
    const withError = { summary: summary({ error: 1 }), validatorErrorCount: 0 };
    expect(decideOutcome(STRICT_POLICY, withError)).toBe("fail");
    expect(decideOutcome(LENIENT_POLICY, withError)).toBe("warn");

    const withCritical = { summary: summary({ critical: 1 }), validatorErrorCount: 0 };
    expect(decideOutcome(LENIENT_POLICY, withCritical)).toBe("fail");
  });

  it("never reports pass when a validator failed to run", () => {
    expect(decideOutcome(STRICT_POLICY, { summary: summary(), validatorErrorCount: 1 })).toBe(
      "warn",
    );
  });

  it("still fails when both findings and validator errors are present", () => {
    expect(
      decideOutcome(STRICT_POLICY, { summary: summary({ critical: 1 }), validatorErrorCount: 2 }),
    ).toBe("fail");
  });
});
