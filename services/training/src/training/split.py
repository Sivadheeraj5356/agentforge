"""Deterministic train / held-out split. Never report train-only scores as success."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from training.dataset import discover_tasks


def split_tasks(keys: list[str], *, seed: int, held_out: int) -> dict[str, list[str]]:
    if held_out < 1:
        raise ValueError("held-out count must be at least 1")
    if held_out >= len(keys):
        raise ValueError("held-out count must be smaller than the corpus")
    ranked = sorted(
        keys,
        key=lambda key: hashlib.sha256(f"{seed}:{key}".encode("utf-8")).hexdigest(),
    )
    held = ranked[:held_out]
    train = ranked[held_out:]
    return {"train": train, "held_out": held}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Print a train/held-out split")
    parser.add_argument("--root", required=True)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--held-out", type=int, default=2)
    args = parser.parse_args(argv)
    keys = [path.name for path in discover_tasks(Path(args.root))]
    payload = split_tasks(keys, seed=args.seed, held_out=args.held_out)
    print(json.dumps(payload, indent=2))
    return 0
