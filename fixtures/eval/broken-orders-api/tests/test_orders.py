from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_orders_ok() -> None:
    response = client.get("/orders")
    assert response.status_code == 200
    payload = response.json()
    assert "orders" in payload
    assert isinstance(payload["orders"], list)
    assert "debug" not in payload
    assert len(payload["orders"]) == 3
    assert set(payload["orders"][0].keys()) == {"id", "total"}
    totals = sorted(float(row["total"]) for row in payload["orders"])
    assert totals == [4.5, 7.25, 10.0]
