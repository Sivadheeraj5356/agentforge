# ADR-006: Immutable task versions

## Status

Accepted

## Context

Evaluations are only meaningful if the task definition cannot silently change after runs start.

## Decision

Task content is stored as **immutable versions**. Edits create a new version. Trials and validations always pin a `task_version_id`.

## Consequences

- Storage growth over time (mitigate with retention policies)
- Clear audit trail and reproducibility
- UI must never imply in-place edit of published versions
