"""Orders API backed by a store.

Harbor compose sets DATABASE_URL to Postgres. Isolated/TestClient uses sqlite
so the same off-by-one SQL bug can be graded without a database sidecar.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from typing import Any

from fastapi import FastAPI, HTTPException

BUG_SQL = "SELECT id, total FROM orders OFFSET 2"
FIXED_SQL = "SELECT id, total FROM orders"

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SQLITE_PATH = os.environ.get("ORDERS_SQLITE", "/tmp/orders.db")

app = FastAPI()


def _postgres() -> bool:
    return DATABASE_URL.startswith("postgres")


def _connect() -> Any:
    if _postgres():
        import psycopg

        return psycopg.connect(DATABASE_URL)
    connection = sqlite3.connect(SQLITE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _init() -> None:
    with closing(_connect()) as connection:
        cursor = connection.cursor()
        if _postgres():
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS orders ("
                "id SERIAL PRIMARY KEY, total DOUBLE PRECISION NOT NULL)"
            )
        else:
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS orders ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, total REAL NOT NULL)"
            )
        cursor.execute("SELECT COUNT(*) FROM orders")
        row = cursor.fetchone()
        count = int(row[0] if not isinstance(row, dict) else next(iter(row.values())))
        if count == 0:
            cursor.execute("INSERT INTO orders (total) VALUES (10.0)")
            cursor.execute("INSERT INTO orders (total) VALUES (4.5)")
            cursor.execute("INSERT INTO orders (total) VALUES (7.25)")
        connection.commit()


_init()


@app.get("/health")
def health() -> dict[str, str]:
    try:
        with closing(_connect()) as connection:
            connection.cursor().execute("SELECT 1")
        return {"status": "ok"}
    except Exception as error:
        raise HTTPException(status_code=503, detail="store unavailable") from error


@app.get("/orders")
def list_orders() -> dict[str, object]:
    with closing(_connect()) as connection:
        cursor = connection.cursor()
        cursor.execute(BUG_SQL)
        rows = cursor.fetchall()
    orders = []
    for row in rows:
        if hasattr(row, "keys"):
            orders.append({"id": int(row["id"]), "total": float(row["total"])})
        else:
            orders.append({"id": int(row[0]), "total": float(row[1])})
    return {"orders": orders}
