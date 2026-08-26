"""Oracle patch applied by solve.sh. Kept as a Python module for tests."""

from pathlib import Path

BUG = "SELECT id, total FROM orders OFFSET 2"
FIX = "SELECT id, total FROM orders"


def apply_oracle(main_py: Path) -> None:
    text = main_py.read_text(encoding="utf-8")
    if BUG not in text:
        raise ValueError("oracle patch target not found")
    main_py.write_text(text.replace(BUG, FIX, 1), encoding="utf-8")


if __name__ == "__main__":
    apply_oracle(Path("/workspace/app/main.py"))
