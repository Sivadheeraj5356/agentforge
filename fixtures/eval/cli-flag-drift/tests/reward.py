"""Grader for cli-flag-drift."""

from __future__ import annotations

import json
import os
from pathlib import Path

HIDDEN_TESTS = Path("/hidden/tests/test_cli.py")
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


def _cli() -> float:
    try:
        from app.cli import render

        out = render(["--format=v2"])
        if out.splitlines()[0] != "id,amount,status":
            return 0.0
        if "1,4.5,open" not in out or "2,9.0,paid" not in out:
            return 0.0
        if "id|amount" in out:
            return 0.0
        return 1.0
    except Exception:
        return 0.0


def grade() -> dict[str, float]:
    cli = _cli()
    diff = _diff()
    reward = round(0.85 * cli + 0.15 * diff, 4)
    return {
        "reward": reward,
        "critical_tests": cli,
        "api_contract": cli,
        "diff_quality": diff,
        "service_health": cli,
        "regression_tests": cli,
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
