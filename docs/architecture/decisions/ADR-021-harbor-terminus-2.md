# ADR-021: Harbor Terminus-2 is the first real agent

## Status

Superseded for product identity by [ADR-036](ADR-036-agentforge-is-the-bench.md). Harbor CLI may remain behind `AGENTFORGE_ENABLE_HARBOR=1` for legacy jobs only.

## Context

Chunks 8–11 shipped Oracle/NOP and sandbox plumbing. The first production-like
agent must call a model from the execution plane only, with secrets out of
Next.js, and without mounting the host Docker socket.

## Decision

- Catalog agent `harbor/terminus-2/1.0.0` is metadata. `AgentAdapter` lives in
  `services/evaluator`.
- `HarborSandbox` maps `agent` / `multi_agent` to `harbor run --agent terminus-2
  --model $HARBOR_MODEL` and passes OpenAI-compatible `OPENAI_BASE_URL` /
  `OPENAI_API_KEY` as Harbor `--ae` only. Logs redact secret values.
- Forbidden args stay `docker.sock`, `--privileged`, `--pid=host`, `--network=host`.
- Control plane may enqueue `agentKind=agent`. It never starts Harbor or stores keys.
- Worker default is Harbor when the CLI exists, otherwise Isolated. Fake is never
  the fallback for untrusted work or model agents.
- The original fixture is FastAPI + SQL (`OFFSET 2` on `GET /orders`) with Harbor
  compose Postgres. Isolated grades the same bug via TestClient + sqlite.

## Consequences

- A Terminus-2 trial requires evaluator env (`HARBOR_MODEL`, `OPENAI_API_KEY`).
- Harbor smoke (`--agent oracle` then `--agent nop` on `broken-orders-api`) is the
  V1 runtime proof. Unit tests cover argv, redaction, and Isolated oracle vs NOP.
