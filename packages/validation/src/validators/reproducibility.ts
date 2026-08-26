import type { TaskDocument, ValidationFindingDraft, WorkspaceReader } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { findFirstLineContaining } from "../findings/excerpt";
import { atLine, atPath } from "../findings/factory";
import { NodePackageManifestSchema } from "../metadata/task-schema";
import { dockerfileCandidates, TERMINUS_PATHS } from "../terminus/layout";
import { joinWorkspacePath } from "../workspace/paths";
import { WorkspaceReadError } from "../workspace/reader";
import { defineValidator } from "./define";

const SHA256_HEX = /^[a-f0-9]{64}$/;
const FROM_DIRECTIVE = /^\s*FROM\s+(\S+)/i;
const MUTABLE_IMAGE_TAG = "latest";
const MUTABLE_DEPENDENCY_RANGES = new Set(["latest", "*", "", "x", "next"]);
const TIMEOUT_FIELDS = ["verifier.timeout_sec", "agent.timeout_sec"] as const;

type ImageReference = {
  readonly value: string;
  readonly line: number;
};

function collectImageReferences(text: string): readonly ImageReference[] {
  const references: ImageReference[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    const match = FROM_DIRECTIVE.exec(line);
    if (match?.[1]) {
      references.push({ value: match[1], line: index + 1 });
    }
  }
  return references;
}

/** True when the reference has no digest and no tag, or an explicit `latest` tag. */
function isMutableImageReference(reference: string): boolean {
  if (reference.includes("@sha256:")) {
    return false;
  }
  const lastSlash = reference.lastIndexOf("/");
  const lastColon = reference.lastIndexOf(":");
  if (lastColon <= lastSlash) {
    return true;
  }
  return reference.slice(lastColon + 1).toLowerCase() === MUTABLE_IMAGE_TAG;
}

function nestedValue(document: TaskDocument | null, fieldPath: string): unknown {
  if (!document) {
    return undefined;
  }
  let current: unknown = document.raw;
  for (const segment of fieldPath.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function readManifest(workspace: WorkspaceReader, path: string): Record<string, string> | null {
  let raw: unknown;
  try {
    raw = workspace.readJson(path);
  } catch (error) {
    if (error instanceof WorkspaceReadError) {
      return null;
    }
    throw error;
  }
  if (raw === null) {
    return null;
  }
  const parsed = NodePackageManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return { ...parsed.data.dependencies, ...parsed.data.devDependencies };
}

/**
 * Reproducibility evidence: is this run pinned to something a future run could
 * reproduce? Checks the recorded artifact hash, the declared task version,
 * explicit timeouts, and mutable image / dependency references.
 */
export const reproducibilityValidator = defineValidator({
  id: "reproducibility",
  name: "Reproducibility",
  category: "reproducibility",
  version: "1.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];
    const rootLabel = context.task.rootPath || ".";

    if (!SHA256_HEX.test(context.artifact.contentHash)) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_REPRODUCIBILITY_ARTIFACT_HASH_MISSING,
          severity: "error",
          title: "Artifact content hash is not recorded",
          message:
            "This run has no SHA-256 digest for the uploaded archive, so its result cannot be tied to specific bytes.",
          location: atPath(rootLabel),
          remediation: "Re-run validation so the ingest pipeline records the archive digest.",
        }),
      );
    }

    if (context.taskVersion === null) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_REPRODUCIBILITY_TASK_VERSION_MISSING,
          severity: "info",
          title: "Task declares no version",
          message: `The metadata document for ${rootLabel} declares no version field, so revisions cannot be distinguished by version.`,
          location: context.metadata?.locate("version") ?? atPath(rootLabel),
          remediation: "Add a version field to the task metadata document.",
        }),
      );
    }

    for (const field of TIMEOUT_FIELDS) {
      if (nestedValue(context.metadata, field) === undefined) {
        findings.push(
          emit({
            code: FINDING_CODES.TASK_REPRODUCIBILITY_TIMEOUT_UNDECLARED,
            severity: "info",
            title: "Timeout is not declared explicitly",
            message: `${field} is not declared, so the harness default applies and may change between harness versions.`,
            location: context.metadata?.locate(field) ?? atPath(rootLabel),
            remediation: `Declare ${field} in the task metadata document.`,
          }),
        );
      }
    }

    for (const candidate of dockerfileCandidates(context.task.rootPath)) {
      const text = context.workspace.readText(candidate);
      if (text === null) {
        continue;
      }
      for (const reference of collectImageReferences(text)) {
        if (!isMutableImageReference(reference.value)) {
          continue;
        }
        findings.push(
          emit({
            code: FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_IMAGE_REF,
            severity: "warning",
            title: "Base image reference is mutable",
            message: `FROM ${reference.value} has no digest and no immutable tag, so a rebuild can produce a different environment.`,
            location: atLine(candidate, reference.line),
            excerpt: `FROM ${reference.value}`,
            remediation: "Pin the base image to a version tag or a @sha256 digest.",
          }),
        );
      }
    }

    const manifestPath = joinWorkspacePath(
      context.task.rootPath,
      TERMINUS_PATHS.environmentPackageManifest,
    );
    const dependencies = readManifest(context.workspace, manifestPath);
    if (dependencies) {
      const manifestText = context.workspace.readText(manifestPath) ?? "";
      for (const [name, range] of Object.entries(dependencies)) {
        if (!MUTABLE_DEPENDENCY_RANGES.has(range.trim().toLowerCase())) {
          continue;
        }
        findings.push(
          emit({
            code: FINDING_CODES.TASK_REPRODUCIBILITY_MUTABLE_DEPENDENCY,
            severity: "warning",
            title: "Dependency range is mutable",
            message: `${name} is declared as "${range}", so an install can resolve to a different version on each build.`,
            location: atLine(manifestPath, findFirstLineContaining(manifestText, `"${name}"`)),
            excerpt: `"${name}": "${range}"`,
            remediation: "Pin the dependency to an exact version.",
          }),
        );
      }
    }

    return findings;
  },
});
