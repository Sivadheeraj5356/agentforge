# ADR-007: Supabase SSR authentication

## Status

Accepted

## Context

Chunk 2 needs production-grade identity for the Next.js App Router control plane without treating the browser session as an authorization proof.

## Decision

- Use `@supabase/ssr` + `@supabase/supabase-js` (not deprecated auth helpers).
- Separate browser and server clients; refresh sessions in middleware via a shared proxy helper.
- Protect `/app/**` with server helpers (`requireAuthenticatedUser`) that call `auth.getUser()`.
- Map provider errors to safe user-facing messages.

## Consequences

- Auth is server-authoritative for route protection.
- Local development requires Supabase (`pnpm db:start`) and public anon credentials only in the browser.
