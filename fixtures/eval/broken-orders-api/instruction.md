The `/orders` endpoint intermittently returns 500 errors. Diagnose the issue and fix it without changing the API contract.

The service is FastAPI in front of Postgres (Harbor compose). Do not change the response schema of `GET /orders`. Do not delete or rewrite tests. Keep `/health` healthy.
