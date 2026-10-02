"""
Persistent SQLite storage for the GP Profile crawler.
Every discovered / processed GP is written immediately so progress survives
crashes, disconnects, restarts and manual stops (enables RESUME).
"""
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any

from website_adapter import fy_label, make_unique_key

DB_PATH = Path(__file__).parent / "gp_crawler.db"
_lock = threading.RLock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db() -> None:
    with _lock, _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unique_key TEXT UNIQUE NOT NULL,
                district TEXT, subdivision TEXT, block TEXT, gp TEXT,
                financial_year TEXT,
                email TEXT, mob1 TEXT, mob2 TEXT,
                status TEXT,                 -- SUCCESS | PARTIAL | FAILED
                error_message TEXT,
                timestamp TEXT
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS discovered (
                unique_key TEXT UNIQUE NOT NULL,
                district TEXT, subdivision TEXT, block TEXT, gp TEXT,
                timestamp TEXT
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                district TEXT, subdivision TEXT, block TEXT, gp TEXT,
                financial_year TEXT,
                error_type TEXT, error_message TEXT,
                retry_count INTEGER, timestamp TEXT
            )
            """
        )


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------
def mark_discovered(district, subdivision, block, gp) -> None:
    key = make_unique_key(district, subdivision, block, gp)
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO discovered(unique_key,district,subdivision,block,gp,timestamp) "
            "VALUES (?,?,?,?,?,?)",
            (key, district, subdivision, block, gp, _now()),
        )


def save_record(district, subdivision, block, gp, email, mob1, mob2, status, error_message="") -> None:
    key = make_unique_key(district, subdivision, block, gp)
    with _lock, _conn() as c:
        c.execute(
            """
            INSERT INTO records
                (unique_key,district,subdivision,block,gp,financial_year,email,mob1,mob2,status,error_message,timestamp)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(unique_key) DO UPDATE SET
                email=excluded.email, mob1=excluded.mob1, mob2=excluded.mob2,
                status=excluded.status, error_message=excluded.error_message, timestamp=excluded.timestamp
            """,
            (key, district, subdivision, block, gp, fy_label(),
             email or "", mob1 or "", mob2 or "", status, error_message or "", _now()),
        )


def save_error(district, subdivision, block, gp, error_type, error_message, retry_count) -> None:
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO errors(district,subdivision,block,gp,financial_year,error_type,error_message,retry_count,timestamp) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (district, subdivision, block, gp, fy_label(),
             error_type, error_message, retry_count, _now()),
        )


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------
def record_status(district, subdivision, block, gp) -> Optional[str]:
    key = make_unique_key(district, subdivision, block, gp)
    with _lock, _conn() as c:
        row = c.execute("SELECT status FROM records WHERE unique_key=?", (key,)).fetchone()
        return row["status"] if row else None


def get_records(status: Optional[str] = None, district: Optional[str] = None,
                search: Optional[str] = None, missing: bool = False,
                limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    where, params = [], []
    if status and status.upper() != "ALL":
        where.append("status=?"); params.append(status.upper())
    if district and district.upper() != "ALL":
        where.append("district=?"); params.append(district)
    if missing:
        where.append("(email='' OR mob1='' OR mob2='')")
    if search:
        like = f"%{search}%"
        where.append("(district LIKE ? OR subdivision LIKE ? OR block LIKE ? OR gp LIKE ? OR email LIKE ? OR mob1 LIKE ? OR mob2 LIKE ?)")
        params += [like] * 7
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    with _lock, _conn() as c:
        total = c.execute(f"SELECT COUNT(*) n FROM records {clause}", params).fetchone()["n"]
        rows = c.execute(
            f"SELECT * FROM records {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    return {"total": total, "rows": [dict(r) for r in rows]}


def all_records_for_export(scope: str = "all") -> List[Dict[str, Any]]:
    clause = ""
    if scope == "successful":
        clause = "WHERE status='SUCCESS'"
    elif scope == "partial":
        clause = "WHERE status='PARTIAL'"
    elif scope == "failed":
        clause = "WHERE status='FAILED'"
    elif scope == "missing":
        clause = "WHERE email='' OR mob1='' OR mob2=''"
    with _lock, _conn() as c:
        rows = c.execute(
            f"SELECT district,subdivision,block,gp,financial_year,email,mob1,mob2,status "
            f"FROM records {clause} ORDER BY district,subdivision,block,gp"
        ).fetchall()
    return [dict(r) for r in rows]


def get_errors() -> List[Dict[str, Any]]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM errors ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def get_failed_records() -> List[Dict[str, Any]]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT district,subdivision,block,gp FROM records WHERE status='FAILED'").fetchall()
    return [dict(r) for r in rows]


def get_counts() -> Dict[str, int]:
    with _lock, _conn() as c:
        def one(q, p=()):
            return c.execute(q, p).fetchone()[0]
        return {
            "discovered": one("SELECT COUNT(*) FROM discovered"),
            "processed": one("SELECT COUNT(*) FROM records"),
            "successful": one("SELECT COUNT(*) FROM records WHERE status='SUCCESS'"),
            "partial": one("SELECT COUNT(*) FROM records WHERE status='PARTIAL'"),
            "failed": one("SELECT COUNT(*) FROM records WHERE status='FAILED'"),
            "missing_email": one("SELECT COUNT(*) FROM records WHERE email=''"),
            "missing_mob1": one("SELECT COUNT(*) FROM records WHERE mob1=''"),
            "missing_mob2": one("SELECT COUNT(*) FROM records WHERE mob2=''"),
        }


def completeness_report() -> List[Dict[str, Any]]:
    """Branches (district>block) where some discovered GPs failed — for the completeness check."""
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT district, block, COUNT(*) failed FROM records WHERE status='FAILED' "
            "GROUP BY district, block ORDER BY district, block"
        ).fetchall()
    return [dict(r) for r in rows]


def reset_all() -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM records")
        c.execute("DELETE FROM discovered")
        c.execute("DELETE FROM errors")
