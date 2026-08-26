# Execution plane

## Purpose

Run untrusted and privileged evaluation work away from the Next.js control plane:

- Materialize pinned task versions into sandboxes
- Execute Oracle / NOP / reference / BYO / multi-agent trials
- Grade in a **separate** verifier environment
- Collect logs, rewards, trajectories, and artifacts

## Components (Chunks 8–16)

| Component              | Role                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `services/evaluator`   | DB-backed worker (`evaluation_jobs`, `SKIP LOCKED` + heartbeat) |
| `HarborSandbox`        | Legacy Harbor CLI behind `AGENTFORGE_ENABLE_HARBOR`; not the product path |
| `IsolatedSandbox`      | Two Docker runs: agent workspace ≠ `/hidden` grader           |
| `FakeSandbox`          | Deterministic oracle/NOP for tests only                       |
| `TerminalBenchAdapter` | Structural parse of TB2 / Harbor layout                       |
| `services/training`    | SFT/GRPO dataset, `--execute` CPU smoke, experiment records   |

## Trust model

- Control plane authenticates and calls `enqueue_evaluation` with project, pinned versions, and harness id.
- Evaluator worker uses the **service role** only to claim jobs, heartbeat, and write trials/results.
- Sandbox network is deny-by-default (`--network none` on isolated). Hidden tests are not mounted into the agent.
- Users may cancel a queued/running run. They cannot mark it succeeded.
- Fake is forbidden for untrusted kinds and model agents (`ALLOW_FAKE=false`).

## Local run

Prefer Isolated + Docker. Harbor when the CLI exists. Do not default to Fake.

```bash
docker build -t agentforge-eval-python:3.12 -f services/evaluator/docker/eval-python.Dockerfile .
cd services/evaluator
pip install -e ".[dev]"
set ALLOW_FAKE=false
set VORTEX_FIXTURES_DIR=D:\ai-saas\vortex\fixtures\eval
python -m evaluator worker --loop
```

Harbor smoke:

```bash
harbor run --path fixtures/eval/broken-orders-api --agent oracle
harbor run --path fixtures/eval/broken-orders-api --agent nop
```

Import a gitignored Terminal Bench 2 checkout (do not commit licensed dumps):

```bash
set TB_FIXTURES_DIR=D:\ai-saas\vortex\.data\benchmarks\terminal-bench-2
python -m evaluator import-tasks --write
```

## Related

- [ADR-002](decisions/ADR-002-control-execution-separation.md)
- [ADR-018](decisions/ADR-018-harbor-sandbox-isolation.md)
- [ADR-019](decisions/ADR-019-verifier-is-not-reward.md)
- [ADR-020](decisions/ADR-020-training-plane.md)
- [ADR-021](decisions/ADR-021-harbor-terminus-2.md) (superseded for product identity by ADR-036)
- [ADR-036](decisions/ADR-036-agentforge-is-the-bench.md)
- [ADR-022](decisions/ADR-022-training-execute.md)
- [ADR-023](decisions/ADR-023-multi-agent-evaluator.md)
