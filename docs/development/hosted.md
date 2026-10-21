# Hosted control plane

The Next.js app (`apps/web`) runs on Vercel. Server-side enqueue routes and the authenticated daily cron can launch a separate disposable Vercel Sandbox microVM. That VM installs Docker and runs the isolated evaluator; Docker and untrusted submission code do not run inside the Next.js process. A separately managed Docker host remains an alternative.

The hosted bootstrap imports catalog fixtures before draining queued jobs. A successful idle drain proves bootstrap/import, not a fresh completed evaluation. Check current free allowances before launching runs. Oracle, NOP and bundled no-model BYO adapters do not require paid model calls.

## Split

| Plane         | Where                                                                 | Secrets                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Control plane | Vercel (`apps/web`)                                                   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. Server-only: `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_*`), optional `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`, optional `R2_*`. |
| Data          | Supabase cloud project                                                | Service role stays server-only.                                                                                                                                                                                                                    |
| Execution     | Disposable Vercel Sandbox microVM or a separately managed Docker host | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENTFORGE_FIXTURES_DIR`, `AGENTFORGE_ENVIRONMENTS_DIR`, optional model keys, `AGENTFORGE_BYO_CMD`.                                                                                                  |

Do not put OpenAI/Anthropic keys in Vercel `NEXT_PUBLIC_*`. Do not run Harbor, Isolated, or user code in Next.js.

## R2

When `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` are set on the control plane, ingest uses the R2 `ArtifactStore`. Otherwise local `.data/untrusted-ingest`. Postgres stores keys and hashes only.

## Stripe

Test mode only. Checkout + webhook persist `billing_customers` / `billing_subscriptions`. A paid row does **not** gate local eval.

## Worker

The hosted launcher is `apps/web/src/modules/grader/sandbox.ts`; `/api/internal/grader-drain` requires the configured cron bearer secret. It imports fixtures, drains jobs with a bounded budget, then stops the microVM. Alternatively keep `python -m evaluator worker --loop` as a process on a Docker host. No Kubernetes in this tree.

There is no compose file that replaces `pnpm db:start` / `supabase start`.
