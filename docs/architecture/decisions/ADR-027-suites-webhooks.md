# ADR-027: Suites, gates, and signed webhooks

## Status

Accepted

## Context

EvalForge chunk 15 needs regression CI without Kafka. Org-level concurrency
must cap `evaluation_jobs`.

## Decision

- `evaluation_suites` pin task versions. Gates fail if `pass@1` (or mean
  reward) is below `min_value`.
- `organizations.eval_concurrency_limit` (default 4) is enforced in
  `claim_evaluation_job`.
- Completed/failed runs enqueue signed webhook deliveries
  (`X-AgentForge-Signature: sha256=…`). The evaluator worker POSTs them.
- GitHub App / PR checks are a `CiCheckAdapter`. The GitHub implementation
  refuses until configured. GitHub types do not enter `@agentforge/validation`.

## Consequences

- Regression is a Postgres fact plus a signed callback, not a queue fabric.
