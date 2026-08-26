import type {
  DetectionResult,
  ValidationConfiguration,
  ValidationConfigurationInput,
  ValidationContext,
  ValidationFinding,
  ValidationFindingDraft,
  ValidationReport,
  ValidationReportTask,
  ValidationSeverity,
  Validator,
  ValidatorDescriptor,
  ValidatorExecutionError,
  ValidatorOptions,
  WorkspaceReader,
} from "@agentforge/contracts";
import { summarizeFindings, ValidationConfigurationSchema } from "@agentforge/contracts";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { ArchiveError } from "../archive/bytes";
import { BenchmarkAdapterRefusedError } from "../errors";
import { materializeZip, withTempWorkspace } from "../archive/extract";
import { inspectZip } from "../archive/zip";
import { FINDING_CODES, type FindingCodeName } from "../finding-codes";
import { atPath, createPipelineFinding } from "../findings/factory";
import { fingerprintFinding, normalizeFindings } from "../findings/normalize";
import { sha256Hex } from "../hash";
import { MAX_FINDINGS_PER_RUN } from "../limits";
import { decideOutcome, resolvePolicy } from "../policy/policy";
import { createDefaultBenchmarkAdapterRegistry, type BenchmarkAdapterRegistry } from "../registry";
import { createWorkspaceReader } from "../workspace/reader";
import { isWithinDirectory } from "../workspace/paths";
import { loadWorkspaceSnapshot } from "../workspace/snapshot";
import { noopDiagnostics, type DiagnosticsSink } from "./diagnostics";

export type ValidationPipelineInput = {
  readonly archiveBytes: Uint8Array;
  readonly configuration?: Partial<ValidationConfigurationInput>;
  readonly registry?: BenchmarkAdapterRegistry;
  /** Injectable monotonic clock so duration is deterministic in tests. */
  readonly clock?: () => number;
  readonly diagnostics?: DiagnosticsSink;
};

const UNMATCHED_DETECTION: DetectionResult = {
  matched: false,
  adapterId: null,
  confidence: 0,
  reasons: [],
};

/** Archive problems that indicate a hostile package rather than a malformed one. */
const CRITICAL_ARCHIVE_CODES = new Set<FindingCodeName>([
  FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
  FINDING_CODES.ARCHIVE_SYMLINK_REJECTED,
  FINDING_CODES.ARCHIVE_ABSOLUTE_PATH,
]);

function archiveSeverity(code: FindingCodeName): ValidationSeverity {
  return CRITICAL_ARCHIVE_CODES.has(code) ? "critical" : "error";
}

function toValidationFindings(
  drafts: readonly ValidationFindingDraft[],
  options: ValidatorOptions,
  diagnostics: DiagnosticsSink,
): readonly ValidationFinding[] {
  const normalized = normalizeFindings(drafts, MAX_FINDINGS_PER_RUN);
  if (normalized.droppedCount === 0) {
    return normalized.findings;
  }

  // Reserve the final slot for the notice so the report never exceeds the ceiling.
  const kept = normalized.findings.slice(0, MAX_FINDINGS_PER_RUN - 1);
  const droppedCount = normalized.droppedCount + (normalized.findings.length - kept.length);

  diagnostics({
    level: "warn",
    event: "findings.truncated",
    detail: `${droppedCount} findings exceeded the per-run ceiling of ${MAX_FINDINGS_PER_RUN}`,
  });

  const notice = createPipelineFinding(
    {
      code: FINDING_CODES.VALIDATION_FINDINGS_TRUNCATED,
      severity: "warning",
      title: "Finding list was truncated",
      message: `This package produced more distinct findings than the per-run ceiling of ${MAX_FINDINGS_PER_RUN}. ${droppedCount} lower-severity findings are not shown.`,
      remediation: "Fix the reported findings and re-run validation to see the remaining findings.",
    },
    "configuration",
    options,
  );

  return [
    ...kept,
    {
      ...notice,
      fingerprint: fingerprintFinding(notice),
      ordinal: kept.length,
    },
  ];
}

function buildReport(input: {
  readonly configuration: ValidationConfiguration;
  readonly contentHash: string;
  readonly byteSize: number;
  readonly detection: DetectionResult;
  readonly benchmarkVersion: string | null;
  readonly tasks: readonly ValidationReportTask[];
  readonly drafts: readonly ValidationFindingDraft[];
  readonly validators: readonly ValidatorDescriptor[];
  readonly validatorErrors: readonly ValidatorExecutionError[];
  readonly durationMs: number;
  readonly diagnostics: DiagnosticsSink;
}): ValidationReport {
  const findings = toValidationFindings(
    input.drafts,
    input.configuration.validatorOptions,
    input.diagnostics,
  );
  const summary = summarizeFindings(findings);
  const policy = resolvePolicy(input.configuration);

  return {
    schemaVersion: 1,
    benchmark: input.detection.adapterId,
    benchmarkVersion: input.benchmarkVersion,
    artifact: { contentHash: input.contentHash, byteSize: input.byteSize },
    detection: input.detection,
    tasks: input.tasks,
    outcome: decideOutcome(policy, {
      summary,
      validatorErrorCount: input.validatorErrors.length,
    }),
    policy: policy.id,
    summary,
    findings,
    validators: input.validators,
    validatorErrors: input.validatorErrors,
    durationMs: input.durationMs,
    configuration: input.configuration,
  };
}

/**
 * Runs one validator with error isolation. A throwing validator becomes an
 * execution error, never a finding, and never stops the run.
 */
function runValidator(
  validator: Validator,
  context: ValidationContext,
  diagnostics: DiagnosticsSink,
): { drafts: readonly ValidationFindingDraft[]; error: ValidatorExecutionError | null } {
  try {
    return { drafts: validator.validate(context), error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown validator failure";
    diagnostics({
      level: "error",
      event: "validator.failed",
      detail,
      validatorId: validator.id,
      taskRootPath: context.task.rootPath,
    });
    return {
      drafts: [],
      error: {
        validatorId: validator.id,
        validatorVersion: validator.version,
        taskRootPath: context.task.rootPath,
        message: detail,
      },
    };
  }
}

function filesForTask(
  workspace: WorkspaceReader,
  rootPath: string,
  allFiles: readonly string[],
  sharedFiles: readonly string[],
): readonly string[] {
  if (rootPath === "") {
    return allFiles;
  }
  return [...new Set([...workspace.listFiles(rootPath), ...sharedFiles])].sort();
}

/**
 * Artifact → safe extraction → detection → discovery → parse → validators →
 * normalization → policy → report.
 *
 * Deterministic and side-effect free apart from an isolated temp directory that is
 * always removed. Never executes uploaded scripts, never calls a model provider,
 * and never touches a database. Callable from the web app, a worker, a CLI, or CI.
 */
export async function runValidationPipeline(
  input: ValidationPipelineInput,
): Promise<ValidationReport> {
  assertNeverExecutesUserCode("validation pipeline");

  const clock = input.clock ?? Date.now;
  const diagnostics = input.diagnostics ?? noopDiagnostics;
  const startedAt = clock();
  const configuration = ValidationConfigurationSchema.parse({
    schemaVersion: 1,
    ...input.configuration,
  });
  const registry = input.registry ?? createDefaultBenchmarkAdapterRegistry();
  const byteSize = input.archiveBytes.byteLength;
  const contentHash = sha256Hex(input.archiveBytes);

  const report = (
    overrides: Omit<
      Parameters<typeof buildReport>[0],
      "configuration" | "contentHash" | "byteSize" | "durationMs" | "diagnostics"
    >,
  ): ValidationReport =>
    buildReport({
      configuration,
      contentHash,
      byteSize,
      durationMs: Math.max(0, clock() - startedAt),
      diagnostics,
      ...overrides,
    });

  try {
    const inspection = inspectZip(input.archiveBytes);

    return await withTempWorkspace(async (directory) => {
      await materializeZip(input.archiveBytes, inspection, directory);
      const workspace = createWorkspaceReader(await loadWorkspaceSnapshot(directory));

      const matched = registry.detect(workspace);
      if (!matched) {
        diagnostics({
          level: "warn",
          event: "benchmark.undetected",
          detail: `no registered adapter matched (${registry.list().length} adapters)`,
        });
        return report({
          detection: UNMATCHED_DETECTION,
          benchmarkVersion: null,
          tasks: [],
          validators: [],
          validatorErrors: [],
          drafts: [
            createPipelineFinding(
              {
                code: FINDING_CODES.BENCHMARK_UNDETECTED,
                severity: "error",
                title: "Package format was not recognized",
                message: `No registered benchmark adapter recognized this package. Registered adapters: ${registry
                  .list()
                  .map((adapter) => adapter.id)
                  .join(", ")}.`,
                remediation:
                  "Use a Harbor/Terminus layout (instruction.md, task.toml, environment/, tests/).",
              },
              "structure",
              configuration.validatorOptions,
            ),
          ],
        });
      }

      const { adapter, detection } = matched;
      const validators = adapter.validators().select(configuration);
      const allFiles = workspace.listFiles();
      const discovered = adapter.discoverTasks(workspace);
      let parsed;
      try {
        parsed = discovered.map((task) => adapter.parseTask(workspace, task));
      } catch (error) {
        if (!(error instanceof BenchmarkAdapterRefusedError)) {
          throw error;
        }
        diagnostics({
          level: "warn",
          event: "benchmark.refused",
          detail: error.message,
        });
        return report({
          detection,
          benchmarkVersion: adapter.version,
          tasks: [],
          validators: [],
          validatorErrors: [],
          drafts: [
            createPipelineFinding(
              {
                code: FINDING_CODES.BENCHMARK_ADAPTER_REFUSED,
                severity: "error",
                title: "Benchmark adapter refused this package",
                message: error.message,
                remediation:
                  "Use a Harbor/Terminus fixture AgentForge can execute, or import a licensed pack behind this adapter.",
              },
              "structure",
              configuration.validatorOptions,
            ),
          ],
        });
      }

      const namedRoots = discovered
        .map((task) => task.rootPath)
        .filter((rootPath) => rootPath !== "");
      const sharedFiles = allFiles.filter(
        (file) => !namedRoots.some((root) => isWithinDirectory(file, root)),
      );

      const drafts: ValidationFindingDraft[] = [];
      const validatorErrors: ValidatorExecutionError[] = [];

      for (const { definition, document } of parsed) {
        const context: ValidationContext = {
          artifact: { contentHash, byteSize },
          benchmark: adapter.id,
          benchmarkVersion: adapter.version,
          task: definition,
          taskVersion: definition.metadata.version,
          workspace,
          files: filesForTask(workspace, definition.rootPath, allFiles, sharedFiles),
          metadata: document,
          configuration,
          options: configuration.validatorOptions,
        };

        for (const validator of validators) {
          const outcome = runValidator(validator, context, diagnostics);
          drafts.push(...outcome.drafts);
          if (outcome.error) {
            validatorErrors.push(outcome.error);
          }
        }
      }

      return report({
        detection,
        benchmarkVersion: adapter.version,
        tasks: parsed.map(({ definition }) => ({
          rootPath: definition.rootPath,
          externalKey: definition.externalKey,
          name: definition.metadata.name,
          version: definition.metadata.version,
        })),
        drafts,
        validators: validators.map((validator) => ({
          id: validator.id,
          name: validator.name,
          version: validator.version,
        })),
        validatorErrors,
      });
    });
  } catch (error) {
    if (!(error instanceof ArchiveError)) {
      throw error;
    }
    diagnostics({
      level: "warn",
      event: "archive.rejected",
      detail: `${error.code}: ${error.message}`,
    });
    return report({
      detection: UNMATCHED_DETECTION,
      benchmarkVersion: null,
      tasks: [],
      validators: [],
      validatorErrors: [],
      drafts: [
        createPipelineFinding(
          {
            code: error.code,
            severity: archiveSeverity(error.code),
            title: "Archive was rejected before inspection",
            message: error.message,
            location: atPath("."),
            remediation:
              "Upload a ZIP that stays within ingest limits and contains only relative file paths.",
          },
          "archive",
          configuration.validatorOptions,
        ),
      ],
    });
  }
}
