# AgentForge

[![CI](https://github.com/Sivadheeraj5356/agentforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Sivadheeraj5356/agentforge/actions/workflows/ci.yml)

**Private agent bench and grader.** You queue a trial. The evaluator writes the score. Chat traces are not evidence.

AgentForge is evaluation infrastructure for coding and work agents: immutable task versions, hidden graders, staged rewards, and a split **control plane** (Next.js) / **execution plane** (Python worker + Docker). The product is the bench itself — not Terminus-2, not Terminal-Bench, and not a Fable 5 leaderboard.

> The local folder may still be named `vortex`. The product, npm packages (`@agentforge/*`), and this GitHub repo are **AgentForge**.

## What this is

Labs and agent teams need a world the agent can fail in: a pinned environment, tools, hidden stage verifiers, a 0–1 reward, and a reset. AgentForge ships that as:

1. A **Horizon v1** catalog of **23 original tasks** (Isolated Docker jobs + work-pack worlds). No vendored SWE-bench dumps.
2. A trusted **control-plane app** for orgs, projects, ingest, lab, suites, reviews, and recorded protocol results.
3. An **evaluator worker** that runs Oracle, NOP, reference (OpenAI/Anthropic), and BYO agents, then grades off the agent filesystem.

Scores exist only when the worker recorded them. Cost and tokens stay `null` until a provider writes them. Empty protocol boards say “no recorded runs,” not 0%.

## What this is not

- A public ranking of frontier models
- Terminus-2 as the catalog harness (that is a competing Terminal-Bench agent)
- A Fable 5 percentage or invented resume score
- Live Gmail / Slack / Salesforce OAuth (incident and clone tools are **labeled simulated**)
- Running untrusted code inside the Next.js process (hosted grading uses a separate Vercel Sandbox microVM)
- Kafka, Kubernetes, or ClickHouse

## How a run works

```
Browser / API  →  apps/web (auth, org RLS, enqueue)
                       │  enqueue_evaluation
                       ▼
              services/evaluator  (claim job, sandbox, grade)
                       │  trials + artifacts
                       ▼
              Postgres (meta) + local disk or R2 (blobs)
```

1. **Enqueue** — pin an immutable task version and harness (`oracle`, `nop`, `reference`, or `byo`) in the workspace or via `/api/v1`.
2. **Evaluate** — the worker starts Isolated Docker (agent workspace ≠ hidden grader) or an in-process work-pack MCP world.
3. **Record** — reward, stage scores, trajectory (capped), and failure category land on the trial.

The server-side enqueue and cron routes can launch a disposable Vercel Sandbox microVM. The evaluator inside that VM runs and grades submissions in separate isolated containers; untrusted code never runs in the Next.js process. Model keys, when configured, stay server-side and are not passed into submission containers.

## Horizon v1 catalog (`agentforge-internal`)

Protocol pin: **`horizon-v1.0.0`**. Recipe: [docs/benchmark/protocol.md](docs/benchmark/protocol.md).

### Isolated fixtures (`fixtures/eval/`)

Original FastAPI / CLI / ledger jobs. Hidden tests live in `_shared/tests` (not mounted into the agent).

| Key                      | Task                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `broken-orders-api`      | Diagnose 500s on `GET /orders` without changing the contract |
| `broken-orders-filter`   | Fix status filter crashes                                    |
| `healthcheck-missing`    | Restore `GET /health`                                        |
| `contract-extra-field`   | Remove leaked debug field                                    |
| `silent-wrong-total`     | Correct totals that fail silently                            |
| `empty-orders-crash`     | Empty store returns `[]`, not 500                            |
| `forbidden-test-rewrite` | Rewriting tests must not yield reward 1                      |
| `stale-health-payload`   | Restore the health payload contract                          |
| `ledger-evolve`          | Idempotent POST, migrate legacy rows, update CLI             |
| `spec-to-kit`            | Implement `cutlist_span` from `SPEC.md`                      |
| `refund-double-apply`    | Refund helper debit applied twice                            |
| `timezone-cutoff-orders` | Business-day cutoff must use UTC                             |
| `webhook-retry-storm`    | Retries reuse `delivery_id`; ingest is idempotent            |
| `migration-partial-rows` | Migrator stamps only the first legacy row                    |
| `cli-flag-drift`         | `--format=v2` is the contract, not the legacy pipe dump      |

### Work environment packs (`environments/packs/`)

Saleable worlds: instruction + tools + hidden stage verifiers + staged reward + reset. MCP runs in the evaluator only.

| Key                               | Pack                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| `production-incident-eu-payments` | EU payments incident (simulated Slack, GitHub, Jira, Grafana) |
| `incident-us-inventory`           | US-east warehouse allocation incident                         |
| `checkout-console-clone`          | Checkout UI / admin console / support inbox clone             |
| `support-desk-clone`              | Claim, macro, SLA hold, note on simulated ticket surfaces     |
| `private-eval-long-horizon`       | Stalled release train (ops console, runbook, handoff board)   |
| `wave-inventory`                  | Three-wave revising spec                                      |
| `wave-pricing`                    | Three waves; WAVE-2 revises WAVE-1 list price                 |
| `skill-constraint`                | Follow in-world `SKILL.md` (never wipe the audit log)         |

`orders-ops` is the Isolated family overlay on the orders API fixtures. Sibling queue keys such as `private-eval-skipped-session` are not extra catalog rows.

## Harness labels

| Label         | Meaning                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **oracle**    | Known-good trajectory. Expect reward **1.0**.                                                                                                              |
| **NOP**       | Empty / no-op. Must **not** score 1.0.                                                                                                                     |
| **reference** | AgentForge OpenAI/Anthropic tool loop on the evaluator. Requires worker keys. Missing keys fail the job; they do not score like NOP.                       |
| **byo**       | Operator command or HTTP/stdio loop on the evaluator. Examples: `examples/byo-isolated`, `examples/byo-work`. The control plane never receives the binary. |

Default sandbox is **Isolated**. Harbor/Terminus-2 is legacy-only behind `AGENTFORGE_ENABLE_HARBOR=1`.

## Product surface

| Area             | What ships                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & tenancy   | Supabase Auth, personal org bootstrap, org-scoped RLS                                                                                   |
| Projects & tasks | CRUD, archive, immutable task versions, ZIP ingest (structure only — no script execution)                                               |
| Lab              | Catalog runs, work environments, suites, signed webhooks, rollouts                                                                      |
| Review           | Independent reviewer / adjudicator roles; second review hides the other rationale                                                       |
| API              | `/api/v1/evaluations` (create/get/cancel/results/artifacts/trajectory/report), `/api/v1/rollouts`, `/api/v1/environments/start` + reset |
| Protocol board   | `/app/{org}/results/protocol` — recorded rows only                                                                                      |
| Training         | `services/training` SFT/GRPO dry-run and CPU `--execute` smoke. Held-out eval stays the evaluator’s job                                 |
| Billing          | Stripe **test mode** rows only. A paid subscription does **not** gate local eval                                                        |
| Artifacts        | Local `.data/` or Cloudflare R2 when `R2_*` is set                                                                                      |
| Adapters         | Terminus + Terminal Bench layouts. SWE-bench **detects and refuses** until a licensed fixture exists                                    |

SSO/SAML/SCIM/CMK and GitHub App CI checks are ADR stubs until a named customer.

## Stack

| Layer         | Choice                                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Monorepo      | pnpm 9.15 + Turborepo                                                           |
| Control plane | Next.js 15 App Router, React 19, TypeScript strict                              |
| UI            | Tailwind CSS v4 + `@agentforge/ui` (shadcn-style primitives)                    |
| Auth / DB     | Supabase Auth + Postgres + RLS + pgTAP                                          |
| Contracts     | Zod in `@agentforge/contracts` at every trust boundary                          |
| Execution     | Python 3.11+ `agentforge-evaluator`, Docker image `agentforge-eval-python:3.12` |
| Training      | Python `agentforge-training`                                                    |
| Tests         | Vitest, Playwright, pytest, pgTAP                                               |
| CI            | GitHub Actions (`quality` + `database`)                                         |

Packages: `@agentforge/web`, `@agentforge/ui`, `@agentforge/contracts`, `@agentforge/validation`, `@agentforge/security`, `@agentforge/config`.

## Repository layout

```
agentforge/
├── apps/web                 # Next.js control plane (@agentforge/web)
├── packages/
│   ├── ui                   # Design system (no vendor SDKs)
│   ├── contracts            # Zod schemas, generated DB types
│   ├── validation           # Adapters, ZIP ingest, structural validators
│   ├── security             # Pure helpers
│   └── config               # TS / ESLint
├── supabase/                # Migrations, seed, pgTAP
├── services/
│   ├── evaluator            # Execution plane (never imported by apps/web)
│   └── training             # SFT/GRPO records
├── fixtures/eval            # Original Isolated task packages
├── environments/            # Experience packs + families
├── examples/
│   ├── byo-isolated         # Workspace edit agent, no model keys
│   └── byo-work             # HTTP / stdio MCP loop
├── docs/                    # Product, architecture, security, ADRs
├── scripts/                 # DB types, horizon-score.py (output gitignored)
└── .github/workflows/ci.yml
```

Dependency rule: `apps/web` → `packages/*`. Packages do not import the app. UI does not import Supabase or Stripe. Validation’s default entry is server-only; clients use `@agentforge/validation/browser`.

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9.15+ (`corepack prepare pnpm@9.15.4 --activate`)
- Docker Desktop (local Supabase **and** Isolated eval)
- Python 3.11+ (evaluator)

Local Supabase API/DB ports are **15421 / 15422** so Windows Hyper-V does not steal 54321. Match `NEXT_PUBLIC_SUPABASE_URL` to `http://127.0.0.1:15421`.

### Control plane

```bash
pnpm install
pnpm db:start
pnpm db:reset
```

Copy `.env.example` → `apps/web/.env.local` (demo anon key matches local Supabase). Then:

```bash
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Sign up, land in `/app/[organizationSlug]`, create projects under `/projects`.

Jobs stay **queued** until the evaluator worker is running.

### Evaluator

```bash
docker build -t agentforge-eval-python:3.12 -f services/evaluator/docker/eval-python.Dockerfile .
cd services/evaluator
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate
pip install -e ".[dev]"
python -m evaluator health
```

Worker (server-only env — never `NEXT_PUBLIC_*`):

```powershell
$env:SUPABASE_URL="http://127.0.0.1:15421"
$env:SUPABASE_SERVICE_ROLE_KEY="<demo service-role JWT from supabase status>"
$env:ALLOW_FAKE="false"
$env:SANDBOX_PROVIDER="isolated"
$env:AGENTFORGE_FIXTURES_DIR="<repo>/fixtures/eval"
$env:AGENTFORGE_ENVIRONMENTS_DIR="<repo>/environments"
$env:AGENTFORGE_EVAL_IMAGE="agentforge-eval-python:3.12"
python -m evaluator worker --loop
```

Operator order: **oracle** (expect 1.0) → **NOP** (below 1.0) → example BYO (no model keys) → **reference** once `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` is on this process.

In-process smoke (no paid APIs):

```bash
python -m evaluator smoke
```

Full evaluator notes: [services/evaluator/README.md](services/evaluator/README.md). Hosted split (Vercel UI + Docker worker): [docs/development/hosted.md](docs/development/hosted.md).

## Scripts

| Command                             | Description                            |
| ----------------------------------- | -------------------------------------- |
| `pnpm dev`                          | Start development servers              |
| `pnpm build`                        | Production build                       |
| `pnpm lint`                         | Lint all packages                      |
| `pnpm typecheck`                    | TypeScript project references          |
| `pnpm test`                         | Unit tests (Vitest)                    |
| `pnpm test:e2e`                     | Playwright smoke / auth / projects     |
| `pnpm format` / `pnpm format:check` | Prettier                               |
| `pnpm db:start` / `stop` / `status` | Local Supabase                         |
| `pnpm db:reset`                     | Reset from migrations + seed           |
| `pnpm db:lint`                      | Lint SQL                               |
| `pnpm db:test`                      | pgTAP                                  |
| `pnpm db:types`                     | Generate `packages/contracts` DB types |

Evaluator: `python -m pytest` from `services/evaluator`. Set `AGENTFORGE_SKIP_ISOLATED_SANDBOX=1` only when Docker is unavailable.

## Environment variables

Canonical prefix is `AGENTFORGE_*`. `VORTEX_*` and existing `HARBOR_*` names are one-release aliases. See [`.env.example`](.env.example).

| Variable                                                          | Where           | Notes                                                             |
| ----------------------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | `apps/web`      | Browser-safe. Local demo keys only.                               |
| `SUPABASE_SERVICE_ROLE_KEY`                                       | Server / worker | **Never** `NEXT_PUBLIC_*`. Not used for normal user queries.      |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`                            | Evaluator only  | Reference agent. Missing keys fail the job.                       |
| `AGENTFORGE_BYO_CMD` / `AGENTFORGE_BYO_HTTP_URL`                  | Evaluator       | Isolated command or work-pack HTTP/stdio                          |
| `R2_ACCOUNT_ID` + access keys + bucket                            | Control plane   | ArtifactStore; otherwise local disk                               |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | Control plane   | Test mode. Does not gate eval.                                    |
| `TB_FIXTURES_DIR`                                                 | Evaluator       | Gitignored licensed Terminal Bench checkout — do not commit dumps |

## Security

- Untrusted code **never** runs in `apps/web` or shared TypeScript packages.
- Agent container and grader container are separate. Hidden tests are unmounted (Isolated) or omitted from `tools/list` (work packs).
- Isolated network is deny-by-default. No `--privileged`, no docker.sock in the agent.
- Tenant isolation is Postgres RLS + org slug resolved under the caller session.
- Uploaded ZIPs are inspected structurally; scripts and Dockerfiles are not executed at ingest.
- `ALLOW_FAKE=false` for product-like env. Fake is a test fixture only.

See [docs/security/trust-boundaries.md](docs/security/trust-boundaries.md) and [docs/security/threat-model.md](docs/security/threat-model.md).

## Documentation

Start at [docs/README.md](docs/README.md).

| Topic                         | Doc                                                                        |
| ----------------------------- | -------------------------------------------------------------------------- |
| Vision & wedge                | [docs/product/vision.md](docs/product/vision.md)                           |
| Phases / slices A–H and W1–W6 | [docs/product/phases.md](docs/product/phases.md)                           |
| Glossary                      | [docs/product/glossary.md](docs/product/glossary.md)                       |
| Work environments             | [docs/product/work-environments/](docs/product/work-environments/)         |
| Architecture                  | [docs/architecture/overview.md](docs/architecture/overview.md)             |
| Horizon protocol              | [docs/benchmark/protocol.md](docs/benchmark/protocol.md)                   |
| Getting started               | [docs/development/getting-started.md](docs/development/getting-started.md) |
| ADRs                          | [docs/architecture/decisions/](docs/architecture/decisions/)               |

Naming decision: [ADR-024](docs/architecture/decisions/ADR-024-agentforge-naming.md). Bench (not Terminus-2): [ADR-036](docs/architecture/decisions/ADR-036-agentforge-is-the-bench.md). Protocol freeze: [ADR-037](docs/architecture/decisions/ADR-037-horizon-v1-protocol.md). Control vs execution: [ADR-002](docs/architecture/decisions/ADR-002-control-execution-separation.md).

## License

No license file is published yet. All rights reserved unless a later commit adds one. Do not vendor licensed third-party task dumps (SWE-bench, Terminal-Bench Dropbox corpora) into this tree.
