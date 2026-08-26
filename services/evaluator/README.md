# Evaluator (execution plane)

Runs Oracle, NOP, AgentForge reference, BYO, work-pack MCP agents, and multi-agent trials in isolated sandboxes.
**Not imported by `apps/web`.** Next.js never starts Docker/Harbor or calls models.

## Operator checklist (local demo)

1. `pnpm db:start` then `pnpm db:reset` (applies catalog seeds including Horizon tasks).
2. `apps/web/.env.local` from `.env.example`. `pnpm dev`.
3. Build Isolated image: `docker build -t agentforge-eval-python:3.12 -f services/evaluator/docker/eval-python.Dockerfile .`
4. Evaluator env (server-only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENTFORGE_FIXTURES_DIR`, `AGENTFORGE_ENVIRONMENTS_DIR`. For the reference agent: `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, plus `AGENTFORGE_OPENAI_MODEL` / `ANTHROPIC_MODEL` (`HARBOR_MODEL` is a deprecated alias). For Isolated BYO without model keys: `AGENTFORGE_BYO_CMD=python /opt/byo/agent.py` (example under `examples/byo-isolated`). For work-pack BYO: `AGENTFORGE_BYO_HTTP_URL` or `AGENTFORGE_BYO_CMD` pointing at `examples/byo-work`. Never `NEXT_PUBLIC_*`.
5. `python -m evaluator smoke` — in-process oracle 1.0 and NOP < 1.0 on a work pack. No paid APIs.
6. `python -m evaluator worker --loop`
7. In the app: Environments → Run oracle (expect 1.0 after the worker writes) → Run NOP → Run agent (fails clearly if keys are missing).

## Hard constraints

- Next.js never starts Docker/Harbor or runs `solve.sh` / tests.
- Agent container and grader container are separate. Hidden tests are not mounted into the agent.
- Never `--privileged`, never `/var/run/docker.sock` in the agent.
- `ALLOW_FAKE=false` in production-like env. Fake is a test fixture, not the local product path.
- Model keys (`OPENAI_API_KEY`) stay in this process. Harbor receives them as `--ae KEY=***` (redacted in logs).

## Local eval without Harbor = Isolated + Docker

```bash
docker build -t agentforge-eval-python:3.12 -f services/evaluator/docker/eval-python.Dockerfile .
```

Build context is the repo root (the Dockerfile copies `fixtures/eval/.../requirements.txt`).

```bash
cd services/evaluator
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
python -m evaluator health
python -m pytest
```

Isolated oracle vs NOP runs whenever Docker is present. Set `AGENTFORGE_SKIP_ISOLATED_SANDBOX=1` only to skip those tests on machines without Docker.

## Work environments

Packs live in `environments/`. Incident MCP (`search_messages`, `rollback_release`, …) runs in this process only. Set `AGENTFORGE_ENVIRONMENTS_DIR` if the working directory is not the repo root.


## Harbor CLI (legacy only)

Harbor/Terminus-2 is **not** the product sandbox. Isolated + work packs are. Keep `harbor.py` for one release behind `AGENTFORGE_ENABLE_HARBOR=1`. Old jobs that ask for harbor without that flag fail clearly.

Do not install Harbor for a local demo. Do not treat Terminus-2 as a catalog harness.

```bash
set AGENTFORGE_ENABLE_HARBOR=1
```

The worker default is **isolated**. It never auto-falls back to fake for untrusted uploads.

`SANDBOX_PROVIDER`:

- `isolated` — Docker agent vs grader vs deps volumes, no docker.sock. Prefer the prebuilt `agentforge-eval-python:3.12` image so trials skip per-run pip.
- `work` — in-process simulated MCP worlds (`AGENTFORGE_ENVIRONMENTS_DIR`)
- `harbor` — legacy `harbor run …` only when `AGENTFORGE_ENABLE_HARBOR=1`
- `fake` — deterministic oracle/NOP for **tests** (`ALLOW_FAKE=true`). Forbidden for `uploaded_archive` and for model agents.

## Worker

```bash
set SUPABASE_URL=http://127.0.0.1:15421
set SUPABASE_SERVICE_ROLE_KEY=...   # server-only
set ALLOW_FAKE=false
set AGENTFORGE_FIXTURES_DIR=D:\ai-saas\vortex\fixtures\eval
set AGENTFORGE_EVAL_IMAGE=agentforge-eval-python:3.12
python -m evaluator worker
python -m evaluator worker --loop
```

Workers heartbeat `evaluation_jobs.heartbeat_at`. `claim_evaluation_job` reclaims stale claimed/running leases (default 900s). Multiple `--loop` workers stay safe via `SKIP LOCKED`.

Import a gitignored Terminal Bench 2 checkout (do not commit licensed dumps). If `TB_FIXTURES_DIR` is set, `--write` pins `terminal-bench@2.0.0`:

```bash
set TB_FIXTURES_DIR=D:\ai-saas\vortex\.data\benchmarks\terminal-bench-2
python -m evaluator import-tasks --write
```
