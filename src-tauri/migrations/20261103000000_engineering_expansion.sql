-- Fine-Tuning Engineering Workstation Schema Migration
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS template_configs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_family TEXT NOT NULL,
    hf_model_id TEXT,
    bos_token TEXT,
    eos_token TEXT,
    chat_template TEXT NOT NULL,
    supports_system_role INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_configs_project ON template_configs(project_id);

CREATE TABLE IF NOT EXISTS dataset_splits (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    seed INTEGER NOT NULL DEFAULT 42,
    train_pct REAL NOT NULL DEFAULT 0.8,
    val_pct REAL NOT NULL DEFAULT 0.1,
    eval_pct REAL NOT NULL DEFAULT 0.1,
    leakage_free INTEGER NOT NULL DEFAULT 1,
    total_count INTEGER NOT NULL DEFAULT 0,
    train_count INTEGER NOT NULL DEFAULT 0,
    val_count INTEGER NOT NULL DEFAULT 0,
    eval_count INTEGER NOT NULL DEFAULT 0,
    config_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dataset_splits_project ON dataset_splits(project_id);

CREATE TABLE IF NOT EXISTS dataset_split_assignments (
    split_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    record_type TEXT NOT NULL DEFAULT 'sft',
    split_name TEXT NOT NULL,
    group_id TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY(split_id, record_id),
    FOREIGN KEY(split_id) REFERENCES dataset_splits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_split_assignments_split ON dataset_split_assignments(split_id);
CREATE INDEX IF NOT EXISTS idx_split_assignments_record ON dataset_split_assignments(record_id);

CREATE TABLE IF NOT EXISTS duplicate_review_decisions (
    project_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    note TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(project_id, group_id, record_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_duplicate_decisions_project ON duplicate_review_decisions(project_id);

CREATE TABLE IF NOT EXISTS training_readiness_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    model_family TEXT,
    max_seq_len INTEGER,
    total_records INTEGER NOT NULL,
    summary_json TEXT NOT NULL,
    report_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_readiness_reports_project ON training_readiness_reports(project_id);
