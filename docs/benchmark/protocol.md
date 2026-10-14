# AgentForge Horizon v1 protocol

Version pin: **horizon-v1.0.0**

This is the citable recipe for a private AgentForge run. It is not SWE-bench, not Terminal-Bench, and not a Fable 5 leaderboard. Oracle 1.0 and NOP partial credit are harness contracts. Model scores exist only when the evaluator worker recorded them.

## Recipe

1. Pin an immutable environment version and catalog task version. Do not mutate a published version; ship a new one.
2. Run the agent where it cannot see hidden tests (`/hidden` unmounted on Isolated; hidden MCP tools omitted from `tools/list` on work packs).
3. Grade in a separate verifier (Isolated grader container or in-process `stage_metrics()`).
4. Score with `rewardRecipe: staged` when the pack declares stages. Weights sum to 1.
5. Persist every attempt: trial metrics, trajectory steps (capped 256 × 4k), and failed-rollout export.

## Harness labels

| Label     | Meaning                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------- |
| oracle    | Known-good trajectory. Expect reward 1.0.                                                      |
| NOP       | Empty or no-op trajectory. Must not score 1.0.                                                 |
| reference | AgentForge OpenAI/Anthropic tool loop on the evaluator. Requires worker keys.                  |
| byo       | Operator command or HTTP/stdio loop on the evaluator. Control plane never receives the binary. |

Missing model keys fail the job. They do not score like NOP.

## Export

JSON reports follow `EvaluationJsonReportSchema` (`schemaVersion: 1`, `product: AgentForge`):

- `scores.passAt1` / `passAtK`, mean/median reward, latency, tool-call count
- `stageScores` from trial metrics
- `trajectory` steps + artifact id
- `failedRolloutsHref`: `/api/v1/rollouts?kind=failed`
- `costUsd` / token fields are **null** unless the worker recorded them

Local score JSON from `scripts/horizon-score.py` is gitignored. Do not paste those numbers into marketing copy.

## What this protocol does not claim

- A public ranking of frontier models
- A live Fable 5 percentage
- Hosted Isolated Docker on Vercel (the worker still needs a Docker host)
