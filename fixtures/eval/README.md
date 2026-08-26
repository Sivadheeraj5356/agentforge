# Original Vortex evaluation fixtures (not Terminal Bench).

#

# Import into the catalog with:

# python -m evaluator import-tasks --root fixtures/eval

# python -m evaluator import-tasks --root fixtures/eval --write

#

# Shared hidden grader lives in `_shared/tests` (not a task).

# Terminal Bench 2 / Dropbox dumps belong in a gitignored directory:

# TB_FIXTURES_DIR=.data/benchmarks/terminal-bench-2

# python -m evaluator import-tasks --root .data/benchmarks/terminal-bench-2 --benchmark terminal-bench --version 2.0.0 --write

#

# Do not commit licensed third-party task dumps.

broken-orders-api
broken-orders-filter
healthcheck-missing
contract-extra-field
silent-wrong-total
empty-orders-crash
forbidden-test-rewrite
stale-health-payload
ledger-evolve
spec-to-kit
refund-double-apply
timezone-cutoff-orders
webhook-retry-storm
migration-partial-rows
cli-flag-drift
