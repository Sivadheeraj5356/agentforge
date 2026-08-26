import type { ValidationFindingDraft } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { parseIssues, schemaIssuesOutside } from "../metadata/document";
import { atPath } from "../findings/factory";
import { metadataPaths } from "../terminus/layout";
import { defineValidator } from "./define";

/** Sections reported by the environment and verifier validators instead. */
const DELEGATED_SECTIONS = ["environment", "verifier"] as const;

export const metadataValidator = defineValidator({
  id: "metadata",
  name: "Task metadata",
  category: "metadata",
  version: "2.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];
    const document = context.metadata;

    if (!document) {
      return [
        emit({
          code: FINDING_CODES.TASK_METADATA_MISSING,
          severity: "error",
          title: "Task metadata is not available",
          message: `No metadata document was found at ${metadataPaths(context.task.rootPath).join(", ")}.`,
          location: atPath(context.task.rootPath || "."),
          remediation: "Add task.toml (Harbor/Terminus) or task.yaml (classic Terminal Bench).",
        }),
      ];
    }

    for (const issue of parseIssues(document)) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_METADATA_MALFORMED,
          severity: "error",
          title: "Task metadata could not be parsed",
          message: issue.message,
          location: issue.location,
          excerpt: context.workspace.readText(document.path),
          remediation: "Fix the syntax. YAML anchors, aliases, and merge keys are rejected.",
        }),
      );
    }

    for (const issue of schemaIssuesOutside(document, DELEGATED_SECTIONS)) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_METADATA_INVALID_FIELD,
          severity: "error",
          title: "Task metadata field does not match the expected type",
          message: `${issue.location.fieldPath ?? "document"}: ${issue.message}`,
          location: issue.location,
          remediation: "Correct the field type declared in the task metadata document.",
        }),
      );
    }

    if (parseIssues(document).length > 0) {
      return findings;
    }

    if (document.format === "toml") {
      const metadata = document.raw.metadata;
      const hasMetadataTable =
        metadata !== undefined &&
        metadata !== null &&
        typeof metadata === "object" &&
        !Array.isArray(metadata);
      if (!hasMetadataTable) {
        findings.push(
          emit({
            code: FINDING_CODES.TASK_METADATA_FIELD_MISSING,
            severity: "warning",
            title: "task.toml has no [metadata] table",
            message:
              "Harbor/Terminus packages declare author and category under [metadata]. Reviewers cannot attribute this task without it.",
            location: document.locate("metadata"),
            remediation: "Add a [metadata] table with category and author_name.",
          }),
        );
      }
      return findings;
    }

    const instruction = document.raw.instruction;
    if (typeof instruction !== "string" || instruction.trim().length === 0) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_METADATA_FIELD_MISSING,
          severity: "error",
          title: "task.yaml has no instruction field",
          message:
            "Classic Terminal Bench task.yaml carries the agent-facing instruction in an instruction field.",
          location: document.locate("instruction"),
          remediation: "Set instruction: to the agent-facing problem statement.",
        }),
      );
    }

    return findings;
  },
});
