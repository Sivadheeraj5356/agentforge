import type { ValidationFindingDraft } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { atPath } from "../findings/factory";
import { schemaIssuesUnder } from "../metadata/document";
import { TERMINUS_PATHS } from "../terminus/layout";
import { joinWorkspacePath, WorkspacePathError } from "../workspace/paths";
import { defineValidator } from "./define";

const SEPARATE_ENVIRONMENT_MODE = "separate";

function verifierTable(raw: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const value = raw.verifier;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export const verifierValidator = defineValidator({
  id: "verifier",
  name: "Verifier configuration",
  category: "verifier",
  version: "2.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];
    const root = context.task.rootPath;
    const testsDirectory = joinWorkspacePath(root, TERMINUS_PATHS.testsDirectory);
    const document = context.metadata;

    for (const issue of schemaIssuesUnder(document, "verifier")) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION,
          severity: "error",
          title: "Verifier configuration value is not usable",
          message: `${issue.location.fieldPath ?? "verifier"}: ${issue.message}`,
          location: issue.location,
          remediation: 'Use a positive timeout_sec and environment_mode of "shared" or "separate".',
        }),
      );
    }

    if (context.workspace.listFiles(testsDirectory).length === 0) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_VERIFIER_MISSING,
          severity: "error",
          title: "Verifier tests directory is not present",
          message: `No files were found under ${testsDirectory}.`,
          location: atPath(root || "."),
          remediation:
            "Add tests/ with test.sh (Harbor) or test_outputs.py (classic Terminal Bench).",
        }),
      );
    }

    const verifier = verifierTable(document?.raw ?? {});

    if (verifier.environment_mode === SEPARATE_ENVIRONMENT_MODE) {
      const testsDockerfile = joinWorkspacePath(root, TERMINUS_PATHS.testsDockerfile);
      if (!context.workspace.exists(testsDockerfile)) {
        findings.push(
          emit({
            code: FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION,
            severity: "warning",
            title: "Verifier requests a separate environment that is not defined",
            message: `environment_mode is "${SEPARATE_ENVIRONMENT_MODE}" but ${testsDockerfile} is not present in the package.`,
            location: document?.locate("verifier.environment_mode") ?? atPath(root || "."),
            remediation:
              "Add tests/Dockerfile for the separate verifier image, or use the shared environment mode.",
          }),
        );
      }
    }

    const entrypoint = verifier.entrypoint;
    if (typeof entrypoint === "string" && entrypoint.trim().length > 0) {
      const location = document?.locate("verifier.entrypoint") ?? atPath(root || ".");
      try {
        const resolved = context.workspace.resolveSafePath(joinWorkspacePath(root, entrypoint));
        if (!context.workspace.exists(resolved)) {
          findings.push(
            emit({
              code: FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION,
              severity: "error",
              title: "Verifier configuration references a file that does not exist",
              message: `entrypoint points at ${resolved}, which is not in the package.`,
              location,
              remediation: "Point entrypoint at a file included in the package.",
            }),
          );
        }
      } catch (error) {
        if (!(error instanceof WorkspacePathError)) {
          throw error;
        }
        findings.push(
          emit({
            code: FINDING_CODES.TASK_VERIFIER_INVALID_CONFIGURATION,
            severity: "critical",
            title: "Verifier configuration references a path outside the package",
            message:
              "entrypoint resolves outside the task package. AgentForge refuses to read paths beyond the uploaded files.",
            location,
            excerpt: entrypoint.slice(0, context.options.maxExcerptCharacters),
            remediation: "Use a relative path inside the task package.",
          }),
        );
      }
    }

    return findings;
  },
});
