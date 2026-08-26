import { describe, expect, it } from "vitest";

import {
  EXECUTION_DISCLOSURE,
  projectCounts,
  projectFinding,
  projectProvenance,
  projectRunSummary,
  readEvidence,
  readValidatorDescriptors,
  shortenHash,
  type FindingRow,
  type RunRow,
} from "@/modules/tasks/model";

const VALIDATORS = [
  { id: "metadata", name: "Task metadata", version: "2.0.0" },
  { id: "environment", name: "Environment", version: "1.3.0" },
];

const RUN: RunRow = {
  run_number: 7,
  status: "succeeded",
  outcome: "fail",
  policy: "strict",
  created_at: "2026-08-16T10:00:00.000Z",
  started_at: "2026-08-16T10:00:00.000Z",
  completed_at: "2026-08-16T10:00:02.000Z",
  duration_ms: 2000,
  adapter_id: "terminus",
  adapter_version: "2.0.0",
  artifact_content_hash: "a".repeat(64),
  critical_count: 1,
  error_count: 2,
  warning_count: 3,
  info_count: 4,
  validator_error_count: 1,
  validators: VALIDATORS,
};

function row(overrides: Partial<FindingRow> & { id: string }): FindingRow {
  return {
    id: overrides.id,
    ordinal: overrides.ordinal ?? 0,
    fingerprint: overrides.fingerprint ?? "b".repeat(64),
    code: overrides.code ?? "TASK_METADATA_MISSING",
    category: overrides.category ?? "metadata",
    severity: overrides.severity ?? "error",
    title: overrides.title ?? "Metadata is missing",
    message: overrides.message ?? "task.toml was not found.",
    remediation: overrides.remediation ?? null,
    validator_id: "validator_id" in overrides ? (overrides.validator_id ?? null) : "metadata",
    evidence: overrides.evidence ?? { schemaVersion: 1, path: "task.toml", line: 3 },
  };
}

describe("readValidatorDescriptors", () => {
  it("reads well-formed descriptors and ignores the rest", () => {
    expect(
      readValidatorDescriptors([
        { id: "metadata", name: "Task metadata", version: "2.0.0" },
        { id: "broken" },
        null,
        "nope",
        ["also nope"],
      ]),
    ).toEqual([{ id: "metadata", name: "Task metadata", version: "2.0.0" }]);
  });

  it("returns nothing for a column that is not an array", () => {
    expect(readValidatorDescriptors(null)).toEqual([]);
    expect(readValidatorDescriptors({ id: "metadata" })).toEqual([]);
  });
});

describe("readEvidence", () => {
  it("reads the fields the pipeline records", () => {
    expect(
      readEvidence({ schemaVersion: 1, path: "task.toml", line: 4, fieldPath: "metadata.name" }),
    ).toEqual({ path: "task.toml", line: 4, fieldPath: "metadata.name", excerpt: null });
  });

  it("never invents a location from malformed data", () => {
    expect(readEvidence({ path: "", line: 0 })).toEqual({
      path: null,
      line: null,
      fieldPath: null,
      excerpt: null,
    });
    expect(readEvidence({ path: "a.md", line: -3 }).line).toBeNull();
    expect(readEvidence({ path: "a.md", line: 1.5 }).line).toBeNull();
    expect(readEvidence("corrupt")).toEqual({
      path: null,
      line: null,
      fieldPath: null,
      excerpt: null,
    });
  });
});

describe("projectFinding", () => {
  it("resolves the validator name and version from the run's descriptors", () => {
    const finding = projectFinding(row({ id: "1" }), VALIDATORS);
    expect(finding.validatorId).toBe("metadata");
    expect(finding.validatorName).toBe("Task metadata");
    expect(finding.validatorVersion).toBe("2.0.0");
  });

  it("starts deterministic findings as open", () => {
    expect(projectFinding(row({ id: "1" }), VALIDATORS).status).toBe("open");
  });

  it("keeps a pipeline finding that has no validator", () => {
    const finding = projectFinding(row({ id: "2", validator_id: null }), VALIDATORS);
    expect(finding.validatorId).toBeNull();
    expect(finding.validatorName).toBeNull();
  });

  it("shows evidence even when a category or severity is unrecognized", () => {
    const finding = projectFinding(
      row({ id: "3", category: "from-the-future", severity: "apocalyptic" }),
      VALIDATORS,
    );
    expect(finding.category).toBe("structure");
    expect(finding.severity).toBe("info");
    expect(finding.title).toBe("Metadata is missing");
  });
});

describe("projectRunSummary", () => {
  it("carries the display number, never the row id", () => {
    const summary = projectRunSummary(RUN);
    expect(summary.runNumber).toBe(7);
    expect(Object.keys(summary)).not.toContain("id");
  });

  it("totals the severity counts", () => {
    expect(projectCounts(RUN)).toEqual({
      total: 10,
      critical: 1,
      error: 2,
      warning: 3,
      info: 4,
    });
  });

  it("reports no verdict when the stored outcome is not one AgentForge knows", () => {
    expect(projectRunSummary({ ...RUN, outcome: "exploded" }).outcome).toBeNull();
    expect(projectRunSummary({ ...RUN, outcome: null }).outcome).toBeNull();
  });
});

describe("projectProvenance", () => {
  it("projects the facts that let a reviewer trust the report", () => {
    const findings = [
      projectFinding(row({ id: "1", validator_id: "metadata" }), VALIDATORS),
      projectFinding(row({ id: "2", validator_id: "metadata" }), VALIDATORS),
      projectFinding(row({ id: "3", validator_id: "environment" }), VALIDATORS),
    ];
    const provenance = projectProvenance(RUN, findings, 4096);

    expect(provenance.benchmark).toBe("terminus");
    expect(provenance.benchmarkVersion).toBe("2.0.0");
    expect(provenance.artifactContentHash).toBe("a".repeat(64));
    expect(provenance.artifactByteSize).toBe(4096);
    expect(provenance.policy).toBe("strict");
    expect(provenance.startedAt).toBe("2026-08-16T10:00:00.000Z");
    expect(provenance.completedAt).toBe("2026-08-16T10:00:02.000Z");
    expect(provenance.durationMs).toBe(2000);
    expect(provenance.validators).toEqual([
      { id: "metadata", name: "Task metadata", version: "2.0.0", findingCount: 2 },
      { id: "environment", name: "Environment", version: "1.3.0", findingCount: 1 },
    ]);
  });

  it("survives a run with no recorded validators", () => {
    expect(projectProvenance({ ...RUN, validators: null }, [], null).validators).toEqual([]);
  });

  it("states plainly that nothing was executed", () => {
    expect(EXECUTION_DISCLOSURE).toContain("not part of this validation run");
    expect(EXECUTION_DISCLOSURE).toContain("built, installed, or run");
  });
});

describe("shortenHash", () => {
  it("shortens for display without inventing a value", () => {
    expect(shortenHash("a".repeat(64))).toBe("a".repeat(12));
    expect(shortenHash("abc", 12)).toBe("abc");
    expect(shortenHash(null)).toBeNull();
  });
});
