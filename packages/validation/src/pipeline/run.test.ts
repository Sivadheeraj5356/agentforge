import type { ValidationReport, Validator } from "@agentforge/contracts";
import { describe, expect, it } from "vitest";

import { createStoredZip } from "../archive/zip";
import { FINDING_CODES } from "../finding-codes";
import { FIXTURE_IDS, fixtureExpectation, fixturePackage, fixtureZip } from "../fixtures";
import { MAX_FINDINGS_PER_RUN } from "../limits";
import { createBenchmarkAdapterRegistry } from "../registry";
import { TerminusAdapter } from "../terminus/adapter";
import { createValidatorRegistry } from "../validators/registry";
import { securityValidator } from "../validators/security";
import type { DiagnosticEvent } from "./diagnostics";
import { runValidationPipeline } from "./run";

const encoder = new TextEncoder();

function uniqueSortedCodes(report: ValidationReport): readonly string[] {
  return [...new Set(report.findings.map((finding) => finding.code))].sort();
}

describe("runValidationPipeline over the fixtures", () => {
  for (const id of FIXTURE_IDS) {
    it(`matches the expected result for the ${id} fixture`, async () => {
      const report = await runValidationPipeline({ archiveBytes: fixtureZip(id) });
      const expected = fixtureExpectation(id);

      expect(report.benchmark).toBe("terminus");
      expect(report.detection.matched).toBe(true);
      expect(uniqueSortedCodes(report)).toEqual([...expected.codes].sort());
      expect(report.outcome).toBe(expected.outcome);
      expect(report.validatorErrors).toEqual([]);
    });
  }

  it("reports a complete package as passing with no findings", async () => {
    const report = await runValidationPipeline({ archiveBytes: fixtureZip("valid") });
    expect(report.findings).toEqual([]);
    expect(report.summary).toEqual({ total: 0, critical: 0, error: 0, warning: 0, info: 0 });
    expect(report.outcome).toBe("pass");
    expect(report.policy).toBe("strict");
  });

  it("records benchmark, versions, artifact hash, validators, and duration", async () => {
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("valid"),
      clock: (() => {
        let now = 1_000;
        return () => (now += 25);
      })(),
    });

    expect(report.benchmark).toBe("terminus");
    expect(report.benchmarkVersion).toBe(new TerminusAdapter().version);
    expect(report.artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.artifact.byteSize).toBeGreaterThan(0);
    expect(report.validators.map((validator) => validator.id)).toEqual([
      "task-structure",
      "metadata",
      "instruction",
      "environment",
      "verifier",
      "test",
      "documentation",
      "security",
      "reproducibility",
    ]);
    expect(report.validators.every((validator) => validator.version.length > 0)).toBe(true);
    expect(report.durationMs).toBe(25);
  });

  it("produces byte-identical reports for repeated runs", async () => {
    const first = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-environment"),
      clock: () => 0,
    });
    const second = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-environment"),
      clock: () => 0,
    });
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("emits multiple findings for one package in the documented order", async () => {
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-environment"),
    });
    expect(report.findings.length).toBeGreaterThan(1);
    expect(report.findings.map((finding) => finding.severity)).toEqual([
      "error",
      "error",
      "warning",
    ]);
    expect(report.findings.map((finding) => finding.ordinal)).toEqual([0, 1, 2]);
    expect(report.findings.every((finding) => /^[a-f0-9]{64}$/.test(finding.fingerprint))).toBe(
      true,
    );
  });

  it("keeps fingerprints stable across runs so future diffing works", async () => {
    const first = await runValidationPipeline({ archiveBytes: fixtureZip("invalid-verifier") });
    const second = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-verifier", "wrapper"),
    });
    expect(first.findings.map((finding) => finding.code)).toEqual(
      second.findings.map((finding) => finding.code),
    );
  });

  it("applies the lenient policy when configured", async () => {
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-structure"),
      configuration: { policy: "lenient" },
    });
    expect(report.summary.error).toBeGreaterThan(0);
    expect(report.summary.critical).toBe(0);
    expect(report.outcome).toBe("warn");
  });

  it("runs only the validators enabled by configuration", async () => {
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("invalid-structure"),
      configuration: { enabledValidators: ["documentation"] },
    });
    expect(report.validators.map((validator) => validator.id)).toEqual(["documentation"]);
    expect(report.findings).toEqual([]);
  });
});

describe("multi-task packages", () => {
  const files = [
    ...fixturePackage("valid").files.map((file) => ({
      path: `tasks/alpha/${file.path}`,
      content: file.content,
    })),
    ...fixturePackage("missing-metadata").files.map((file) => ({
      path: `tasks/beta/${file.path}`,
      content: file.content,
    })),
    { path: "docker-compose.yaml", content: "services:\n  shared:\n    privileged: true\n" },
  ];

  it("discovers every task and attributes findings to the right root", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createStoredZip(
        files.map((file) => ({ path: file.path, data: encoder.encode(file.content) })),
      ),
    });

    expect(report.tasks.map((task) => task.rootPath)).toEqual(["tasks/alpha", "tasks/beta"]);
    const metadataFinding = report.findings.find(
      (finding) => finding.code === FINDING_CODES.TASK_METADATA_MISSING,
    );
    expect(metadataFinding?.evidencePath).toBe("tasks/beta");
  });

  it("reports a shared file outside every task root exactly once", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createStoredZip(
        files.map((file) => ({ path: file.path, data: encoder.encode(file.content) })),
      ),
    });
    const privileged = report.findings.filter(
      (finding) => finding.code === FINDING_CODES.TASK_SECURITY_PRIVILEGED,
    );
    expect(privileged).toHaveLength(1);
    expect(privileged[0]?.evidencePath).toBe("docker-compose.yaml");
  });
});

describe("validator error isolation", () => {
  const explodingValidator: Validator = {
    id: "metadata",
    name: "Exploding validator",
    category: "metadata",
    version: "0.0.1",
    validate() {
      throw new Error("validator crashed with /tmp/internal/path detail");
    },
  };

  class PartiallyBrokenAdapter extends TerminusAdapter {
    override validators() {
      return createValidatorRegistry([explodingValidator, securityValidator]);
    }
  }

  it("keeps the run going, records the failure, and still reports other findings", async () => {
    const events: DiagnosticEvent[] = [];
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("security-invalid"),
      registry: createBenchmarkAdapterRegistry([new PartiallyBrokenAdapter()]),
      diagnostics: (event) => events.push(event),
    });

    expect(report.validatorErrors).toEqual([
      {
        validatorId: "metadata",
        validatorVersion: "0.0.1",
        taskRootPath: "",
        message: "validator crashed with /tmp/internal/path detail",
      },
    ]);
    expect(uniqueSortedCodes(report)).toContain(FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET);
    expect(events.map((event) => event.event)).toContain("validator.failed");
  });

  it("does not turn a validator failure into a finding", async () => {
    const report = await runValidationPipeline({
      archiveBytes: fixtureZip("valid"),
      registry: createBenchmarkAdapterRegistry([new PartiallyBrokenAdapter()]),
    });
    expect(report.findings).toEqual([]);
    expect(report.validatorErrors).toHaveLength(1);
    expect(report.outcome).toBe("warn");
  });
});

describe("finding ceiling", () => {
  // Extracting several hundred files is genuinely I/O heavy, especially on Windows.
  const CEILING_TEST_TIMEOUT_MS = 60_000;

  it(
    "truncates deterministically and says so, staying within the ceiling",
    async () => {
      const noisyFiles = Array.from({ length: MAX_FINDINGS_PER_RUN + 20 }, (_, index) => ({
        path: `scripts/step-${String(index).padStart(4, "0")}.sh`,
        data: encoder.encode("#!/bin/bash\ndocker run --privileged busybox\n"),
      }));
      const report = await runValidationPipeline({
        archiveBytes: createStoredZip([
          ...fixturePackage("valid").files.map((file) => ({
            path: file.path,
            data: encoder.encode(file.content),
          })),
          ...noisyFiles,
        ]),
      });

      expect(report.findings).toHaveLength(MAX_FINDINGS_PER_RUN);
      expect(report.summary.total).toBe(MAX_FINDINGS_PER_RUN);
      const notice = report.findings.at(-1);
      expect(notice?.code).toBe(FINDING_CODES.VALIDATION_FINDINGS_TRUNCATED);
      expect(notice?.category).toBe("configuration");
      expect(notice?.ordinal).toBe(MAX_FINDINGS_PER_RUN - 1);
      expect(report.outcome).toBe("fail");
    },
    CEILING_TEST_TIMEOUT_MS,
  );
});

describe("unrecognized packages", () => {
  it("reports BENCHMARK_UNDETECTED instead of throwing", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createStoredZip([
        { path: "notes.txt", data: encoder.encode("just some notes") },
      ]),
    });

    expect(report.detection.matched).toBe(false);
    expect(report.benchmark).toBeNull();
    expect(report.tasks).toEqual([]);
    expect(report.validators).toEqual([]);
    expect(report.findings.map((finding) => finding.code)).toEqual([
      FINDING_CODES.BENCHMARK_UNDETECTED,
    ]);
    expect(report.outcome).toBe("fail");
  });
});
