"""Hidden ledger evolution tests. Grader container only."""

import subprocess
import sys

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_idempotent_post() -> None:
    first = client.post("/entries", json={"amount": 3.0, "client_key": "k-1"})
    second = client.post("/entries", json={"amount": 9.0, "client_key": "k-1"})
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    listed = client.get("/entries").json()["entries"]
    matching = [row for row in listed if row.get("client_key") == "k-1"]
    assert len(matching) == 1


def test_legacy_rows_migrated() -> None:
    listed = client.get("/entries").json()["entries"]
    keys = {row.get("client_key") for row in listed}
    assert "legacy-1" in keys
    assert "legacy-2" in keys


def test_cli_prints_client_keys() -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "app.cli"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=15,
    )
    assert completed.returncode == 0
    assert "id,amount,client_key" in completed.stdout
    assert "legacy-1" in completed.stdout
    assert "legacy-2" in completed.stdout
