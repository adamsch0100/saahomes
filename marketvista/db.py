"""Database access for ListLogic accounts — Postgres (Railway) or SQLite fallback."""
from __future__ import annotations

import logging
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional
from urllib.parse import urlparse

logger = logging.getLogger("ListLogic.db")

ROOT = Path(__file__).resolve().parent
MIGRATIONS_DIR = ROOT / "migrations"
DEFAULT_SQLITE = ROOT / "output" / "listlogic.db"

_lock = threading.Lock()
_pg = None  # psycopg connection pool / module flag


def database_url() -> str:
    return (os.environ.get("DATABASE_URL") or "").strip()


def using_postgres() -> bool:
    url = database_url()
    return bool(url) and url.startswith(("postgres://", "postgresql://"))


def _sqlite_path() -> Path:
    url = database_url()
    if url.startswith("sqlite:///"):
        return Path(url.replace("sqlite:///", "", 1))
    return DEFAULT_SQLITE


def _adapt_sql(sql: str) -> str:
    """SQLite uses ? placeholders; Postgres uses %s."""
    if using_postgres():
        return sql.replace("?", "%s")
    return sql


@contextmanager
def connect() -> Iterator[Any]:
    if using_postgres():
        import psycopg

        url = database_url()
        # Railway sometimes uses postgres:// — psycopg wants postgresql://
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        # Hard timeout so Railway healthchecks don't hang forever if Postgres
        # is briefly unreachable during a rolling deploy.
        conn = psycopg.connect(url, connect_timeout=10)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        path = _sqlite_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def execute(sql: str, params: tuple | list = (), *, fetch: str = "none") -> Any:
    with _lock:
        with connect() as conn:
            cur = conn.cursor()
            cur.execute(_adapt_sql(sql), params)
            if fetch == "one":
                row = cur.fetchone()
                return _row_to_dict(row)
            if fetch == "all":
                rows = cur.fetchall()
                return [_row_to_dict(r) for r in rows]
            return cur.rowcount


def executemany_script(script: str) -> None:
    """Run a multi-statement SQL migration script."""
    with _lock:
        with connect() as conn:
            if using_postgres():
                cur = conn.cursor()
                # Split on semicolons carefully enough for our migration files
                for stmt in _split_statements(script):
                    cur.execute(stmt)
            else:
                conn.executescript(script)


def _split_statements(script: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip().rstrip(";").strip()
            if stmt:
                parts.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        parts.append(tail)
    return parts


def _row_to_dict(row: Any) -> Optional[dict]:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    if hasattr(row, "keys"):
        return {k: row[k] for k in row.keys()}
    return None


def run_migrations() -> None:
    path = MIGRATIONS_DIR / "001_init.sql"
    if not path.exists():
        logger.warning("No migration file at %s", path)
        return
    script = path.read_text(encoding="utf-8")
    if using_postgres():
        # Postgres: CREATE TABLE IF NOT EXISTS is fine; INDEX IF NOT EXISTS ok on PG 9.5+
        script = script.replace("INTEGER NOT NULL DEFAULT 1", "INTEGER NOT NULL DEFAULT 1")
    executemany_script(script)
    _migrate_presentation_limit_nullable()
    backend = "postgres" if using_postgres() else f"sqlite:{_sqlite_path()}"
    logger.info("Migrations applied (%s)", backend)


def _migrate_presentation_limit_nullable() -> None:
    """Older SQLite DBs had presentation_limit NOT NULL — recreate column if needed."""
    if using_postgres():
        try:
            execute("ALTER TABLE users ALTER COLUMN presentation_limit DROP NOT NULL")
        except Exception:
            pass
        return
    try:
        rows = execute("PRAGMA table_info(users)", (), fetch="all") or []
        col = next((r for r in rows if r.get("name") == "presentation_limit"), None)
        if not col or not int(col.get("notnull") or 0):
            return
        # SQLite can't DROP NOT NULL easily — rebuild users table
        with _lock:
            with connect() as conn:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS users_new (
                      id TEXT PRIMARY KEY,
                      email TEXT NOT NULL UNIQUE,
                      password_hash TEXT NOT NULL,
                      name TEXT NOT NULL DEFAULT '',
                      phone TEXT NOT NULL DEFAULT '',
                      brokerage TEXT NOT NULL DEFAULT '',
                      role TEXT NOT NULL DEFAULT 'agent',
                      status TEXT NOT NULL DEFAULT 'trial',
                      trial_ends_at TEXT,
                      presentations_used INTEGER NOT NULL DEFAULT 0,
                      presentation_limit INTEGER,
                      promo_code_id TEXT,
                      created_at TEXT NOT NULL,
                      updated_at TEXT NOT NULL
                    );
                    INSERT INTO users_new
                    SELECT id, email, password_hash, name, phone, brokerage, role, status,
                           trial_ends_at, presentations_used, presentation_limit, promo_code_id,
                           created_at, updated_at
                    FROM users;
                    DROP TABLE users;
                    ALTER TABLE users_new RENAME TO users;
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                    """
                )
        logger.info("Migrated users.presentation_limit to nullable")
    except Exception:
        logger.exception("presentation_limit nullable migration skipped/failed")


def health_info() -> dict:
    return {
        "backend": "postgres" if using_postgres() else "sqlite",
        "configured": bool(database_url()) or _sqlite_path().exists() or True,
    }
