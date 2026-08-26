# ADR-030: Lab contracts and enterprise stubs

## Status

Accepted

## Context

EvalForge chunk 18 wants dataset versions, privacy classification, and
enterprise hooks. There is no named paying customer for SSO/CMK.

## Decision

- `dataset_versions` are immutable. `privacy_class` defaults to `PRIVATE`.
  Customer data is never treated as reusable training material.
- Dataset members record lineage to task, environment, run, or review.
- `/api/v1` (ADR-026) is the public versioned surface.
- SSO/SAML, SCIM, CMK, and data residency are **not implemented**. They stay
  as this ADR until a customer is named.

## Consequences

- The lab page stores PRIVATE datasets without implying a compliance product.
