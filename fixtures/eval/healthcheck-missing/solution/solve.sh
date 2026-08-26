#!/bin/sh
set -eu
python - <<'PY'
from pathlib import Path
Path("/workspace/app/main.py").write_text(
    '''from fastapi import FastAPI

app = FastAPI()
ORDERS = [{"id": 1, "total": 1.0}]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/orders")
def list_orders() -> dict[str, object]:
    return {"orders": ORDERS}
''',
    encoding="utf-8",
)
PY
