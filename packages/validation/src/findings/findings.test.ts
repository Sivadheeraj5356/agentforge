import type { ValidationFindingDraft } from "@agentforge/contracts";
import { summarizeFindings, ValidationConfigurationSchema } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { FINDING_CODES } from "../finding-codes";
import { excerptFromText, excerptMatchingLines, findFirstLine } from "./excerpt";
import { atLine, atPath, createFindingEmitter, createPipelineFinding } from "./factory";
import { compareFindings, fingerprintFinding, normalizeFindings } from "./normalize";

const OPTIONS = ValidationConfigurationSchema.parse({ schemaVersion: 1 }).validatorOptions;
const NO_LIMIT = 1000;

function draft(overrides: Partial<ValidationFindingDraft> = {}): ValidationFindingDraft {
  return {
    code: FINDING_CODES.TASK_METADATA_MISSING,
    category: "metadata",
    severity: "error",
    title: "Task metadata is not available",
    message: "No metadata document was found.",
    evidencePath: "task.toml",
    evidenceLine: null,
    evidenceFieldPath: null,
    excerpt: null,
    remediation: null,
    validatorId: "metadata",
    ...overrides,
  };
}

describe("finding creation", () => {
  it("stamps the emitting validator's id and category", () => {
    const emit = createFindingEmitter({ id: "security", category: "security" }, OPTIONS);
    const created = emit({
      code: FINDING_CODES.TASK_SECURITY_PRIVILEGED,
      severity: "critical",
      title: "Package requests a privileged container",
      message: "A file requests privileged execution.",
      location: atLine("docker-compose.yaml", 4),
    });

    expect(created.validatorId).toBe("security");
    expect(created.category).toBe("security");
    expect(created.evidencePath).toBe("docker-compose.yaml");
    expect(created.evidenceLine).toBe(4);
    expect(created.evidenceFieldPath).toBeNull();
    expect(created.excerpt).toBeNull();
  });

  it("leaves pipeline findings unattributed to any validator", () => {
    const created = createPipelineFinding(
      {
        code: FINDING_CODES.BENCHMARK_UNDETECTED,
        severity: "error",
        title: "Package format was not recognized",
        message: "No adapter matched.",
        location: atPath("."),
      },
      "structure",
      OPTIONS,
    );
    expect(created.validatorId).toBeNull();
    expect(created.category).toBe("structure");
  });

  it("clamps excerpts to the configured ceiling", () => {
    const emit = createFindingEmitter({ id: "environment", category: "environment" }, OPTIONS);
    const created = emit({
      code: FINDING_CODES.TASK_ENVIRONMENT_WORKDIR_MISSING,
      severity: "warning",
      title: "Dockerfile declares no WORKDIR",
      message: "No WORKDIR directive was found.",
      excerpt: "x".repeat(OPTIONS.maxExcerptCharacters + 50),
    });
    expect(created.excerpt).toHaveLength(OPTIONS.maxExcerptCharacters);
  });
});

describe("excerpt helpers", () => {
  const dockerfile = ["FROM ubuntu:24.04", "COPY tests/ /app/tests/", "RUN echo hi"].join("\n");

  it("keeps only matching lines and derives real line numbers", () => {
    expect(excerptMatchingLines(dockerfile, /^\s*COPY/i, OPTIONS)).toBe("COPY tests/ /app/tests/");
    expect(findFirstLine(dockerfile, /^\s*COPY/i)).toBe(2);
    expect(findFirstLine(dockerfile, /WORKDIR/)).toBeNull();
  });

  it("bounds leading excerpts by line count", () => {
    const long = Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n");
    expect(excerptFromText(long, OPTIONS)?.split("\n")).toHaveLength(OPTIONS.maxExcerptLines);
  });
});

describe("severity aggregation", () => {
  it("counts by severity and total", () => {
    expect(
      summarizeFindings([
        draft({ severity: "critical" }),
        draft({ severity: "error" }),
        draft({ severity: "warning" }),
        draft({ severity: "warning" }),
        draft({ severity: "info" }),
      ]),
    ).toEqual({ total: 5, critical: 1, error: 1, warning: 2, info: 1 });
  });
});

describe("fingerprints", () => {
  it("depend on code, validator, and location only", () => {
    const base = draft();
    expect(fingerprintFinding(base)).toBe(fingerprintFinding(draft({ title: "Different title" })));
    expect(fingerprintFinding(base)).not.toBe(fingerprintFinding(draft({ evidenceLine: 3 })));
    expect(fingerprintFinding(base)).not.toBe(
      fingerprintFinding(draft({ code: FINDING_CODES.TASK_METADATA_MALFORMED })),
    );
    expect(fingerprintFinding(base)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("cannot be confused by separator injection in a path", () => {
    expect(fingerprintFinding(draft({ evidencePath: "a", evidenceFieldPath: "b" }))).not.toBe(
      fingerprintFinding(draft({ evidencePath: "a\u0000b", evidenceFieldPath: null })),
    );
  });
});

describe("normalizeFindings", () => {
  it("orders by severity, then category, validator, code, and location", () => {
    const result = normalizeFindings(
      [
        draft({ severity: "info", category: "documentation", validatorId: "documentation" }),
        draft({ severity: "critical", category: "security", validatorId: "security" }),
        draft({ severity: "error", category: "structure", validatorId: "task-structure" }),
        draft({ severity: "warning", category: "environment", validatorId: "environment" }),
      ],
      NO_LIMIT,
    );

    expect(result.findings.map((finding) => finding.severity)).toEqual([
      "critical",
      "error",
      "warning",
      "info",
    ]);
    expect(result.findings.map((finding) => finding.ordinal)).toEqual([0, 1, 2, 3]);
  });

  it("breaks ties by code then path then line", () => {
    const result = normalizeFindings(
      [
        draft({ code: FINDING_CODES.TASK_METADATA_MALFORMED, evidencePath: "b.toml" }),
        draft({ code: FINDING_CODES.TASK_METADATA_MALFORMED, evidencePath: "a.toml" }),
        draft({ code: FINDING_CODES.TASK_METADATA_FIELD_MISSING, evidencePath: "z.toml" }),
        draft({
          code: FINDING_CODES.TASK_METADATA_MALFORMED,
          evidencePath: "a.toml",
          evidenceLine: 2,
        }),
      ],
      NO_LIMIT,
    );

    expect(
      result.findings.map(
        (finding) => `${finding.code}:${finding.evidencePath}:${finding.evidenceLine}`,
      ),
    ).toEqual([
      "TASK_METADATA_FIELD_MISSING:z.toml:null",
      "TASK_METADATA_MALFORMED:a.toml:null",
      "TASK_METADATA_MALFORMED:a.toml:2",
      "TASK_METADATA_MALFORMED:b.toml:null",
    ]);
  });

  it("is stable regardless of input order", () => {
    const drafts = [
      draft({ severity: "warning", category: "environment", validatorId: "environment" }),
      draft({ severity: "critical", category: "security", validatorId: "security" }),
      draft({ severity: "info", category: "documentation", validatorId: "documentation" }),
    ];
    const forward = normalizeFindings(drafts, NO_LIMIT).findings.map((f) => f.fingerprint);
    const reversed = normalizeFindings([...drafts].reverse(), NO_LIMIT).findings.map(
      (f) => f.fingerprint,
    );
    expect(forward).toEqual(reversed);
  });

  it("collapses equivalent findings and keeps the most severe duplicate", () => {
    const result = normalizeFindings(
      [draft({ severity: "warning" }), draft({ severity: "critical" }), draft()],
      NO_LIMIT,
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.severity).toBe("critical");
  });

  it("keeps distinct locations of the same code separate", () => {
    const result = normalizeFindings(
      [
        draft({ evidenceFieldPath: "verifier.entrypoint" }),
        draft({ evidenceFieldPath: "verifier.environment_mode" }),
      ],
      NO_LIMIT,
    );
    expect(result.findings).toHaveLength(2);
  });

  it("drops the least severe findings past the ceiling", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      draft({ severity: index === 0 ? "critical" : "info", evidencePath: `file-${index}.toml` }),
    );
    const result = normalizeFindings(many, 5);
    expect(result.findings).toHaveLength(5);
    expect(result.droppedCount).toBe(7);
    expect(result.findings[0]?.severity).toBe("critical");
  });
});

describe("compareFindings", () => {
  it("treats identical findings as equal", () => {
    expect(compareFindings(draft(), draft())).toBe(0);
  });
});
