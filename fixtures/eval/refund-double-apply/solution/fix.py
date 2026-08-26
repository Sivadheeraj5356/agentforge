from pathlib import Path

Path("/workspace/app/refunds.py").write_text(
    """def apply_refund(balance: float, amount: float) -> float:
    if amount < 0:
        raise ValueError("negative refund")
    return balance - amount
""",
    encoding="utf-8",
)
