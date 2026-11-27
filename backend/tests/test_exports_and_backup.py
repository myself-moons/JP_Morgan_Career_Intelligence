import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.core.seed import seed_baseline_jobs
from app.services.taxonomy_service import seed_taxonomy_if_empty, batch_extract_all_jobs
from backup_db import backup_database
from restore_db import restore_database


@pytest.fixture(scope="module", autouse=True)
def setup_m7_data():
    init_db()
    db = SessionLocal()
    seed_baseline_jobs(db)
    seed_taxonomy_if_empty(db)
    batch_extract_all_jobs(db)
    db.close()


def test_tc18_export_filtered_coverage_csv_and_xlsx():
    """Verify FR-26 / TC-18: CSV and Excel skill coverage exports respect active filters."""
    client = TestClient(app)

    csv_resp = client.get("/api/exports/coverage?format=csv&role_family=Family+B")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    df_csv = pd.read_csv(io.BytesIO(csv_resp.content))
    assert "Canonical Skill" in df_csv.columns
    assert "Coverage %" in df_csv.columns
    assert len(df_csv) >= 10
    assert (df_csv["Active Filter"] == "Family B").all()

    xlsx_resp = client.get("/api/exports/coverage?format=xlsx")
    assert xlsx_resp.status_code == 200
    assert "spreadsheetml" in xlsx_resp.headers["content-type"]
    df_xlsx = pd.read_excel(io.BytesIO(xlsx_resp.content))
    assert "Canonical Skill" in df_xlsx.columns
    assert len(df_xlsx) >= 10


def test_export_jobs_matrix_and_roadmap():
    """Verify CSV/Excel exports for Jobs, Cross-Role Matrix, and My Roadmap."""
    client = TestClient(app)

    jobs_resp = client.get("/api/exports/jobs?format=csv")
    assert jobs_resp.status_code == 200
    assert "Requisition Code" in jobs_resp.text

    matrix_resp = client.get("/api/exports/matrix?format=xlsx")
    assert matrix_resp.status_code == 200
    assert len(matrix_resp.content) > 500

    roadmap_resp = client.get("/api/exports/roadmap?format=csv")
    assert roadmap_resp.status_code == 200
    assert "Canonical Skill" in roadmap_resp.text

    learn_alias_resp = client.get("/api/exports/learning?format=csv")
    assert learn_alias_resp.status_code == 200
    assert "Canonical Skill" in learn_alias_resp.text


def test_nfr09_database_backup_and_restore(tmp_path):
    """Verify NFR-09: SQLite online backup & integrity-checked restore CLI functions."""
    import sqlite3

    src_db = tmp_path / "source.db"
    with sqlite3.connect(str(src_db)) as conn:
        conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
        conn.execute("INSERT INTO items (name) VALUES ('initial_record')")
        conn.commit()

    backup_file = tmp_path / "backups" / "test_backup.db"
    created = backup_database(source_path=src_db, output_path=backup_file)
    assert created.exists()

    # Mutate source DB after backup
    with sqlite3.connect(str(src_db)) as conn:
        conn.execute("DELETE FROM items")
        conn.execute("INSERT INTO items (name) VALUES ('corrupted_later')")
        conn.commit()

    # Restore from backup
    safety = restore_database(backup_path=backup_file, target_path=src_db)
    assert safety is not None and safety.exists()

    with sqlite3.connect(str(src_db)) as conn:
        rows = conn.execute("SELECT name FROM items").fetchall()
        assert rows == [("initial_record",)]
