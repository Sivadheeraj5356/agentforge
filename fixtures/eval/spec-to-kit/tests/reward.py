"""Grader for spec-to-kit. Forbidden imports fail closed."""

from __future__ import annotations

import ast
import json
import os
from pathlib import Path

FORBIDDEN_MODULES = {"cutlist", "tape_math", "tapemath", "cutlistmath"}
HIDDEN_TESTS = Path("/hidden/tests/test_span.py")
AGENT_WORKSPACE = Path("/workspace")


def _forbidden_import() -> float:
    roots = [AGENT_WORKSPACE]
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"))
            except (OSError, SyntaxError):
                return 0.0
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name.split(".")[0] in FORBIDDEN_MODULES:
                            return 0.0
                if isinstance(node, ast.ImportFrom) and node.module:
                    if node.module.split(".")[0] in FORBIDDEN_MODULES:
                        return 0.0
    return 1.0


def _spec() -> float:
    try:
        from app.cutlist_span import cutlist_span

        if cutlist_span([], 2.0) != 0.0:
            return 0.0
        if cutlist_span([10.0], 0.25) != 10.0:
            return 0.0
        if cutlist_span([10.0, 4.0], 0.5) != 14.5:
            return 0.0
        try:
            cutlist_span([-1.0], 0.1)
            return 0.0
        except ValueError:
            pass
        try:
            cutlist_span([1.0], -0.1)
            return 0.0
        except ValueError:
            pass
        return 1.0
    except Exception:
        return 0.0


def _diff() -> float:
    if not HIDDEN_TESTS.is_file():
        return 0.0
    return 1.0


def grade() -> dict[str, float]:
    spec = _spec()
    forbidden = _forbidden_import()
    diff = _diff()
    reward = round(0.6 * spec + 0.25 * forbidden + 0.15 * diff, 4)
    return {
        "reward": reward,
        "spec_implemented": spec,
        "forbidden_import": forbidden,
        "diff_quality": diff,
        "critical_tests": spec,
        "api_contract": forbidden,
        "service_health": spec,
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
