from pathlib import Path

Path("/workspace/app/cli.py").write_text(
    '''from __future__ import annotations

import sys

ROWS = (
    {"id": "1", "amount": "4.5", "status": "open"},
    {"id": "2", "amount": "9.0", "status": "paid"},
)


def render(argv: list[str]) -> str:
    if "--format=v2" not in argv:
        raise SystemExit("use --format=v2")
    lines = ["id,amount,status"]
    for row in ROWS:
        lines.append(f"{row['id']},{row['amount']},{row['status']}")
    return "\\n".join(lines) + "\\n"


def main() -> None:
    sys.stdout.write(render(sys.argv[1:]))


if __name__ == "__main__":
    main()
''',
    encoding="utf-8",
)
