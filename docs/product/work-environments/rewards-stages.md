# Stage rewards

End-of-trial recipes (`binary` / `continuous` / `hybrid`) still exist. Work-environment packs use **`staged`**.

## Contract

- Ordered stages, each with a hidden verifier and a weight
- Weights **sum to 1**
- Rollout reward = Σ (weightᵢ × stageᵢ) in `[0, 1]`
- Per-stage scores persist on `evaluation_trials.metrics` (`stage_<id>`)
- The worker writes those numbers. Next.js **displays** them. The browser never computes reward

Example incident rubric (implemented as verifier functions, not UI sliders):

| Stage          | Weight |
| -------------- | ------ |
| Service health | 0.35   |
| Root cause     | 0.20   |
| Data preserved | 0.20   |
| Safe rollback  | 0.15   |
| Communication  | 0.10   |

Orders-ops maps stages onto existing Isolated grader signals (`service_health`, `critical_tests`, `api_contract`, `diff_quality`).

Partial credit is real: a NOP that did not delete customers can score `data_preserved` and still be far from 1.0.

See [ADR-033](../../architecture/decisions/ADR-033-stage-rewards-from-verifier.md).
