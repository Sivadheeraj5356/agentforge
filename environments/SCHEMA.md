# Pack JSON schema

`schemaVersion` is `1`. Zod: `ExperiencePackSchema`. Python: `evaluator.workenv.pack.load_pack`.

Required:

- `key` kebab, `version` pinned (never `latest`)
- `family`: `orders-ops` | `production-incident` | `app-clone` | `private-eval` | `horizon-swe` | `evolving-spec` | `skill-follow`
- `title`, `instruction`
- `simulated`: subset of `slack` | `github` | `jira` | `grafana` | `terminal` | `orders-api` | `checkout-ui` | `admin-console` | `support-inbox` | `returns-desk` | `ops-console` | `runbook` | `handoff-board` | `inventory-console` | `spec-board` | `skill-file` | `audit-log` | `ticket-queue` | `macro-panel` | `sla-board`
- `applications`: human-readable app names
- `tools[]`: `{ name, description, simulatedBackend }`
- `stages[]`: `{ id, label, weight, metricKey }` with weights summing to 1 (±1e-9)
- `rewardRecipe`: `staged`
- `catalogTaskKey`
- `failureModes[]`
- `reset.kind`: `new_workspace` | `new_world`
- `environmentVersion`: unique per adapter (e.g. `orders-ops-1.0.0`)

Optional: `contextMount`, `hiddenState`, `siblingTaskKeys`.
