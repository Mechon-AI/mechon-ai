-- Initial Schema Migration for Mechon AI
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived);

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key_encrypted TEXT,
    credential_ref TEXT,
    default_model TEXT,
    models_cache_json TEXT NOT NULL DEFAULT '[]',
    timeout_seconds INTEGER NOT NULL DEFAULT 60,
    is_active INTEGER NOT NULL DEFAULT 1,
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sft_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Conversation',
    system_prompt TEXT NOT NULL DEFAULT 'You are a helpful, respectful, and honest assistant.',
    status TEXT NOT NULL DEFAULT 'draft',
    provider_id TEXT,
    model TEXT,
    temperature REAL NOT NULL DEFAULT 0.7,
    top_p REAL NOT NULL DEFAULT 0.9,
    max_tokens INTEGER NOT NULL DEFAULT 2048,
    committed_record_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sft_sessions_project ON sft_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sft_sessions_status ON sft_sessions(status);

CREATE TABLE IF NOT EXISTS sft_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    model TEXT,
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sft_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sft_messages_session ON sft_messages(session_id, sequence_order);

CREATE TABLE IF NOT EXISTS sft_records (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    session_id TEXT,
    messages_json TEXT NOT NULL,
    turn_count INTEGER NOT NULL DEFAULT 0,
    character_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sft_records_project ON sft_records(project_id);
CREATE INDEX IF NOT EXISTS idx_sft_records_session ON sft_records(session_id);

CREATE TABLE IF NOT EXISTS dpo_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    system_prompt TEXT,
    response_a TEXT NOT NULL DEFAULT '',
    response_b TEXT NOT NULL DEFAULT '',
    preference TEXT,
    rationale TEXT,
    helpfulness_rating INTEGER,
    factuality_rating INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dpo_tasks_project ON dpo_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_dpo_tasks_status ON dpo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_dpo_tasks_preference ON dpo_tasks(preference);

CREATE TABLE IF NOT EXISTS dataset_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    dataset_type TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    checksum_sha256 TEXT NOT NULL,
    parent_version_id TEXT,
    change_summary TEXT,
    description TEXT,
    snapshot_data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_versions_project ON dataset_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_type ON dataset_versions(dataset_type);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
