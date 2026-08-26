#!/usr/bin/env python3
"""Score a pinned work pack with oracle, NOP, optional BYO, and optional model agents.

Run from repo root with evaluator env. Writes gitignored:
  scripts/horizon-score.out.json
  .data/scores/horizon-v1.json
Never paste those numbers into marketing copy. Fable 5 is not scored here.
Model rows are omitted when keys are absent.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "evaluator" / "src"))

from evaluator.workenv.model_agent import WorkModelConfig
from evaluator.workenv.sandbox import WorkEnvironmentSandbox

OUT = ROOT / "scripts" / "horizon-score.out.json"
DATA_OUT = ROOT / ".data" / "scores" / "horizon-v1.json"
PACK = os.environ.get("AGENTFORGE_SCORE_PACK", "skill-constraint")
PROTOCOL = "horizon-v1.0.0"


def _run(sandbox: WorkEnvironmentSandbox, kind: str) -> float:
    outcome = sandbox.run_trial(
        task_key=PACK,
        agent_kind=kind,
        recipe="staged",
        timeout_seconds=int(os.environ.get("EVALUATOR_TIMEOUT_SECONDS", "120")),
        pack_key=PACK,
    )
    return float(outcome.reward)


def main() -> None:
    model = WorkModelConfig(
        provider=os.environ.get("AGENTFORGE_WORK_MODEL_PROVIDER", "openai"),
        openai_api_key=os.environ.get("OPENAI_API_KEY"),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
        openai_model=os.environ.get(
            "AGENTFORGE_OPENAI_MODEL", os.environ.get("HARBOR_MODEL", "gpt-4.1-mini")
        ),
        anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        openai_base_url=os.environ.get("OPENAI_BASE_URL"),
    )
    sandbox = WorkEnvironmentSandbox(
        str(ROOT / "environments"),
        work_model=model,
        byo_http_url=os.environ.get("AGENTFORGE_BYO_HTTP_URL"),
        byo_cmd=os.environ.get("AGENTFORGE_BYO_CMD"),
    )
    rows: dict[str, object] = {
        "protocol": PROTOCOL,
        "pack": PACK,
        "oracle": _run(sandbox, "oracle"),
        "nop": _run(sandbox, "nop"),
    }
    if os.environ.get("AGENTFORGE_BYO_HTTP_URL") or os.environ.get("AGENTFORGE_BYO_CMD"):
        rows["byo"] = _run(sandbox, "byo")
    if os.environ.get("OPENAI_API_KEY"):
        rows["openai_agent"] = _run(
            WorkEnvironmentSandbox(
                str(ROOT / "environments"),
                work_model=WorkModelConfig(
                    provider="openai",
                    openai_api_key=os.environ.get("OPENAI_API_KEY"),
                    anthropic_api_key=None,
                    openai_model=str(model.openai_model),
                    anthropic_model="claude-sonnet-4-5",
                    openai_base_url=os.environ.get("OPENAI_BASE_URL"),
                ),
            ),
            "agent",
        )
    if os.environ.get("ANTHROPIC_API_KEY"):
        rows["anthropic_agent"] = _run(
            WorkEnvironmentSandbox(
                str(ROOT / "environments"),
                work_model=WorkModelConfig(
                    provider="anthropic",
                    openai_api_key=None,
                    anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
                    openai_model="gpt-4.1-mini",
                    anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
                ),
            ),
            "agent",
        )
    payload = json.dumps(rows, indent=2) + "\n"
    OUT.write_text(payload, encoding="utf-8")
    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(payload, encoding="utf-8")
    print(payload, end="")


if __name__ == "__main__":
    main()
