"""Stdio line-JSON BYO agent for work packs (skill-constraint oracle).

Evaluator writes one JSON-RPC `next` line per turn. Reply with a tool call or `{done:true}`.

    set AGENTFORGE_BYO_CMD=python examples/byo-work/stdio_agent.py
"""

from __future__ import annotations

import json
import sys

ORACLE = [
    ("read_skill", {}),
    ("read_audit", {}),
    ("post_correction", {"text": "status corrected; audit retained per SKILL.md"}),
    ("close_ticket", {}),
]


def main() -> None:
    for line in sys.stdin:
        stripped = line.strip()
        if not stripped:
            break
        try:
            message = json.loads(stripped)
        except json.JSONDecodeError:
            break
        params = message.get("params") if isinstance(message, dict) else None
        if not isinstance(params, dict):
            params = message if isinstance(message, dict) else {}
        history = params.get("history")
        index = len(history) if isinstance(history, list) else 0
        if index >= len(ORACLE):
            reply: dict[str, object] = {"done": True}
        else:
            name, arguments = ORACLE[index]
            reply = {"name": name, "arguments": arguments}
        sys.stdout.write(json.dumps(reply) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
