from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.sft_service import SFTService
from app.schemas.schemas import (
    SFTSessionCreate, SFTSessionUpdate, SFTSessionResponse,
    SFTMessageCreate, SFTMessageUpdate,
    SFTCommitRequest, SFTRecordResponse, SFTRecordUpdate
)

router = APIRouter()


# ------------------------------
# SFT Sessions (Draft Conversations)
# ------------------------------
@router.get("/sessions", response_model=List[SFTSessionResponse])
def list_sessions(
    project_id: str = Query(...),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return SFTService.list_sessions(db, project_id, status)


@router.post("/sessions", response_model=SFTSessionResponse)
def create_session(data: SFTSessionCreate, db: Session = Depends(get_db)):
    return SFTService.create_session(db, data)


@router.get("/sessions/{session_id}", response_model=SFTSessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    s = SFTService.get_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="SFT session not found")
    return s


@router.put("/sessions/{session_id}", response_model=SFTSessionResponse)
def update_session(session_id: str, data: SFTSessionUpdate, db: Session = Depends(get_db)):
    s = SFTService.update_session(db, session_id, data)
    if not s:
        raise HTTPException(status_code=404, detail="SFT session not found")
    return s


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    success = SFTService.delete_session(db, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="SFT session not found")
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/duplicate", response_model=SFTSessionResponse)
def duplicate_session(session_id: str, db: Session = Depends(get_db)):
    s = SFTService.duplicate_session(db, session_id)
    if not s:
        raise HTTPException(status_code=404, detail="SFT session not found")
    return s


# ------------------------------
# SFT Messages Inside a Session
# ------------------------------
@router.post("/sessions/{session_id}/messages")
def add_message(session_id: str, data: SFTMessageCreate, db: Session = Depends(get_db)):
    try:
        return SFTService.add_message(
            db=db,
            session_id=session_id,
            role=data.role,
            content=data.content,
            model=data.model
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/messages/{message_id}")
def update_message(message_id: str, data: SFTMessageUpdate, db: Session = Depends(get_db)):
    msg = SFTService.update_message(db, message_id, data.content)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@router.delete("/messages/{message_id}")
def delete_message(message_id: str, db: Session = Depends(get_db)):
    success = SFTService.delete_message(db, message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}


@router.post("/sessions/{session_id}/truncate")
def truncate_downstream(session_id: str, from_sequence: int = Query(...), db: Session = Depends(get_db)):
    deleted = SFTService.truncate_downstream_messages(db, session_id, from_sequence)
    return {"truncated_count": deleted}


# -------------------------------------------------------------
# CORE COMMIT: Commit Session to SFT Dataset (One Turn Array -> One Record)
# -------------------------------------------------------------
@router.post("/sessions/{session_id}/commit", response_model=SFTRecordResponse)
def commit_session(session_id: str, req: SFTCommitRequest, db: Session = Depends(get_db)):
    try:
        return SFTService.commit_session(db, session_id, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ------------------------------
# SFT Committed Dataset Records
# ------------------------------
@router.get("/records")
def list_records(
    project_id: str = Query(...),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    records, total = SFTService.list_records(db, project_id, search, tag, limit, offset)
    return {"records": records, "total": total}


@router.get("/records/{record_id}", response_model=SFTRecordResponse)
def get_record(record_id: str, db: Session = Depends(get_db)):
    rec = SFTService.get_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="SFT record not found")
    return rec


@router.put("/records/{record_id}", response_model=SFTRecordResponse)
def update_record(record_id: str, data: SFTRecordUpdate, db: Session = Depends(get_db)):
    rec = SFTService.update_record(db, record_id, data)
    if not rec:
        raise HTTPException(status_code=404, detail="SFT record not found")
    return rec


@router.delete("/records/{record_id}")
def delete_record(record_id: str, db: Session = Depends(get_db)):
    success = SFTService.delete_record(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="SFT record not found")
    return {"message": "SFT record deleted"}


@router.post("/records/{record_id}/duplicate", response_model=SFTRecordResponse)
def duplicate_record(record_id: str, db: Session = Depends(get_db)):
    rec = SFTService.duplicate_record(db, record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="SFT record not found")
    return rec
