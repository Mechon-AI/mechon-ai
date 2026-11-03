-- Migration: 20261103200000_story_architect_revisions.sql
-- Conversation Revision History & Context Invalidation for Story Architect

CREATE TABLE IF NOT EXISTS story_architect_message_revisions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    role TEXT NOT NULL,
    original_content TEXT NOT NULL,
    modified_content TEXT NOT NULL,
    provider_id TEXT,
    model TEXT,
    revision_reason TEXT NOT NULL, -- 'prompt_edit', 'regenerate', 'manual_restore', 'downstream_invalidation'
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(message_id) REFERENCES story_architect_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_revisions_msg ON story_architect_message_revisions(message_id);
CREATE INDEX IF NOT EXISTS idx_story_revisions_sess ON story_architect_message_revisions(session_id);

ALTER TABLE story_architect_messages ADD COLUMN is_outdated INTEGER DEFAULT 0;
ALTER TABLE story_architect_messages ADD COLUMN revision_count INTEGER DEFAULT 0;
ALTER TABLE story_architect_messages ADD COLUMN updated_at TEXT;
