import { FINDING_CODES } from "../finding-codes";
import { atPath } from "../findings/factory";
import { TERMINUS_PATHS, testEntrypointCandidates } from "../terminus/layout";
import { joinWorkspacePath } from "../workspace/paths";
import { defineValidator } from "./define";

export const testValidator = defineValidator({
  id: "test",
  name: "Test entrypoint",
  category: "tests",
  version: "2.0.0",
  check(context, emit) {
    const candidates = testEntrypointCandidates(context.task.rootPath);
    if (candidates.some((candidate) => context.workspace.exists(candidate))) {
      return [];
    }

    return [
      emit({
        code: FINDING_CODES.TASK_TEST_ENTRYPOINT_MISSING,
        severity: "error",
        title: "Test entrypoint is not present",
        message: `None of ${candidates.join(", ")} was found in the package.`,
        location: atPath(joinWorkspacePath(context.task.rootPath, TERMINUS_PATHS.testsDirectory)),
        remediation:
          "Add a test entrypoint file. AgentForge records it as evidence and never executes it.",
      }),
    ];
  },
});
