"""
Pydantic schemas for request validation, serialization, and API responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# =====================
# Project Schemas
# =====================
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_archived: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class ProjectResponse(ProjectBase):
    id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    sft_record_count: int = 0
    dpo_task_count: int = 0
    active_draft_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# =====================
# SFT Schemas
# =====================
class SFTMessageItem(BaseModel):
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str = Field(..., description="Message text content")
    model: Optional[str] = None
    token_count: Optional[int] = 0


class SFTMessageCreate(BaseModel):
    role: str
    content: str
    model: Optional[str] = None


class SFTMessageUpdate(BaseModel):
    content: str


class SFTSessionCreate(BaseModel):
    project_id: str
    title: Optional[str] = "Untitled Conversation"
    system_prompt: Optional[str] = "You are a helpful, respectful, and honest assistant."
    provider_id: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 2048


class SFTSessionUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None
    status: Optional[str] = None
    provider_id: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None


class SFTSessionResponse(BaseModel):
    id: str
    project_id: str
    title: str
    system_prompt: str
    status: str
    provider_id: Optional[str] = None
    model: Optional[str] = None
    temperature: float
    top_p: float
    max_tokens: int
    committed_record_id: Optional[str] = None
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SFTCommitRequest(BaseModel):
    title_override: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class SFTRecordResponse(BaseModel):
    id: str
    project_id: str
    session_id: Optional[str] = None
    messages: List[Dict[str, Any]]
    turn_count: int
    character_count: int
    metadata: Dict[str, Any]
    revision: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SFTRecordUpdate(BaseModel):
    messages: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


# =====================
# DPO Schemas
# =====================
class DPOTaskCreate(BaseModel):
    project_id: str
    prompt: str = Field(..., min_length=1)
    system_prompt: Optional[str] = None
    response_a: Optional[str] = ""
    response_b: Optional[str] = ""
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class DPOAnnotationUpdate(BaseModel):
    preference: str = Field(..., description="'a', 'b', 'tie', 'both_bad', 'skip', 'flag'")
    rationale: Optional[str] = None
    helpfulness_rating: Optional[int] = None
    factuality_rating: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class DPOTaskUpdate(BaseModel):
    prompt: Optional[str] = None
    system_prompt: Optional[str] = None
    response_a: Optional[str] = None
    response_b: Optional[str] = None
    preference: Optional[str] = None
    rationale: Optional[str] = None
    helpfulness_rating: Optional[int] = None
    factuality_rating: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class DPOTaskResponse(BaseModel):
    id: str
    project_id: str
    prompt: str
    system_prompt: Optional[str] = None
    response_a: str
    response_b: str
    preference: Optional[str] = None
    rationale: Optional[str] = None
    helpfulness_rating: Optional[int] = None
    factuality_rating: Optional[int] = None
    status: str
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DPOGenerateRequest(BaseModel):
    provider_id: Optional[str] = None
    model: Optional[str] = None
    prompt: str
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 2048
    target: str = Field(..., description="'a', 'b', or 'both'")


# =====================
# Provider Schemas
# =====================
class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider_type: str = Field(..., description="openai_compatible, ollama, custom_http, mock")
    base_url: str
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    timeout_seconds: Optional[int] = 60
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    timeout_seconds: Optional[int] = None
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class ProviderResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    base_url: str
    has_api_key: bool
    default_model: Optional[str] = None
    models_cache: List[str] = Field(default_factory=list)
    timeout_seconds: int
    is_active: bool
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModelTestRequest(BaseModel):
    provider_id: str
    model: Optional[str] = None
    prompt: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 1024


# =====================
# Quality Control / Validation Schemas
# =====================
class ValidationIssue(BaseModel):
    record_id: str
    dataset_type: str
    severity: str
    issue_type: str
    message: str
    suggested_fix: Optional[str] = None


class ValidationReport(BaseModel):
    dataset_type: str
    total_records: int
    passed_records: int
    failed_records: int
    error_count: int
    warning_count: int
    issues: List[ValidationIssue]
    generated_at: datetime


# =====================
# Versioning Schemas
# =====================
class SnapshotCreateRequest(BaseModel):
    project_id: str
    dataset_type: str = Field(..., description="'sft', 'dpo', or 'combined'")
    version_tag: str
    description: Optional[str] = None


class VersionResponse(BaseModel):
    id: str
    project_id: str
    dataset_type: str
    version_tag: str
    record_count: int
    checksum_sha256: str
    parent_version_id: Optional[str] = None
    change_summary: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================
# Analytics Schemas
# =====================
class AnalyticsResponse(BaseModel):
    project_id: Optional[str] = None
    total_projects: int
    sft_metrics: Dict[str, Any]
    dpo_metrics: Dict[str, Any]
    shared_metrics: Dict[str, Any]
    model_usage: Dict[str, int]
    timeline_growth: List[Dict[str, Any]]
