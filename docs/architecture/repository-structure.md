# Repository structure

```
vortex/
├── apps/
│   └── web/                 # Next.js App Router control-plane UI
├── packages/
│   ├── ui/                  # Design system (no vendor SDKs)
│   ├── contracts/           # Zod schemas, generated DB types
│   ├── validation/          # Adapters, ZIP ingest, structural validators
│   ├── config/              # Shared TS + ESLint configs
│   └── security/            # Pure security helpers
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   ├── seed.sql
│   └── tests/database/      # pgTAP
├── services/
│   ├── evaluator/           # Execution plane (Harbor/isolated/fake worker)
│   └── training/            # SFT/GRPO dry-run + dataset conversion
├── fixtures/
│   └── eval/                # Harbor/Terminus fixtures
├── environments/            # Experience packs (orders-ops, incident, app-clone, private-eval)
├── docs/                    # Product, architecture, security, development
├── scripts/                 # DB type generation helpers
├── .cursor/rules/           # Permanent agent constraints
├── .github/workflows/       # CI
├── pnpm-workspace.yaml
└── turbo.json
```

## Dependency direction

```
apps/web → packages/{ui,contracts,config,security,validation}
packages/* ↛ apps/web
ui ↛ vendor SDKs (Supabase, Stripe, etc.) and ↛ Terminus
contracts ↛ React
validation ↛ React / Supabase
security = pure helpers only
```

`@agentforge/validation` has two entry points. The default one is server-only: it
reaches `node:zlib`, `node:fs`, and `node:crypto` for archives, workspaces, and
hashing. `@agentforge/validation/browser` re-exports only the modules that touch no
Node built-in, and is what client components import.

## Turborepo tasks

Root scripts delegate to package tasks: `dev`, `build`, `lint`, `typecheck`, `test`.

Database scripts are root-level (Supabase CLI): `db:start`, `db:stop`, `db:status`, `db:reset`, `db:lint`, `db:test`, `db:types`.
