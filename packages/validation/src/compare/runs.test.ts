import type { ValidationSeverity } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { compareValidationRuns, severityDrift, type ComparableFinding } from "./runs";
import { fingerprintFinding } from "../findings/normalize";

function finding(
  overrides: Partial<ComparableFinding> & { readonly code: string },
): ComparableFinding {
  const base = {
    code: overrides.code,
    validatorId: overrides.validatorId ?? ("metadata" as const),
    evidencePath: overrides.evidencePath ?? "task.toml",
    evidenceLine: overrides.evidenceLine ?? null,
    evidenceFieldPath: null,
  };
  return {
    fingerprint: overrides.fingerprint ?? fingerprintFinding(base),
    severity: overrides.severity ?? "error",
    code: base.code,
    category: overrides.category ?? "metadata",
    title: overrides.title ?? base.code,
    validatorId: base.validatorId,
    ordinal: overrides.ordinal ?? 0,
    evidencePath: base.evidencePath,
    evidenceLine: base.evidenceLine,
  };
}

describe("compareValidationRuns", () => {
  it("classifies new, resolved, unchanged, and severity-changed findings", () => {
    const stable = finding({ code: "TASK_METADATA_MISSING", ordinal: 0 });
    const drifted = finding({ code: "TASK_TEST_ENTRYPOINT_MISSING", severity: "warning" });
    const gone = finding({ code: "TASK_INSTRUCTION_MISSING", ordinal: 2 });
    const added = finding({
      code: "TASK_SECURITY_DOCKER_SOCKET",
      severity: "critical",
      ordinal: 3,
    });

    const comparison = compareValidationRuns(
      { runId: "run-a", findings: [stable, drifted, gone] },
      {
        runId: "run-b",
        findings: [stable, { ...drifted, severity: "error" as ValidationSeverity }, added],
      },
    );

    expect(comparison.previousRunId).toBe("run-a");
    expect(comparison.currentRunId).toBe("run-b");
    expect(comparison.newFindings.map((entry) => entry.code)).toEqual([
      "TASK_SECURITY_DOCKER_SOCKET",
    ]);
    expect(comparison.resolvedFindings.map((entry) => entry.code)).toEqual([
      "TASK_INSTRUCTION_MISSING",
    ]);
    expect(comparison.unchangedFindings.map((entry) => entry.code)).toEqual([
      "TASK_METADATA_MISSING",
    ]);
    expect(comparison.changedFindings).toHaveLength(1);
    expect(comparison.changedFindings[0]?.previous.severity).toBe("warning");
    expect(comparison.changedFindings[0]?.current.severity).toBe("error");
  });

  it("matches on fingerprint, so a re-ordered report is not a change", () => {
    const first = finding({ code: "TASK_METADATA_MISSING", ordinal: 0 });
    const second = finding({ code: "TASK_TEST_ENTRYPOINT_MISSING", ordinal: 1 });

    const comparison = compareValidationRuns(
      { runId: "run-a", findings: [first, second] },
      {
        runId: "run-b",
        findings: [
          { ...second, ordinal: 0 },
          { ...first, ordinal: 1 },
        ],
      },
    );

    expect(comparison.newFindings).toEqual([]);
    expect(comparison.resolvedFindings).toEqual([]);
    expect(comparison.changedFindings).toEqual([]);
    expect(comparison.unchangedFindings).toHaveLength(2);
  });

  it("treats the same code at a different location as a different finding", () => {
    const atLineOne = finding({ code: "TASK_ENVIRONMENT_WORKDIR_MISSING", evidenceLine: 1 });
    const atLineNine = finding({ code: "TASK_ENVIRONMENT_WORKDIR_MISSING", evidenceLine: 9 });

    expect(atLineOne.fingerprint).not.toBe(atLineNine.fingerprint);

    const comparison = compareValidationRuns(
      { runId: "run-a", findings: [atLineOne] },
      { runId: "run-b", findings: [atLineNine] },
    );

    expect(comparison.newFindings).toHaveLength(1);
    expect(comparison.resolvedFindings).toHaveLength(1);
  });

  it("returns an empty diff for two empty runs", () => {
    const comparison = compareValidationRuns(
      { runId: "run-a", findings: [] },
      { runId: "run-b", findings: [] },
    );

    expect(comparison).toEqual({
      previousRunId: "run-a",
      currentRunId: "run-b",
      newFindings: [],
      resolvedFindings: [],
      unchangedFindings: [],
      changedFindings: [],
    });
  });

  it("orders every bucket deterministically", () => {
    const findings = [
      finding({ code: "B_CODE", ordinal: 2 }),
      finding({ code: "A_CODE", ordinal: 1 }),
      finding({ code: "C_CODE", ordinal: 0 }),
    ];

    const comparison = compareValidationRuns(
      { runId: "run-a", findings: [] },
      { runId: "run-b", findings },
    );

    expect(comparison.newFindings.map((entry) => entry.code)).toEqual([
      "C_CODE",
      "A_CODE",
      "B_CODE",
    ]);
  });
});

describe("severityDrift", () => {
  it("reports direction, and null when nothing moved", () => {
    expect(severityDrift("warning", "critical")).toBe("worse");
    expect(severityDrift("error", "info")).toBe("better");
    expect(severityDrift("error", "error")).toBeNull();
  });
});
