from pathlib import Path

Path("/workspace/app/migrate.py").write_text(
    '''def migrate(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows:
        copy = dict(row)
        if copy.get("status") == "legacy":
            copy["status"] = "migrated"
        out.append(copy)
    return out
''',
    encoding="utf-8",
)
