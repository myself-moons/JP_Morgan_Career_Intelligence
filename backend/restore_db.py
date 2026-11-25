"""
Database Restore CLI Utility (NFR-09)
Validates a SQLite backup file and safely restores it over the active database
after creating a pre-restore safety snapshot.
Usage:
    python backend/restore_db.py data/backups/jci_backup_20261125_120000.db
"""
import argparse
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from backup_db import backup_database  # noqa: E402


def restore_database(backup_path: Path, target_path: Optional[Path] = None) -> Optional[Path]:
    src = Path(backup_path)
    dst = Path(target_path or settings.DATABASE_PATH)

    if not src.exists():
        raise FileNotFoundError(f"Backup file not found: {src}")

    # Verify backup source integrity before touching target database
    with sqlite3.connect(str(src)) as check_conn:
        result = check_conn.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0].lower() != "ok":
            raise RuntimeError(f"Backup file failed integrity check: {result}")

    # Create pre-restore safety snapshot if target exists
    safety_snapshot: Optional[Path] = None
    if dst.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safety_path = dst.parent / "backups" / f"pre_restore_safety_{stamp}.db"
        safety_snapshot = backup_database(source_path=dst, output_path=safety_path)

    dst.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(src)) as src_conn:
        with sqlite3.connect(str(dst)) as dst_conn:
            src_conn.backup(dst_conn)

    return safety_snapshot


def main():
    parser = argparse.ArgumentParser(description="Restore JCI SQLite database from an integrity-checked backup.")
    parser.add_argument("backup_file", type=Path, help="Path to the SQLite backup file to restore")
    parser.add_argument("--target", type=Path, default=None, help="Target SQLite database path")
    args = parser.parse_args()

    try:
        safety = restore_database(args.backup_file, args.target)
        if safety:
            print(f"[INFO] Created pre-restore safety snapshot: {safety}")
        print(f"[OK] Database successfully restored from {args.backup_file}")
    except Exception as exc:
        print(f"[ERROR] Restore failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
