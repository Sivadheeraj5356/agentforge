# What labs buy

Bootstrap order: **Data → Evals → Environments**. RL training as a hosted service stays later.

## Now (this tree)

| SKU                                | Contents                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pack A — SWE / DevOps              | `orders-ops` family: investigate → patch → health → don’t trash the grader. Isolated sandbox, staged reward, JSONL/ATIF export                  |
| Pack B — tool-use                  | Same MCP loop, simulated backends, hidden verifiers                                                                                             |
| Pack C — long-horizon              | One Production Incident world (EU payments). Reset from an immutable `environment_versions` row                                                 |
| Pack D — app / UI clone            | `app-clone` family: Checkout console clone. Multi-surface simulated UIs, hidden stages, PRIVATE export                                          |
| Pack E — private long-horizon eval | `private-eval` family: stalled release train, three sessions, PRIVATE rollouts. Compare your agent on a pinned version; not a live public score |

Labs pay per rollout or monthly **later**. This slice ships the pack format, staged grader, MCP world, Environment API, and PRIVATE export kinds. It does not invent billing.

## Later (ADR stubs, not this series)

- RL training service as a product (`--execute` stays honest; no published score without held-out rows)
- 30–50 environments / three full families at 90 days (target, not a fake catalog)
- Real Kubernetes, real AWS, live SaaS OAuth
- Public AgentGym leaderboard

Capability-gap UI groups **real** `failure_category` counts from trials. It does not print a 31/24/19 pie. “Generate more recovery experiences” is a queue of pack variants.
