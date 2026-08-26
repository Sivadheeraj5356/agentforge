import type { ValidationFindingDraft } from "@agentforge/contracts";

import { FINDING_CODES } from "../finding-codes";
import { atPath } from "../findings/factory";
import { instructionPath, metadataPaths } from "../terminus/layout";
import { defineValidator } from "./define";

export const taskStructureValidator = defineValidator({
  id: "task-structure",
  name: "Task structure",
  category: "structure",
  version: "2.0.0",
  check(context, emit) {
    const findings: ValidationFindingDraft[] = [];
    const root = context.task.rootPath;
    const rootLabel = root || ".";

    const instructionFile = instructionPath(root);
    const declaresInstruction =
      context.metadata?.format === "yaml" && typeof context.metadata.raw.instruction === "string";
    if (!context.workspace.exists(instructionFile) && !declaresInstruction) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_STRUCTURE_MISSING_INSTRUCTION,
          severity: "error",
          title: "Instruction file is not present",
          message: `No ${instructionFile} was found, and no task.yaml instruction field was declared at ${rootLabel}.`,
          location: atPath(rootLabel),
          remediation: "Add instruction.md (Harbor/Terminus) or an instruction key in task.yaml.",
        }),
      );
    }

    const candidates = metadataPaths(root);
    if (!candidates.some((candidate) => context.workspace.exists(candidate))) {
      findings.push(
        emit({
          code: FINDING_CODES.TASK_STRUCTURE_MISSING_METADATA,
          severity: "error",
          title: "Task metadata file is not present",
          message: `None of ${candidates.join(", ")} was found in the package.`,
          location: atPath(rootLabel),
          remediation: "Add Harbor-style task.toml or classic Terminal Bench task.yaml.",
        }),
      );
    }

    return findings;
  },
});
