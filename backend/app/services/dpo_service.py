"""
DPO Studio and Dataset Service.
Handles prompt management, dual model response generation, side-by-side preference rating,
and canonical chosen/rejected DPO dataset persistence.
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.entities import DPOTask, AuditLog
from app.schemas.schemas import DPOTaskCreate, DPOAnnotationUpdate


class DPOService:
    @staticmethod
    def list_tasks(
        db: Session,
        project_id: str,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = db.query(DPOTask).filter(DPOTask.project_id == project_id)

        if status:
            query = query.filter(DPOTask.status == status)

        if search:
            query = query.filter(
                (DPOTask.prompt.ilike(f"%{search}%")) |
                (DPOTask.response_a.ilike(f"%{search}%")) |
                (DPOTask.response_b.ilike(f"%{search}%"))
            )

        total = query.count()
        tasks = query.order_by(DPOTask.updated_at.desc()).offset(offset).limit(limit).all()
        return [DPOService._format_task(t) for t in tasks], total

    @staticmethod
    def get_task(db: Session, task_id: str) -> Optional[Dict[str, Any]]:
        task = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not task:
            return None
        return DPOService._format_task(task)

    @staticmethod
    def create_task(db: Session, data: DPOTaskCreate) -> Dict[str, Any]:
        task = DPOTask(
            project_id=data.project_id,
            prompt=data.prompt.strip(),
            system_prompt=data.system_prompt,
            response_a=data.response_a or "",
            response_b=data.response_b or "",
            metadata_json=json.dumps(data.metadata or {}, ensure_ascii=False),
            status="pending"
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return DPOService._format_task(task)

    @staticmethod
    def update_task(
        db: Session,
        task_id: str,
        data: Any
    ) -> Optional[Dict[str, Any]]:
        task = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not task:
            return None
        if hasattr(data, "prompt") and data.prompt is not None:
            task.prompt = data.prompt.strip()
        if hasattr(data, "system_prompt") and data.system_prompt is not None:
            task.system_prompt = data.system_prompt
        if hasattr(data, "response_a") and data.response_a is not None:
            task.response_a = data.response_a
        if hasattr(data, "response_b") and data.response_b is not None:
            task.response_b = data.response_b
        if hasattr(data, "preference") and data.preference is not None:
            task.preference = data.preference
            if data.preference in ("a", "b", "tie", "both_bad"):
                task.status = "completed"
            elif data.preference == "skip":
                task.status = "skipped"
            elif data.preference == "flag":
                task.status = "flagged"
        if hasattr(data, "rationale") and data.rationale is not None:
            task.rationale = data.rationale
        if hasattr(data, "helpfulness_rating") and data.helpfulness_rating is not None:
            task.helpfulness_rating = data.helpfulness_rating
        if hasattr(data, "factuality_rating") and data.factuality_rating is not None:
            task.factuality_rating = data.factuality_rating
        if hasattr(data, "metadata") and data.metadata:
            meta = json.loads(task.metadata_json or "{}")
            meta.update(data.metadata)
            task.metadata_json = json.dumps(meta, ensure_ascii=False)

        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return DPOService._format_task(task)

    @staticmethod
    def update_task_responses(
        db: Session,
        task_id: str,
        response_a: Optional[str] = None,
        response_b: Optional[str] = None,
        metadata_update: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        task = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not task:
            return None
        if response_a is not None:
            task.response_a = response_a
        if response_b is not None:
            task.response_b = response_b

        if metadata_update:
            meta = json.loads(task.metadata_json or "{}")
            meta.update(metadata_update)
            task.metadata_json = json.dumps(meta, ensure_ascii=False)

        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return DPOService._format_task(task)

    @staticmethod
    def annotate_task(db: Session, task_id: str, data: DPOAnnotationUpdate) -> Optional[Dict[str, Any]]:
        task = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not task:
            return None

        pref = data.preference.lower().strip()
        task.preference = pref
        task.rationale = data.rationale
        task.helpfulness_rating = data.helpfulness_rating
        task.factuality_rating = data.factuality_rating

        if pref in ("a", "b", "tie", "both_bad"):
            task.status = "completed"
        elif pref == "skip":
            task.status = "skipped"
        elif pref == "flag":
            task.status = "flagged"

        if data.metadata:
            meta = json.loads(task.metadata_json or "{}")
            meta.update(data.metadata)
            task.metadata_json = json.dumps(meta, ensure_ascii=False)

        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)

        # Audit log
        audit = AuditLog(
            project_id=task.project_id,
            event_type="dpo_annotated",
            entity_type="dpo_task",
            entity_id=task.id,
            details_json=json.dumps({"preference": pref})
        )
        db.add(audit)
        db.commit()

        return DPOService._format_task(task)

    @staticmethod
    def undo_last_annotation(db: Session, project_id: str) -> Optional[Dict[str, Any]]:
        """Undo preference on the most recently completed DPO task."""
        task = db.query(DPOTask).filter(
            DPOTask.project_id == project_id,
            DPOTask.status.in_(["completed", "skipped", "flagged"])
        ).order_by(DPOTask.updated_at.desc()).first()

        if not task:
            return None

        task.preference = None
        task.status = "pending"
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return DPOService._format_task(task)

    @staticmethod
    def delete_task(db: Session, task_id: str) -> bool:
        task = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not task:
            return False
        db.delete(task)
        db.commit()
        return True

    @staticmethod
    def duplicate_task(db: Session, task_id: str) -> Optional[Dict[str, Any]]:
        orig = db.query(DPOTask).filter(DPOTask.id == task_id).first()
        if not orig:
            return None
        clone = DPOTask(
            project_id=orig.project_id,
            prompt=orig.prompt,
            system_prompt=orig.system_prompt,
            response_a=orig.response_a,
            response_b=orig.response_b,
            preference=None,
            status="pending",
            metadata_json=orig.metadata_json
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)
        return DPOService._format_task(clone)

    @staticmethod
    def _format_task(t: DPOTask) -> Dict[str, Any]:
        return {
            "id": t.id,
            "project_id": t.project_id,
            "prompt": t.prompt,
            "system_prompt": t.system_prompt,
            "response_a": t.response_a,
            "response_b": t.response_b,
            "preference": t.preference,
            "rationale": t.rationale,
            "helpfulness_rating": t.helpfulness_rating,
            "factuality_rating": t.factuality_rating,
            "status": t.status,
            "metadata": json.loads(t.metadata_json or "{}"),
            "created_at": t.created_at,
            "updated_at": t.updated_at
        }
