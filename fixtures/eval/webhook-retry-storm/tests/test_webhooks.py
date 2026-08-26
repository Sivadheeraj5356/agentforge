from app.webhooks import ingest


def test_retry_is_idempotent() -> None:
    state: dict[str, object] = {}
    ingest("d-1", 4.0, state)
    ingest("d-1", 4.0, state)
    ingest("d-2", 1.0, state)
    assert state["applied"] == [4.0, 1.0]
