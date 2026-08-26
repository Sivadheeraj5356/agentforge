# ADR-019: Verifier evidence is not the reward

## Status

Accepted

## Context

A hidden test suite can answer “did the property hold?” That is not the same as “how good was this trajectory for learning?” Collapsing both into a boolean makes later RLVR noisier and makes anti-cheat harder to talk about.

## Decision

- **Verifier** (grader container, `reward.py`, Harbor tests) produces per-criterion evidence in `[0, 1]`: critical tests, regression, API contract, forbidden-diff / safety, service health.
- **Reward recipe** maps that evidence to a scalar `reward ∈ [0, 1]`:
  - `binary` — 1 iff critical tests pass
  - `continuous` — weighted sum of the five criteria
  - `hybrid` — continuous outcome mixed with efficiency / safety / correctness
- Failure taxonomy is assigned by **deterministic rules** (timeout, grader tamper, NOP, zero tool calls, …), never by an LLM.
- Adversarial cases (delete tests, touch grader paths, fake output) must not yield reward 1.0.
- Trajectory JSON is an artifact. Postgres stores trial metadata, reward, metrics, and artifact ids.

## Consequences

- UI can show reward and failure category from real rows without inventing leaderboard numbers.
- Ablation of binary vs continuous vs hybrid is an experiment config (`training_experiments.reward_recipe`), not a hardcoded score.
