# AgentForge documentation

Evaluation infrastructure for AI agents. Control plane in Next.js; Harbor, Docker, and training stay in `services/evaluator` and `services/training`.

## Index

### Product

- [Vision](product/vision.md)
- [Phases](product/phases.md)
- [Glossary](product/glossary.md)
- [Work environments](product/work-environments/)

### Architecture

- [Overview](architecture/overview.md)
- [Repository structure](architecture/repository-structure.md)
- [Domain model](architecture/domain-model.md)
- [Benchmark adapters](architecture/benchmark-adapters.md)
- [Ingestion & validation](architecture/ingestion.md)
- [Validation pipeline & validators](architecture/validation-pipeline.md)
- [Task inspector](architecture/task-inspector.md)
- [Execution plane](architecture/execution-plane.md)
- [Data & storage](architecture/data-storage.md)
- [Technology decisions](architecture/technology-decisions.md)
- [ADRs](architecture/decisions/)

### Security

- [Threat model](security/threat-model.md)
- [Trust boundaries](security/trust-boundaries.md)
- [Data governance](security/data-governance.md)

### Development

- [Getting started](development/getting-started.md)
- [Hosted control plane](development/hosted.md)
- [Conventions](development/conventions.md)
- [Testing](development/testing.md)

## Naming

The product is **AgentForge** (ADR-024). Historical ADRs may still say Vortex; they apply to this tree.

## Slices A–H

See [product/phases.md](product/phases.md). EvalForge 1–11 are already implemented. Later ADRs:

- [ADR-025](architecture/decisions/ADR-025-independent-review.md) independent review
- [ADR-026](architecture/decisions/ADR-026-evaluation-http-api.md) versioned HTTP API
- [ADR-027](architecture/decisions/ADR-027-suites-webhooks.md) suites and signed webhooks
- [ADR-028](architecture/decisions/ADR-028-private-scenarios.md) private scenarios
- [ADR-029](architecture/decisions/ADR-029-rollouts.md) rollouts
- [ADR-030](architecture/decisions/ADR-030-lab-enterprise-stubs.md) lab + enterprise stubs
- [ADR-031](architecture/decisions/ADR-031-work-environments-not-tb4.md) work environments, not TB4
- [ADR-032](architecture/decisions/ADR-032-mcp-evaluator-only.md) MCP in evaluator only
- [ADR-033](architecture/decisions/ADR-033-stage-rewards-from-verifier.md) stage rewards from verifier
- [ADR-034](architecture/decisions/ADR-034-private-eval-fable-5-target.md) private long-horizon eval (superseded as a Fable 5 target by ADR-036)
- [ADR-036](architecture/decisions/ADR-036-agentforge-is-the-bench.md) AgentForge is the bench; reference + BYO harness
- [ADR-037](architecture/decisions/ADR-037-horizon-v1-protocol.md) Horizon v1 protocol freeze
- [Horizon v1 protocol](benchmark/protocol.md)
