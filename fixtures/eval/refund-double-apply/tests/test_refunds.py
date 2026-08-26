import pytest

from app.refunds import apply_refund


def test_once() -> None:
    assert apply_refund(40.0, 10.0) == 30.0


def test_zero() -> None:
    assert apply_refund(40.0, 0.0) == 40.0


def test_full() -> None:
    assert apply_refund(10.0, 10.0) == 0.0


def test_rejects_negative() -> None:
    with pytest.raises(ValueError):
        apply_refund(10.0, -1.0)
