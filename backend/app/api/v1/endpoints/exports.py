from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.export_service import ExportService
from app.services.import_service import ImportService

router = APIRouter()


@router.get("/export/sft", response_class=PlainTextResponse)
def export_sft(
    project_id: str = Query(...),
    format_type: str = Query("jsonl", description="'jsonl', 'json', or 'csv'"),
    include_metadata: bool = Query(True),
    db: Session = Depends(get_db)
):
    try:
        content = ExportService.export_sft(
            db=db,
            project_id=project_id,
            format_type=format_type,
            include_metadata=include_metadata
        )
        return content
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/dpo", response_class=PlainTextResponse)
def export_dpo(
    project_id: str = Query(...),
    format_type: str = Query("jsonl", description="'jsonl', 'json', or 'csv'"),
    include_metadata: bool = Query(True),
    only_completed: bool = Query(True),
    db: Session = Depends(get_db)
):
    try:
        content = ExportService.export_dpo(
            db=db,
            project_id=project_id,
            format_type=format_type,
            include_metadata=include_metadata,
            only_completed=only_completed
        )
        return content
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import")
async def import_dataset(
    project_id: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        raw_bytes = await file.read()
        content = raw_bytes.decode("utf-8")
        result = ImportService.import_dataset(
            db=db,
            project_id=project_id,
            content=content,
            filename=file.filename or "uploaded_dataset.jsonl"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
