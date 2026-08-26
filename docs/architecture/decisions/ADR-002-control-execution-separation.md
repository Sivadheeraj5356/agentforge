# ADR-002: Control / execution plane separation

## Status

Accepted

## Context

Evaluating agent tasks requires running untrusted code and privileged sandboxes. Doing so inside the Next.js process would create catastrophic RCE risk.

## Decision

- **Control plane**: authentication, metadata, schema validation, job enqueue, UI
- **Execution plane**: sandboxes, Harbor, model/agent runs, artifact production
- Trusted apps **never** execute user-supplied code

## Consequences

- Higher operational complexity
- Clear security boundary and blast-radius limit
- `services/evaluator` owns Harbor/Docker workers; Next.js never starts containers
