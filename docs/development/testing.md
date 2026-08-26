# Testing

## Unit (Vitest)

- Packages and `apps/web` use Vitest
- Run all: `pnpm test`
- Place tests next to sources as `*.test.ts`
- Chunk 2 covers redirect safety, slug validation, and auth error mapping
- Chunk 5 covers adapter detection, ZIP safety, finding codes, and artifact storage keys
- Chunk 6 covers every validator, finding creation, severity aggregation,
  normalization, deterministic ordering, the policy layer, and workspace path safety
- Chunk 7 covers run comparison and fingerprint stability, file-tree construction,
  display-text sanitization and large-file thresholds, task slugs, the report
  projection, finding filtering and search, inspector navigation state (including
  several findings at one location), the file-read authorization gate against
  hostile paths, and source-level guards for the module (no markup rendering, no
  storage credentials, no server entry point in a client component, exactly one
  file-content route)
- Chunk 8–11 covers evaluator rewards/pass@k/isolation, enqueue split, and training dry-run plans

Python (not in Turborepo):

```bash
cd services/evaluator
pip install -e ".[dev]"
python -m pytest
cd ..\training
pip install -e ".[dev]"
python -m pytest
```

### Validation fixtures and golden reports

`packages/validation/src/fixtures` holds six minimal packages (`valid`,
`missing-metadata`, `invalid-structure`, `invalid-environment`, `invalid-verifier`,
`security-invalid`) with their expected outcome and finding codes in `expected.ts`.
Fixture files are inert data: nothing in them is executed, built, or installed.

Full reports are pinned as golden JSON in
`packages/validation/src/pipeline/goldens/`. The archive digest, byte size, and
duration are replaced with sentinels; ordering, ordinals, fingerprints, categories,
and evidence are compared exactly. Regenerate intentionally:

```powershell
$env:VORTEX_UPDATE_GOLDENS=1; pnpm --filter @agentforge/validation test; Remove-Item Env:\VORTEX_UPDATE_GOLDENS
```

`packages/validation/src/architecture.test.ts` fails if the package gains a
reference to process spawning, sockets, `fetch`, `eval`, a model provider,
Supabase, or React.

## Database (pgTAP)

- Tests live in `supabase/tests/database`
- Requires local Supabase: `pnpm db:start && pnpm db:reset`
- Run: `pnpm db:test`
- Covers RLS enablement, indexes, profile trigger, bootstrap idempotency, cross-tenant isolation
- Chunk 3 adds project role/archive/slug uniqueness/created_by spoof/no-DELETE coverage
- Chunk 4 adds catalog/tenant RLS, pin consistency, hash/version constraints, audit isolation
- Chunk 8–11 adds evaluation job claim (service_role only), cancel-only run updates, trial insert denial, training experiment tenancy
- Chunk 6 adds report columns, category/fingerprint/ordinal constraints, artifact-hash
  consistency and immutability, and outcome-before-completion rejection
- Chunk 7 adds per-project run numbering (sequential, restarting per project,
  immutable), task/manifest RLS isolation, path-shape constraints on the manifest,
  task slug format, detail-row immutability, and no-DELETE coverage
- Chunk 8–11 adds evaluation job claim (service_role only), cancel-only run updates,
  trial insert denial, and training experiment tenancy

## E2E (Playwright)

- Smoke/auth/project tests live in `apps/web/e2e`
- Requires local Supabase and `apps/web/.env.local`
- Run: `pnpm test:e2e`
- Includes anonymous redirect, auth form validation, authenticated shell fixture, cross-tenant denial
- Chunk 3: empty→create→list→open→settings→archive→filter→restore plus cross-tenant project denial
- Chunk 5: upload ZIP → validation report; existing project flow keeps Add task enabled for owners
- Chunk 6: complete package → "No validation issues found."; malformed package → findings
  with code, category, evidence path and line, expandable detail, and severity filtering
- Chunk 7 (`task-inspector.spec.ts`, reduced motion): project → task, tree renders,
  file selection loads the viewer, findings appear, filter and search stay in the
  URL, clicking a finding jumps to its evidence line, keyboard-only tree
  navigation, second run → history and comparison, dark mode, another
  organization's task and file route answer 404, tampered paths are refused
- Chunk 8–11 (`evaluations.spec.ts`, `domain-shell.spec.ts`): catalog lists
  vortex-internal / terminal-bench; enqueue oracle shows project run number, not a
  fake leaderboard percentage

## CI

- `quality` job: format, lint, typecheck, unit, build, Python evaluator/training pytest
- `database` job: start Supabase, reset, lint, pgTAP, generated types drift check

## Definition of done

Do not claim a change is done without running the relevant suite. Auth/UI/project changes should include Playwright when practical.
