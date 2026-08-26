# ADR-015: Pass/fail policy is separate from validators, and validators are versioned

## Status

Accepted

## Context

Chunk 5 derived a run's fate from its findings implicitly: any critical archive
finding meant `failed`, and `strictMode` promoted warnings to errors so that a
stricter run would fail. Two problems followed.

First, severity stopped describing evidence. The same missing README could be a
warning or an error depending on configuration, which makes findings
incomparable across runs and makes "how bad is this?" unanswerable from the data.

Second, there was nowhere to express the verdicts real users need. CI wants
"fail on errors", an authoring UI wants "warn but let me keep editing", and a
future gate wants thresholds or a score. Encoding those in validators would
duplicate the rules in nine places.

Separately, a report that says `TASK_ENVIRONMENT_WORKDIR_MISSING` is not
explainable six months later unless we know which version of the environment
validator produced it.

## Decision

**Severity is a property of evidence.** A validator assigns severity from what it
proved and nothing else. Configuration never rewrites a severity.

**A policy layer decides the outcome.** `resolvePolicy(configuration)` returns a
`ValidationPolicy` (`failsOn` / `warnsOn` severity sets) and
`decideOutcome(policy, { summary, validatorErrorCount })` returns
`pass | warn | fail`. `strict` fails on critical and error; `lenient` fails only on
critical. `strictMode` survives as a policy modifier that adds warnings to the
failing set. Future CI thresholds or scores are new fields on `ValidationPolicy`
plus a new policy id — validators do not change.

**Validator execution errors cannot pass.** If a validator threw, evidence is
incomplete, so the best outcome is `warn`.

**Outcome is distinct from lifecycle.** `ValidationReport.outcome` is the verdict;
`validation_runs.status` stays the job lifecycle. A package that fails validation
produces a `succeeded` run with `outcome = 'fail'`.

**Validators are versioned.** Every validator declares `id`, `name`, `category`,
and a semantic `version`, and the run persists the descriptor list that produced
the report.

## Consequences

- Findings are comparable across runs and configurations; fingerprints plus stable
  severities make future run diffing meaningful.
- Two extra persisted columns (`policy`, `outcome`) and one jsonb column
  (`validators`).
- Adding a policy is a code change plus a `CHECK` constraint update, not a
  validator rewrite.
- Changing a validator's checks requires a version bump; reviewers can see it in
  the diff and in the stored report.
- `validation_runs.status` no longer signals a bad package, so UI and future CI
  integrations must read `outcome`.
