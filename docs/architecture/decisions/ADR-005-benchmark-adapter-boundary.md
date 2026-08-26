# ADR-005: Benchmark adapter boundary

## Status

Accepted

## Context

Harbor, Terminal Bench, and custom ZIP layouts will evolve independently of Vortex's canonical domain.

## Decision

All external formats enter through a `BenchmarkAdapter`. Core domain code consumes only canonical task version structures defined in `@agentforge/contracts` (and future modules).

## Consequences

- Extra translation layer
- Protects domain stability when formats change
- Adapter interfaces are documented in Chunk 1; concrete adapters come later
