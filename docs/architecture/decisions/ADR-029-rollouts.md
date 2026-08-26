# ADR-029: Immutable environment versions and rollouts

## Status

Accepted

## Context

EvalForge chunk 17 needs RL-shaped records without Parquet/ClickHouse.

## Decision

- `environment_versions` are immutable. `rollouts` point at env version + task
  version + agent + seed.
- Rewards still come from the evaluator verifier.
- Export is JSONL. When stored trial steps exist, the line is ATIF-shaped.
- Training `--execute` may import TRL/PEFT when CUDA is present. `passAt1`
  stays null until held-out evaluator rows exist.

## Consequences

- Operators can dump rollouts without a warehouse. No invented resume %.
