# Technology decisions

## Current stack (Chunk 3)

| Area             | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo                                |
| Control plane UI | Next.js App Router, React 19, TypeScript strict            |
| Auth / DB        | Supabase Auth + Postgres + RLS                             |
| Domain           | Organizations, projects, evaluation model, validation runs |
| Supabase clients | `@supabase/ssr` + `@supabase/supabase-js`                  |
| Styling          | Tailwind CSS v4 + `@agentforge/ui` tokens                      |
| Components       | shadcn-style primitives (Radix Slot, CVA)                  |
| Theming          | `next-themes` (light / dark / system)                      |
| Validation       | Zod in `@agentforge/contracts`                                 |
| Unit tests       | Vitest                                                     |
| DB tests         | pgTAP via `supabase test db`                               |
| E2E smoke        | Playwright                                                 |
| CI               | GitHub Actions (quality + database jobs)                   |

## Documented for later (do not install yet)

| Area           | Likely choice                       | Notes                |
| -------------- | ----------------------------------- | -------------------- |
| Sandboxes      | Isolated Docker / work MCP          | Execution plane only |
| Queue          | TBD (e.g. pgmq / SQS / Cloud Tasks) | Prefer boring        |
| Analytics      | PostHog / similar                   | Far future           |
| Error tracking | Sentry                              | Far future           |

## Wired in this tree (test / operator)

| Area      | Choice                         | Notes                                      |
| --------- | ------------------------------ | ------------------------------------------ |
| Artifacts | Local filesystem, or R2 when `R2_*` is set | ADR-004; signed GET on R2 only    |
| Payments  | Stripe **test mode**           | Org subscription rows; does not gate eval  |

## Explicitly deferred

Do not add Sentry, PostHog, Harbor SDKs, or AI provider SDKs until a chunk requests them. Stripe stays test-mode keys only (`STRIPE_SECRET_KEY`, never `NEXT_PUBLIC_STRIPE_SECRET`). Isolated grading stays off Vercel.
