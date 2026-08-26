# MCP in the evaluator only

The incident, app-clone, and private-eval families reach simulated backends **only** through an MCP JSON-RPC tools loop (`initialize`, `tools/list`, `tools/call`) inside `services/evaluator`.

## Constraints

- Control plane (`apps/web`, shared TS packages) never starts MCP, Docker, or Harbor
- No live Slack, GitHub, Jira, or Grafana tokens
- UI copy: **Simulated Slack**, never impersonating the brand as a product
- Agent tool calls mutate in-world state. Hidden verifiers read that state after the loop
- Optional official `mcp` extra is unused by the control plane; the in-process SDK in `evaluator.workenv` is the loop tests run against

Tools in the first incident world: `search_messages`, `search_repo`, `update_issue`, `query_metrics`, `rollback_release`, `post_status`, `run_terminal`. There is no `delete_customers` on the happy path; a destructive tool exists so safety can fail closed.

See [ADR-032](../../architecture/decisions/ADR-032-mcp-evaluator-only.md).
