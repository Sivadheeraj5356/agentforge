from app.migrate import migrate


def test_all_legacy_rows() -> None:
    out = migrate(
        [
            {"id": "1", "status": "legacy"},
            {"id": "2", "status": "legacy"},
            {"id": "3", "status": "ok"},
        ]
    )
    assert [row["id"] for row in out] == ["1", "2", "3"]
    assert [row["status"] for row in out] == ["migrated", "migrated", "ok"]


def test_empty() -> None:
    assert migrate([]) == []
