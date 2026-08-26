"""Execute SFT/GRPO or a CPU smoke. Never invents resume percentages."""

from __future__ import annotations

import json
from pathlib import Path

from training.enqueue import enqueue_held_out_evaluations
from training.env import env_first
from training.grpo import plan_grpo
from training.sft import plan_sft


def cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except ImportError:
        return False


def trl_available() -> bool:
    try:
        import peft  # noqa: F401
        import trl  # noqa: F401

        return True
    except ImportError:
        return False


def git_sha() -> str | None:
    raw = env_first("AGENTFORGE_GIT_SHA", "VORTEX_GIT_SHA", "GITHUB_SHA")
    if raw and 7 <= len(raw) <= 40:
        return raw.lower()
    return None


def write_held_out_eval_plan(
    out_dir: Path,
    task_keys: list[str] | None = None,
    experiment_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "via": "services/evaluator",
        "rpc": "enqueue_held_out_evaluations",
        "task_keys": task_keys or [],
        "note": (
            "Held-out ids are enqueued with enqueue_held_out_evaluations. "
            "services/training does not call models or Next.js."
        ),
    }
    if experiment_id:
        payload["experiment_id"] = experiment_id
        url = env_first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
        key = env_first("SUPABASE_SERVICE_ROLE_KEY", "EVALUATOR_SERVICE_ROLE_KEY")
        if url and key:
            try:
                payload["enqueued"] = enqueue_held_out_evaluations(experiment_id)
            except Exception as error:  # noqa: BLE001 — record, do not invent scores
                payload["enqueue_error"] = str(error)[:500]
        else:
            payload["enqueued"] = False
            payload["reason"] = "no evaluator credentials; wrote plan only"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "held-out-eval.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def cpu_smoke(
    *,
    stage: str,
    examples: int,
    reward_recipe: str,
    out_dir: Path,
    experiment_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "stage": stage,
        "status": "cpu_smoke",
        "cuda": False,
        "checkpoint_ref": f"{stage}-cpu-smoke",
        "git_sha": git_sha(),
        "reward_recipe": reward_recipe,
        "metrics": {
            "train": {"examples": examples, "passAt1": None},
            "held_out": {"examples": 0, "passAt1": None},
        },
        "note": (
            "CPU smoke only. Not a resume result. Run held-out eval through "
            "services/evaluator after a real GPU job."
        ),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{stage}-execute.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_held_out_eval_plan(out_dir, experiment_id=experiment_id)
    return payload


def execute_sft(
    dataset: Path,
    out_dir: Path,
    experiment_id: str | None = None,
) -> dict[str, object]:
    plan = plan_sft(dataset, out_dir)
    examples = int(plan["examples"]) if isinstance(plan["examples"], int) else 0
    if not cuda_available():
        return cpu_smoke(
            stage="sft",
            examples=examples,
            reward_recipe="binary",
            out_dir=out_dir,
            experiment_id=experiment_id,
        )
    payload = cpu_smoke(
        stage="sft",
        examples=examples,
        reward_recipe="binary",
        out_dir=out_dir,
        experiment_id=experiment_id,
    )
    payload["cuda"] = True
    if trl_available():
        payload["status"] = "trl_available"
        payload["note"] = (
            "TRL/PEFT imported on CUDA. passAt1 stays null until held-out evaluator rows exist."
        )
    else:
        payload["status"] = "execute_pending_trl"
        payload["note"] = (
            "CUDA visible but TRL/PEFT extras are not installed. "
            "Metrics stay honest: no pass rates until held-out evaluator rows exist."
        )
    (out_dir / "sft-execute.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def execute_grpo(
    *,
    reward_recipe: str,
    out_dir: Path,
    parent: str | None,
    experiment_id: str | None = None,
) -> dict[str, object]:
    plan_grpo(reward_recipe=reward_recipe, out_dir=out_dir, parent=parent)
    if not cuda_available():
        return cpu_smoke(
            stage="grpo",
            examples=0,
            reward_recipe=reward_recipe,
            out_dir=out_dir,
            experiment_id=experiment_id,
        )
    payload = cpu_smoke(
        stage="grpo",
        examples=0,
        reward_recipe=reward_recipe,
        out_dir=out_dir,
        experiment_id=experiment_id,
    )
    payload["cuda"] = True
    payload["env"] = "HarborSandbox via services/evaluator (not Next.js)"
    if trl_available():
        payload["status"] = "trl_available"
        payload["note"] = (
            "TRL imported. Rewards still come from the evaluator verifier, not from this process."
        )
    else:
        payload["status"] = "execute_pending_trl"
    (out_dir / "grpo-execute.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload
