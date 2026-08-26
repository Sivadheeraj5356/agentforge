"""Read AGENTFORGE_* first, then one-release VORTEX_* aliases."""

from __future__ import annotations

import os


def env_first(*names: str, default: str | None = None) -> str | None:
    for name in names:
        raw = os.environ.get(name)
        if raw is not None and raw.strip() != "":
            return raw
    return default
