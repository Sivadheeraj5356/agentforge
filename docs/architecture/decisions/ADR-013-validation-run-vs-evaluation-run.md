# ADR-013: ValidationRun is not EvaluationRun

## Status

Accepted

## Context

Chunk 4 introduced `evaluation_runs` for future execution (pinned benchmark/task versions, agent, evaluator configuration). Chunk 5 adds ZIP ingest and structural validation. Overloading `evaluation_runs` would mix a static package check with a later sandboxed trial.

## Decision

- Persist ingest results on `validation_runs` and `validation_findings`.
- Keep `evaluation_runs` / review-scoped `findings` unchanged for Phase 3+.
- Validation severity is `info | warning | error | critical` (tooling scale), not the review severity enum.
- The structural pipeline is an async-ready function (`runStructuralValidationPipeline` / `executeValidationJob`) invoked from a server action, not inlined as a Route Handler.

## Consequences

- Extra tables and RLS policies
- Clearer Phase 3 wiring: execution jobs never look like validation jobs
- UI can show validation reports without implying Harbor or model runs
