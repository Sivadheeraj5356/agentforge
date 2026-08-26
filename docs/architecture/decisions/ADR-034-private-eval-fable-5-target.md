# ADR-034: Private long-horizon eval vs Fable 5 design target

## Status

Superseded by [ADR-036](ADR-036-agentforge-is-the-bench.md)

Historical note: this ADR documented a private long-horizon pack. Fable 5 is **not** a product design target or a score. Keep the pack; drop the comparison-class copy.

## Context

Private RL/RLVR needs a pack that is actually long-horizon (multi-session, not a single-turn quiz) and a honest way to talk about a Fable 5–class frontier agent. Publishing a live “vs Fable 5” percentage would invent a leaderboard number. Omitting a comparison protocol would leave the pack undocumented.

## Decision

- Ship `private-eval-long-horizon` (family `private-eval`, version `1.0.0`) as an immutable work pack
- Tasks require three operator sessions in order (triage → repair → handoff) inside `HorizonWorld` in `services/evaluator`
- Fable 5 is a **design target**: the intended comparison class and protocol for a private run on the same pinned environment version, with staged RLVR, full failed rollouts, and logs
- Do not store or display a live Fable 5 score. Harness fixtures (oracle = 1.0, NOP = 0.15) stay unit-test contracts
- Control plane lists catalog metadata and enqueues. It never runs the world

## Consequences

Docs (`/docs/private-eval`) describe the protocol, not a result. Recovery sibling keys (`private-eval-skipped-session`, `private-eval-forced-green`, `private-eval-wiped-artifacts`) are a queue, not extra leaderboard rows.
