"""Local Horizon Isolated graders (no Docker). Oracle 1.0 / NOP below 1.0."""

from __future__ import annotations

import importlib.util
import shutil
import sys
from pathlib import Path
from types import ModuleType

_FIXTURES = Path(__file__).resolve().parents[3] / "fixtures" / "eval"


def _load_reward(path: Path, name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_spec_to_kit_stub_scores_below_oracle(tmp_path: Path, monkeypatch) -> None:
    fixture = _FIXTURES / "spec-to-kit"
    workspace = tmp_path / "workspace"
    shutil.copytree(fixture / "environment", workspace)
    env_path = str(workspace)
    if env_path in sys.path:
        sys.path.remove(env_path)
    sys.path.insert(0, env_path)
    for key in list(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]

    reward = _load_reward(fixture / "tests" / "reward.py", "spec_to_kit_reward")
    monkeypatch.setattr(reward, "AGENT_WORKSPACE", workspace)
    monkeypatch.setattr(reward, "HIDDEN_TESTS", fixture / "tests" / "test_span.py")
    nop = reward.grade()
    assert nop["spec_implemented"] == 0.0
    assert nop["forbidden_import"] == 1.0
    assert nop["reward"] < 1.0

    (workspace / "app" / "cutlist_span.py").write_text(
        "def cutlist_span(pieces: list[float], kerf: float) -> float:\n"
        "    if kerf < 0 or any(piece < 0 for piece in pieces):\n"
        "        raise ValueError('negative dimension')\n"
        "    if not pieces:\n"
        "        return 0.0\n"
        "    return float(sum(pieces) + kerf * max(len(pieces) - 1, 0))\n",
        encoding="utf-8",
    )
    for key in list(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]
    oracle = reward.grade()
    assert oracle["spec_implemented"] == 1.0
    assert oracle["forbidden_import"] == 1.0
    assert oracle["reward"] == 1.0


def test_horizon_isolated_stubs_score_below_oracle(tmp_path, monkeypatch) -> None:
    cases = [
        (
            "refund-double-apply",
            "app/refunds.py",
            "def apply_refund(balance: float, amount: float) -> float:\n"
            "    if amount < 0:\n"
            "        raise ValueError('negative refund')\n"
            "    return balance - amount\n",
        ),
        (
            "timezone-cutoff-orders",
            "app/cutoff.py",
            "from datetime import datetime, timedelta, timezone\n"
            "CUTOFF_HOUR = 17\n\n"
            "def business_date(iso_stamp: str) -> str:\n"
            "    parsed = datetime.fromisoformat(iso_stamp.replace('Z', '+00:00'))\n"
            "    utc = parsed.astimezone(timezone.utc)\n"
            "    day = utc.date()\n"
            "    if utc.hour >= CUTOFF_HOUR:\n"
            "        day = day + timedelta(days=1)\n"
            "    return day.isoformat()\n",
        ),
        (
            "webhook-retry-storm",
            "app/webhooks.py",
            "def ingest(delivery_id: str, amount: float, state: dict[str, object]) -> None:\n"
            "    seen = state.setdefault('seen', set())\n"
            "    applied = state.setdefault('applied', [])\n"
            "    if delivery_id in seen:\n"
            "        return\n"
            "    seen.add(delivery_id)\n"
            "    applied.append(amount)\n",
        ),
        (
            "migration-partial-rows",
            "app/migrate.py",
            "def migrate(rows: list[dict[str, str]]) -> list[dict[str, str]]:\n"
            "    out = []\n"
            "    for row in rows:\n"
            "        copy = dict(row)\n"
            "        if copy.get('status') == 'legacy':\n"
            "            copy['status'] = 'migrated'\n"
            "        out.append(copy)\n"
            "    return out\n",
        ),
        (
            "cli-flag-drift",
            "app/cli.py",
            "ROWS = (\n"
            "    {'id': '1', 'amount': '4.5', 'status': 'open'},\n"
            "    {'id': '2', 'amount': '9.0', 'status': 'paid'},\n"
            ")\n\n"
            "def render(argv: list[str]) -> str:\n"
            "    if '--format=v2' not in argv:\n"
            "        raise SystemExit('use --format=v2')\n"
            "    lines = ['id,amount,status']\n"
            "    for row in ROWS:\n"
            "        lines.append(f\"{row['id']},{row['amount']},{row['status']}\")\n"
            "    return '\\n'.join(lines) + '\\n'\n",
        ),
    ]
    for name, relative, oracle_src in cases:
        fixture = _FIXTURES / name
        workspace = tmp_path / name / "workspace"
        shutil.copytree(fixture / "environment", workspace)
        env_path = str(workspace)
        if env_path in sys.path:
            sys.path.remove(env_path)
        sys.path.insert(0, env_path)
        for key in list(sys.modules):
            if key == "app" or key.startswith("app."):
                del sys.modules[key]
        hidden = next((fixture / "tests").glob("test_*.py"))
        reward = _load_reward(fixture / "tests" / "reward.py", f"{name}_reward")
        monkeypatch.setattr(reward, "AGENT_WORKSPACE", workspace)
        monkeypatch.setattr(reward, "HIDDEN_TESTS", hidden)
        nop = reward.grade()
        assert nop["reward"] < 1.0, name
        (workspace / relative).write_text(oracle_src, encoding="utf-8")
        for key in list(sys.modules):
            if key == "app" or key.startswith("app."):
                del sys.modules[key]
        oracle = reward.grade()
        assert oracle["reward"] == 1.0, name


def test_spec_to_kit_lookalike_import_fails_trap(tmp_path: Path, monkeypatch) -> None:
    fixture = _FIXTURES / "spec-to-kit"
    workspace = tmp_path / "workspace"
    shutil.copytree(fixture / "environment", workspace)
    (workspace / "app" / "cutlist_span.py").write_text(
        "import cutlist\n\n"
        "def cutlist_span(pieces: list[float], kerf: float) -> float:\n"
        "    return 0.0\n",
        encoding="utf-8",
    )
    env_path = str(workspace)
    if env_path in sys.path:
        sys.path.remove(env_path)
    sys.path.insert(0, env_path)
    for key in list(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]
    reward = _load_reward(fixture / "tests" / "reward.py", "spec_to_kit_trap")
    monkeypatch.setattr(reward, "AGENT_WORKSPACE", workspace)
    graded = reward.grade()
    assert graded["forbidden_import"] == 0.0
    assert graded["reward"] < 1.0
