# ADR-028: Private scenarios and EnvironmentAdapter

## Status

Accepted

## Context

EvalForge chunk 16 wants org-private eval authoring. Fake Gmail/Slack/Salesforce
environments would be dishonest.

## Decision

- `eval_scenarios` are org-scoped. AI-assisted rows cannot insert as trusted.
- `EnvironmentAdapter.provision` may refuse. The shipped adapter refuses
  unimplemented SaaS environments.
- Human review (ADR-025) is required before treating an AI draft as trusted.

## Consequences

- Tenant isolation is proven with pgTAP. No marketplace of customer scenarios.
