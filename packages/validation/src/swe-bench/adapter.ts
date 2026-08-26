import type {
  BenchmarkAdapter,
  DetectionResult,
  DiscoveredTask,
  ParsedTask,
  ValidatorRegistry,
  WorkspaceReader,
} from "@agentforge/contracts";
import { CatalogKeySchema } from "@agentforge/contracts";

import { BenchmarkAdapterRefusedError } from "../errors";
import { createValidatorRegistry } from "../validators/registry";

const MARKERS = ["swe-bench.json", "instance.json", "SWE-bench.json"] as const;

/**
 * Detects a SWE-bench-style layout and refuses execution.
 * No fixture, no leaderboard, no invented scores.
 */
export class SweBenchAdapter implements BenchmarkAdapter {
  readonly id = CatalogKeySchema.parse("swe-bench");
  readonly version = "1.0.0";

  private readonly registry: ValidatorRegistry = createValidatorRegistry([]);

  detect(workspace: WorkspaceReader): DetectionResult {
    const reasons: string[] = [];
    for (const marker of MARKERS) {
      if (workspace.exists(marker)) {
        reasons.push(marker);
      }
    }
    const instance = workspace.readText("instance.json") ?? workspace.readText("swe-bench.json");
    if (instance && (instance.includes("FAIL_TO_PASS") || instance.includes("instance_id"))) {
      reasons.push("instance_id");
    }
    const matched = reasons.length > 0;
    return {
      matched,
      adapterId: matched ? this.id : null,
      confidence: matched ? 0.99 : 0,
      reasons,
    };
  }

  discoverTasks(_workspace: WorkspaceReader): readonly DiscoveredTask[] {
    return [{ rootPath: "", externalKey: "swe-bench-unsupported" }];
  }

  parseTask(_workspace: WorkspaceReader, _task: DiscoveredTask): ParsedTask {
    throw new BenchmarkAdapterRefusedError(
      this.id,
      "SWE-bench adapter refuses this package until a licensed fixture is imported. No scores are produced.",
    );
  }

  validators(): ValidatorRegistry {
    return this.registry;
  }
}
