"""Webhook ingest. Missing idempotency is the bug."""


def ingest(delivery_id: str, amount: float, state: dict[str, object]) -> None:
    applied = state.setdefault("applied", [])
    if not isinstance(applied, list):
        raise TypeError("applied")
    applied.append(amount)
