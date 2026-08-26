"""Local evaluation artifact writer. Postgres stores keys and hashes only."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def write_json_artifact(
    root: str,
    *,
    organization_id: str,
    name: str,
    payload: Any,
) -> tuple[str, int, str]:
    body = json.dumps(payload, indent=2).encode("utf-8")
    digest = hashlib.sha256(body).hexdigest()
    key = f"{organization_id}/{digest[:16]}/{name}"
    if ".." in key or key.startswith("/"):
        raise ValueError("unsafe artifact key")
    path = Path(root) / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return digest, len(body), key
