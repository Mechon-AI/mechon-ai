from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.dpo_service import DPOService
from app.schemas.schemas import (
    DPOTaskCreate, DPOAnnotationUpdate, DPOTaskResponse
)

router = APIRouter()


@router.get("/tasks")
def list_tasks(
    project_id: str = Query(...),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    tasks, total = DPOService.list_tasks(db, project_id, status, search, limit, offset)
    return {"tasks": tasks, "total": total}


@router.post("/tasks", response_model=DPOTaskResponse)
def create_task(data: DPOTaskCreate, db: Session = Depends(get_db)):
    return DPOService.create_task(db, data)


@router.get("/tasks/{task_id}", response_model=DPOTaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    t = DPOService.get_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="DPO task not found")
    return t


@router.put("/tasks/{task_id}/annotate", response_model=DPOTaskResponse)
def annotate_task(task_id: str, data: DPOAnnotationUpdate, db: Session = Depends(get_db)):
    t = DPOService.annotate_task(db, task_id, data)
    if not t:
        raise HTTPException(status_code=404, detail="DPO task not found")
    return t


@router.post("/undo", response_model=DPOTaskResponse)
def undo_last_annotation(project_id: str = Query(...), db: Session = Depends(get_db)):
    t = DPOService.undo_last_annotation(db, project_id)
    if not t:
        raise HTTPException(status_code=404, detail="No recently annotated task found to undo")
    return t


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, db: Session = Depends(get_db)):
    success = DPOService.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="DPO task not found")
    return {"message": "DPO task deleted"}


@router.post("/tasks/{task_id}/duplicate", response_model=DPOTaskResponse)
def duplicate_task(task_id: str, db: Session = Depends(get_db)):
    t = DPOService.duplicate_task(db, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="DPO task not found")
    return t
