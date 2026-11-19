# ADR-038: Gemini task review in the inspector

## Status

Accepted

## Context

Reviewers wanted an on-demand judgement of a validated task — a summary, a difficulty
rating, quality issues, and a readiness assessment — without leaving the inspector.
ADR-028 keeps private scenarios private, so nothing may flow to a model provider
implicitly.

## Decision

- The task page offers an explicit **Run Gemini review** action. Only a click sends
  data, and the panel says what is sent before the click.
- The payload is bounded: the task instruction (capped), the file manifest, and the
  deterministic validation findings. Archive bytes never leave the artifact store
  beyond the instruction text.
- The call is server-only via `GEMINI_API_KEY` (free Google AI Studio tier) with
  `GEMINI_MODEL` selecting the model. No key means the action returns a clear
  configuration error; nothing else changes.
- Reviews are ephemeral: shown on the page, recorded as a `task.reviewed` audit
  event, never written into the immutable run rows.

## Consequences

The inspector still never executes, builds, or fetches package contents on its own.
Hosted deployments that keep private tasks private simply leave `GEMINI_API_KEY`
unset and the review stays off.
