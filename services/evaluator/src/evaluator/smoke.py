"""In-process oracle/NOP smoke. No paid model APIs."""

from __future__ import annotations

import json
from pathlib import Path

from evaluator.workenv.sandbox import WorkEnvironmentSandbox

_ROOT = Path(__file__).resolve()


def _environments_dir() -> Path:
    for parent in _ROOT.parents:
        packs = parent / "environments" / "packs"
        if packs.is_dir():
            return parent / "environments"
    raise RuntimeError("environments/packs not found")


def run_smoke() -> dict[str, object]:
    sandbox = WorkEnvironmentSandbox(str(_environments_dir()))
    oracle = sandbox.run_trial(
        task_key="production-incident-eu-payments",
        agent_kind="oracle",
        recipe="staged",
        timeout_seconds=30,
        pack_key="production-incident-eu-payments",
    )
    nop = sandbox.run_trial(
        task_key="production-incident-eu-payments",
        agent_kind="nop",
        recipe="staged",
        timeout_seconds=30,
        pack_key="production-incident-eu-payments",
    )
    if oracle.reward != 1.0:
        raise SystemExit(f"oracle reward {oracle.reward} != 1.0")
    if nop.reward >= 1.0:
        raise SystemExit(f"nop reward {nop.reward} must be < 1.0")
    payload = {
        "ok": True,
        "pack": "production-incident-eu-payments",
        "oracleReward": oracle.reward,
        "nopReward": nop.reward,
        "oracleSteps": len(oracle.steps),
    }
    print(json.dumps(payload, indent=2))
    return payload
