# ADR-010: No service-role for user queries

## Status

Accepted

## Context

The Supabase service role bypasses RLS. Using it for normal product reads/writes would silently defeat tenancy.

## Decision

- Normal user queries and mutations use the anon key + user session (SSR cookie client).
- Service role is server-only, never `NEXT_PUBLIC_*`, and not used for listing orgs, loading workspaces, or profile reads.
- Test/admin harnesses may use service role only for fixture setup outside the product path.

## Consequences

- RLS always applies on the product path.
- Operational tooling that needs service role must live outside browser bundles.
