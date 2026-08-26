"""Work-environment pack loading. Path traversal is rejected."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PACK_KEY_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789-")
WEIGHT_TOLERANCE = 1e-9


class PackError(ValueError):
    pass


def _assert_pack_key(key: str) -> str:
    if not key or ".." in key or "/" in key or "\\" in key:
        raise PackError("invalid pack key")
    if any(char not in PACK_KEY_CHARS for char in key):
        raise PackError("invalid pack key")
    return key


def load_pack(environments_dir: str | Path, key: str) -> dict[str, Any]:
    safe = _assert_pack_key(key)
    path = Path(environments_dir) / "packs" / f"{safe}.json"
    if not path.is_file():
        raise PackError(f"unknown experience pack: {safe}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise PackError("pack must be an object")
    stages = payload.get("stages")
    if not isinstance(stages, list) or not stages:
        raise PackError("pack stages required")
    total = 0.0
    for stage in stages:
        if not isinstance(stage, dict):
            raise PackError("invalid stage")
        total += float(stage["weight"])
    if abs(total - 1.0) > WEIGHT_TOLERANCE:
        raise PackError("stage weights must sum to 1")
    if payload.get("rewardRecipe") != "staged":
        raise PackError("work environment packs use staged rewards")
    return payload


def pack_stages(pack: dict[str, Any]) -> list[dict[str, Any]]:
    stages = pack.get("stages")
    if not isinstance(stages, list):
        return []
    normalized: list[dict[str, Any]] = []
    for stage in stages:
        if not isinstance(stage, dict):
            continue
        metric = stage.get("metricKey") or stage.get("metric_key")
        normalized.append(
            {
                "id": str(stage["id"]),
                "label": str(stage.get("label") or stage["id"]),
                "weight": float(stage["weight"]),
                "metric_key": str(metric),
            }
        )
    return normalized
