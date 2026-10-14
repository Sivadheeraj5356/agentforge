# Agent Work Environments

AgentForge sells **private, executable work environments** — not a public Terminal-Bench 4.

[Terminal-Bench 3.0](https://www.tbench.ai) already covers longer-horizon terminal work (multi-container, GPU, seven domains). Competing on “harder shell tasks” is the wrong wedge. The unit of sale here is an **experience pack**: instruction + world + tools + hidden state + stage verifiers + reward + trajectories + reset.

```
Data packs → evaluation packs → environment API → (later) RL training service
```

Do not sell “10,000 prompts.” Sell a world the agent can fail inside, with a hidden grader and a reset.

## What this is not

- Not a TB3 clone or a public AgentGym leaderboard
- Not live Gmail / Slack / Salesforce OAuth (ADR-028). Simulated Slack, GitHub, Jira, and Grafana are **labeled simulated**
- Not Kubernetes-in-production, Kafka, or invented resume percentages
- Not MCP or Docker started from `apps/web`

## Tree

Canonical packs live in [`environments/`](../../../environments/). Control plane lists pack metadata and enqueues ids. The evaluator loads the same JSON, runs MCP (incident family) or Isolated (orders-ops), and writes per-stage scores.

| Doc                                    | Topic                                          |
| -------------------------------------- | ---------------------------------------------- |
| [packs.md](packs.md)                   | Experience pack schema                         |
| [rewards-stages.md](rewards-stages.md) | Staged rewards; Next.js never computes them    |
| [mcp.md](mcp.md)                       | MCP JSON-RPC loop in `services/evaluator` only |
| [selling.md](selling.md)               | Pack SKUs and what stays later                 |

ADRs: [031](../../architecture/decisions/ADR-031-work-environments-not-tb4.md), [032](../../architecture/decisions/ADR-032-mcp-evaluator-only.md), [033](../../architecture/decisions/ADR-033-stage-rewards-from-verifier.md), [034](../../architecture/decisions/ADR-034-private-eval-fable-5-target.md).
