"""Grader for migration-partial-rows."""

from __future__ import annotations

import json
import os
from pathlib import Path

HIDDEN_TESTS = Path("/hidden/tests/test_migrate.py")
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


def _migrated() -> float:
    try:
        from app.migrate import migrate

        if migrate([]) != []:
            return 0.0
        out = migrate(
            [
                {"id": "1", "status": "legacy"},
                {"id": "2", "status": "legacy"},
                {"id": "3", "status": "ok"},
            ]
        )
        if [row["id"] for row in out] != ["1", "2", "3"]:
            return 0.0
        if [row["status"] for row in out] != ["migrated", "migrated", "ok"]:
            return 0.0
        return 1.0
    except Exception:
        return 0.0


def grade() -> dict[str, float]:
    migrated = _migrated()
    diff = _diff()
    reward = round(0.85 * migrated + 0.15 * diff, 4)
    return {
        "reward": reward,
        "critical_tests": migrated,
        "api_contract": migrated,
        "diff_quality": diff,
        "service_health": migrated,
        "regression_tests": migrated,
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
