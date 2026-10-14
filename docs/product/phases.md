# Product phases

AgentForge maps EvalForge phases 1–6 onto slices A–H. EvalForge chunks 1–11 and the old Vortex execution work are already in the tree.

| EvalForge phase   | AgentForge slice                       | What it is                                                           |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------- |
| 1–2 foundation    | Shipped + **A** rename + **B** honesty | Auth, orgs, inspector, queue, Harbor/Isolated, task report           |
| 3 review          | **C**                                  | Independent human review / adjudication                              |
| 4 APIs            | **D**                                  | Second adapter boundary + `/api/v1`                                  |
| 5 CI              | **E**                                  | Suites, gates, signed webhooks, org concurrency                      |
| 5–6 private evals | **F**                                  | Org-private scenarios; EnvironmentAdapter refuses fake SaaS          |
| 6 RL / lab        | **G**–**H**                            | Immutable env versions, rollouts, PRIVATE datasets, enterprise stubs |

## Slice A — AgentForge name

- Workspace packages `@agentforge/*`, Python `agentforge-evaluator` / `agentforge-training`
- `AGENTFORGE_*` env with one-release `VORTEX_*` / `HARBOR_*` aliases
- Catalog `agentforge-internal`

## Slice B — Dashboard and leftovers

- Task page evaluation sections that have real data
- JSON report (artifact hash, versions, model snapshot; cost/tokens null)
- Harbor smoke when CLI exists; fail clearly when it does not
- Training `--execute` enqueues held-out eval through the evaluator RPC, not Next.js

## Slice C — Human review

- Workflow roles `reviewer` / `adjudicator` are not org owner/admin/member
- Evidence required; independent second review hides the other rationale until submit
- `ReviewProvider` stays unused by deterministic validators

## Slice D — Multi-benchmark + API

- Terminus + Terminal Bench remain. SWE-bench detects and **refuses** until a licensed fixture exists
- `/api/v1/evaluations` create/get/cancel/results/artifacts/trajectory/report — user JWT + RLS

## Slice E — Regression CI

- Suites pin task versions. Gates fail if pass@1 (or mean reward) is below threshold
- Signed webhooks. Org concurrency cap on `evaluation_jobs`
- GitHub App last, behind `CiCheckAdapter` (not configured)

## Slice F — Managed private evals

- Org-private scenarios. AI-assisted rows cannot insert as trusted
- `EnvironmentAdapter` refuses unimplemented Gmail/Slack/Salesforce

## Slice G — RL environments

- Immutable `environment_versions`. `rollouts` point at env + task + agent + seed
- JSONL / ATIF-shaped export. Optional real TRL on GPU; `passAt1` still null without held-out rows

## Slice H — Lab contracts

- Dataset versions default `PRIVATE`. Customer data is not reusable
- `/api/v1` is the public versioned surface
- SSO/SAML/SCIM/CMK are ADR stubs until a named customer

## Slices W1–W6 — Agent Work Environments

Private executable packs (not TB4). See [product/work-environments/](product/work-environments/).

| Slice  | What it is                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------- |
| **W1** | Pack schema, docs, Lab Environments chrome, ADR-031/032/033                                       |
| **W2** | orders-ops family, staged reward, `eval_scenarios` overlay in the worker, read-only context mount |
| **W3** | One Production Incident world + MCP JSON-RPC loop in `services/evaluator`                         |
| **W4** | `/api/v1/environments/start` and reset; rollout reward fetch                                      |
| **W5** | PRIVATE trajectory / preference export; capability-gap from real `failure_category` counts        |
| **W6** | Tests: staged math, MCP handlers, pgTAP tenancy, Playwright chrome, Isolated oracle/NOP           |

## Permanent outs

Kafka, Kubernetes, ClickHouse, invented resume percentages, executing user code in `apps/web`.
