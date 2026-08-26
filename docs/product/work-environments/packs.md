# Experience packs

An **experience** is not a prompt. The pack is the unit of sale.

## Required fields

Validated at the trust boundary by `ExperiencePackSchema` in `@agentforge/contracts`. The evaluator loads the same JSON from `environments/packs/`.

| Field | Meaning |
| --- | --- |
| `key` / `version` | Immutable once published. New version, not a mutate |
| `family` | `orders-ops`, `production-incident`, `app-clone`, or `private-eval` |
| `instruction` | What the agent is asked to do |
| `simulated` | Backends the agent may reach, always labeled simulated |
| `tools` | MCP tool manifest (incident) or terminal-only (orders-ops) |
| `stages` | Hidden verifiers; weights **sum to 1** |
| `rewardRecipe` | `staged` for these packs |
| `catalogTaskKey` | Pinned catalog task the run FK points at |
| `failureModes` | Honest failure tags, not invented percents |
| `reset` | `new_workspace` (Isolated) or `new_world` (incident) |
| `contextMount` | Optional read-only notes/logs for the agent |

Hidden verifier implementations stay off the agent filesystem (Isolated `/hidden`, incident world object in the evaluator process).

## Families in this tree

- **orders-ops** — long-horizon DevOps over the existing FastAPI+SQL fixtures, with `context/` logs mounted read-only
- **production-incident** — one EU-payments incident world first; more worlds later
- **app-clone** — cloned application UIs (checkout console first). Surfaces are labeled simulated. The agent must act in the UI, not a chat transcript.
- **private-eval** — long-horizon private RL/RLVR. First pack is a stalled release train across three operator sessions. Compare agents privately on a pinned version; this is not a published leaderboard.

Sale manifests: `environments/packs/*.json`.
