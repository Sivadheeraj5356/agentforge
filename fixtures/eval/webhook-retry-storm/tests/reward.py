"""Grader for webhook-retry-storm."""

from __future__ import annotations

import json
import os
from pathlib import Path

HIDDEN_TESTS = Path("/hidden/tests/test_webhooks.py")
AGENT_WORKSPACE = Path("/workspace")
FORBIDDEN_PREFIXES = ("/hidden", "/grader", "/private")


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


def _idempotent() -> float:
    try:
        from app.webhooks import ingest

        state: dict[str, object] = {}
        ingest("d-1", 4.0, state)
        ingest("d-1", 4.0, state)
        ingest("d-2", 1.0, state)
        applied = state.get("applied")
        return 1.0 if applied == [4.0, 1.0] else 0.0
    except Exception:
        return 0.0


def grade() -> dict[str, float]:
    idempotent = _idempotent()
    diff = _diff()
    reward = round(0.85 * idempotent + 0.15 * diff, 4)
    return {
        "reward": reward,
        "critical_tests": idempotent,
        "api_contract": idempotent,
        "diff_quality": diff,
        "service_health": idempotent,
        "regression_tests": idempotent,
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
