"""Grader for timezone-cutoff-orders."""

from __future__ import annotations

import json
import os
from pathlib import Path

HIDDEN_TESTS = Path("/hidden/tests/test_cutoff.py")
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


def _cutoff() -> float:
    try:
        from app.cutoff import business_date

        if business_date("2026-08-25T10:00:00Z") != "2026-08-25":
            return 0.0
        if business_date("2026-08-25T18:00:00Z") != "2026-08-26":
            return 0.0
        if business_date("2026-08-25T16:00:00+05:30") != "2026-08-25":
            return 0.0
        return 1.0
    except Exception:
        return 0.0


def grade() -> dict[str, float]:
    cutoff = _cutoff()
    diff = _diff()
    reward = round(0.85 * cutoff + 0.15 * diff, 4)
    return {
        "reward": reward,
        "critical_tests": cutoff,
        "api_contract": cutoff,
        "diff_quality": diff,
        "service_health": cutoff,
        "regression_tests": cutoff,
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
