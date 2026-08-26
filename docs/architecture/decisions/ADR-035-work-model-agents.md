# ADR-035: MCP tool-calling agents and Anthropic keys stay in the evaluator

## Status

Accepted

## Context

Work-environment sandboxes previously scored non-oracle agents as empty tool loops (NOP-like). Harbor Terminus-2 already accepted an OpenAI-shaped key. Anthropic was only in argv redaction. Control plane must never hold model keys.

## Decision

- Work packs (`production-incident`, `app-clone`, `private-eval`, `evolving-spec`, `skill-follow`) run `agent` / `multi_agent` through an in-process MCP tool-calling loop in `services/evaluator` (`workenv/model_agent.py`). HTTP uses the stdlib. No OpenAI/Anthropic SDKs. Isolated `horizon-swe` tasks (`ledger-evolve`, `spec-to-kit`) stay on Docker/Harbor, not this MCP loop.
- Provider is `AGENTFORGE_WORK_MODEL_PROVIDER=openai|anthropic`. OpenAI uses `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) and `HARBOR_MODEL`. Anthropic uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
- Harbor Isolated/Terminus-2 receives `ANTHROPIC_API_KEY` as `--ae` alongside OpenAI when present. Logs redact both.
- Missing keys fail the job with a clear evaluator error. They must not score like NOP.
- Next.js, `@agentforge/validation`, and `NEXT_PUBLIC_*` never import these modules or keys.

## Consequences

Environments UI may enqueue `agent` / `multi_agent` / `byo`. The worker must be running with keys (or BYO config) for those harnesses. Fable 5 is not a live score and is not a design target (ADR-036).
