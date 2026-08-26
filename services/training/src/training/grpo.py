"""GRPO/RLVR dry-run. Harbor + custom reward stay in the evaluator; this records the recipe."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def plan_grpo(*, reward_recipe: str, out_dir: Path, parent: str | None) -> dict[str, object]:
    if reward_recipe not in {"binary", "continuous", "hybrid"}:
        raise ValueError("unknown reward recipe")
    plan = {
        "stage": "grpo",
        "status": "dry_run",
        "reward_recipe": reward_recipe,
        "env": "HarborSandbox via services/evaluator (not Next.js)",
        "parent_experiment": parent,
        "stack": "TRL GRPO with a stateful Harbor env — documented, not executed here",
        "checkpoint_ref": None,
        "metrics": {},
        "note": "Train and held-out metrics must both be recorded before any resume claim.",
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "grpo-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="GRPO dry-run")
    parser.add_argument("--reward-recipe", default="continuous")
    parser.add_argument("--out", default=".data/training")
    parser.add_argument("--parent", default=None)
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--execute", action="store_true", default=False)
    args = parser.parse_args(argv)
    if args.execute:
        from training.execute import execute_grpo

        plan = execute_grpo(
            reward_recipe=args.reward_recipe, out_dir=Path(args.out), parent=args.parent
        )
    else:
        plan = plan_grpo(reward_recipe=args.reward_recipe, out_dir=Path(args.out), parent=args.parent)
    print(json.dumps(plan, indent=2))
    return 0
