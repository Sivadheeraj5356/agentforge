from fastapi import FastAPI

app = FastAPI()
ORDERS = [{"id": 1, "total": 1.0}]


@app.get("/orders")
def list_orders() -> dict[str, object]:
    return {"orders": ORDERS}
