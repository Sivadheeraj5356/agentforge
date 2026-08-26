import { describe, expect, it } from "vitest";

import { recordedProtocolRuns } from "./protocol-runs";
import type { EvaluationRunListItem } from "./evaluation-runs";

function run(partial: Partial<EvaluationRunListItem>): EvaluationRunListItem {
  return {
    id: "run-1",
    project_id: "p",
    organization_id: "o",
    submission_id: "s",
    benchmark_version_id: "b",
    task_version_id: "t",
    agent_id: "a",
    evaluator_configuration: {},
    status: "succeeded",
    run_number: 1,
    created_at: "2026-08-25T00:00:00Z",
    started_at: null,
    completed_at: null,
    environment_version_id: null,
    eval_scenario_id: null,
    suite_run_id: null,
    agent_git_sha: null,
    agent_config_hash: null,
    projectSlug: "demo",
    projectName: "Demo",
    agentName: "oracle",
    taskKey: "broken-orders-api",
    meanReward: 1,
    passAt1: 1,
    ...partial,
  };
}

describe("recordedProtocolRuns", () => {
  it("keeps recorded oracle NOP BYO reference rows", () => {
    const rows = recordedProtocolRuns([
      run({ id: "1", agentName: "oracle", passAt1: 1 }),
      run({ id: "2", agentName: "nop", meanReward: 0.2, passAt1: 0 }),
      run({ id: "3", agentName: "byo", passAt1: 1 }),
      run({ id: "4", agentName: "reference", passAt1: 0.5 }),
      run({ id: "5", agentName: "multi-agent", passAt1: 1 }),
      run({ id: "6", agentName: "oracle", meanReward: null, passAt1: null }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["1", "2", "3", "4"]);
  });
});
