# ADR-020: Training plane is not the control plane

## Status

Accepted

## Context

SFT and GRPO need GPUs, long jobs, and untrusted env loops. Running them in `apps/web` would mix trusted orchestration with model training and would make it tempting to paste example percentages onto a resume before any run exists.

## Decision

- Add `services/training` for dataset conversion, train/held-out splits, and dry-run SFT/GRPO plans.
- Next.js may **record** `training_experiments` (planned split, recipe, git SHA later) but must not load torch, TRL, or PEFT.
- GRPO, when executed, uses the evaluator’s Harbor/isolated env and the same reward recipes (ADR-019).
- Metrics on an experiment stay `{}` until a real job writes them. Empty metrics are not a published result.
- Train and held-out task lists are stored on `training_experiment_tasks`. Success claims must quote both.

## Consequences

- Resume language can describe the system honestly before numbers exist, and can add `X% → Y%` only after held-out eval rows exist.
- Optional `train` extras are documented, not required to install the package.
