# ADR-033: Stage rewards come from the verifier

## Status

Accepted

## Context

Partial credit is required for long-horizon packs. Computing those weights in the browser would let the control plane invent scores.

## Decision

- Recipe `staged`: ordered hidden verifiers, weights sum to 1, reward in `[0, 1]`
- The evaluator writes `stage_*` keys onto `evaluation_trials.metrics`
- Next.js may render those keys after the worker. It must not recompute them
- `eval_scenarios` overlay instruction text for the worker; they are not a second grader

## Consequences

UI stage checklists stay empty until trial rows exist. Playwright asserts the chrome does not print invented percentages.
