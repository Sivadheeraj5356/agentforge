"""Oracle-like Isolated BYO agent for broken-orders-api.

Edits /workspace only. Hidden tests stay off this filesystem.
Run in the agent container:

    AGENTFORGE_BYO_CMD=python /opt/byo/agent.py
"""

from __future__ import annotations

from pathlib import Path

BUG = "SELECT id, total FROM orders OFFSET 2"
FIX = "SELECT id, total FROM orders"


def main() -> None:
    target = Path("/workspace/app/main.py")
    text = target.read_text(encoding="utf-8")
    if BUG not in text:
        raise SystemExit("oracle patch target not found")
    target.write_text(text.replace(BUG, FIX, 1), encoding="utf-8")


if __name__ == "__main__":
    main()
