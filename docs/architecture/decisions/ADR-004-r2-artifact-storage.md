# ADR-004: R2 for artifact storage

## Status

Accepted (R2 adapter wired when `R2_*` env is set; local filesystem remains default)

## Context

Evaluation produces large binary artifacts (bundles, logs, traces). Postgres is a poor fit for blob payloads.

## Decision

Store artifacts in **Cloudflare R2** (S3-compatible) when operator credentials are present. Metadata and content hashes live in Postgres; blobs live in R2 under org-scoped key prefixes (`orgs/{organizationId}/…`). Local filesystem remains the default for `pnpm dev`.

## Consequences

- Cheap egress relative to some object stores
- Signed GET URLs exist on the R2 adapter; the task inspector still reads bytes server-side and never issues a storage key to the browser
- Isolated Docker grading runs in a separate Vercel Sandbox microVM or a managed Docker host, never in the Next.js process
