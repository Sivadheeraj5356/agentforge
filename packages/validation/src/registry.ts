import type { BenchmarkAdapter, DetectionResult, WorkspaceReader } from "@agentforge/contracts";

import { TerminusAdapter } from "./terminus/adapter";
import { TerminalBenchAdapter } from "./terminal-bench/adapter";
import { SweBenchAdapter } from "./swe-bench/adapter";

export type AdapterMatch = {
  readonly adapter: BenchmarkAdapter;
  readonly detection: DetectionResult;
};

export type BenchmarkAdapterRegistry = {
  list(): readonly BenchmarkAdapter[];
  get(id: string): BenchmarkAdapter | null;
  detect(workspace: WorkspaceReader): AdapterMatch | null;
};

export function createBenchmarkAdapterRegistry(
  adapters: readonly BenchmarkAdapter[],
): BenchmarkAdapterRegistry {
  const byId = new Map(adapters.map((adapter) => [adapter.id, adapter]));

  return {
    list() {
      return adapters;
    },
    get(id: string) {
      return byId.get(id) ?? null;
    },
    detect(workspace: WorkspaceReader) {
      let best: AdapterMatch | null = null;
      for (const adapter of adapters) {
        const detection = adapter.detect(workspace);
        if (!detection.matched) continue;
        if (!best || detection.confidence > best.detection.confidence) {
          best = { adapter, detection };
        }
      }
      return best;
    },
  };
}

export function createDefaultBenchmarkAdapterRegistry(): BenchmarkAdapterRegistry {
  return createBenchmarkAdapterRegistry([
    new SweBenchAdapter(),
    new TerminalBenchAdapter(),
    new TerminusAdapter(),
  ]);
}
