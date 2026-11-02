"""
Project Management Service.
Handles project lifecycle, metadata, isolation, duplication, and statistics.
"""

import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import Project, SFTSession, SFTRecord, DPOTask, AuditLog, generate_uuid
from app.schemas.schemas import ProjectCreate, ProjectUpdate


class ProjectService:
    @staticmethod
    def list_projects(db: Session, include_archived: bool = False) -> List[Dict[str, Any]]:
        query = db.query(Project)
        if not include_archived:
            query = query.filter(Project.is_archived == False)
        projects = query.order_by(Project.updated_at.desc()).all()

        results = []
        for p in projects:
            sft_count = db.query(func.count(SFTRecord.id)).filter(SFTRecord.project_id == p.id).scalar() or 0
            dpo_count = db.query(func.count(DPOTask.id)).filter(DPOTask.project_id == p.id).scalar() or 0
            draft_count = db.query(func.count(SFTSession.id)).filter(
                SFTSession.project_id == p.id,
                SFTSession.status == "draft"
            ).scalar() or 0

            results.append({
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "is_archived": p.is_archived,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "settings": json.loads(p.settings_json or "{}"),
                "sft_record_count": sft_count,
                "dpo_task_count": dpo_count,
                "active_draft_count": draft_count
            })
        return results

    @staticmethod
    def get_project(db: Session, project_id: str) -> Optional[Dict[str, Any]]:
        p = db.query(Project).filter(Project.id == project_id).first()
        if not p:
            return None
        sft_count = db.query(func.count(SFTRecord.id)).filter(SFTRecord.project_id == p.id).scalar() or 0
        dpo_count = db.query(func.count(DPOTask.id)).filter(DPOTask.project_id == p.id).scalar() or 0
        draft_count = db.query(func.count(SFTSession.id)).filter(
            SFTSession.project_id == p.id,
            SFTSession.status == "draft"
        ).scalar() or 0

        return {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "is_archived": p.is_archived,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "settings": json.loads(p.settings_json or "{}"),
            "sft_record_count": sft_count,
            "dpo_task_count": dpo_count,
            "active_draft_count": draft_count
        }

    @staticmethod
    def create_project(db: Session, data: ProjectCreate) -> Dict[str, Any]:
        p = Project(
            name=data.name.strip(),
            description=data.description,
            settings_json=json.dumps(data.settings or {})
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        # Audit log
        audit = AuditLog(
            project_id=p.id,
            event_type="project_created",
            entity_type="project",
            entity_id=p.id,
            details_json=json.dumps({"name": p.name})
        )
        db.add(audit)
        db.commit()

        return ProjectService.get_project(db, p.id)

    @staticmethod
    def update_project(db: Session, project_id: str, data: ProjectUpdate) -> Optional[Dict[str, Any]]:
        p = db.query(Project).filter(Project.id == project_id).first()
        if not p:
            return None
        if data.name is not None:
            p.name = data.name.strip()
        if data.description is not None:
            p.description = data.description
        if data.is_archived is not None:
            p.is_archived = data.is_archived
        if data.settings is not None:
            p.settings_json = json.dumps(data.settings)

        db.commit()
        db.refresh(p)
        return ProjectService.get_project(db, p.id)

    @staticmethod
    def delete_project(db: Session, project_id: str) -> bool:
        p = db.query(Project).filter(Project.id == project_id).first()
        if not p:
            return False
        db.delete(p)
        db.commit()
        return True

    @staticmethod
    def duplicate_project(db: Session, project_id: str, new_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        src = db.query(Project).filter(Project.id == project_id).first()
        if not src:
            return None
        target_name = new_name or f"{src.name} (Copy)"
        clone = Project(
            name=target_name,
            description=f"Cloned from {src.name}. {src.description or ''}".strip(),
            settings_json=src.settings_json
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)

        # Clone committed SFT records
        sft_records = db.query(SFTRecord).filter(SFTRecord.project_id == src.id).all()
        for r in sft_records:
            new_r = SFTRecord(
                project_id=clone.id,
                session_id=None,
                messages_json=r.messages_json,
                turn_count=r.turn_count,
                character_count=r.character_count,
                metadata_json=r.metadata_json,
                revision=1
            )
            db.add(new_r)

        # Clone DPO tasks
        dpo_tasks = db.query(DPOTask).filter(DPOTask.project_id == src.id).all()
        for t in dpo_tasks:
            new_t = DPOTask(
                project_id=clone.id,
                prompt=t.prompt,
                system_prompt=t.system_prompt,
                response_a=t.response_a,
                response_b=t.response_b,
                preference=t.preference,
                rationale=t.rationale,
                helpfulness_rating=t.helpfulness_rating,
                factuality_rating=t.factuality_rating,
                status=t.status,
                metadata_json=t.metadata_json
            )
            db.add(new_t)

        db.commit()
        return ProjectService.get_project(db, clone.id)
