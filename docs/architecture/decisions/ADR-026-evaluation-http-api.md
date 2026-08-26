# ADR-026: Versioned evaluation HTTP API

## Status

Accepted

## Context

EvalForge chunk 14 needs create/get/cancel plus results, artifacts, and
trajectory without putting the service role in the browser.

## Decision

- Public routes live under `/api/v1/evaluations` and `/api/v1/rollouts`.
- Auth is the user JWT (cookie session or `Authorization: Bearer`) and RLS.
- Benchmark-specific raw output stays in artifacts. Normalized scores stay in
  Postgres.
- SWE-bench is registered as a detecting adapter that **refuses** until a
  licensed fixture exists. No fake leaderboard.

## Consequences

- Clients can automate enqueue without Next.js UI.
- Control plane still never starts Harbor or Docker.
