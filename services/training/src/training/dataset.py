"""Expert trajectories → chat JSON. No model weights are loaded."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def discover_tasks(root: Path) -> list[Path]:
    tasks: list[Path] = []
    if not root.is_dir():
        return tasks
    for child in sorted(root.iterdir()):
        if child.is_dir() and not child.name.startswith("_") and (child / "instruction.md").is_file():
            tasks.append(child)
    return tasks


def oracle_messages(task_dir: Path) -> dict[str, object]:
    instruction = (task_dir / "instruction.md").read_text(encoding="utf-8")
    patch = ""
    solve = task_dir / "solution" / "solve.sh"
    fix = task_dir / "solution" / "fix.py"
    if solve.is_file():
        patch = solve.read_text(encoding="utf-8")
    elif fix.is_file():
        patch = fix.read_text(encoding="utf-8")
    return {
        "task": task_dir.name,
        "messages": [
            {
                "role": "system",
                "content": "You are a coding agent. Fix the task without touching hidden tests.",
            },
            {"role": "user", "content": instruction.strip()},
            {
                "role": "assistant",
                "content": f"Apply the oracle patch.\n\n```\n{patch.strip()}\n```",
            },
        ],
    }


def write_sft_dataset(root: Path, out_path: Path) -> int:
    rows = [oracle_messages(task) for task in discover_tasks(root)]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")
    return len(rows)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Write SFT chat JSONL from oracle fixtures")
    parser.add_argument("--root", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    count = write_sft_dataset(Path(args.root), Path(args.out) / "sft.jsonl")
    print(f"wrote={count}")
    return 0
