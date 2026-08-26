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
    if payload["orders"]:
        assert set(payload["orders"][0].keys()) == {"id", "total"}
        assert float(payload["orders"][0]["total"]) > 0
