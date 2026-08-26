# app-clone family

Evaluate agents inside **cloned application UIs**, not chat traces.

The first world is a multi-surface checkout console: Simulated checkout UI, Simulated admin console, and Simulated support inbox. Tools mutate in-world UI state. Hidden verifiers read that state after the loop.

`apps/web` never starts this world. The evaluator loads `environments/packs/checkout-console-clone.json`.
