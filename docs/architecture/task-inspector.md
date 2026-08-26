# Task inspector

A read-only review surface for a validated task package: the files on the left, one
file in the middle, the validation report on the right. Its job is to make a
finding checkable — a reviewer should be able to go from "the verifier
configuration references a missing file" to the line that says so in two clicks.

Nothing here executes, builds, installs, or fetches anything from a package, and
nothing here sends package contents to a model provider.

## Routes

| Route                                                               | Shows                                             |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `…/projects/[projectSlug]/tasks`                                    | Tasks this project has validated                  |
| `…/projects/[projectSlug]/tasks/[taskSlug]`                         | The task at its most recent run                   |
| `…/projects/[projectSlug]/tasks/[taskSlug]/runs/[runId]`            | The task at one historical run                    |
| `…/projects/[projectSlug]/tasks/[taskSlug]/runs/compare?from=&to=`  | Fingerprint diff between two runs                 |
| `…/projects/[projectSlug]/tasks/[taskSlug]/runs/[runId]/file?path=` | One file's contents (JSON), the only content path |

`[runId]` carries the **per-project run number**, not the row's UUID. Runs are
cited the way a reviewer says them out loud ("run 3"), and the internal identifier
never appears in a URL.

## Where a task comes from

There is no task catalog to curate. A task exists because a validated package
contained one.

At ingest, `executeValidationJob` records, alongside the report:

- `validation_run_tasks` — one row per task the adapter discovered: ordinal, slug,
  external key, root path, name, declared version.
- `validation_run_files` — the file manifest of the pinned artifact, read from the
  archive's central directory.

Both are per run and immutable. Re-validating the same package writes new rows; it
never edits old ones. The slug comes from `taskSlugFromExternalKey` /
`assignTaskSlugs` in `@agentforge/validation`, so the same package always produces the
same URL, and two tasks that slugify identically get a deterministic suffix.

`validation_runs.run_number` is assigned by a `BEFORE INSERT` trigger that takes a
per-project advisory lock, so concurrent ingests cannot collide. It is immutable
once assigned.

## Server / client boundary

Loaded on the server, once, per request:

- organization → project → task → run resolution, all through RLS
- findings (in the persisted deterministic `ordinal` order)
- provenance and validator descriptors
- the file manifest, and the tree built from it
- run history for the task

Client-side, and nothing more:

- filters, in-panel search, finding selection and expansion
- file selection, in-file search, line selection
- pane collapse and the file-tree resizer
- fetching the body of the one file that is currently open

`loadProjectRunIndex` reads a project's newest `MAX_INDEXED_RUNS` (200) runs plus
their task rows in two queries, wrapped in React `cache`, so the header, the
history table, and the task resolver share one read.

## File contents

See [ADR-016](decisions/ADR-016-task-file-access.md) for the decision and its
reasoning. The short version:

1. Authenticate. Unauthenticated → 401, `no-store`.
2. Resolve organization → project → task → run through RLS. Any miss → 404,
   `no-store`. A cross-tenant resource is indistinguishable from a missing one.
3. Validate the requested path's shape, then normalize it with
   `normalizeWorkspacePath`, which refuses `..`, absolute paths, drive letters, UNC
   prefixes, and NUL bytes rather than resolving them.
4. Require the normalized path to be in this run's manifest **and** inside this
   task's scope (its own root, plus files outside every task root).
5. Only now read an object key — from the `artifacts` row the run pins, never from
   the request — and pull the single ZIP entry with `readZipEntry`.
6. Decode, size-classify, and sanitize. Respond with JSON lines and, for a
   completed run, `private, max-age=3600, immutable`.

### Text is text

`sanitizeDisplayText` replaces ANSI escape sequences (CSI and OSC), C0/C1 control
characters, DEL, and bidirectional overrides with U+FFFD. Removal is visible on
purpose: silently dropping bytes would misreport the evidence. Angle brackets,
quotes, and backticks survive untouched, because they are content — the viewer puts
them in text nodes and there is no `dangerouslySetInnerHTML` anywhere in the module
(a unit test enforces that).

### Large files

| Size                | Mode       | Behaviour                             |
| ------------------- | ---------- | ------------------------------------- |
| ≤ 256 KB            | `full`     | Whole file rendered                   |
| > 256 KB and ≤ 2 MB | `preview`  | First 2000 lines, labelled as partial |
| > 2 MB              | `metadata` | Never decoded; size and path only     |
| any, not UTF-8      | `binary`   | Never rendered                        |

Single lines are cut at 2000 characters with a marker. The oversize case is decided
from the byte length _before_ decoding, so a hostile entry cannot cost a
multi-megabyte string on the server.

### Stale responses

Each file request carries a sequence number and an `AbortController`. Moving the
selection aborts the in-flight request and bumps the sequence, so a slow response
for file A can never overwrite the currently selected file B.

## Report projection

`modules/tasks/model.ts` turns database rows into the view model and is the only
place that reads jsonb columns. It is pure and unit-tested, so a future API or CI
surface can reuse the same projection.

- Unknown severities and categories degrade to the least specific value rather than
  hiding evidence.
- Malformed `evidence` yields "no location". A line number is never invented.
- `validators` is parsed defensively; a descriptor written by another build is
  skipped, not fatal.
- Findings carry a `status`, always `open`. The four-state model
  (`open`/`acknowledged`/`resolved`/`dismissed`) exists so a later collaborative
  review can record a decision without a schema change. Nothing writes the other
  states.

There is no quality score. The report shows what was checked, what was found, and
what was not checked.

## Finding navigation

`modules/tasks/navigation.ts` holds a typed reducer. Every jump is a state
transition — nothing queries the DOM to decide what to show.

Opening a finding produces one action carrying the finding id, its file, its line,
and the directories to expand. The reducer selects the file, expands the tree path,
marks the finding active, and increments `revealToken`; the viewer scrolls when that
token changes, which is why re-opening the same finding scrolls again.

Findings that share a file and line are all reachable:
`findingLinesForFile` groups them into a list per line and the viewer renders "3
findings at this location" with each one clickable. A later finding never
overwrites an earlier one at the same anchor. Findings that name a file but no line
are shown separately as file-level findings.

Filters, the current file, and the current line live in the URL so a report link is
shareable, and are written with `window.history.replaceState` — a history update,
not a route change, so changing a filter does not re-run the server render. There
is no `window.location.reload()` anywhere in the module.

## Run comparison

`compareValidationRuns(previous, current)` lives in `@agentforge/validation` and knows
nothing about React, the database, or the URL. It matches findings by the
`fingerprint` Chunk 6 already persists — the SHA-256 of code, validator, path,
line, and field path — and returns four buckets:

- `newFindings` — in the current run only
- `resolvedFindings` — in the previous run only
- `unchangedFindings` — same fingerprint, same severity
- `changedFindings` — same fingerprint, different severity

Because it compares normalized data, a re-ordered report reads as unchanged and the
same code at a different location reads as one resolved plus one new. `severityDrift`
labels a change `worse` or `better`. A CI gate or an analytics job can call the same
function on the same rows.

## Provenance

The provenance panel answers "what exactly was checked, and against what": benchmark
and version, artifact name, full SHA-256, byte size, policy, the validator set,
start and completion timestamps, duration — and `Execution: Not performed`.

The Checks disclosure lists each validator with its version and finding count, and
separates two things that look alike in a summary:

- a check that ran and found nothing, and
- a check that **failed to run**, which produced no evidence at all.

`EXECUTION_DISCLOSURE` is a single constant so every surface says the same sentence:
functional execution is not part of a validation run.

## UI architecture

Desktop is three panes with independent scrolling and sticky headers. Below `md`
the panes collapse to one with a Files / File / Findings tab bar; from `md` up the
tree is collapsible and resizable (pointer drag or arrow keys on a
`role="separator"` handle).

Accessibility notes worth keeping:

- The tree follows the ARIA tree pattern: one tab stop, arrows to move, Right to
  open, Left to close or step to the parent, Enter/Space to activate.
- Severity is never colour alone — every appearance is icon plus word plus tone, and
  `critical` and `error` use different shapes because they share the danger colour.
- Focus styling is left to the global `:focus-visible` outline in
  `@agentforge/ui/globals.css`. The module adds no ring utilities, because a local ring
  overrides the token-based outline.
- Motion is limited to disclosure and chevron transitions and is disabled under
  `prefers-reduced-motion`. Playwright runs the inspector with reduced motion.

## Extension points

These are deliberately reachable without redesigning anything:

- **AI review.** `ReviewProvider.review({ report })` consumes the finished
  deterministic report. Review output would be a second source of findings rendered
  alongside these, distinguished by source. The finding status model is already
  four-state.
- **Agent results and trajectories.** They attach to `evaluation_runs`, which stays
  separate from `validation_runs` (ADR-013). A trajectory pane is a fourth pane or a
  tab in the right panel; nothing in the file access path changes, because a
  trajectory is not a package file.
- **CI status.** `compareValidationRuns` plus `outcome` are enough for a gate. CI
  needs no UI code.
- **Private tenant tasks.** Everything here is already org-scoped through RLS and
  answers 404 across tenants. A stricter visibility rule is a policy change on the
  existing tables.
- **Dataset provenance.** `validation_run_tasks` is per run and immutable, so
  attaching a source (upload, git commit, generated) is a column, not a redesign.
- **Remote artifact storage.** `ArtifactStore` is already the boundary. Moving to R2
  means a different implementation plus a byte cache in front of the file route.
