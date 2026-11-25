"""
Database Backup CLI Utility (NFR-09)
Creates an online, integrity-checked SQLite backup in data/backups/.
Usage:
    python backend/backup_db.py
    python backend/backup_db.py --output path/to/backup.db
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


def backup_database(source_path: Optional[Path] = None, output_path: Optional[Path] = None) -> Path:
    src = Path(source_path or settings.DATABASE_PATH)
    if not src.exists():
        raise FileNotFoundError(f"Source database does not exist: {src}")

    if output_path is None:
        backup_dir = settings.DATA_DIR / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dst = backup_dir / f"jci_backup_{stamp}.db"
    else:
        dst = Path(output_path)
        dst.parent.mkdir(parents=True, exist_ok=True)

    # Use SQLite online backup API so backups are consistent even during active reads
    with sqlite3.connect(str(src)) as src_conn:
        with sqlite3.connect(str(dst)) as dst_conn:
            src_conn.backup(dst_conn)

    # Verify backup integrity
    with sqlite3.connect(str(dst)) as check_conn:
        result = check_conn.execute("PRAGMA integrity_check").fetchone()
        if not result or result[0].lower() != "ok":
            raise RuntimeError(f"Backup integrity check failed: {result}")

    return dst


def main():
    parser = argparse.ArgumentParser(description="Create an integrity-checked backup of the JCI SQLite database.")
    parser.add_argument("--source", type=Path, default=None, help="Source SQLite database path")
    parser.add_argument("--output", type=Path, default=None, help="Destination backup file path")
    args = parser.parse_args()

    try:
        dest = backup_database(args.source, args.output)
        size_kb = dest.stat().st_size / 1024
        print(f"[OK] Database backed up and verified (PRAGMA integrity_check=ok): {dest} ({size_kb:.1f} KB)")
    except Exception as exc:
        print(f"[ERROR] Backup failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
