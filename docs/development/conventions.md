# Conventions

## TypeScript

- Strict mode, `noUncheckedIndexedAccess`, no `any`
- Prefer branded Zod IDs from `@agentforge/contracts`
- `verbatimModuleSyntax` — use type-only imports where required

## Packages

- `apps/web` may import packages; packages never import apps
- `@agentforge/ui` has no vendor SDKs
- `@agentforge/contracts` has no React
- `@agentforge/security` is pure helpers
- `@agentforge/validation` — adapters, ZIP, workspace reader, parsers, validators, policy (no React, no DB, no network)
- Generated DB types live in `@agentforge/contracts` (`database.generated.ts`)

## Auth / data access

- Server helpers in `modules/auth/server`, `modules/organizations/server`, `modules/projects/server`, plus `benchmarks` / `evaluations` / `submissions` / `artifacts` / `reviews` / `audit` / `agents` / `validation`
- Explicit functions (list/get/create) — no generic CRUD base
- No AuthProvider + `useEffect` SPA gate for protected routes
- No service-role on the product path

## UI

- Use design tokens from `@agentforge/ui/globals.css`
- Prefer `@agentforge/ui` primitives before bespoke controls
- Light and dark modes are first-class; warm off-white / warm near-black with restrained teal accent
- Editorial serif for titles; sans for UI chrome
- Project lists are editorial lists — not KPI card grids

## Git / env

- Never commit `.env`, `.env.local`, or secrets
- Keep `.env.example` documented and secret-free

## Validation

- Deterministic validators must never depend on an LLM
- Severity describes evidence; the policy layer decides pass/fail
- Finding codes are public API: add, never rename or repurpose
- Never invent line numbers — omit when the parser did not derive one
- Validators receive only `ValidationContext` (no DB client, session, or host fs)

## Scope discipline

Do not implement Harbor execution, billing, or LLM review unless a chunk explicitly requests it.
