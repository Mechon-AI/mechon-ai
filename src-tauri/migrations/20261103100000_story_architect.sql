-- Migration: 20261103100000_story_architect.sql
-- Mechon AI: Story Architect & Autonomous Conversation Engine

-- 1. Story Architect Sessions
CREATE TABLE IF NOT EXISTS story_architect_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    interaction_type TEXT NOT NULL DEFAULT 'storytelling',
    primary_language TEXT NOT NULL DEFAULT 'en',
    secondary_language TEXT,
    target_turns INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, planning, in_progress, paused, completed, failed
    execution_mode TEXT NOT NULL DEFAULT 'manual', -- manual, auto_allow, hybrid
    auto_pause_conditions_json TEXT NOT NULL DEFAULT '["major_milestone", "contradiction_detected", "quality_below_threshold", "target_turns_reached"]',
    planning_provider_id TEXT,
    planning_model TEXT,
    inference_provider_id TEXT,
    inference_model TEXT,
    evaluation_provider_id TEXT,
    evaluation_model TEXT,
    temperature REAL DEFAULT 0.7,
    top_p REAL DEFAULT 0.9,
    max_tokens INTEGER DEFAULT 2048,
    max_turns INTEGER DEFAULT 20,
    max_agent_iterations INTEGER DEFAULT 50,
    token_budget INTEGER DEFAULT 100000,
    tokens_used INTEGER DEFAULT 0,
    sft_session_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_story_sessions_project ON story_architect_sessions(project_id);

-- 2. Planning Specifications
CREATE TABLE IF NOT EXISTS planning_specifications (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    premise TEXT NOT NULL DEFAULT '',
    world_environment TEXT DEFAULT '',
    character_profiles_json TEXT NOT NULL DEFAULT '[]',
    main_conflict TEXT DEFAULT '',
    secondary_conflicts TEXT DEFAULT '',
    important_events_json TEXT NOT NULL DEFAULT '[]',
    narrative_progression TEXT DEFAULT '',
    desired_ending TEXT DEFAULT '',
    constraints_forbidden_developments TEXT DEFAULT '',
    learning_objectives_json TEXT NOT NULL DEFAULT '[]',
    reasoning_objectives_json TEXT NOT NULL DEFAULT '[]',
    communication_objectives_json TEXT NOT NULL DEFAULT '[]',
    expected_assistant_behavior TEXT DEFAULT '',
    quality_requirements TEXT DEFAULT '',
    completion_criteria TEXT DEFAULT '',
    custom_fields_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);

-- 3. Planning Milestones
CREATE TABLE IF NOT EXISTS planning_milestones (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    objective TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed, blocked
    completion_criteria TEXT,
    associated_turn_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_planning_milestones_session ON planning_milestones(session_id);

-- 4. Story Architect Messages (Conversation Turns)
CREATE TABLE IF NOT EXISTS story_architect_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    role TEXT NOT NULL, -- user, assistant, system
    content TEXT NOT NULL,
    prompt_history_id TEXT,
    milestone_id TEXT,
    provider_id TEXT,
    model TEXT,
    token_count INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    translations_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_story_messages_session ON story_architect_messages(session_id);

-- 5. Planning Prompt History
CREATE TABLE IF NOT EXISTS planning_prompt_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    prompt_content TEXT NOT NULL,
    current_objective TEXT NOT NULL,
    related_milestone_id TEXT,
    expected_outcome TEXT,
    contextual_rationale TEXT,
    suggested_parameters_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'proposed', -- proposed, approved, edited, rejected, regenerated
    engineer_notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_prompt_history_session ON planning_prompt_history(session_id);

-- 6. Narrative States
CREATE TABLE IF NOT EXISTS narrative_states (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    current_arc TEXT,
    current_scene TEXT,
    current_objective TEXT,
    character_states_json TEXT NOT NULL DEFAULT '{}',
    relationship_states_json TEXT NOT NULL DEFAULT '{}',
    established_facts_json TEXT NOT NULL DEFAULT '[]',
    unresolved_conflicts_json TEXT NOT NULL DEFAULT '[]',
    completed_milestones_json TEXT NOT NULL DEFAULT '[]',
    active_milestones_json TEXT NOT NULL DEFAULT '[]',
    next_objective TEXT,
    completion_status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, paused, completed
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_narrative_states_session ON narrative_states(session_id);

-- 7. Agent Evaluations
CREATE TABLE IF NOT EXISTS agent_evaluations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    turn_index INTEGER NOT NULL,
    consistency_score REAL DEFAULT 1.0,
    consistency_details TEXT,
    progress_score REAL DEFAULT 1.0,
    progress_details TEXT,
    quality_score REAL DEFAULT 1.0,
    quality_details TEXT,
    detected_contradictions_json TEXT NOT NULL DEFAULT '[]',
    repetition_detected INTEGER DEFAULT 0,
    next_recommended_action TEXT NOT NULL DEFAULT 'continue_objective', -- continue_objective, advance_milestone, revisit_objective, request_engineer_intervention, complete_session
    evaluation_summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agent_evaluations_session ON agent_evaluations(session_id);

-- 8. Story Architect Custom & Builtin Planning Templates
CREATE TABLE IF NOT EXISTS story_architect_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    interaction_type TEXT NOT NULL,
    description TEXT,
    is_builtin INTEGER DEFAULT 0,
    template_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
