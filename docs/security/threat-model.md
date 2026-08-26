# Threat model

## Assets

- Org metadata and membership
- Project metadata (names, slugs, descriptions, archive state)
- Benchmark catalog and pinned versions (non-secret manifests)
- Submission / artifact / evaluation-run metadata
- Audit events (mutation trail)
- Uploaded task ZIP bytes (local untrusted ingest dir; metadata in Postgres)
- User profiles and auth sessions
- API credentials (Supabase service role, R2, model keys)
- Integrity of scores and trial logs (future)

## Adversaries

- External attackers probing the public web app
- Malicious or compromised org members uploading hostile task packs
- Cross-tenant probing by authenticated users (orgs and projects)
- Supply-chain compromise of dependencies
- Confused-deputy bugs that run untrusted code in the control plane

## Key threats & mitigations

| Threat                                  | Mitigation                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Hostile ZIP (zip-slip, bombs, symlinks) | Inspect central directory first; reject `..`/absolute/symlink; named size/count/ratio limits; extract to temp then delete |
| RCE via uploaded tasks                  | Execution plane isolation; never `exec` user content in trusted apps; validators are static                               |
| Cross-tenant data leak / IDOR           | Org-scoped RLS; server slug resolution; `notFound()` without existence leak                                               |
| Project IDOR / slug probing             | `requireProjectBySlug` under membership RLS; stable slug, no existence leak                                               |
| Member privilege escalation             | Owner/admin-only INSERT/UPDATE; UI hides mutations; RLS still enforces                                                    |
| created_by / org_id spoofing            | INSERT check `created_by = auth.uid()`; immutable-column trigger                                                          |
| Hard-delete abuse                       | No authenticated DELETE policy; archive/restore only                                                                      |
| RLS policy mistake                      | pgTAP isolation tests + E2E cross-tenant scenario                                                                         |
| Service-role leakage                    | Server-only; never `NEXT_PUBLIC_*`; never used for normal user queries                                                    |
| Open redirects                          | `getSafeRedirectPath` rejects absolute/protocol-relative URLs                                                             |
| Auth callback abuse                     | PKCE code exchange server-side; safe `next` redirect                                                                      |
| Session misuse                          | `auth.getUser()` on server; middleware refresh; no SPA AuthProvider gate                                                  |
| XSS via org/profile/project text        | React escaping; constrained lengths; plain-text descriptions only                                                         |
| Security-definer privilege escalate     | Narrow RPCs, fixed `search_path`, auth.uid() checks, EXECUTE grants                                                       |
| Malicious client requests               | Zod at trust boundaries + DB constraints + RLS                                                                            |
| Cookie caching / stale session          | Middleware session refresh via `@supabase/ssr`                                                                            |
| Migration drift                         | Committed migrations + CI db reset/lint/test/types                                                                        |
| Cross-tenant catalog vs tenant mix-up   | Catalog is global read; tenant tables keyed by org/project + RLS isolation tests                                          |
| Fake evaluation integrity               | Runs pin version ids; results not writable by authenticated clients                                                       |
| Audit metadata secrets                  | Size limits; Zod forbids secret-shaped keys; no GET logging                                                               |
| Artifact path traversal                 | `storage_key` CHECK + future `isSafeRelativePath`; no blobs in Postgres                                                   |
| User enumeration                        | Neutral forgot-password response                                                                                          |
| Validator reads outside the package     | `WorkspaceReader` confines every path; traversal refused not resolved; symlinks skipped at snapshot load                  |
| Malicious path inside task metadata     | `verifier.entrypoint` resolved via `resolveSafePath`; an escape is a critical finding, never a read                       |
| Validator crash hiding other findings   | Per-validator error isolation; execution errors reported separately and can never yield `pass`                            |
| Internal detail leaking to end users    | Job failures return a safe sentence plus correlation id; stack traces stay in server logs                                 |
| Finding flood from a hostile package    | Fingerprint dedup plus `MAX_FINDINGS_PER_RUN`, surfaced as a truncation finding                                           |
| Regex denial of service via metadata    | Strings from uploads are never compiled into regular expressions                                                          |
| Silent LLM exfiltration of task content | Providers are interfaces only; `architecture.test.ts` fails on model/network/exec references                              |

## Residual risk

- Local demo anon/service keys are public by design for Supabase local; production must use project-specific secrets.
- Team invitations / membership administration are not implemented; membership writes are denied for authenticated clients except bootstrap RPC (tests may seed members via service role).
- Project descriptions are plain text only; Markdown/HTML rendering is intentionally deferred.
- Catalog writes are not available on the product path; seeding uses table-owner / service role in tests only.
- Evaluation execution, R2 production, and LLM review are not implemented.
