"""v1 ledger: POST always inserts; rows have no client_key; CLI is a legacy dump."""

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
            "id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL NOT NULL)"
        )
        cursor.execute("SELECT COUNT(*) FROM entries")
        count = int(cursor.fetchone()[0])
        if count == 0:
            cursor.execute("INSERT INTO entries (amount) VALUES (10.0)")
            cursor.execute("INSERT INTO entries (amount) VALUES (2.5)")
        connection.commit()


_init()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/entries")
def list_entries() -> dict[str, object]:
    with closing(_connect()) as connection:
        rows = connection.cursor().execute("SELECT id, amount FROM entries ORDER BY id").fetchall()
    return {"entries": [{"id": int(row["id"]), "amount": float(row["amount"])} for row in rows]}


@app.post("/entries")
def create_entry(payload: dict[str, Any]) -> dict[str, object]:
    amount = payload.get("amount")
    if not isinstance(amount, (int, float)):
        raise HTTPException(status_code=400, detail="amount required")
    with closing(_connect()) as connection:
        cursor = connection.cursor()
        cursor.execute("INSERT INTO entries (amount) VALUES (?)", (float(amount),))
        connection.commit()
        entry_id = int(cursor.lastrowid)
    return {"id": entry_id, "amount": float(amount)}
