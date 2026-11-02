import shutil
import sqlite3
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app.core.config import settings
from app.models.entities import AppSetting

router = APIRouter()


@router.get("/settings")
def get_all_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).all()
    res = {r.key: r.value for r in rows}
    # defaults
    if "theme" not in res:
        res["theme"] = "dark"
    if "default_provider_id" not in res:
        res["default_provider_id"] = "mock"
    return res


@router.put("/settings")
def update_settings(payload: Dict[str, str], db: Session = Depends(get_db)):
    for k, v in payload.items():
        item = db.query(AppSetting).filter(AppSetting.key == k).first()
        if item:
            item.value = str(v)
        else:
            item = AppSetting(key=k, value=str(v))
            db.add(item)
    db.commit()
    return {"message": "Settings updated"}


@router.get("/settings/integrity")
def check_database_integrity():
    """Runs PRAGMA integrity_check on the local SQLite database."""
    conn = sqlite3.connect(str(settings.DB_PATH))
    cursor = conn.cursor()
    cursor.execute("PRAGMA integrity_check;")
    status = cursor.fetchone()[0]
    cursor.close()
    conn.close()
    return {
        "status": status,
        "is_ok": status.lower() == "ok",
        "db_path": str(settings.DB_PATH)
    }


@router.post("/settings/backup")
def create_backup():
    """Perform hot online backup of SQLite database using sqlite3 backup API."""
    backup_file = settings.DATA_DIR / "dataset_studio_backup.db"
    src_conn = sqlite3.connect(str(settings.DB_PATH))
    dst_conn = sqlite3.connect(str(backup_file))
    with dst_conn:
        src_conn.backup(dst_conn)
    dst_conn.close()
    src_conn.close()
    return {
        "message": "Backup created successfully",
        "backup_path": str(backup_file)
    }


@router.post("/settings/restore")
def restore_backup():
    """Restores SQLite database from the backup file."""
    backup_file = settings.DATA_DIR / "dataset_studio_backup.db"
    if not backup_file.exists():
        raise HTTPException(status_code=404, detail="No backup file found")
    
    # Close connections and overwrite
    engine.dispose()
    shutil.copy2(backup_file, settings.DB_PATH)
    return {"message": "Database restored from backup"}
