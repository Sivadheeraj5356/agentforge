# ADR-008: Organization tenancy

## Status

Accepted

## Context

Vortex is multi-tenant. Users need a workspace immediately after signup without multi-step browser inserts that can race or leave orphan rows.

## Decision

- Organizations are the tenancy root.
- Membership roles for Chunk 2: `owner | admin | member`.
- Every authenticated user receives a personal workspace via `ensure_personal_organization()` (security definer RPC).
- Active organization is taken from the route slug `/app/[organizationSlug]` and resolved server-side under RLS.

## Consequences

- No localStorage-based active org trust.
- Personal workspace bootstrap is idempotent and race-safe (deterministic slug + unique constraint).
- Team invitations / arbitrary membership writes remain deferred.
