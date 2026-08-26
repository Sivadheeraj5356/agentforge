# ADR-001: Modular monolith control plane

## Status

Accepted

## Context

Vortex needs a control plane that can grow (auth, projects, validations, evaluations) without premature microservice sprawl.

## Decision

Ship a **modular monolith**: one deployable Next.js app with clear internal module boundaries and shared packages (`ui`, `contracts`, `security`). Extract services only when isolation or scaling demands it (execution plane is already separate by security need).

## Consequences

- Faster iteration and simpler local UX
- Shared types via `@agentforge/contracts`
- Must keep package dependency direction strict to avoid a ball-of-mud
