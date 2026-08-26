# ADR-025: Reviewer workflow is not an org role

## Status

Accepted

## Context

EvalForge chunk 13 needs human accept/reject/comment with evidence and an
independent second review. Organization `owner` / `admin` / `member` already
gate tenancy. Mixing those with reviewer identity would let an org owner see
another reviewer's rationale too early.

## Decision

- `evaluation_workflow_memberships` stores `reviewer` and `adjudicator`.
- Those rows are not `organization_role` values.
- `finding_reviews` require evidence. Reviewer B cannot select A's rationale
  until B has submitted.
- `ReviewProvider` remains unused by deterministic validators (ADR-015).

## Consequences

- Adjudicators can see submitted reviews. Org membership is still required to
  read findings via RLS.
