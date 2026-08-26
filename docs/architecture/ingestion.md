# Ingestion and structural validation

Control-plane pipeline for task packages. Never executes user-supplied code.

```
Upload ZIP
  → size / magic-byte check
  → SHA-256
  → ArtifactStore.put (bytes)
  → artifacts row (hash, size, storage_key only)
  → submissions row (uploaded_archive)
  → validation_runs (running)
  → runValidationPipeline (see validation-pipeline.md)
  → validation_findings (ordered, fingerprinted)
  → complete run (status succeeded, outcome pass/warn/fail)
```

`executeValidationJob` in `apps/web` is the queueable unit. `runValidationPipeline`
in `@agentforge/validation` is the reusable core: async, deterministic, with an
injectable clock and diagnostics sink, and no React, database, or session
dependency. A future worker can `ArtifactStore.get` and call the same function.
No Redis/Kafka in this chunk.

## ArtifactStore

- Interface in `@agentforge/contracts`
- Local/dev adapter: filesystem under `.data/untrusted-ingest` (override `VORTEX_ARTIFACT_STORE_DIR`)
- Outside `apps/web` / web root
- Postgres never stores ZIP blobs
- R2 can replace the adapter later (ADR-004)

## Limits (named constants)

See `@agentforge/validation` `limits.ts`:

- `MAX_UPLOAD_ARCHIVE_BYTES` = 32 MiB
- `MAX_EXTRACTED_ARCHIVE_BYTES` = 128 MiB
- `MAX_ARCHIVE_FILE_COUNT` = 2048
- `MAX_SINGLE_EXTRACTED_FILE_BYTES` = 16 MiB
- `MAX_COMPRESSION_RATIO` = 100
- `MAX_ARCHIVE_PATH_LENGTH` = 240
- `MAX_WORKSPACE_PATH_LENGTH` = 1024
- `MAX_TEXT_FILE_BYTES` = 256 KiB
- `MAX_FINDINGS_PER_RUN` = 500

Rejected: path traversal, absolute paths, backslash separators, symlinks, encryption, Zip64, data descriptors, unexpected compression.

The trusted app does not use the host Docker socket.

## Run status vs outcome

`validation_runs.status` is the job lifecycle. `validation_runs.outcome` is the
policy verdict (`pass` / `warn` / `fail`). A package full of errors still produces
a `succeeded` run — the job completed and reported. `status = failed` means the job
itself could not finish, and the stored `error_message` is a user-safe sentence with
a correlation id, never internal detail. See [ADR-015](decisions/ADR-015-validation-policy-and-validator-versioning.md).

## ValidationRun vs EvaluationRun

See [ADR-013](decisions/ADR-013-validation-run-vs-evaluation-run.md).

## How to add Benchmark X

1. Implement `BenchmarkAdapter` in `@agentforge/validation`
2. Register it in `createDefaultBenchmarkAdapterRegistry`
3. Keep `validation_runs` and the report UI unchanged
4. Do not add `x_task_id` columns to Postgres
