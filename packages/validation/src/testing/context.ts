import type { ValidationConfigurationInput, ValidationContext } from "@agentforge/contracts";
import { ValidationConfigurationSchema } from "@agentforge/contracts";

import { TerminusAdapter } from "../terminus/adapter";
import { createMemoryWorkspace, type MemoryWorkspaceFile } from "../workspace/memory";

const TEST_CONTENT_HASH = "a".repeat(64);
const TEST_BYTE_SIZE = 1024;

export type TestContextInput = {
  readonly files: readonly MemoryWorkspaceFile[];
  readonly configuration?: Partial<ValidationConfigurationInput>;
  readonly contentHash?: string;
  /** Index into the discovered task list, for multi-task packages. */
  readonly taskIndex?: number;
};

/**
 * Builds a real `ValidationContext` from in-memory files by running the actual
 * discovery and parse phases, so validator unit tests exercise production parsing.
 */
export function createTestContext(input: TestContextInput): ValidationContext {
  const configuration = ValidationConfigurationSchema.parse({
    schemaVersion: 1,
    ...input.configuration,
  });
  const workspace = createMemoryWorkspace(input.files);
  const adapter = new TerminusAdapter();
  const discovered = adapter.discoverTasks(workspace);
  const task = discovered[input.taskIndex ?? 0];
  if (!task) {
    throw new Error("No task was discovered for the provided files.");
  }
  const parsed = adapter.parseTask(workspace, task);

  return {
    artifact: {
      contentHash: input.contentHash ?? TEST_CONTENT_HASH,
      byteSize: TEST_BYTE_SIZE,
    },
    benchmark: adapter.id,
    benchmarkVersion: adapter.version,
    task: parsed.definition,
    taskVersion: parsed.definition.metadata.version,
    workspace,
    files: workspace.listFiles(),
    metadata: parsed.document,
    configuration,
    options: configuration.validatorOptions,
  };
}
