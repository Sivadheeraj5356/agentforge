# Data & storage

## Current stores (Chunk 5)

| Store                | Use                                                                            | Status      |
| -------------------- | ------------------------------------------------------------------------------ | ----------- |
| Supabase Postgres    | Profiles, orgs, memberships, projects, evaluation domain, validation runs, RLS | Implemented |
| Supabase Auth        | Users & sessions (SSR cookies)                                                 | Implemented |
| Local ArtifactStore  | Untrusted ZIP bytes under `.data/untrusted-ingest`                             | Implemented |
| Cloudflare R2        | Production blobs                                                               | Documented  |
| Job queue (Postgres) | `evaluation_jobs` claimed by evaluator worker                                  | Implemented |
| Eval artifacts       | Trajectory JSON under `.data/eval-artifacts`                                   | Implemented |

## Postgres guidance

Follow Supabase Postgres best practices:

- Org-scoped RLS on every tenant table
- Catalog tables (`benchmarks`, versions, `tasks`, `agents`) are authenticated-read, not client-writable
- Indexes on foreign keys and list filters (`organization_id`, `project_id`, keys, `content_hash`)
- Prefer `uuid` primary keys
- JSONB only for variable manifests/metadata/payloads, with size CHECKs
- No service-role queries from the browser or normal product path
- Migrations in `supabase/migrations` are the source of truth
- Generate types with `pnpm db:types` → `packages/contracts/src/database.generated.ts`

## Identity & projects schema

- `profiles` — 1:1 with `auth.users`
- `organizations` — tenant root (`name`, unique `slug`)
- `organization_memberships` — `(organization_id, user_id)` + `organization_role`
- `projects` — org-scoped containers with soft archive (`project_status`); optional `benchmark_id`

Personal workspaces are created by `public.ensure_personal_organization()`.
Project mutations require owner/admin via `app_private.is_organization_owner_or_admin`.

## Evaluation domain schema (Chunk 4)

- Catalog: `benchmarks`, `benchmark_versions`, `tasks`, `task_versions`, `agents`
- Tenant: `submissions`, `artifacts`, `evaluation_runs`, `evaluation_jobs`, `evaluation_trials`, `evaluation_results`, `reviews`, `findings`, `audit_events`, `validation_runs`, `validation_findings`, `training_experiments`
- Pins: evaluation runs store specific version ids (never latest)
- Artifacts: metadata + SHA-256 + `storage_key`; bytes in ArtifactStore (local now, R2 later)

## Object storage layout (intended)

```
orgs/{org_id}/tasks/{task_id}/versions/{task_version_id}/bundle.zip
orgs/{org_id}/evals/{evaluation_id}/trials/{trial_id}/...
```

Keys must pass relative-path safety checks (`@agentforge/security` `isSafeRelativePath`). Artifact `storage_key` CHECK rejects `..` and absolute paths.

## Retention

Define retention per org tier later. Artifacts are content-addressed where practical (`sha256`).
