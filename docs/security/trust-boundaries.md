# Trust boundaries

## Planes

1. **Browser** — untrusted. Receives only public env and user-authorized data.
2. **Control plane** (`apps/web` server) — trusted for orchestration and authz helpers, not for sandbox execution.
3. **Execution plane** (`services/evaluator` + sandboxes, `services/training`) — runs untrusted workloads and (later) training jobs.
4. **Managed backends** (Supabase / future R2) — trust via keys, RLS, and network policy.

## Crossing rules

- Validate every external payload with Zod / contracts at the boundary.
- Prefer signed URLs for artifact access over proxying large blobs through the web app.
- Model API keys stay in the execution plane or a secrets manager — not in client bundles.
- Uploaded archives are inspected then extracted only to a disposable temp directory; scripts are never executed.
- `assertNeverExecutesUserCode` marks orchestration entrypoints that must not grow into local execution.
- Organization context comes from the URL slug, resolved with the caller's session under RLS — never from a browser-trusted org UUID alone.
- Project context comes from `(organizationSlug, projectSlug)`, resolved with `requireProjectBySlug` under the same session; misses are `notFound()` without existence leak.
- Evaluation domain JSON (manifests, evaluator configuration, audit metadata) is validated with Zod in `@agentforge/contracts` before insert.
- Service role never crosses into the browser trust boundary.
- The evaluator worker is the only caller of `claim_evaluation_job`. The control plane never starts Harbor or Docker.

## Permanent ban

Shelling out to user-provided commands inside `apps/web` or shared packages is a security defect, not a feature.
