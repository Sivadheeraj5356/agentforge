import type { Json, ValidationFinding, ValidationReport } from "@agentforge/contracts";
import { ValidationFindingEvidenceSchema, ValidationFindingSchema } from "@agentforge/contracts";
import {
  ArchiveError,
  assignTaskSlugs,
  inspectZip,
  manifestFromInspection,
  MAX_UPLOAD_ARCHIVE_BYTES,
  runValidationPipeline,
  sha256Hex,
  type DiagnosticsSink,
  type ManifestEntry,
} from "@agentforge/validation";
import { assertNeverExecutesUserCode } from "@agentforge/security";

import { toJson } from "@/lib/json";
import { logServerEvent } from "@/lib/server-log";
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { recordArtifactMetadata } from "@/modules/artifacts/server/artifacts";
import { getBenchmarkByKey } from "@/modules/benchmarks/server/benchmarks";
import { createSubmission } from "@/modules/submissions/server/submissions";
import {
  buildArtifactStorageKey,
  createArtifactStore,
  createLocalFilesystemArtifactStore,
} from "@/modules/validation/server/artifact-store";
import { createValidationRun } from "@/modules/validation/server/validation-runs";

const CONTENT_TYPE_ZIP = "application/zip";

/**
 * Error whose message is safe to show a user. Internal detail stays in the server
 * log, addressable by the correlation id.
 */
export class ValidationJobError extends Error {
  readonly correlationId: string | null;

  constructor(message: string, correlationId: string | null = null) {
    super(message);
    this.name = "ValidationJobError";
    this.correlationId = correlationId;
  }
}

export function isZipMagic(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

function evidenceJson(finding: ValidationFinding): Json {
  return toJson(
    ValidationFindingEvidenceSchema.parse({
      schemaVersion: 1,
      path: finding.evidencePath,
      line: finding.evidenceLine ?? undefined,
      fieldPath: finding.evidenceFieldPath ?? undefined,
      excerpt: finding.excerpt ?? undefined,
    }),
  );
}

/** Singular column: only meaningful when the package contains exactly one task. */
function singleTaskVersion(report: ValidationReport): string | null {
  return report.tasks.length === 1 ? (report.tasks[0]?.version ?? null) : null;
}

async function persistFindings(
  supabase: SupabaseServerClient,
  runId: string,
  findings: readonly ValidationFinding[],
): Promise<void> {
  if (findings.length === 0) {
    return;
  }
  const { error } = await supabase.from("validation_findings").insert(
    findings.map((raw) => {
      // Re-validate at the persistence boundary: the DB constraints and the
      // contract must agree before anything is written.
      const finding = ValidationFindingSchema.parse(raw);
      return {
        validation_run_id: runId,
        code: finding.code,
        category: finding.category,
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        evidence: evidenceJson(finding),
        remediation: finding.remediation,
        validator_id: finding.validatorId,
        fingerprint: finding.fingerprint,
        ordinal: finding.ordinal,
      };
    }),
  );
  if (error) {
    throw new Error(`validation_findings insert failed: ${error.message}`);
  }
}

/**
 * The tasks a run's package contained, with the slug the inspector routes on.
 * Recorded per run: re-validating the same package writes new rows rather than
 * editing the old ones.
 */
async function persistRunTasks(
  supabase: SupabaseServerClient,
  runId: string,
  report: ValidationReport,
): Promise<void> {
  if (report.tasks.length === 0) {
    return;
  }
  const slugs = assignTaskSlugs(report.tasks.map((task) => task.externalKey));
  const { error } = await supabase.from("validation_run_tasks").insert(
    report.tasks.map((task, index) => ({
      validation_run_id: runId,
      ordinal: index,
      slug: slugs[index] ?? `task-${index + 1}`,
      external_key: task.externalKey,
      root_path: task.rootPath,
      name: task.name,
      task_version: task.version,
    })),
  );
  if (error) {
    throw new Error(`validation_run_tasks insert failed: ${error.message}`);
  }
}

/**
 * The file manifest of the pinned artifact. Read from the archive's central
 * directory, so it costs no extraction — and it is what later authorizes a file
 * read, since a path absent from the manifest is not readable.
 */
function buildManifest(archiveBytes: Uint8Array): readonly ManifestEntry[] {
  try {
    return manifestFromInspection(inspectZip(archiveBytes));
  } catch (error) {
    if (error instanceof ArchiveError) {
      // A rejected archive has already been reported as a finding. There is
      // nothing safe to list, so the inspector shows an empty tree.
      return [];
    }
    throw error;
  }
}

async function persistRunFiles(
  supabase: SupabaseServerClient,
  runId: string,
  manifest: readonly ManifestEntry[],
): Promise<void> {
  if (manifest.length === 0) {
    return;
  }
  const { error } = await supabase.from("validation_run_files").insert(
    manifest.map((entry) => ({
      validation_run_id: runId,
      path: entry.path,
      byte_size: entry.byteSize,
    })),
  );
  if (error) {
    throw new Error(`validation_run_files insert failed: ${error.message}`);
  }
}

/**
 * Queueable ingest + validation job. Stores the upload, runs the deterministic
 * pipeline, and persists the report. Never executes package contents and never
 * sends package contents to a model provider.
 */
export async function executeValidationJob(input: {
  organizationId: string;
  projectId: string;
  archiveBytes: Uint8Array;
}): Promise<{ runId: string }> {
  assertNeverExecutesUserCode("executeValidationJob");

  if (input.archiveBytes.byteLength === 0) {
    throw new ValidationJobError("The uploaded file is empty.");
  }
  if (input.archiveBytes.byteLength > MAX_UPLOAD_ARCHIVE_BYTES) {
    throw new ValidationJobError(
      `The ZIP is larger than the ${MAX_UPLOAD_ARCHIVE_BYTES} byte upload limit.`,
    );
  }
  if (!isZipMagic(input.archiveBytes)) {
    throw new ValidationJobError("The upload is not a ZIP archive.");
  }

  const contentHash = sha256Hex(input.archiveBytes);
  const objectId = crypto.randomUUID();
  const storageKey = buildArtifactStorageKey(input.organizationId, objectId, contentHash);
  const store = createArtifactStore();
  await store.put(storageKey, input.archiveBytes, { contentType: CONTENT_TYPE_ZIP });

  const artifact = await recordArtifactMetadata(input.organizationId, {
    kind: "archive",
    contentHash,
    byteSize: input.archiveBytes.byteLength,
    contentType: CONTENT_TYPE_ZIP,
    storageKey,
  });

  const submission = await createSubmission(input.projectId, {
    kind: "uploaded_archive",
    metadata: { contentHash, byteSize: input.archiveBytes.byteLength },
  });

  const run = await createValidationRun({
    projectId: input.projectId,
    artifactId: artifact.id,
    submissionId: submission.id,
  });

  const diagnostics: DiagnosticsSink = (event) => {
    logServerEvent({
      level: event.level,
      message: `validation ${event.event}: ${event.detail}`,
      action: "validation_run.diagnostic",
      organizationId: input.organizationId,
      projectId: input.projectId,
    });
  };

  const supabase = await createSupabaseServerClient();

  try {
    const report = await runValidationPipeline({ archiveBytes: input.archiveBytes, diagnostics });
    const catalog = report.benchmark ? await getBenchmarkByKey(report.benchmark) : null;

    await persistFindings(supabase, run.id, report.findings);
    await persistRunTasks(supabase, run.id, report);
    await persistRunFiles(supabase, run.id, buildManifest(input.archiveBytes));

    // The job completed, so status is `succeeded` even when the policy outcome is
    // `fail`. `status` is lifecycle; `outcome` is the validation verdict.
    const { error: updateError } = await supabase
      .from("validation_runs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        adapter_id: report.benchmark,
        adapter_version: report.benchmarkVersion,
        benchmark_id: catalog?.id ?? null,
        artifact_content_hash: report.artifact.contentHash,
        task_version: singleTaskVersion(report),
        policy: report.policy,
        outcome: report.outcome,
        critical_count: report.summary.critical,
        error_count: report.summary.error,
        warning_count: report.summary.warning,
        info_count: report.summary.info,
        validators: toJson(report.validators),
        validator_error_count: report.validatorErrors.length,
        duration_ms: report.durationMs,
        configuration: toJson(report.configuration),
      })
      .eq("id", run.id)
      .eq("project_id", input.projectId);

    if (updateError) {
      throw new Error(`validation_runs update failed: ${updateError.message}`);
    }

    logServerEvent({
      level: "info",
      message: `validation run completed with outcome ${report.outcome}`,
      action: "validation_run.completed",
      organizationId: input.organizationId,
      projectId: input.projectId,
    });

    return { runId: run.id };
  } catch (error) {
    const correlationId = logServerEvent({
      level: "error",
      message: error instanceof Error ? error.message : "validation run failed",
      action: "validation_run.failed",
      organizationId: input.organizationId,
      projectId: input.projectId,
    });

    await supabase
      .from("validation_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Validation could not be completed. Reference ${correlationId}.`,
      })
      .eq("id", run.id)
      .eq("project_id", input.projectId);

    throw new ValidationJobError(
      "Validation could not be completed. The upload was stored and the failure was logged.",
      correlationId,
    );
  }
}
