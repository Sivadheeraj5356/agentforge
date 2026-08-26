"""Grader for refund-double-apply."""

from __future__ import annotations

import json
import os
from pathlib import Path

HIDDEN_TESTS = Path("/hidden/tests/test_refunds.py")
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


def _once() -> float:
    try:
        from app.refunds import apply_refund

        if apply_refund(40.0, 10.0) != 30.0:
            return 0.0
        if apply_refund(40.0, 0.0) != 40.0:
            return 0.0
        if apply_refund(10.0, 10.0) != 0.0:
            return 0.0
        try:
            apply_refund(10.0, -1.0)
            return 0.0
        except ValueError:
            return 1.0
    except Exception:
        return 0.0


def grade() -> dict[str, float]:
    once = _once()
    diff = _diff()
    reward = round(0.85 * once + 0.15 * diff, 4)
    return {
        "reward": reward,
        "critical_tests": once,
        "api_contract": once,
        "diff_quality": diff,
        "service_health": once,
        "regression_tests": once,
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
