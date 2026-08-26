# ADR-037: Horizon v1 protocol freeze

## Status

Accepted

## Context

AgentForge is the bench (ADR-036). Horizon needed a citable version pin, export schema, and a way to measure without inventing model scores when OpenAI/Anthropic keys are absent.

## Decision

- Protocol identity is `horizon-v1.0.0` in `docs/benchmark/protocol.md` and `/docs/benchmark`.
- `EvaluationJsonReportSchema` in `@agentforge/contracts` is the export contract.
- Oracle, NOP, and example BYO can produce recorded rewards without model keys. Reference-agent rows stay optional.
- A protocol results surface lists **recorded** org rows only. Empty means no runs, not 0%.

## Consequences

Growing original tasks and simulated clones still uses this pin. Do not vendor SWE-bench. Do not print Fable 5 scores.
