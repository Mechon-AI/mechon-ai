"""
SFT Studio and Dataset Service.
Handles multi-turn conversational drafting, message manipulation,
provenance tracking, and atomic conversation commit to the project SFT dataset.
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import SFTSession, SFTMessage, SFTRecord, AuditLog
from app.schemas.schemas import (
    SFTSessionCreate, SFTSessionUpdate, SFTCommitRequest,
    SFTRecordUpdate
)


class SFTService:
    # ==========================================
    # SFT Session (Conversation Draft) Operations
    # ==========================================
    @staticmethod
    def list_sessions(db: Session, project_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query = db.query(SFTSession).filter(SFTSession.project_id == project_id)
        if status:
            query = query.filter(SFTSession.status == status)
        sessions = query.order_by(SFTSession.updated_at.desc()).all()
        return [SFTService._format_session(s) for s in sessions]

    @staticmethod
    def get_session(db: Session, session_id: str) -> Optional[Dict[str, Any]]:
        session = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not session:
            return None
        return SFTService._format_session(session)

    @staticmethod
    def create_session(db: Session, data: SFTSessionCreate) -> Dict[str, Any]:
        session = SFTSession(
            project_id=data.project_id,
            title=data.title or "Untitled Conversation",
            system_prompt=data.system_prompt or "You are a helpful, respectful, and honest assistant.",
            provider_id=data.provider_id,
            model=data.model,
            temperature=data.temperature if data.temperature is not None else 0.7,
            top_p=data.top_p if data.top_p is not None else 0.9,
            max_tokens=data.max_tokens or 2048,
            status="draft"
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return SFTService._format_session(session)

    @staticmethod
    def update_session(db: Session, session_id: str, data: SFTSessionUpdate) -> Optional[Dict[str, Any]]:
        session = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not session:
            return None
        if data.title is not None:
            session.title = data.title.strip()
        if data.system_prompt is not None:
            session.system_prompt = data.system_prompt
        if data.status is not None:
            session.status = data.status
        if data.provider_id is not None:
            session.provider_id = data.provider_id
        if data.model is not None:
            session.model = data.model
        if data.temperature is not None:
            session.temperature = data.temperature
        if data.top_p is not None:
            session.top_p = data.top_p
        if data.max_tokens is not None:
            session.max_tokens = data.max_tokens

        db.commit()
        db.refresh(session)
        return SFTService._format_session(session)

    @staticmethod
    def delete_session(db: Session, session_id: str) -> bool:
        session = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not session:
            return False
        db.delete(session)
        db.commit()
        return True

    @staticmethod
    def duplicate_session(db: Session, session_id: str) -> Optional[Dict[str, Any]]:
        orig = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not orig:
            return None
        clone = SFTSession(
            project_id=orig.project_id,
            title=f"{orig.title} (Draft Copy)",
            system_prompt=orig.system_prompt,
            provider_id=orig.provider_id,
            model=orig.model,
            temperature=orig.temperature,
            top_p=orig.top_p,
            max_tokens=orig.max_tokens,
            status="draft"
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)

        # Clone messages
        for msg in orig.messages:
            cloned_msg = SFTMessage(
                session_id=clone.id,
                role=msg.role,
                content=msg.content,
                sequence_order=msg.sequence_order,
                model=msg.model,
                token_count=msg.token_count
            )
            db.add(cloned_msg)
        db.commit()
        return SFTService._format_session(clone)

    # ==========================================
    # SFT Message Operations inside a Session
    # ==========================================
    @staticmethod
    def add_message(
        db: Session,
        session_id: str,
        role: str,
        content: str,
        model: Optional[str] = None,
        token_count: int = 0
    ) -> Dict[str, Any]:
        session = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        max_seq = db.query(func.max(SFTMessage.sequence_order)).filter(
            SFTMessage.session_id == session_id
        ).scalar()
        seq = (max_seq + 1) if max_seq is not None else 1

        msg = SFTMessage(
            session_id=session_id,
            role=role,
            content=content,
            sequence_order=seq,
            model=model,
            token_count=token_count or len(content.split())
        )
        db.add(msg)
        session.status = "in_progress"
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(msg)

        return {
            "id": msg.id,
            "session_id": msg.session_id,
            "role": msg.role,
            "content": msg.content,
            "sequence_order": msg.sequence_order,
            "model": msg.model,
            "token_count": msg.token_count,
            "created_at": msg.created_at
        }

    @staticmethod
    def update_message(db: Session, message_id: str, new_content: str) -> Optional[Dict[str, Any]]:
        msg = db.query(SFTMessage).filter(SFTMessage.id == message_id).first()
        if not msg:
            return None
        msg.content = new_content
        msg.token_count = len(new_content.split())
        msg.session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(msg)
        return {
            "id": msg.id,
            "session_id": msg.session_id,
            "role": msg.role,
            "content": msg.content,
            "sequence_order": msg.sequence_order,
            "model": msg.model,
            "token_count": msg.token_count,
            "created_at": msg.created_at
        }

    @staticmethod
    def delete_message(db: Session, message_id: str) -> bool:
        msg = db.query(SFTMessage).filter(SFTMessage.id == message_id).first()
        if not msg:
            return False
        session_id = msg.session_id
        del_seq = msg.sequence_order
        db.delete(msg)

        # Re-sequence subsequent messages
        subsequent = db.query(SFTMessage).filter(
            SFTMessage.session_id == session_id,
            SFTMessage.sequence_order > del_seq
        ).order_by(SFTMessage.sequence_order).all()
        for s in subsequent:
            s.sequence_order -= 1

        db.commit()
        return True

    @staticmethod
    def truncate_downstream_messages(db: Session, session_id: str, from_sequence_order: int) -> int:
        """Remove messages starting from a sequence order when regenerating a branch."""
        deleted = db.query(SFTMessage).filter(
            SFTMessage.session_id == session_id,
            SFTMessage.sequence_order >= from_sequence_order
        ).delete()
        db.commit()
        return deleted

    # =========================================================================
    # CORE REQUIREMENT: Commit Session to SFT Dataset (Multi-turn -> ONE record)
    # =========================================================================
    @staticmethod
    def commit_session(db: Session, session_id: str, req: SFTCommitRequest) -> Dict[str, Any]:
        """
        Commits an entire multi-turn chat session into ONE canonical SFT dataset record.
        Validates content, role alternation, ensures integrity, and marks session committed.
        """
        session = db.query(SFTSession).filter(SFTSession.id == session_id).first()
        if not session:
            raise ValueError(f"Session {session_id} not found")

        messages = db.query(SFTMessage).filter(
            SFTMessage.session_id == session_id
        ).order_by(SFTMessage.sequence_order).all()

        if not messages:
            raise ValueError("Cannot commit an empty conversation.")

        # Build canonical messages array
        canonical_messages = []
        if session.system_prompt and session.system_prompt.strip():
            canonical_messages.append({
                "role": "system",
                "content": session.system_prompt.strip()
            })

        for m in messages:
            canonical_messages.append({
                "role": m.role,
                "content": m.content.strip()
            })

        # Basic SFT validation check before commit
        has_user = any(m["role"] == "user" for m in canonical_messages)
        has_assistant = any(m["role"] == "assistant" for m in canonical_messages)
        if not has_user or not has_assistant:
            raise ValueError("SFT conversation must have at least one user prompt and one assistant response.")

        # Compute metrics
        turn_count = len(canonical_messages)
        char_count = sum(len(m["content"]) for m in canonical_messages)

        metadata = req.metadata or {}
        metadata["title"] = req.title_override or session.title
        metadata["tags"] = req.tags
        metadata["source"] = "human_llm_session"
        metadata["model"] = session.model or "unknown"
        metadata["committed_at"] = datetime.utcnow().isoformat()
        metadata["session_id"] = session.id

        # Create ONE atomic SFT record
        record = SFTRecord(
            project_id=session.project_id,
            session_id=session.id,
            messages_json=json.dumps(canonical_messages, ensure_ascii=False),
            turn_count=turn_count,
            character_count=char_count,
            metadata_json=json.dumps(metadata, ensure_ascii=False),
            revision=1
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        # Update session status
        session.status = "committed"
        session.committed_record_id = record.id
        session.updated_at = datetime.utcnow()

        # Audit log
        audit = AuditLog(
            project_id=session.project_id,
            event_type="sft_session_committed",
            entity_type="sft_record",
            entity_id=record.id,
            details_json=json.dumps({
                "session_id": session.id,
                "turn_count": turn_count,
                "char_count": char_count
            })
        )
        db.add(audit)
        db.commit()

        return SFTService._format_record(record)

    # ==========================================
    # SFT Committed Dataset Records Operations
    # ==========================================
    @staticmethod
    def list_records(
        db: Session,
        project_id: str,
        search: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = db.query(SFTRecord).filter(SFTRecord.project_id == project_id)

        if search:
            query = query.filter(SFTRecord.messages_json.ilike(f"%{search}%"))

        total = query.count()
        records = query.order_by(SFTRecord.created_at.desc()).offset(offset).limit(limit).all()

        formatted = []
        for r in records:
            item = SFTService._format_record(r)
            if tag:
                record_tags = item["metadata"].get("tags", [])
                if tag not in record_tags:
                    continue
            formatted.append(item)

        return formatted, total

    @staticmethod
    def get_record(db: Session, record_id: str) -> Optional[Dict[str, Any]]:
        record = db.query(SFTRecord).filter(SFTRecord.id == record_id).first()
        if not record:
            return None
        return SFTService._format_record(record)

    @staticmethod
    def update_record(db: Session, record_id: str, data: SFTRecordUpdate) -> Optional[Dict[str, Any]]:
        record = db.query(SFTRecord).filter(SFTRecord.id == record_id).first()
        if not record:
            return None

        if data.messages is not None:
            record.messages_json = json.dumps(data.messages, ensure_ascii=False)
            record.turn_count = len(data.messages)
            record.character_count = sum(len(m.get("content", "")) for m in data.messages)
            record.revision += 1

        if data.metadata is not None:
            existing_meta = json.loads(record.metadata_json or "{}")
            existing_meta.update(data.metadata)
            record.metadata_json = json.dumps(existing_meta, ensure_ascii=False)

        record.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(record)
        return SFTService._format_record(record)

    @staticmethod
    def delete_record(db: Session, record_id: str) -> bool:
        record = db.query(SFTRecord).filter(SFTRecord.id == record_id).first()
        if not record:
            return False
        db.delete(record)
        db.commit()
        return True

    @staticmethod
    def duplicate_record(db: Session, record_id: str) -> Optional[Dict[str, Any]]:
        orig = db.query(SFTRecord).filter(SFTRecord.id == record_id).first()
        if not orig:
            return None
        clone = SFTRecord(
            project_id=orig.project_id,
            session_id=None,
            messages_json=orig.messages_json,
            turn_count=orig.turn_count,
            character_count=orig.character_count,
            metadata_json=orig.metadata_json,
            revision=1
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)
        return SFTService._format_record(clone)

    # ==========================================
    # Helpers
    # ==========================================
    @staticmethod
    def _format_session(s: SFTSession) -> Dict[str, Any]:
        msgs = []
        for m in sorted(s.messages, key=lambda x: x.sequence_order):
            msgs.append({
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "sequence_order": m.sequence_order,
                "model": m.model,
                "token_count": m.token_count,
                "created_at": m.created_at
            })

        return {
            "id": s.id,
            "project_id": s.project_id,
            "title": s.title,
            "system_prompt": s.system_prompt,
            "status": s.status,
            "provider_id": s.provider_id,
            "model": s.model,
            "temperature": s.temperature,
            "top_p": s.top_p,
            "max_tokens": s.max_tokens,
            "committed_record_id": s.committed_record_id,
            "messages": msgs,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        }

    @staticmethod
    def _format_record(r: SFTRecord) -> Dict[str, Any]:
        return {
            "id": r.id,
            "project_id": r.project_id,
            "session_id": r.session_id,
            "messages": json.loads(r.messages_json or "[]"),
            "turn_count": r.turn_count,
            "character_count": r.character_count,
            "metadata": json.loads(r.metadata_json or "{}"),
            "revision": r.revision,
            "created_at": r.created_at,
            "updated_at": r.updated_at
        }
