-- Migration: 20261103210000_tri_agent_model_selector.sql
-- Mechon AI: Independent Tri-Agent Model Selection & Runtime Configuration

ALTER TABLE story_architect_sessions ADD COLUMN planning_agent_config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE story_architect_sessions ADD COLUMN inference_agent_config_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE story_architect_sessions ADD COLUMN evaluation_agent_config_json TEXT NOT NULL DEFAULT '{}';
