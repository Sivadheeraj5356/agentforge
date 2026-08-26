import type { EvaluationRunListItem } from "@/modules/evaluations/server/evaluation-runs";

const PROTOCOL_HARNESS_NAMES = new Set(["oracle", "nop", "byo", "reference"]);

export type ProtocolRunRow = EvaluationRunListItem;

export function recordedProtocolRuns(
  runs: readonly EvaluationRunListItem[],
): ProtocolRunRow[] {
  return runs.filter((run) => {
    const name = run.agentName;
    if (!name || !PROTOCOL_HARNESS_NAMES.has(name)) {
      return false;
    }
    return run.meanReward !== null || run.passAt1 !== null;
  });
}
