# Work environment packs

First-class **experience packs** (instruction + world + tools + hidden verifiers + staged reward + reset). Harbor/Terminus task ZIPs stay in `fixtures/eval/`.

The Next.js control plane never starts these worlds. `services/evaluator` loads `packs/*.json`.

| Path                            | Role                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `SCHEMA.md`                     | Field list matching `ExperiencePackSchema`           |
| `families/orders-ops/`          | Long-horizon DevOps over the FastAPI+SQL fixtures    |
| `families/production-incident/` | One simulated EU-payments incident                   |
| `families/app-clone/`           | Multi-surface cloned application UIs                 |
| `families/private-eval/`        | Long-horizon private RL/RLVR (stalled release train) |
| `packs/`                        | Versioned sale manifests (immutable once published)  |
