"""SQLite storage for accounts, sessions and saved screenings.

Raw SQL over the standard-library driver: the schema is four tables, and a
query builder would only hide what each request actually does to the disk.

The database lives outside the source tree (``THYROLENS_DB_PATH``, default
``var/thyrolens.db``) so a container can mount it on a persistent volume.
"""

from __future__ import annotations

import logging
import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "var" / "thyrolens.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash   TEXT    NOT NULL,
    full_name       TEXT    NOT NULL,
    date_of_birth   TEXT,
    sex             TEXT    CHECK (sex IN ('male', 'female')),
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash      TEXT    PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TEXT    NOT NULL,
    expires_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS assessments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TEXT    NOT NULL,
    prediction      TEXT    NOT NULL CHECK (prediction IN ('Negative', 'Hypothyroid', 'Hyperthyroid')),
    confidence      REAL    NOT NULL,
    probabilities   TEXT    NOT NULL,
    inputs_provided INTEGER NOT NULL,
    input_json      TEXT    NOT NULL,
    result_json     TEXT    NOT NULL,
    note            TEXT
);
CREATE INDEX IF NOT EXISTS idx_assessments_user_created ON assessments (user_id, created_at DESC);

-- One row per lab value, so trends and out-of-range counts are plain
-- aggregates instead of JSON parsing. ``value`` is in the unit the patient
-- typed; ``value_canonical`` is in the training unit, which is the only
-- scale on which readings entered in different units can be compared.
CREATE TABLE IF NOT EXISTS lab_values (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at      TEXT    NOT NULL,
    feature         TEXT    NOT NULL,
    label           TEXT    NOT NULL,
    value           REAL    NOT NULL,
    unit            TEXT    NOT NULL,
    value_canonical REAL    NOT NULL,
    status          TEXT    NOT NULL CHECK (status IN ('low', 'normal', 'high')),
    reference_low   REAL    NOT NULL,
    reference_high  REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_values_assessment ON lab_values (assessment_id);
CREATE INDEX IF NOT EXISTS idx_lab_values_user_feature ON lab_values (user_id, feature, created_at);
"""

_db_path: Path = DEFAULT_DB_PATH


def init_db() -> None:
    """Create the schema if needed. Safe to call on every start-up."""
    global _db_path
    _db_path = Path(os.environ.get("THYROLENS_DB_PATH", DEFAULT_DB_PATH))
    _db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = _open()
    try:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript(SCHEMA)
        connection.commit()
    finally:
        connection.close()
    logger.info("Database ready at %s", _db_path)


def _open() -> sqlite3.Connection:
    # FastAPI may run a sync dependency and the endpoint that uses it on
    # different worker threads; each connection still serves one request.
    connection = sqlite3.connect(_db_path, timeout=10, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 10000")
    return connection


def get_db() -> Iterator[sqlite3.Connection]:
    """Request-scoped connection; rolled back on error, always closed."""
    connection = _open()
    try:
        yield connection
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
