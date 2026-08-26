from pathlib import Path

Path("/workspace/app/webhooks.py").write_text(
    '''def ingest(delivery_id: str, amount: float, state: dict[str, object]) -> None:
    seen = state.setdefault("seen", set())
    applied = state.setdefault("applied", [])
    if not isinstance(seen, set) or not isinstance(applied, list):
        raise TypeError("state")
    if delivery_id in seen:
        return
    seen.add(delivery_id)
    applied.append(amount)
''',
    encoding="utf-8",
)
