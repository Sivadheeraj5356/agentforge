"""CLI dump. --legacy pipe format is the bug."""

from __future__ import annotations

import sys

ROWS = (
    {"id": "1", "amount": "4.5", "status": "open"},
    {"id": "2", "amount": "9.0", "status": "paid"},
)


def render(argv: list[str]) -> str:
    del argv
    lines = ["id|amount"]
    for row in ROWS:
        lines.append(f"{row['id']}|{row['amount']}")
    return "\n".join(lines) + "\n"


def main() -> None:
    sys.stdout.write(render(sys.argv[1:]))


if __name__ == "__main__":
    main()
