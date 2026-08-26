from fastapi import FastAPI

app = FastAPI()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "degraded"}


@app.get("/orders")
def list_orders() -> dict[str, object]:
    return {"orders": [{"id": 1, "total": 1.0}]}
