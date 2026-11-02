from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("/dashboard")
def get_analytics(
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return AnalyticsService.get_dashboard_analytics(db, project_id)
