import { FINDING_CODES } from "../finding-codes";
import { atPath } from "../findings/factory";
import { TERMINUS_PATHS } from "../terminus/layout";
import { joinWorkspacePath } from "../workspace/paths";
import { defineValidator } from "./define";

export const documentationValidator = defineValidator({
  id: "documentation",
  name: "Human documentation",
  category: "documentation",
  version: "2.0.0",
  check(context, emit) {
    const candidates = [TERMINUS_PATHS.readmeMarkdown, TERMINUS_PATHS.readme].map((name) =>
      joinWorkspacePath(context.task.rootPath, name),
    );
    if (candidates.some((candidate) => context.workspace.exists(candidate))) {
      return [];
    }

    return [
      emit({
        code: FINDING_CODES.TASK_DOCUMENTATION_MISSING_README,
        severity: "info",
        title: "No README at the task root",
        message:
          "A README is optional for Harbor tasks. Reviewers use it for context that does not belong in the agent instruction.",
        location: atPath(context.task.rootPath || "."),
        remediation: "Optionally add README.md describing the task for humans.",
      }),
    ];
  },
});
