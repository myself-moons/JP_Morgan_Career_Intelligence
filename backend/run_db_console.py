import sys
import subprocess
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from app.core.config import settings


def main():
    db_file = settings.DATABASE_PATH
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

    # If the database file doesn't exist yet, create an empty one so sqlite-web can open it
    if not db_file.exists():
        import sqlite3
        conn = sqlite3.connect(db_file)
        conn.close()
        print(f"Initialized blank SQLite database at: {db_file}")

    print("=" * 65)
    print(" JPMorgan Career Intelligence - Live SQLite Database Console (FR-41)")
    print("=" * 65)
    print(f" Database:     {db_file}")
    print(f" Console Web:  http://{settings.HOST}:{settings.DB_CONSOLE_PORT}")
    print(" Press Ctrl+C to stop the console server.")
    print("=" * 65)

    # Note: Upstream sqlite-web package has an empty __init__.py, so module invocation
    # must target sqlite_web.sqlite_web directly rather than sqlite_web.
    cmd = [
        sys.executable,
        "-m",
        "sqlite_web.sqlite_web",
        str(db_file),
        "--host",
        settings.HOST,
        "--port",
        str(settings.DB_CONSOLE_PORT),
        "--no-browser",
    ]
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\nDatabase console stopped.")


if __name__ == "__main__":
    main()
