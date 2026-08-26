"""Refund apply. Double-debit is the bug."""


def apply_refund(balance: float, amount: float) -> float:
    if amount < 0:
        raise ValueError("negative refund")
    return balance - amount - amount
