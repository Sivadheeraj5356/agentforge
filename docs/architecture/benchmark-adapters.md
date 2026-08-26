# Benchmark adapters

External formats must not leak into core domain code. Adapters translate at the boundary.

## Interface (`@agentforge/contracts`)

`BenchmarkAdapter`:

- `detect(workspace)` — confidence score for this format
- `discoverTasks(workspace)` — one discovery pass, task roots only
- `parseTask(workspace, task)` — one parse phase per task, returns a `TaskDefinition` plus the parsed `TaskDocument`
- `validators()` — the adapter's typed `ValidatorRegistry`

Adapters **do not** run validators. The pipeline owns validator execution, error
isolation, normalization, and the pass/fail policy, so every benchmark gets the
same guarantees. See [validation pipeline](validation-pipeline.md).

Adapters **must not** do auth, DB transactions, org authorization, UI, billing,
model APIs, or generic storage.

## Registry (`@agentforge/validation`)

`createDefaultBenchmarkAdapterRegistry()` registers `TerminalBenchAdapter` (`terminal-bench`) then `TerminusAdapter` (`terminus`). Detection selects the highest-confidence match. TB2 markers (`run-tests.sh`, `tests/test_outputs.py`, compose files) raise Terminal Bench confidence above a plain Terminus pack.

## Terminus / Terminal Bench (implemented)

Inspected conventions (Harbor task format used by Terminal Bench 3, plus classic `task.yaml`):

```
instruction.md
task.toml          # or task.yaml
environment/Dockerfile
solution/solve.sh  # not executed
tests/test.sh      # not executed
```

Classic Terminal Bench `task.yaml` + root Dockerfile / `run-tests.sh` / `tests/test_outputs.py` is also detected. Multi-task packages under `tasks/<name>/` are discovered per task. Packages are not assumed identical; validators emit findings per missing or malformed piece.

`TerminusAdapter` registers nine validators: task structure, metadata,
instruction, environment, verifier, test, documentation, security, and
reproducibility.

## Planned later

| Adapter id   | Format            | Notes                     |
| ------------ | ----------------- | ------------------------- |
| `harbor`     | Harbor-only packs | May share Terminus layout |
| `custom-zip` | Opinionated ZIP   | Future convenience format |

## Rules

- Parsing happens after safe ZIP inspection and extract-to-temp.
- Adapters read the workspace only through `WorkspaceReader`.
- Adapters never invoke sandboxes. `SandboxProvider` stays in the execution plane.
- Deterministic validators do not call `ReviewProvider` / `AnalysisProvider` (interfaces only).
- Adapter output is versioned (`TerminusAdapter.version`), and each validator carries its own version.
