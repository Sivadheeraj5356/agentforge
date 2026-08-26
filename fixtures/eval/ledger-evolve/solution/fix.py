"""Oracle: idempotent POST, migrate legacy rows, CLI prints client_key."""

from pathlib import Path

MAIN = '''"""v2 ledger with idempotent POST and migrated client keys."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Any

from fastapi import FastAPI, HTTPException

SQLITE_PATH = "/tmp/ledger.db"

app = FastAPI()


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(SQLITE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _init() -> None:
    with closing(_connect()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS entries ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL, client_key TEXT)"
        )
        cols = {row[1] for row in cursor.execute("PRAGMA table_info(entries)").fetchall()}
        if "client_key" not in cols:
            cursor.execute("ALTER TABLE entries ADD COLUMN client_key TEXT")
        cursor.execute("SELECT COUNT(*) FROM entries")
        count = int(cursor.fetchone()[0])
        if count == 0:
            cursor.execute("INSERT INTO entries (amount, client_key) VALUES (10.0, 'legacy-1')")
            cursor.execute("INSERT INTO entries (amount, client_key) VALUES (2.5, 'legacy-2')")
        else:
            rows = cursor.execute("SELECT id FROM entries ORDER BY id").fetchall()
            for index, row in enumerate(rows, start=1):
                cursor.execute(
                    "UPDATE entries SET client_key = ? WHERE id = ? AND (client_key IS NULL OR client_key = '')",
                    (f"legacy-{index}", int(row["id"])),
                )
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS entries_client_key ON entries(client_key)"
        )
        connection.commit()


_init()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/entries")
def list_entries() -> dict[str, object]:
    with closing(_connect()) as connection:
        rows = connection.cursor().execute(
            "SELECT id, amount, client_key FROM entries ORDER BY id"
        ).fetchall()
    return {
        "entries": [
            {"id": int(row["id"]), "amount": float(row["amount"]), "client_key": row["client_key"]}
            for row in rows
        ]
    }


@app.post("/entries")
def create_entry(payload: dict[str, Any]) -> dict[str, object]:
    amount = payload.get("amount")
    client_key = payload.get("client_key")
    if not isinstance(amount, (int, float)):
        raise HTTPException(status_code=400, detail="amount required")
    if not isinstance(client_key, str) or not client_key.strip():
        raise HTTPException(status_code=400, detail="client_key required")
    with closing(_connect()) as connection:
        cursor = connection.cursor()
        existing = cursor.execute(
            "SELECT id, amount, client_key FROM entries WHERE client_key = ?",
            (client_key,),
        ).fetchone()
        if existing:
            return {
                "id": int(existing["id"]),
                "amount": float(existing["amount"]),
                "client_key": existing["client_key"],
            }
        cursor.execute(
            "INSERT INTO entries (amount, client_key) VALUES (?, ?)",
            (float(amount), client_key),
        )
        connection.commit()
        return {"id": int(cursor.lastrowid), "amount": float(amount), "client_key": client_key}
'''

CLI = '''from app.main import list_entries


def main() -> None:
    payload = list_entries()
    print("id,amount,client_key")
    for row in payload["entries"]:
        print(f"{row['id']},{row['amount']},{row['client_key']}")


if __name__ == "__main__":
    main()
'''

Path("/workspace/app/main.py").write_text(MAIN, encoding="utf-8")
Path("/workspace/app/cli.py").write_text(CLI, encoding="utf-8")
