# ADR-009: RLS as a security boundary

## Status

Accepted

## Context

Application checks alone are insufficient for cross-tenant isolation. A buggy query must still fail closed.

## Decision

- Enable and force RLS on `profiles`, `organizations`, `organization_memberships`, and `projects`.
- Prefer separate SELECT/INSERT/UPDATE/DELETE policies over broad `FOR ALL`.
- Use private helpers in `app_private` (`is_organization_member`, `is_organization_owner`, `is_organization_owner_or_admin`) to avoid recursive membership policies.
- Cover isolation with pgTAP and a real E2E cross-tenant scenario.

## Consequences

- Database remains the authoritative authorization boundary.
- Helpers are security definer with fixed `search_path` and narrow EXECUTE grants.
