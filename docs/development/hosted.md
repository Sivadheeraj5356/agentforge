# Hosted control plane

The Next.js app (`apps/web`) can run on Vercel. Isolated grading **cannot**. Docker agent vs grader stays on a VM or WSL worker.

## Split

| Plane | Where | Secrets |
| --- | --- | --- |
| Control plane | Vercel (`apps/web`) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. Server-only: `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_*`), optional `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`, optional `R2_*`. |
| Data | Supabase cloud project | Service role stays server-only. |
| Execution | Long-running evaluator on a Docker host | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENTFORGE_FIXTURES_DIR`, `AGENTFORGE_ENVIRONMENTS_DIR`, optional model keys, `AGENTFORGE_BYO_CMD`. |

Do not put OpenAI/Anthropic keys in Vercel `NEXT_PUBLIC_*`. Do not run Harbor, Isolated, or user code in Next.js.

## R2

When `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` are set on the control plane, ingest uses the R2 `ArtifactStore`. Otherwise local `.data/untrusted-ingest`. Postgres stores keys and hashes only.

## Stripe

Test mode only. Checkout + webhook persist `billing_customers` / `billing_subscriptions`. A paid row does **not** gate local eval.

## Worker

Keep `python -m evaluator worker --loop` as a process with Docker. No Kubernetes in this tree.

There is no compose file that replaces `pnpm db:start` / `supabase start`.
