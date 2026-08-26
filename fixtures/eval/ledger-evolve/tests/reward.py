"""Grader for ledger-evolve. Runs in the grader container."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from fastapi.testclient import TestClient

HIDDEN_TESTS = Path("/hidden/tests/test_ledger.py")
AGENT_WORKSPACE = Path("/workspace")
FORBIDDEN_PREFIXES = ("/hidden", "/grader", "/private")


def _health() -> float:
    try:
        from app.main import app

        client = TestClient(app)
        response = client.get("/health")
        return 1.0 if response.status_code == 200 and response.json().get("status") == "ok" else 0.0
    except Exception:
        return 0.0


def _idempotent() -> float:
    try:
        from app.main import app

        client = TestClient(app)
        first = client.post("/entries", json={"amount": 3.0, "client_key": "grade-k"})
        second = client.post("/entries", json={"amount": 8.0, "client_key": "grade-k"})
        if first.status_code != 200 or second.status_code != 200:
            return 0.0
        if first.json().get("id") != second.json().get("id"):
            return 0.0
        listed = client.get("/entries").json()["entries"]
        matching = [row for row in listed if row.get("client_key") == "grade-k"]
        return 1.0 if len(matching) == 1 else 0.0
    except Exception:
        return 0.0


def _migrated() -> float:
    try:
        from app.main import app

        client = TestClient(app)
        listed = client.get("/entries").json()["entries"]
        keys = {row.get("client_key") for row in listed}
        return 1.0 if "legacy-1" in keys and "legacy-2" in keys else 0.0
    except Exception:
        return 0.0


def _cli() -> float:
    try:
        completed = subprocess.run(
            ["python", "-m", "app.cli"],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=15,
        )
        out = completed.stdout
        if "id,amount,client_key" not in out:
            return 0.0
        if "legacy-1" not in out or "legacy-2" not in out:
            return 0.0
        return 1.0
    except Exception:
        return 0.0


def _diff() -> float:
    if not HIDDEN_TESTS.is_file():
        return 0.0
    if not AGENT_WORKSPACE.exists():
        return 1.0
    for path in AGENT_WORKSPACE.rglob("*"):
        try:
            resolved = str(path.resolve())
        except OSError:
            return 0.0
        if any(resolved.startswith(prefix) for prefix in FORBIDDEN_PREFIXES):
            return 0.0
    return 1.0


def grade() -> dict[str, float]:
    idempotent = _idempotent()
    migrated = _migrated()
    cli = _cli()
    health = _health()
    diff = _diff()
    reward = round(0.35 * idempotent + 0.25 * migrated + 0.2 * cli + 0.1 * health + 0.1 * diff, 4)
    return {
        "reward": reward,
        "idempotent_post": idempotent,
        "rows_migrated": migrated,
        "cli_updated": cli,
        "service_health": health,
        "diff_quality": diff,
        "critical_tests": idempotent,
        "api_contract": migrated,
    }


if __name__ == "__main__":
    result = grade()
    print(json.dumps(result))
    out = Path(os.environ.get("REWARD_PATH", "/tmp/reward.json"))
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result), encoding="utf-8")
    except OSError:
        pass
