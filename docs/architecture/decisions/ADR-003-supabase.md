# ADR-003: Supabase for auth and Postgres

## Status

Accepted (implemented in Chunk 2)

## Context

We need managed Postgres, auth, and RLS-friendly multi-tenant patterns without operating our own auth stack on day one.

## Decision

Use **Supabase** (Auth + Postgres) for control-plane persistence and identity. Service role keys remain server-only. All tenant tables use org-scoped RLS.

## Consequences

- Fast path to auth and RLS
- Vendor coupling accepted for Phase 2+
- Chunk 2 ships local Supabase tooling, identity schema, RLS, and SSR clients
- Service role remains forbidden on the normal user query path (ADR-010)
