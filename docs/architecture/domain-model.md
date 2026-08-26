# Domain model

## Implemented (Chunks 2–5)

### Profile

- `id` → `auth.users.id` (cascade delete)
- `display_name`, `avatar_url`, timestamps

### Organization

- `id`, `name`, `slug` (unique), `created_by`, timestamps
- Tenancy root for RLS

### Membership

- `organization_id`, `user_id`, `role` (`owner` | `admin` | `member`)
- Composite primary key

### Personal workspace

- Created atomically by `ensure_personal_organization()`
- Idempotent; deterministic personal slug per user

### Project

- `id`, `organization_id`, `name`, `slug`, `description` (plain text)
- `status` (`active` | `archived`), `archived_at`, `created_by`, timestamps
- Optional `benchmark_id` (nullable FK to catalog; not required)
- Unique `(organization_id, slug)`; slug immutable after create
- Soft-archive only (no authenticated DELETE)

### Benchmark / BenchmarkVersion (catalog)

- `benchmarks`: `key` (unique), `name`, `description`, `provider`, `status` (`draft` | `published` | `retired`)
- `benchmark_versions`: `(benchmark_id, version)` unique; `manifest` JSONB; **immutable** after insert
- No Terminal Bench-specific columns. Adapters map later.

### Task / TaskVersion (catalog)

- `tasks`: belong to a `benchmark_version_id`; `external_key` unique per version; `metadata` JSONB
- `task_versions`: `(task_id, version)` unique; append-only; evaluations pin this id

### Agent (catalog)

- `provider`, `name`, `version`, `type` (`model` | `harness` | `composite`)
- Evaluation runs reference `agent_id`

### Submission (project-scoped)

- `kind`: `uploaded_archive` | `git_repository` | `git_commit` | `generated_task` | `benchmark_provided` | `internal_package`
- Metadata only in Chunk 4 — no object upload

### Artifact (org-scoped metadata)

- `content_hash` (SHA-256 hex), `byte_size`, `content_type`, nullable `storage_key`
- No blobs in Postgres; R2 later

### EvaluationRun

- Pins `project_id`, `organization_id`, `submission_id`, `benchmark_version_id`, `task_version_id`, optional `agent_id`
- Per-project immutable `run_number`
- `status`: `queued` | `running` | `succeeded` | `failed` | `cancelled`
- Users may cancel; only the evaluator service role marks succeeded/failed

### EvaluationJob

- One row per run. Worker claims with `claim_evaluation_job` (`SKIP LOCKED`, service_role)

### EvaluationTrial

- `attempt_index` 1–8, `reward` in `[0, 1]`, `metrics` JSONB, `failure_category`, trajectory artifact id

### TrainingExperiment

- Planned SFT/GRPO records with train vs held-out task lists. Metrics empty until a real training job.

### EvaluationResult

- `evaluation_run_id`, `result_kind` (`score` | `pass_fail` | `raw` | `other`), `payload` JSONB
- Authenticated clients may read, not write (future trusted writer)

### Review / Finding (boundary)

- Reviews are org-scoped; findings carry category, severity, evidence JSONB, recommendation, source, status
- No AI reviewer

### AuditEvent

- `actor_id`, `organization_id`, optional `project_id`, dotted `action`, bounded `metadata`
- Mutations only (project create/update/archive/restore; submission create)

### ValidationRun (Chunk 5)

- Distinct from EvaluationRun. Status, summary counts, optional adapter/benchmark pin.
- `validation_findings`: code, severity (`info|warning|error|critical`), evidence path, remediation
- Does not execute scripts

## Documented for later (not implemented)

- Harbor packing, git ingest, R2 production wiring
- Job queue, sandboxes, Oracle / NOP / agent execution
- Signed URLs, billing, SSO, invitations, LLM review

## Invariants

1. Every tenant row is reachable only through membership + RLS.
2. Task and benchmark versions are append-only; evals never pin `"latest"`.
3. Adapter formats stay outside core columns.
4. Project URLs stay stable; archive/restore does not change slug.
