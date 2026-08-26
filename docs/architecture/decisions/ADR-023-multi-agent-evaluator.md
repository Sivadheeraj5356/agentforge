# ADR-023: V4 multi-agent runs only in the evaluator

## Status

Accepted

## Context

A planner/coder/tester/reviewer split is useful after Terminus-2 works on one
task. Implementing it in Next.js would put model calls and workspace mutation
on the control plane.

## Decision

- Four roles (`planner`, `coder`, `tester`, `reviewer`) run in
  `services/evaluator` only, sharing the agent workspace.
- Isolated: one container invocation per role, then the hidden grader. Tester
  never mounts `/hidden`. Oracle/NOP regression still applies the oracle patch
  only in the coder step when `agentKind=oracle`.
- Harbor: one Terminus-2 session with a four-role system prompt (`VORTEX_SYSTEM_PROMPT`
  via `--ae`). Hidden tests stay in the Harbor grader.
- Control plane adds catalog harness `vortex/multi-agent/1.0.0` and an enqueue
  option. It still only stores ids.
- Trajectories are role-tagged. Reward recipes and the hidden grader are unchanged
  (ADR-019).
- Scope stops at a single task plus Oracle/NOP regression. No 50-task
  multi-agent leaderboard.

## Consequences

- UI can show a four-step timeline without executing commands (ADR-016/017).
- Multi-agent without a model scores 0.0; it does not auto-apply the oracle.
