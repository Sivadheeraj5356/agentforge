"""Unfiltered list works; ?status=open raises."""

from fastapi import FastAPI

app = FastAPI()
ORDERS = [{"id": 1, "total": 10.0, "status": "open"}]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/orders")
def list_orders(status: str | None = None) -> dict[str, object]:
    if status is not None:
        raise RuntimeError("filter not implemented")
    return {"orders": [{"id": row["id"], "total": row["total"]} for row in ORDERS]}
