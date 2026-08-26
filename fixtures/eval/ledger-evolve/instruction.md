Evolve this ledger from v1 to the v2 contract in SPEC terms:

1. `POST /entries` must be idempotent when `client_key` is supplied. Repeating the same key returns the original row, not a duplicate.
2. Existing rows that have no `client_key` must be migrated to stable keys `legacy-1`, `legacy-2`, … in id order.
3. `python -m app.cli` must print `id,amount,client_key` for every row (not the v1 `legacy` dump).

Do not rewrite hidden tests. Do not change `GET /health`.
