# production-incident family

One killer scenario first:

> Payments in Europe are failing intermittently. Investigate and restore service without losing customer data.

The runnable world is an **in-memory simulated** Slack / GitHub / Jira / Grafana graph plus a customer table, driven by MCP tools in `services/evaluator`. Compose below documents the intended topology; `apps/web` never starts it.

Hidden verifiers live in the evaluator, not on the agent filesystem.
