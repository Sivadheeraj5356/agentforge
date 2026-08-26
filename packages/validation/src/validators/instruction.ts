import { FINDING_CODES } from "../finding-codes";
import { atPath } from "../findings/factory";
import { instructionPath } from "../terminus/layout";
import { defineValidator } from "./define";

export const instructionValidator = defineValidator({
  id: "instruction",
  name: "Instruction content",
  category: "instructions",
  version: "2.0.0",
  check(context, emit) {
    const markdownPath = instructionPath(context.task.rootPath);
    const instruction = context.task.instruction;

    if (!instruction) {
      const location = context.workspace.exists(markdownPath)
        ? atPath(markdownPath)
        : (context.metadata?.locate("instruction") ?? atPath(markdownPath));
      return [
        emit({
          code: FINDING_CODES.TASK_INSTRUCTION_EMPTY,
          severity: "error",
          title: "Instruction text is empty",
          message: "No agent-facing instruction text was found for this task.",
          location,
          remediation:
            "Write the instruction in instruction.md or the task.yaml instruction field.",
        }),
      ];
    }

    const minimum = context.options.minInstructionCharacters;
    if (instruction.text.length < minimum) {
      return [
        emit({
          code: FINDING_CODES.TASK_INSTRUCTION_SHORT,
          severity: "warning",
          title: "Instruction is shorter than the configured minimum",
          message: `The instruction has ${instruction.text.length} characters; this validation run expects at least ${minimum}.`,
          location: instruction.source,
          excerpt: instruction.text,
          remediation: "Describe expected outputs, file paths, and constraints in the instruction.",
        }),
      ];
    }

    return [];
  },
});
