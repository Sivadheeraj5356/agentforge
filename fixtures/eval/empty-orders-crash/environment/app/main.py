from fastapi import FastAPI

app = FastAPI()
ORDERS: list[dict[str, object]] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/orders")
def list_orders() -> dict[str, object]:
    return {"orders": ORDERS[0]}
