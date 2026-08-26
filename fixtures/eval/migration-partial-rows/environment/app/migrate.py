"""Partial migrator. Only the first row is the bug."""


def migrate(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    if not rows:
        return []
    first = dict(rows[0])
    first["status"] = "migrated"
    return [first, *[dict(row) for row in rows[1:]]]
