from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.validation_service import ValidationService
from app.schemas.schemas import ValidationReport

router = APIRouter()


@router.get("/validate", response_model=ValidationReport)
def validate_dataset(
    project_id: str = Query(...),
    dataset_type: str = Query("sft", description="'sft' or 'dpo'"),
    db: Session = Depends(get_db)
):
    if dataset_type == "dpo":
        return ValidationService.validate_dpo(db, project_id)
    return ValidationService.validate_sft(db, project_id)
