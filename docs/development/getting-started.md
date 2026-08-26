# Getting started

## Prerequisites

- Node.js 20+
- pnpm 9.15+ (`corepack prepare pnpm@9.15.4 --activate` recommended)
- Docker Desktop (required for local Supabase)
- Python 3.11+ for `services/evaluator` (worker, Isolated Docker, work-pack MCP agents)

Local API/DB host ports are `15421`/`15422` (see `supabase/config.toml`) so Windows Hyper-V ephemeral exclusions do not block the usual `54321`/`54322` binds. Match `NEXT_PUBLIC_SUPABASE_URL` to `http://127.0.0.1:15421`.

## Install

```bash
pnpm install
```

## Environment

Copy `.env.example` to `apps/web/.env.local` (defaults match local Supabase demo keys).

## Database (local Supabase)

```bash
pnpm db:start
pnpm db:reset
pnpm db:status
```

Useful commands:

```bash
pnpm db:lint
pnpm db:test
pnpm db:types
pnpm db:stop
```

## Develop

```bash
pnpm dev
```

Open http://127.0.0.1:3000 — anonymous users are sent to `/login`. After signup/signin, `/app` redirects into a personal workspace.

## Quality commands

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Evaluator (execution plane)

See `services/evaluator/README.md`. The worker must be running (`python -m evaluator worker --loop`) or jobs stay queued. Run oracle first (expect 1.0), then NOP (below 1.0), then example BYO (`examples/byo-isolated` / `examples/byo-work`) without model keys, then the reference agent once `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is on the evaluator process. Local eval is Isolated + Docker (`agentforge-eval-python:3.12`), not Fake. Harbor CLI is legacy-only (`AGENTFORGE_ENABLE_HARBOR=1`).

```bash
cd services/evaluator
pip install -e ".[dev]"
python -m evaluator health
python -m pytest
```

From the repo root, build the Isolated image once:

```bash
docker build -t agentforge-eval-python:3.12 -f services/evaluator/docker/eval-python.Dockerfile .
```

Worker (after `pnpm db:reset`):

```bash
$env:SUPABASE_URL="http://127.0.0.1:15421"
$env:SUPABASE_SERVICE_ROLE_KEY="<server-only demo key>"
$env:ALLOW_FAKE="false"
$env:AGENTFORGE_FIXTURES_DIR="D:\ai-saas\vortex\fixtures\eval"
python -m evaluator worker --loop
```

Training (`--execute` CPU-smokes without CUDA): `services/training/README.md`.
