"""
Database models for Mechon AI.
Includes Projects, SFT Sessions, SFT Records, DPO Tasks, Providers,
Dataset Versions, and Audit Logs.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    settings_json = Column(Text, default="{}", nullable=False)

    # Relationships
    sft_sessions = relationship("SFTSession", back_populates="project", cascade="all, delete-orphan")
    sft_records = relationship("SFTRecord", back_populates="project", cascade="all, delete-orphan")
    dpo_tasks = relationship("DPOTask", back_populates="project", cascade="all, delete-orphan")
    versions = relationship("DatasetVersion", back_populates="project", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="project", cascade="all, delete-orphan")


class SFTSession(Base):
    """
    An active or saved SFT chat session. Represents ONE candidate training conversation.
    Once finalized, the entire multi-turn conversation is committed as ONE SFTRecord.
    """
    __tablename__ = "sft_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="Untitled Conversation", nullable=False)
    system_prompt = Column(Text, default="You are a helpful, respectful, and honest assistant.", nullable=False)
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, in_progress, ready_to_commit, committed, archived
    provider_id = Column(String(36), nullable=True)
    model = Column(String(255), nullable=True)
    temperature = Column(Float, default=0.7, nullable=False)
    top_p = Column(Float, default=0.9, nullable=False)
    max_tokens = Column(Integer, default=2048, nullable=False)
    committed_record_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="sft_sessions")
    messages = relationship("SFTMessage", back_populates="session", cascade="all, delete-orphan", order_by="SFTMessage.sequence_order")


class SFTMessage(Base):
    """A single turn in an SFT chat session."""
    __tablename__ = "sft_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sft_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(30), nullable=False)  # system, user, assistant
    content = Column(Text, nullable=False)
    sequence_order = Column(Integer, nullable=False)
    model = Column(String(255), nullable=True)
    token_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("SFTSession", back_populates="messages")

    __table_args__ = (
        Index("idx_session_seq", "session_id", "sequence_order"),
    )


class SFTRecord(Base):
    """
    A committed, canonical SFT dataset record.
    IMPORTANT: One complete multi-turn conversation is stored as ONE SFT record.
    The messages array is stored in JSON form for instant zero-join serialization and export,
    while maintaining a link to the originating session for provenance.
    """
    __tablename__ = "sft_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(36), nullable=True, index=True)  # Provenance tracking
    messages_json = Column(Text, nullable=False)  # JSON array: [{"role": "user", "content": "..."}, ...]
    turn_count = Column(Integer, default=0, nullable=False)
    character_count = Column(Integer, default=0, nullable=False)
    metadata_json = Column(Text, default="{}", nullable=False)  # tags, source, model, prompt_template
    revision = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="sft_records")


class DPOTask(Base):
    """
    A Direct Preference Optimization preference pair.
    Stores prompt, response A, response B, and preference judgment (chosen vs rejected).
    """
    __tablename__ = "dpo_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=True)
    response_a = Column(Text, default="", nullable=False)
    response_b = Column(Text, default="", nullable=False)
    
    # Preference: 'a', 'b', 'tie', 'both_bad', 'skip', 'flag', or None (pending)
    preference = Column(String(30), nullable=True, index=True)
    
    # Rationale and quality ratings
    rationale = Column(Text, nullable=True)
    helpfulness_rating = Column(Integer, nullable=True)  # 1-5
    factuality_rating = Column(Integer, nullable=True)   # 1-5
    status = Column(String(50), default="pending", nullable=False, index=True)  # pending, completed, flagged, skipped
    
    metadata_json = Column(Text, default="{}", nullable=False)  # model_a, model_b, tags, latency_a, latency_b
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="dpo_tasks")


class Provider(Base):
    """Inference model provider configuration."""
    __tablename__ = "providers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    provider_type = Column(String(50), nullable=False)  # openai_compatible, ollama, custom_http, mock
    base_url = Column(String(512), nullable=False)
    api_key_encrypted = Column(Text, nullable=True)
    default_model = Column(String(255), nullable=True)
    models_cache_json = Column(Text, default="[]", nullable=False)
    timeout_seconds = Column(Integer, default=60, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    settings_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DatasetVersion(Base):
    """Snapshot version of SFT or DPO datasets."""
    __tablename__ = "dataset_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_type = Column(String(30), nullable=False, index=True)  # sft, dpo, combined
    version_tag = Column(String(50), nullable=False)  # e.g. "v1.0.0", "snapshot-20261102"
    record_count = Column(Integer, default=0, nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    parent_version_id = Column(String(36), nullable=True)
    change_summary = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    snapshot_data_json = Column(Text, nullable=False)  # full serialized snapshot for rollback
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="versions")


class AuditLog(Base):
    """Audit log for dataset events (creation, commits, edits, exports, deletes)."""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # project, sft_session, sft_record, dpo_task, export
    entity_id = Column(String(36), nullable=True)
    details_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="audit_logs")


class AppSetting(Base):
    """Key-value application settings."""
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
