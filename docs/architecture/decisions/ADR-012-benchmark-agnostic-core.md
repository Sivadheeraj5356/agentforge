# ADR-012: Benchmark-agnostic core with pinned versions

## Status

Accepted

## Context

Terminal Bench / Terminus / Harbor are the first evaluation formats Vortex will support, but they must not dictate the control-plane schema. Historical evaluations are only meaningful if they pin the exact catalog and task snapshot they ran against — never an implicit "latest".

## Decision

- Core tables (`benchmarks`, `benchmark_versions`, `tasks`, `task_versions`, `submissions`, `evaluation_runs`, `agents`, `artifacts`, `evaluation_results`) are **benchmark-agnostic**.
- Adapter-specific identifiers (for example a Terminus task id) belong in adapter code and optional `extensions` JSON — **not** as first-class columns such as `terminus_task_id`.
- Every evaluation run stores `benchmark_version_id` and `task_version_id`. Version identity `latest` is rejected by constraint and Zod.
- `benchmark_versions.manifest` and `evaluation_runs.evaluator_configuration` are JSONB objects validated with Zod at trust boundaries.
- Submissions are a typed discriminator (`uploaded_archive` | `git_repository` | `git_commit` | `generated_task` | `benchmark_provided` | `internal_package`) with metadata only in this chunk — no ZIP ingest.
- Artifact rows store integrity metadata (`content_hash`, `byte_size`, `content_type`, nullable `storage_key`). Object bytes live in R2 later.
- Agents are catalog rows; runs reference `agent_id` rather than hardcoded model names.
- Catalog tables are readable by authenticated users and not writable on the product path. Tenant tables (`submissions`, `evaluation_runs`, `artifacts`, `reviews`, `findings`, `audit_events`) are org-scoped via membership helpers.

## Consequences

- Adding Terminal Bench later is an adapter + catalog seed, not a migration that special-cases TB columns.
- UI can list empty catalogs and runs without implying execution exists.
- Chunk 5 can attach storage and parsers without rewriting this schema.
