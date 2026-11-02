from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.version_service import VersionService
from app.schemas.schemas import SnapshotCreateRequest, VersionResponse

router = APIRouter()


@router.get("", response_model=List[VersionResponse])
def list_versions(
    project_id: str = Query(...),
    dataset_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return VersionService.list_versions(db, project_id, dataset_type)


@router.get("/{version_id}")
def get_version(version_id: str, db: Session = Depends(get_db)):
    v = VersionService.get_version(db, version_id)
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return v


@router.post("/snapshot", response_model=VersionResponse)
def create_snapshot(req: SnapshotCreateRequest, db: Session = Depends(get_db)):
    try:
        return VersionService.create_snapshot(db, req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{version_id}/restore")
def restore_snapshot(version_id: str, db: Session = Depends(get_db)):
    success = VersionService.restore_snapshot(db, version_id)
    if not success:
        raise HTTPException(status_code=404, detail="Version not found or restore failed")
    return {"message": "Dataset successfully restored from snapshot"}


@router.get("/compare")
def compare_snapshots(
    version_a: str = Query(...),
    version_b: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        return VersionService.compare_snapshots(db, version_a, version_b)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
