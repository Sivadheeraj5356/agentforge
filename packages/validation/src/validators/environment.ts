import type { ValidationFindingDraft, WorkspaceReader } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { excerptFromText, excerptMatchingLines, findFirstLine } from "../findings/excerpt";
import { atLine, atPath } from "../findings/factory";
import { schemaIssuesUnder } from "../metadata/document";
import { dockerfileCandidates } from "../terminus/layout";
import { defineValidator } from "./define";

const WORKDIR_DIRECTIVE = /^\s*WORKDIR\s+\S/im;
const DOCKERFILE_NAME = /dockerfile$/i;
const SOLUTION_OR_TEST_COPY = /^\s*COPY\b[^\n]*(solution|solve\.sh|run-tests\.sh|tests?[/\s])/im;

function firstExisting(
  workspace: WorkspaceReader,
  candidates: readonly string[],
): string | undefined {
  return candidates.find((candidate) => workspace.exists(candidate));
}

export const environmentValidator = defineValidator({
  id: "environment",
  name: "Environment definition",
  category: "environment",
  version: "2.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];

    for (const issue of schemaIssuesUnder(context.metadata, "environment")) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_ENVIRONMENT_INVALID_CONFIGURATION,
          severity: "error",
          title: "Environment configuration value is not usable",
          message: `${issue.location.fieldPath ?? "environment"}: ${issue.message}`,
          location: issue.location,
          remediation: "Declare positive numeric cpus, memory_mb, and build_timeout_sec values.",
        }),
      );
    }

    const candidates = dockerfileCandidates(context.task.rootPath);
    const environmentFile = firstExisting(context.workspace, candidates);
    if (!environmentFile) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_ENVIRONMENT_DOCKERFILE_MISSING,
          severity: "error",
          title: "Environment definition is not present",
          message: `None of ${candidates.join(", ")} was found in the package.`,
          location: atPath(context.task.rootPath || "."),
          remediation:
            "Add a Dockerfile under environment/ without copying tests or solutions into the agent image.",
        }),
      );
      return findings;
    }

    const text = context.workspace.readText(environmentFile);
    if (text === null) {
      return findings;
    }

    if (DOCKERFILE_NAME.test(environmentFile) && !WORKDIR_DIRECTIVE.test(text)) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_ENVIRONMENT_WORKDIR_MISSING,
          severity: "warning",
          title: "Dockerfile declares no WORKDIR",
          message:
            "No WORKDIR directive was found, so the agent's working directory depends on the base image.",
          location: atPath(environmentFile),
          excerpt: excerptFromText(text, context.options),
          remediation: "Add WORKDIR with the path the instruction refers to.",
        }),
      );
    }

    if (SOLUTION_OR_TEST_COPY.test(text)) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_ENVIRONMENT_SOLUTION_LEAK,
          severity: "error",
          title: "Environment copies solution or test paths into the agent image",
          message:
            "A COPY directive references a solution or test path, which would make the answer visible to the agent.",
          location: atLine(environmentFile, findFirstLine(text, SOLUTION_OR_TEST_COPY)),
          excerpt: excerptMatchingLines(text, SOLUTION_OR_TEST_COPY, context.options),
          remediation: "Copy only the files the agent is meant to see.",
        }),
      );
    }

    return findings;
  },
});
