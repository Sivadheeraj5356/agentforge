"""CLI: python -m evaluator <health|worker|import-tasks>"""

from __future__ import annotations

import json
import sys


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] in {"-h", "--help"}:
        print("usage: python -m evaluator [health|worker|import-tasks|smoke ...]")
        return 0
    command = args[0]
    if command == "health":
        from evaluator.health import healthcheck

        print(json.dumps(healthcheck()))
        return 0
    if command == "worker":
        from evaluator.worker import main as worker_main

        worker_main(args[1:])
        return 0
    if command == "import-tasks":
        from evaluator.import_tasks import main as import_main

        return import_main(args[1:])
    if command == "smoke":
        from evaluator.smoke import run_smoke

        run_smoke()
        return 0
    print(f"unknown command: {command}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
