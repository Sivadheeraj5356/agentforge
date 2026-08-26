# ADR-036: AgentForge is the bench

## Status

Accepted

## Context

AgentForge is the benchmark and grader. Terminus-2 is a competing agent on Terminal-Bench, not our product harness. Fable 5 is not a design target or a score. Isolated `agent` previously ran `true` then the grader, so Horizon SWE could not score a real coding agent without Harbor.

## Decision

- Catalog harness for `agentKind=agent` is `agentforge/reference/1.0.0` (OpenAI/Anthropic tool loop on the evaluator). `agentKind=byo` is `agentforge/byo/1.0.0`.
- Isolated reference agents use workspace tools (`list_dir`, `read_file`, `write_file`, `run_command`) then the existing hidden grader. Missing keys fail the job; they never score like NOP.
- Isolated BYO runs `AGENTFORGE_BYO_CMD` on the evaluator, then grades. Work packs drive MCP `call_tool` from an operator HTTP loop (`AGENTFORGE_BYO_HTTP_URL`). Next.js never receives the binary or keys.
- Default sandbox is Isolated. Harbor is retired from the product path unless `AGENTFORGE_ENABLE_HARBOR=1` for legacy jobs.
- Performance reports expose pass@k, stage scores, trajectory, and failed-rollout export. Cost and tokens stay null unless the worker recorded them. No invented Fable 5 percentages.
- Keep `packages/validation` Terminus **task-package layout**. Do not ship Terminus-2 as the catalog agent.

This supersedes the product claims in ADR-021 (Terminus-2 as the first real agent) and ADR-034 (Fable 5 as a design target). Historical Harbor code may remain behind the enable flag.

## Consequences

Get-started is worker → oracle → NOP → reference agent (keys on worker) → BYO. Public docs describe AgentForge Horizon as our private bench protocol. Live model scores wait on evaluator env keys, not on chat, git, or `NEXT_PUBLIC_*`.
