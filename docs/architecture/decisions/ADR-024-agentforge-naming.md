# ADR-024: AgentForge is the product name

## Status

Accepted

## Context

The repository at `d:\ai-saas\vortex` is the product. Two roadmaps (EvalForge
chunks and the old Vortex V1–V4 plan) used overlapping numbers for different
work. The product ships as **AgentForge**: one control plane, one execution
plane, EvalForge 1–18 plus V1–V4 honesty on the same tree.

A second product repo, a mass CRLF rewrite, or rewriting applied SQL
migrations would destroy history without changing behavior.

## Decision

- Workspace packages are `@agentforge/web`, `@agentforge/ui`, `@agentforge/contracts`,
  `@agentforge/security`, `@agentforge/validation`, `@agentforge/config`.
- Python packages are `agentforge-evaluator` and `agentforge-training`.
- The isolated image is `agentforge-eval-python:3.12`.
- Environment variables are `AGENTFORGE_*`. `VORTEX_*` and existing `HARBOR_*`
  names remain aliases for one release.
- Catalog keys `vortex-internal` / provider `vortex` become `agentforge-internal`
  / `agentforge` via a forward migration, not by editing old SQL files.
- Disk path and git remote stay as they are.
- Historical ADRs may still say Vortex; they apply to AgentForge.

## Consequences

- pnpm filters and Playwright chrome use AgentForge.
- Operators can keep an existing `.env` until they rename variables.
