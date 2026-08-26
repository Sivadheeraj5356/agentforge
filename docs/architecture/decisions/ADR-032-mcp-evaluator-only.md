# ADR-032: MCP SDK loop in the evaluator only

## Status

Accepted

## Context

Cross-application incident work needs tools (`search_messages`, `rollback_release`, …) without putting OAuth or Docker in Next.js.

## Decision

- MCP JSON-RPC (`initialize`, `tools/list`, `tools/call`) runs in `services/evaluator` only
- Backends are in-memory (or evaluator-local Compose later). No live SaaS tokens
- `apps/web` stores pack keys and job ids. It never imports MCP and never starts the world
- The in-process server in `evaluator.workenv` is the SDK the tests pin. An optional PyPI `mcp` extra must not leak into the control plane

## Consequences

Incident NOP ≠ 1.0 is proven against the in-memory world. Harbor/Isolated stay available for orders-ops fixtures.
