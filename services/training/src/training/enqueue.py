"""Enqueue held-out eval through the evaluator store/RPC. Never through Next.js."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from training.env import env_first


def enqueue_held_out_evaluations(experiment_id: str) -> dict[str, Any]:
    url = env_first("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    key = env_first("SUPABASE_SERVICE_ROLE_KEY", "EVALUATOR_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required to enqueue held-out eval")
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/rpc/enqueue_held_out_evaluations",
        data=json.dumps({"p_experiment_id": experiment_id}).encode("utf-8"),
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")
        raise RuntimeError(f"held-out enqueue failed: {error.code} {detail}") from error
    return json.loads(raw) if raw else {}
