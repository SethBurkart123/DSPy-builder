import os
import sqlite3
from pathlib import Path
from typing import Iterable

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "flows.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS flows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        # Store the latest saved graph/state per flow as a JSON blob
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS flow_states (
                flow_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """
        )
        # Per-flow custom schemas, stored as JSON for flexibility
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS flow_schemas (
                id TEXT PRIMARY KEY,
                flow_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                fields TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(flow_id) REFERENCES flows(id) ON DELETE CASCADE
            )
            """
        )
        conn.commit()
        # API keys store
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                provider TEXT PRIMARY KEY,
                api_key TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
