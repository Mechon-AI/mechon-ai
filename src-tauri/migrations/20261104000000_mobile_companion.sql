-- Migration: 20261104000000_mobile_companion.sql
-- Mechon AI: Mobile Companion Gateway, Paired Devices & Conversation Sync Pipeline

CREATE TABLE IF NOT EXISTS paired_devices (
    id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    device_platform TEXT NOT NULL DEFAULT 'android',
    auth_token_hash TEXT NOT NULL,
    is_approved INTEGER NOT NULL DEFAULT 1,
    last_active_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_sync_transfers (
    id TEXT PRIMARY KEY,
    device_id TEXT REFERENCES paired_devices(id) ON DELETE SET NULL,
    transfer_id TEXT NOT NULL UNIQUE,
    conversation_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'received',
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_imported_conversations (
    id TEXT PRIMARY KEY,
    transfer_id TEXT REFERENCES mobile_sync_transfers(id) ON DELETE CASCADE,
    original_session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    system_prompt TEXT,
    model_id TEXT,
    provider_id TEXT,
    messages_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    converted_sft_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paired_devices_token ON paired_devices(auth_token_hash);
CREATE INDEX IF NOT EXISTS idx_mobile_transfers_dev ON mobile_sync_transfers(device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_imports_transfer ON mobile_imported_conversations(transfer_id);
CREATE INDEX IF NOT EXISTS idx_mobile_imports_status ON mobile_imported_conversations(status);
