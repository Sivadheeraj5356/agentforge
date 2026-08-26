import type {
  BenchmarkAdapter,
  DetectionResult,
  DiscoveredTask,
  ParsedTask,
  ValidatorRegistry,
  WorkspaceReader,
} from "@agentforge/contracts";
import { CatalogKeySchema } from "@agentforge/contracts";

import { joinWorkspacePath } from "../workspace/paths";
import {
  dockerfileCandidates,
  instructionPath,
  resolveTaskRoots,
  solutionCandidates,
  taskExternalKey,
  TERMINUS_PATHS,
  testEntrypointCandidates,
} from "./layout";
import { parseTerminusTask } from "./parser";
import { createTerminusValidatorRegistry } from "./validators";

/** Detection weights. A package matches once it looks unmistakably like a task. */
const DETECTION_WEIGHTS = {
  instruction: 3,
  metadataToml: 3,
  metadataYaml: 2,
  environment: 2,
  testEntrypoint: 2,
  solution: 1,
} as const;

const DETECTION_MATCH_THRESHOLD = 4;
const DETECTION_CONFIDENCE_DIVISOR = 10;
const MAX_DETECTION_REASONS = 32;

type DetectionScore = {
  readonly score: number;
  readonly reasons: readonly string[];
};

function scoreTaskRoot(workspace: WorkspaceReader, root: string): DetectionScore {
  let score = 0;
  const reasons: string[] = [];

  const award = (points: number, reason: string, path: string): void => {
    if (workspace.exists(path)) {
      score += points;
      reasons.push(reason);
    }
  };

  award(DETECTION_WEIGHTS.instruction, TERMINUS_PATHS.instruction, instructionPath(root));
  award(
    DETECTION_WEIGHTS.metadataToml,
    TERMINUS_PATHS.taskToml,
    joinWorkspacePath(root, TERMINUS_PATHS.taskToml),
  );
  award(
    DETECTION_WEIGHTS.metadataYaml,
    TERMINUS_PATHS.taskYaml,
    joinWorkspacePath(root, TERMINUS_PATHS.taskYaml),
  );
  for (const candidate of dockerfileCandidates(root)) {
    award(DETECTION_WEIGHTS.environment, "environment definition", candidate);
  }
  for (const candidate of testEntrypointCandidates(root)) {
    award(DETECTION_WEIGHTS.testEntrypoint, "test entrypoint", candidate);
  }
  for (const candidate of solutionCandidates(root)) {
    award(DETECTION_WEIGHTS.solution, "solution script", candidate);
  }

  return { score, reasons };
}

/**
 * Harbor / Terminal Bench adapter. Discovers and parses task packages; the
 * pipeline runs the validators this adapter registers.
 */
export class TerminusAdapter implements BenchmarkAdapter {
  readonly id = CatalogKeySchema.parse("terminus");
  readonly version = "2.0.0";

  private readonly registry: ValidatorRegistry = createTerminusValidatorRegistry();

  detect(workspace: WorkspaceReader): DetectionResult {
    let best = 0;
    const reasons: string[] = [];
    for (const root of resolveTaskRoots(workspace)) {
      const scored = scoreTaskRoot(workspace, root);
      best = Math.max(best, scored.score);
      reasons.push(...scored.reasons);
    }

    const matched = best >= DETECTION_MATCH_THRESHOLD;
    return {
      matched,
      adapterId: matched ? this.id : null,
      confidence: Math.min(1, best / DETECTION_CONFIDENCE_DIVISOR),
      reasons: [...new Set(reasons)].slice(0, MAX_DETECTION_REASONS),
    };
  }

  discoverTasks(workspace: WorkspaceReader): readonly DiscoveredTask[] {
    return resolveTaskRoots(workspace).map((rootPath) => ({
      rootPath,
      externalKey: taskExternalKey(rootPath),
    }));
  }

  parseTask(workspace: WorkspaceReader, task: DiscoveredTask): ParsedTask {
    return parseTerminusTask(workspace, task);
  }

  validators(): ValidatorRegistry {
    return this.registry;
  }
}
