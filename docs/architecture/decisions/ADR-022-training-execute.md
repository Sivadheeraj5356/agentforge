# ADR-022: Training execute stays off the control plane

## Status

Accepted

## Context

Dry-run SFT/GRPO plans (ADR-020) must not be mistaken for published scores.
Real training needs GPUs, TRL/PEFT, and a Harbor env loop. Putting that in
Next.js would violate ADR-002 and invite invented resume percentages.

## Decision

- `python -m training sft|grpo --execute` runs only in `services/training`.
- Base model for SFT is `Qwen/Qwen2.5-Coder-1.5B` (LoRA via TRL/PEFT when extras
  are installed). Checkpoints and `VORTEX_GIT_SHA` are written beside the plan.
- **GPU gate:** if CUDA is absent, `--execute` writes a CPU smoke with
  `passAt1: null` for train and held-out. It never emits example percentages.
- If CUDA is present but TRL is not wired, status is `execute_pending_trl` with
  the same honest null scores.
- GRPO uses one stack: TRL stateful env calling the evaluator’s Harbor sandbox
  and the same reward recipes (ADR-019). Next.js only records the experiment row.
- Held-out eval is enqueued through `services/evaluator` (`held-out-eval.json`
  describes the ids). Training does not call models from `apps/web`.
- `training_experiments.metrics` stays `{}` until both train and held-out rows
  exist. Empty metrics are not a published result.

## Consequences

- Operators can run `--execute` on a laptop and get an honest smoke file.
- Resume language may quote `X% → Y%` only after held-out evaluator rows exist.
