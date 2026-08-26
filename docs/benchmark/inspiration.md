# Horizon inspiration map

Research clones live in gitignored `.research/`. They are **not** part of the product, CI, or catalog. We copy the **engineering job**, not instances, patches, Django/NumPy histories, or skill files.

AgentForge Horizon is a private bench protocol (pinned env, hidden grader, staged reward, failed rollouts). This site does not store or display a Fable 5 score ([ADR-036](../architecture/decisions/ADR-036-agentforge-is-the-bench.md)).

| Source | Horizon (Awesome T0–T3) | Job we took | AgentForge original id | What we did **not** copy |
|---|---|---|---|---|
| SWE-bench family | T1 | One principal repair + hidden tests | Existing Isolated fixtures (`broken-orders-api` and siblings) | Issue text, gold patches, repo snapshots |
| [SWE-EVO](https://github.com/SWE-EVO/SWE-EVO) | T2 (near T3) | Multi-obligation evolution: API + data + CLI | `ledger-evolve` | Django/NumPy histories, SRS dumps, OpenHands/SWE-agent trees |
| [DeNovoSWE](https://github.com/AweAI-Team/DeNovoSWE) | T2 | Spec → small library; anti-cheat against installing a lookalike | `spec-to-kit` | Hugging Face rows, `document` fields, PyPI names, Docker image URLs |
| SWE-Chain / T3 papers | T3 | Requirements revise mid-run; later work inherits earlier mutations | `wave-inventory` | Chained release datasets |
| [mattpocock/skills](https://github.com/mattpocock/skills) | n/a (skills, not a bench) | Agent ignores a written constraint when a shortcut exists | `skill-constraint` | Their SKILL.md files, installer, newsletter copy |
| SaaSBench / app-clone papers | T2 | Multi-surface product work, simulated | Existing `checkout-console-clone` | Live SaaS logins, competitor UIs |

## Taxonomy we use in docs

- **T0** — local bounded coding (control; not our wedge)
- **T1** — one engineering objective, long procedural trace (Isolated FastAPI repairs)
- **T2** — several independently verifiable engineering obligations (`ledger-evolve`, `spec-to-kit`, checkout clone)
- **T3** — the spec itself changes (`wave-inventory`, `private-eval-long-horizon` sessions)

Trajectory length is **not** the taxonomy. A long search–edit–test loop on one bug stays T1.
