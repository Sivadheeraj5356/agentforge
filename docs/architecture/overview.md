# Architecture overview

AgentForge is a **modular monolith control plane** with a **separate execution plane**.

```
┌─────────────────────────────────────────────┐
│                 Control plane               │
│  apps/web  ·  packages/*  ·  Supabase Auth  │
│  Auth · orgs · metadata · validation · jobs │
└─────────────────────┬───────────────────────┘
                      │ authenticated jobs
                      ▼
┌─────────────────────────────────────────────┐
│               Execution plane               │
│  services/evaluator · sandboxes · Harbor    │
│  Runs Oracle / NOP / agents on task versions│
└─────────────────────┬───────────────────────┘
                      │ artifacts + results
                      ▼
            Supabase (meta) + R2 (blobs)
```

## Chunk 2 reality

- `apps/web` uses Supabase Auth (SSR) with protected `/app/**` routes.
- Postgres tables: `profiles`, `organizations`, `organization_memberships` with RLS.
- Personal workspace bootstrap via `ensure_personal_organization()`.
- Active tenant context is `/app/[organizationSlug]` resolved server-side.

## Chunk 3 reality

- Org-scoped `projects` exist with CRUD and archive/restore.

## Chunk 4 reality

- Benchmark-agnostic catalog and evaluation **model** tables exist (pinned versions, submissions, artifact metadata, run/result/review/audit foundations).

## Chunk 5 reality

- ZIP ingest, local ArtifactStore, TerminusAdapter structural validation, and `validation_runs` exist.

## Chunks 8–11 reality

- `services/evaluator` claims `evaluation_jobs`, runs Oracle/NOP/reference/BYO agents in Isolated Docker or in-process work MCP worlds, and writes `evaluation_trials` / `evaluation_results`. Keys stay in that process.
- Control plane enqueues via `enqueue_evaluation`. Next.js still never starts containers (ADR-002, ADR-018).
- `TerminalBenchAdapter` is registered beside Terminus. Original fixtures live in `fixtures/eval`. TB2/Dropbox dumps stay gitignored.
- Rewards are 0–1 with a failure taxonomy (ADR-019). Trials UI reads real rows.
- `services/training` writes SFT/GRPO dry-run plans and `training_experiments` records. Metrics stay empty until a real run (ADR-020).

## Chunks 12–16 reality

- The catalog harness is AgentForge reference (OpenAI/Anthropic on the evaluator) or BYO (ADR-036). Work packs call models from the evaluator MCP loop (ADR-035). Keys stay in the evaluator. Harbor/Terminus-2 is not the product agent.
- Isolated uses `agentforge-eval-python:3.12` when present. Fake is fixtures-only.
- Training `--execute` CPU-smokes without CUDA (ADR-022). Held-out eval is the evaluator’s job.
- Four-role multi-agent runs in the evaluator only (ADR-023). Hidden grader unchanged.

## Slices A–H

Product name is AgentForge (ADR-024). Task JSON reports, independent review, `/api/v1`, suites/webhooks, private scenarios, rollouts, and PRIVATE datasets land in this tree. SSO/CMK stay stubs (ADR-030). See [product/phases.md](../product/phases.md).

## Non-negotiables

1. No user code execution in trusted processes
2. Immutable task versions
3. Org-scoped data access (RLS + server helpers)
4. Schema validation at trust boundaries
5. Adapter boundaries for external systems
6. Never use service-role for normal user queries
