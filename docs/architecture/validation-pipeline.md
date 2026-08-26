# Validation pipeline and validator architecture

Deterministic, static inspection of uploaded task packages. Lives in
`@agentforge/validation`, has no React dependency, and is callable from the web app, a
worker, a CLI, or CI.

> **Permanent rule: deterministic validators must never depend on an LLM.**
> `ReviewProvider` and `AnalysisProvider` are interfaces with no wired
> implementation. Package contents are never sent to a model provider.

## Stages

```
artifact bytes
  → SHA-256 + byte size
  → ZIP inspection (central directory only, nothing written yet)
  → extraction into an isolated temp workspace
  → workspace snapshot (one filesystem pass, text preloaded)
  → benchmark detection (adapter registry)
  → task discovery (one pass, roots only)
  → parse phase (one metadata document + one schema pass per task)
  → ValidationContext per task
  → validator registry selection (configuration-driven)
  → validators → raw finding drafts
  → normalization (fingerprint, dedup, deterministic order, ordinals)
  → severity aggregation → summary
  → policy layer → PASS / WARN / FAIL
  → ValidationReport
  → persistence (validation_runs, validation_findings) → UI / API
  → temp workspace removed in a finally block
```

Entry point: `runValidationPipeline({ archiveBytes, configuration?, registry?, clock?, diagnostics? })`.

Discovery and parsing happen **once**. Parsed representations are cached on the
context, so ten validators inspecting `task.toml` cause one read and one parse.

## ValidationContext

A validator sees exactly this, and nothing else:

| Member                          | Purpose                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `artifact`                      | Content hash and byte size of the uploaded archive               |
| `benchmark`, `benchmarkVersion` | Adapter identity that produced the parse                         |
| `task`                          | Normalized `TaskDefinition` (root, key, metadata, instruction)   |
| `taskVersion`                   | Declared task version, or `null`                                 |
| `workspace`                     | `WorkspaceReader` for the extracted package                      |
| `files`                         | Files in scope: the task root plus files outside every task root |
| `metadata`                      | Parsed `TaskDocument` with source locations and issues           |
| `configuration`                 | The run's `ValidationConfiguration`                              |
| `options`                       | Validator thresholds (`ValidatorOptions`)                        |

There is deliberately **no** database client, session, auth object, request,
logger, model provider, or host filesystem handle.

## What validators may and may not do

May:

- Read files through `WorkspaceReader`
- Read parsed metadata and its source locations
- Emit findings about what is provably present, absent, or malformed
- Throw (the pipeline isolates it)

May not:

- Execute, build, or install anything from the package
- Touch the host filesystem, network, or environment directly
- Read or write a database, session, or cookie
- Call a model, reviewer, or analysis provider
- Mutate the context or another validator's findings
- Decide PASS/FAIL — that is the policy layer's job

## WorkspaceReader

`exists`, `stat`, `readText`, `readJson`, `listFiles`, `listDirectories`,
`resolveSafePath`. Every path is workspace-relative and normalized through
`normalizeWorkspacePath`, which **refuses** rather than resolves:

- absolute paths and Windows drive letters
- `..` in any segment (even when it would land back inside the workspace)
- NUL bytes and paths over `MAX_WORKSPACE_PATH_LENGTH`

Backslashes are unified to `/`. Symbolic links are skipped when the snapshot is
loaded, so a link that somehow survived archive inspection can never be followed.
`listFiles(dir)` is recursive; `listDirectories(dir)` returns immediate children.
`readText` returns `null` for binary or oversized files — a validator must not
claim anything about a file it could not read.

## Parsing layer

`readTaskDocument` produces a `TaskDocument`: the parsed table, a `locate(fieldPath)`
function, and a list of issues.

- Parse failures become `kind: "parse"` issues, not exceptions.
- Runtime schemas (`TerminusTaskTomlSchema`, `ClassicTaskYamlSchema`,
  `NodePackageManifestSchema`) validate uploaded TOML/YAML/JSON. TypeScript
  interfaces are not runtime validation. Unknown keys pass through so a newer
  Harbor field is never reported as an error.
- Schema failures become `kind: "schema"` issues carrying a dotted field path.
- `locate` returns a real line when the parser recorded one, otherwise the nearest
  declared ancestor, otherwise `line: null`. **Line numbers are never invented.**

Section ownership for schema issues: `environment.*` belongs to the environment
validator, `verifier.*` to the verifier validator, everything else to the metadata
validator. One issue is reported once, by one validator.

## Validator contract and registry

```ts
type Validator = {
  id: ValidatorId;
  name: string;
  category: ValidationFindingCategory;
  version: string;
  validate(context: ValidationContext): readonly ValidationFindingDraft[];
};
```

Use `defineValidator` so the emitter stamps the validator's id and category onto
every finding; a validator cannot mislabel its own output.

`createValidatorRegistry([...])` builds a typed registry (`list`, `get`, `select`,
`describe`) and rejects duplicate ids at construction. `select(configuration)`
honours `enabledValidators`. There is no `if/else` chain on validator names
anywhere.

### How to write and register a validator

1. Add the id to `ValidatorIdSchema` / `VALIDATOR_IDS` in `@agentforge/contracts`.
2. Add finding codes to `FINDING_CODES`.
3. Create `packages/validation/src/validators/<name>.ts` using `defineValidator`,
   starting at version `1.0.0`.
4. Register it in `createTerminusValidatorRegistry` (or the new benchmark's
   registry).
5. Add unit tests, and update fixture expectations if an existing fixture changes.
6. Extend the DB category `CHECK` constraint if the validator introduces a new
   category.

Bump the validator's `version` whenever its checks change, so a report explains
which logic produced it.

## Finding codes

Codes are public API. Dashboards, CI gates, and persisted rows depend on them, so
they are **added, never renamed or repurposed**. Convention:
`<AREA>_<SUBJECT>_<PROBLEM>` in `SCREAMING_SNAKE_CASE`, matching
`^[A-Z][A-Z0-9_]*$`.

All Chunk 5 codes remain valid and unchanged. Chunk 6 added
`VALIDATION_FINDINGS_TRUNCATED`, `TASK_METADATA_INVALID_FIELD`,
`TASK_ENVIRONMENT_INVALID_CONFIGURATION`, `TASK_VERIFIER_INVALID_CONFIGURATION`,
and the `TASK_REPRODUCIBILITY_*` family.

One documented behaviour change: `TASK_VERIFIER_MISSING` now means only "the tests
directory is absent". The "separate verifier image requested but `tests/Dockerfile`
is absent" case moved to `TASK_VERIFIER_INVALID_CONFIGURATION`, because one code
must mean one thing.

### Categories

`archive`, `configuration`, `structure`, `metadata`, `instructions`, `environment`,
`tests`, `verifier`, `documentation`, `security`, `reproducibility`. Declaration
order is the sort rank. The UI renders them uppercase; identifiers stay lowercase
to match the database's text conventions.

## Severity conventions

`info | warning | error | critical`, evidence-based and never inflated:

| Severity   | Meaning                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `critical` | Hostile or trust-breaking evidence (zip-slip, symlink, Docker socket, path escape) |
| `error`    | A required piece is provably absent or provably malformed                          |
| `warning`  | Provably risky or non-reproducible, but the package is still usable                |
| `info`     | Advisory or optional convention                                                    |

Severity is a property of the evidence. Configuration never rewrites it — that is
what the policy layer is for.

Wording rule: claim only what static inspection proves. "Verifier configuration
references a file that does not exist", not "verifier is broken". "Package
references the host Docker socket", not "this task will escape the sandbox".

## Deterministic ordering and dedup

Findings are deduplicated by fingerprint (keeping the most severe duplicate), then
sorted by:

1. severity (`critical` → `error` → `warning` → `info`)
2. category (declaration order)
3. validator id
4. finding code
5. source location: path, then line, then field path

`ordinal` is the position in that order and is persisted, so the UI and API never
depend on insertion order or `created_at`.

`fingerprint` is the SHA-256 of `code`, `validatorId`, `path`, `line`, and
`fieldPath` joined by a NUL byte — a stable logical identity independent of run id
and timestamps. Future run-to-run
diffing keys off it, so a random UUID is never a finding's only identity. The
migration backfills historical rows with the identical byte construction.

A per-run ceiling (`MAX_FINDINGS_PER_RUN`) protects the database from a hostile
package; truncation is reported as `VALIDATION_FINDINGS_TRUNCATED` rather than
silently dropping evidence.

## Report-consuming helpers

Three additions sit _after_ the pipeline and never influence it. They are pure and
dependency-free, so a CI gate, an analytics job, or the task inspector can all use
them:

- `compareValidationRuns(previous, current)` — diffs two runs by the `fingerprint`
  the pipeline already assigns, returning `newFindings`, `resolvedFindings`,
  `unchangedFindings`, and `changedFindings` (severity moved). It compares
  normalized data, never rendered output.
- `buildFileTree(manifest)` / `visibleTreeNodes` — a deterministic directory tree
  from a flat file manifest, with the same path rules `WorkspaceReader` enforces.
- `sanitizeDisplayText` / `buildTextFilePreview` — decode file bytes for display,
  neutralize terminal escape sequences and control characters, and apply documented
  size thresholds.

### The `@agentforge/validation/browser` entry point

The main entry reaches Node built-ins (`node:zlib`, `node:fs`, `node:crypto`),
because the pipeline runs on a server. `@agentforge/validation/browser` re-exports only
the modules that do not — the tree builder, the display-text helpers, the path
rules, task slugs, and run comparison. Client components import that entry;
`architecture.test.ts` walks the browser entry's import graph and fails if a
`node:` import ever becomes reachable from it.

## Policy layer

Findings are evidence; policy decides the verdict. `findings.length > 0` is never
a failure condition.

| Policy    | Fails on            | Warns on           |
| --------- | ------------------- | ------------------ |
| `strict`  | `critical`, `error` | `warning`          |
| `lenient` | `critical`          | `error`, `warning` |

`strictMode: true` is a policy modifier that adds `warning` to the failing set. It
does not change any finding's severity.

A run with validator execution errors can never report `pass`: the evidence is
incomplete, so the best available outcome is `warn`.

Room to grow: add a policy id plus fields on `ValidationPolicy` (thresholds,
scores, per-category rules). Validators stay untouched.

## Error isolation

Each validator runs inside its own `try`/`catch`. A throw becomes a
`ValidatorExecutionError` (validator id, version, task root, message) — never a
finding, since a crash is the absence of evidence, not evidence. Structured
diagnostics go to the injected `DiagnosticsSink`; the pipeline never writes to the
console and never puts a stack trace in a report. The web app maps job failures to
`ValidationJobError` with a user-safe message plus a correlation id for operators.

## ValidationReport

`benchmark`, `benchmarkVersion`, `artifact` (hash + size), `detection`, `tasks`,
`outcome`, `policy`, `summary` (`total`, `critical`, `error`, `warning`, `info`),
`findings`, `validators` (ids, names, versions), `validatorErrors`, `durationMs`,
`configuration`. There is no synthetic "AI quality score".

`ValidationReport.outcome` is the policy verdict. `validation_runs.status` remains
the job lifecycle (`queued`/`running`/`succeeded`/`failed`/`cancelled`). A package
that fails validation still produces a `succeeded` run: the job did its work.

## Persistence

`validation_runs` records the benchmark and adapter version, task version (only
when the package holds exactly one task), artifact content hash, policy, outcome,
severity counts, validator descriptors, validator error count, duration, and the
full validation configuration. `validation_findings` records code, category,
severity, title, message, evidence (path, line, field path, excerpt), remediation,
validator id, fingerprint, and ordinal.

Guarantees: RLS keeps everything org-scoped; the pinned artifact and its recorded
digest are immutable and must agree; findings are unique per `(run, ordinal)`. No
personal data beyond the existing actor references, and no package contents leave
the deployment.

## Security boundaries

- Control plane inspects; the execution plane (future) runs. Nothing from a package
  is executed, built, installed, or fetched here.
- Archive inspection reads the central directory before writing anything, rejecting
  traversal, absolute paths, backslash separators, symlinks, encryption, Zip64,
  data descriptors, unexpected compression, oversized entries, excessive entry
  counts, and suspicious compression ratios.
- Extraction targets a fresh temp directory removed in a `finally` block.
- Uploaded strings are never compiled into regular expressions.
- `architecture.test.ts` fails the build if the package gains a reference to
  `child_process`, sockets, `fetch`, `eval`, a model provider, Supabase, or React.

## Adding another benchmark

1. Implement `BenchmarkAdapter` (`detect`, `discoverTasks`, `parseTask`,
   `validators`) in `@agentforge/validation`.
2. Register the adapter in `createDefaultBenchmarkAdapterRegistry`.
3. Leave `validation_runs`, `validation_findings`, and the report UI unchanged.
   Do not add `x_task_id` columns.

Detection picks the highest-confidence match. An unrecognized package reports
`BENCHMARK_UNDETECTED` instead of crashing ingest.

## How a future AI review connects

`ReviewProvider.review({ report })` and `AnalysisProvider.analyze({ configuration, report })`
take the finished deterministic report. A reviewer can therefore only ever be
additive: it comments on findings, it does not produce them, and it cannot change
an outcome computed by the policy layer. Any such feature needs explicit consent
before package contents leave the deployment.

## Phase 2–6 evolution

- **Phase 2 (auth/orgs/projects):** validation rows inherit project RLS. Nothing
  in the pipeline knows about tenancy, so tenancy changes do not touch validators.
- **Phase 3 (evaluation runs, CI triggers):** `runValidationPipeline` is an async
  function with injectable clock and diagnostics and no React, database, or session
  dependency, so a queue worker or CI job can call it after `ArtifactStore.get` and
  gate on `outcome`. `evaluation_runs` stays separate (ADR-013). The persistence
  half still lives in `apps/web`; moving a job to a worker means extracting those
  writes into a shared module, not changing the pipeline.
- **Phase 4 (review/collaboration):** stable fingerprints make run-to-run diffing
  and finding-level discussion possible without schema changes.
- **Phase 5 (scale/ops):** limits are named constants, diagnostics are injected, and
  the report is serializable, so hosted runners and observability drop in.
- **Phase 6 (ecosystem):** more adapters register more validators; the core schema
  and report shape stay benchmark-agnostic.
