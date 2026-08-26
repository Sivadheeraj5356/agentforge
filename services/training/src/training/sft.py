"""SFT dry-run. Does not load torch; writes a plan file instead of a checkpoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def plan_sft(dataset: Path, out_dir: Path) -> dict[str, object]:
    if not dataset.is_file():
        raise FileNotFoundError(dataset)
    lines = [line for line in dataset.read_text(encoding="utf-8").splitlines() if line.strip()]
    plan = {
        "stage": "sft",
        "status": "dry_run",
        "dataset": str(dataset),
        "examples": len(lines),
        "base_model": "Qwen/Qwen2.5-Coder-1.5B",
        "method": "LoRA/PEFT via TRL (not executed in this dry-run)",
        "checkpoint_ref": None,
        "metrics": {},
        "note": "Do not put success rates on a resume until a real run writes metrics.",
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "sft-plan.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    return plan


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SFT dry-run")
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--out", default=".data/training")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--execute", action="store_true", default=False)
    args = parser.parse_args(argv)
    if args.execute:
        from training.execute import execute_sft

        plan = execute_sft(Path(args.dataset), Path(args.out))
    else:
        plan = plan_sft(Path(args.dataset), Path(args.out))
    print(json.dumps(plan, indent=2))
    return 0
