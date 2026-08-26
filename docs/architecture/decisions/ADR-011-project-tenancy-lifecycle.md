# ADR-011: Project tenancy and lifecycle

## Status

Accepted

## Context

Organizations alone are too coarse for day-to-day evaluation work. Users need named projects with stable URLs, soft archival, and the same org-scoped RLS model as Chunk 2 — without hard deletes or mutable slugs that break bookmarks.

## Decision

- Projects belong to exactly one organization (`organization_id`).
- Stable identity in the product URL is `(organizationSlug, projectSlug)`.
- `slug` is immutable after insert; collisions are resolved at create time with bounded suffix retries against the unique `(organization_id, slug)` constraint.
- Lifecycle is soft: `project_status` is `active | archived` with a CHECK tying `archived_at` to status.
- Authorization:
  - All org members: `SELECT`
  - Owner/admin: `INSERT` / `UPDATE` (create, edit, archive, restore)
  - No authenticated `DELETE` policy — archive instead
  - `created_by` must equal `auth.uid()` on insert; `organization_id` / `created_by` / `slug` cannot be updated
- Application resolves org and project from route slugs under the caller session; cross-tenant misses call `notFound()` without leaking existence.
- Trusted org context for mutations comes from the organization slug on the server — never from a client-supplied `organization_id`.

## Consequences

- Home and project list surfaces show real project rows (no placeholder metrics).
- Members see read-only UI for mutations they cannot perform; RLS remains authoritative.
- Task upload, Harbor/Terminus parsing, evaluations, and hard delete remain out of scope.
