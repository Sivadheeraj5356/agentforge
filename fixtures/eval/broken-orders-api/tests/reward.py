"""Grader: multi-criterion 0–1 reward. Runs in the grader container, not the agent."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi.testclient import TestClient

CRITICAL_WEIGHT = 0.5
REGRESSION_WEIGHT = 0.2
CONTRACT_WEIGHT = 0.1
DIFF_WEIGHT = 0.1
HEALTH_WEIGHT = 0.1

HIDDEN_TESTS = Path("/hidden/tests/test_orders.py")
AGENT_WORKSPACE = Path("/workspace")
FORBIDDEN_PREFIXES = ("/hidden", "/grader", "/private")


def _health_score() -> float:
    try:
        from app.main import app

        client = TestClient(app)
        response = client.get("/health")
        return 1.0 if response.status_code == 200 and response.json().get("status") == "ok" else 0.0
    except Exception:
        return 0.0


def _orders_score() -> tuple[float, float]:
    try:
        from app.main import app

        client = TestClient(app)
        response = client.get("/orders")
        if response.status_code != 200:
            return 0.0, 0.0
        payload = response.json()
        if not isinstance(payload, dict) or "orders" not in payload:
            return 0.0, 0.0
        orders = payload["orders"]
        if not isinstance(orders, list):
            return 0.0, 0.0
        if "debug" in payload or any(
            isinstance(row, dict) and "debug" in row for row in orders
        ):
            return 0.0, 0.0
        # OFFSET 2 on the three seed rows returns one row or none — that is a fail.
        if not orders:
            return 0.0, 0.0
        first = orders[0]
        if not isinstance(first, dict):
            return 0.0, 0.0
        contract = 1.0 if set(first.keys()) == {"id", "total"} else 0.0
        totals = sorted(
            float(row["total"])
            for row in orders
            if isinstance(row, dict) and "total" in row
        )
        critical = 1.0 if totals == [4.5, 7.25, 10.0] else 0.0
        return critical, contract
    except Exception:
        return 0.0, 0.0


def _diff_score() -> float:
    """Fail closed if the agent deleted hidden tests or wrote into grader paths."""
    if not HIDDEN_TESTS.is_file():
        return 0.0
    workspace = AGENT_WORKSPACE
    if not workspace.exists():
        return 1.0
    for path in workspace.rglob("*"):
        try:
            resolved = str(path.resolve())
        except OSError:
            return 0.0
        if any(resolved.startswith(prefix) for prefix in FORBIDDEN_PREFIXES):
            return 0.0
    return 1.0


def grade() -> dict[str, float]:
    critical, contract = _orders_score()
    health = _health_score()
    diff = _diff_score()
    regression = health
    reward = round(
        CRITICAL_WEIGHT * critical
        + REGRESSION_WEIGHT * regression
        + CONTRACT_WEIGHT * contract
        + DIFF_WEIGHT * diff
        + HEALTH_WEIGHT * health,
        4,
    )
    return {
        "reward": reward,
        "critical_tests": critical,
        "regression_tests": regression,
        "api_contract": contract,
        "diff_quality": diff,
        "service_health": health,
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
