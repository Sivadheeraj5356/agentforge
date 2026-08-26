# ADR-014: Typed benchmark adapter registry

## Status

Accepted

## Context

Vortex must support Terminus/Terminal Bench first, then Harbor and other formats, without making Terminal Bench the schema.

## Decision

- `BenchmarkAdapter` lives in `@agentforge/contracts` (no React, no I/O).
- Concrete adapters and validators live in `@agentforge/validation`.
- A small typed registry holds adapter instances (Terminus now). Detection picks the highest-confidence match. No plugin runtime, no giant `if/else` on format strings in the web app.
- `@agentforge/ui` never imports Terminus types.

To add Benchmark X: implement `BenchmarkAdapter`, register it in `createDefaultBenchmarkAdapterRegistry`, keep core tables and UI report layout unchanged.

## Consequences

- New formats are package-level code, not migrations of `terminus_*` columns
- Unknown packages produce `BENCHMARK_UNDETECTED` rather than crashing ingest
