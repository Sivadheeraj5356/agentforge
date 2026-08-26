# AgentForge

Evaluation infrastructure for AI agents — Terminal Bench / Terminus / Harbor-style task validation, honest scores, and a split control/execution plane.

The git remote and disk path may still say `vortex`. The product name is **AgentForge**. Packages are `@agentforge/*`.

## Quick start

```bash
pnpm install
pnpm db:start
pnpm db:reset
# ensure apps/web/.env.local exists (see .env.example)
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) — sign up / sign in, land in a personal workspace under `/app/[organizationSlug]`, then create projects under `/projects`.

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Start development servers           |
| `pnpm build`        | Production build                    |
| `pnpm lint`         | Lint all packages                   |
| `pnpm typecheck`    | TypeScript project references check |
| `pnpm test`         | Unit tests (Vitest)                 |
| `pnpm test:e2e`     | Playwright smoke / auth / projects  |
| `pnpm format`       | Format with Prettier                |
| `pnpm format:check` | Check formatting                    |
| `pnpm db:start`     | Start local Supabase                |
| `pnpm db:stop`      | Stop local Supabase                 |
| `pnpm db:status`    | Supabase status                     |
| `pnpm db:reset`     | Reset DB from migrations + seed     |
| `pnpm db:lint`      | Lint SQL                            |
| `pnpm db:test`      | Run pgTAP database tests            |
| `pnpm db:types`     | Generate DB TypeScript types        |

## Workspace layout

- `apps/web` — Next.js control-plane UI (`@agentforge/web`)
- `packages/ui` — design system / shared UI
- `packages/contracts` — shared Zod schemas & generated DB types
- `packages/config` — shared TypeScript / ESLint configs
- `packages/validation` — Terminus / Terminal Bench / refusing SWE-bench adapters, ZIP ingest
- `supabase/` — migrations, seed, pgTAP tests
- `services/evaluator` — execution plane (`agentforge-evaluator`). Never runs user code in trusted apps.
- `services/training` — SFT/GRPO records (`agentforge-training`)
- `docs/` — product, architecture, security, and development docs

## Security

The trusted control plane **never** executes user-supplied code. Evaluation runs in a separate execution plane. Tenant isolation is enforced with Postgres RLS. See [docs/security/trust-boundaries.md](docs/security/trust-boundaries.md).

## Documentation

Start at [docs/README.md](docs/README.md).
