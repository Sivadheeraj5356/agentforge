import ast
from pathlib import Path

import pytest

from app import cutlist_span as cutlist_mod
from app.cutlist_span import cutlist_span

FORBIDDEN_MODULES = {"cutlist", "tape_math", "tapemath", "cutlistmath"}


def test_empty() -> None:
    assert cutlist_span([], 2.0) == 0.0


def test_single() -> None:
    assert cutlist_span([10.0], 0.25) == 10.0


def test_kerf_between() -> None:
    assert cutlist_span([10.0, 4.0], 0.5) == 14.5


def test_rejects_negative() -> None:
    with pytest.raises(ValueError):
        cutlist_span([-1.0], 0.1)
    with pytest.raises(ValueError):
        cutlist_span([1.0], -0.1)


def test_no_forbidden_imports() -> None:
    source = Path(cutlist_mod.__file__).read_text(encoding="utf-8")
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert alias.name.split(".")[0] not in FORBIDDEN_MODULES
        if isinstance(node, ast.ImportFrom) and node.module:
            assert node.module.split(".")[0] not in FORBIDDEN_MODULES
