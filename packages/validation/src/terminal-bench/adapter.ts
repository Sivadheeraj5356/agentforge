import type {
  BenchmarkAdapter,
  DetectionResult,
  DiscoveredTask,
  ParsedTask,
  ValidatorRegistry,
  WorkspaceReader,
} from "@agentforge/contracts";
import { CatalogKeySchema } from "@agentforge/contracts";

import { TerminusAdapter } from "../terminus/adapter";
import { joinWorkspacePath } from "../workspace/paths";

const TB_MARKERS = ["run-tests.sh", "run_tests.sh", "tests/test_outputs.py"] as const;

const MARKER_BONUS = 0.15;
const MAX_CONFIDENCE = 1;

/**
 * Terminal Bench 2 / Harbor task adapter.
 *
 * Parsing and validators match the Terminus/Harbor layout. Detection prefers
 * this adapter when TB2-specific markers are present so a future Harbor-only
 * pack does not require rewriting the core pipeline.
 */
export class TerminalBenchAdapter implements BenchmarkAdapter {
  readonly id = CatalogKeySchema.parse("terminal-bench");
  readonly version = "1.0.0";

  private readonly terminus = new TerminusAdapter();

  detect(workspace: WorkspaceReader): DetectionResult {
    const base = this.terminus.detect(workspace);
    if (!base.matched) {
      return { ...base, adapterId: null };
    }

    const reasons = [...base.reasons];
    let bonus = 0;
    for (const marker of TB_MARKERS) {
      if (workspace.exists(joinWorkspacePath("", marker)) || workspace.exists(marker)) {
        bonus += MARKER_BONUS;
        reasons.push(marker);
      }
    }

    if (bonus === 0) {
      return { matched: false, adapterId: null, confidence: 0, reasons: [] };
    }

    return {
      matched: true,
      adapterId: this.id,
      confidence: Math.min(MAX_CONFIDENCE, base.confidence + bonus),
      reasons: [...new Set(reasons)],
    };
  }

  discoverTasks(workspace: WorkspaceReader): readonly DiscoveredTask[] {
    return this.terminus.discoverTasks(workspace);
  }

  parseTask(workspace: WorkspaceReader, task: DiscoveredTask): ParsedTask {
    return this.terminus.parseTask(workspace, task);
  }

  validators(): ValidatorRegistry {
    return this.terminus.validators();
  }
}
