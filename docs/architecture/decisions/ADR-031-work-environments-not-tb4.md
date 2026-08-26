# ADR-031: Agent Work Environments, not TB4

## Status

Accepted

## Context

Terminal-Bench 3.0 already ships longer-horizon, multi-container, and GPU terminal work. Cloning that public suite as “AgentForge TB4” would compete on the wrong axis.

## Decision

- Stay on this repository. Do not create a second product tree
- The product category is **private Agent Work Environments**
- Packs live under `environments/`; Harbor/Terminus fixtures stay under `fixtures/eval/`
- Simulated collaboration tools are labeled simulated (ADR-028 still forbids fake live Gmail/Salesforce)
- No public leaderboard, no invented 28%/54%/31%→58%

## Consequences

Docs, Lab **Environments** chrome, and `/api/v1/environments` describe packs and rollouts. They do not claim TB3 parity.

Shipped families: `orders-ops`, `production-incident`, `app-clone`, and `private-eval`. Public Docs describe hardness as a **design target** (~30% solve rate for a latest frontier model on the hard split), not a live leaderboard and not a named-model score.
