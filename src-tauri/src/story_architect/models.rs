use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterProfile {
    pub name: String,
    pub role: String,
    pub personality: String,
    pub relationship_to_assistant: Option<String>,
    pub background: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRuntimeConfig {
    pub provider_id: String,
    pub model_id: String,
    #[serde(default)]
    pub model_display_name: Option<String>,
    #[serde(default = "default_agent_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub capabilities: Vec<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<usize>,
}

fn default_agent_enabled() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySession {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub interaction_type: String, // storytelling, interactive_roleplay, technical_discussion, etc.
    pub primary_language: String,
    pub secondary_language: Option<String>,
    pub target_turns: usize,
    pub status: String, // draft, planning, in_progress, paused, completed, failed
    pub execution_mode: String, // manual, auto_allow, hybrid
    pub auto_pause_conditions: Vec<String>,
    pub planning_provider_id: Option<String>,
    pub planning_model: Option<String>,
    pub inference_provider_id: Option<String>,
    pub inference_model: Option<String>,
    pub evaluation_provider_id: Option<String>,
    pub evaluation_model: Option<String>,
    #[serde(default)]
    pub planning_agent_config: Option<AgentRuntimeConfig>,
    #[serde(default)]
    pub inference_agent_config: Option<AgentRuntimeConfig>,
    #[serde(default)]
    pub evaluation_agent_config: Option<AgentRuntimeConfig>,
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: usize,
    pub max_turns: usize,
    pub max_agent_iterations: usize,
    pub token_budget: usize,
    pub tokens_used: usize,
    pub sft_session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStorySessionInput {
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub interaction_type: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub target_turns: Option<usize>,
    pub execution_mode: Option<String>,
    pub auto_pause_conditions: Option<Vec<String>>,
    pub planning_provider_id: Option<String>,
    pub planning_model: Option<String>,
    pub inference_provider_id: Option<String>,
    pub inference_model: Option<String>,
    pub evaluation_provider_id: Option<String>,
    pub evaluation_model: Option<String>,
    pub planning_agent_config: Option<AgentRuntimeConfig>,
    pub inference_agent_config: Option<AgentRuntimeConfig>,
    pub evaluation_agent_config: Option<AgentRuntimeConfig>,
    pub template_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStorySessionInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub interaction_type: Option<String>,
    pub primary_language: Option<String>,
    pub secondary_language: Option<String>,
    pub target_turns: Option<usize>,
    pub status: Option<String>,
    pub execution_mode: Option<String>,
    pub auto_pause_conditions: Option<Vec<String>>,
    pub planning_provider_id: Option<String>,
    pub planning_model: Option<String>,
    pub inference_provider_id: Option<String>,
    pub inference_model: Option<String>,
    pub evaluation_provider_id: Option<String>,
    pub evaluation_model: Option<String>,
    pub planning_agent_config: Option<AgentRuntimeConfig>,
    pub inference_agent_config: Option<AgentRuntimeConfig>,
    pub evaluation_agent_config: Option<AgentRuntimeConfig>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<usize>,
    pub max_turns: Option<usize>,
    pub token_budget: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningSpecification {
    pub id: String,
    pub session_id: String,
    pub premise: String,
    pub world_environment: String,
    pub character_profiles: Vec<CharacterProfile>,
    pub main_conflict: String,
    pub secondary_conflicts: String,
    pub important_events: Vec<String>,
    pub narrative_progression: String,
    pub desired_ending: String,
    pub constraints_forbidden_developments: String,
    pub learning_objectives: Vec<String>,
    pub reasoning_objectives: Vec<String>,
    pub communication_objectives: Vec<String>,
    pub expected_assistant_behavior: String,
    pub quality_requirements: String,
    pub completion_criteria: String,
    pub custom_fields: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavePlanningSpecInput {
    pub session_id: String,
    pub premise: String,
    pub world_environment: Option<String>,
    pub character_profiles: Option<Vec<CharacterProfile>>,
    pub main_conflict: Option<String>,
    pub secondary_conflicts: Option<String>,
    pub important_events: Option<Vec<String>>,
    pub narrative_progression: Option<String>,
    pub desired_ending: Option<String>,
    pub constraints_forbidden_developments: Option<String>,
    pub learning_objectives: Option<Vec<String>>,
    pub reasoning_objectives: Option<Vec<String>>,
    pub communication_objectives: Option<Vec<String>>,
    pub expected_assistant_behavior: Option<String>,
    pub quality_requirements: Option<String>,
    pub completion_criteria: Option<String>,
    pub custom_fields: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningMilestone {
    pub id: String,
    pub session_id: String,
    pub order_index: usize,
    pub title: String,
    pub description: Option<String>,
    pub objective: String,
    pub status: String, // pending, active, completed, blocked
    pub completion_criteria: Option<String>,
    pub associated_turn_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveMilestoneInput {
    pub id: Option<String>,
    pub order_index: usize,
    pub title: String,
    pub description: Option<String>,
    pub objective: String,
    pub status: Option<String>,
    pub completion_criteria: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryMessage {
    pub id: String,
    pub session_id: String,
    pub turn_index: usize,
    pub role: String, // user, assistant, system
    pub content: String,
    pub prompt_history_id: Option<String>,
    pub milestone_id: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub token_count: usize,
    pub latency_ms: usize,
    pub translations: Value,
    pub is_outdated: bool,
    pub revision_count: usize,
    pub updated_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryMessageRevision {
    pub id: String,
    pub message_id: String,
    pub session_id: String,
    pub turn_index: usize,
    pub role: String,
    pub original_content: String,
    pub modified_content: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub revision_reason: String,
    pub metadata: Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditStoryMessageInput {
    pub session_id: String,
    pub message_id: String,
    pub content: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegenerateAssistantTurnInput {
    pub session_id: String,
    pub turn_index: usize,
    pub provider_id: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreRevisionInput {
    pub session_id: String,
    pub revision_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanningPromptHistory {
    pub id: String,
    pub session_id: String,
    pub turn_index: usize,
    pub prompt_content: String,
    pub current_objective: String,
    pub related_milestone_id: Option<String>,
    pub expected_outcome: Option<String>,
    pub contextual_rationale: Option<String>,
    pub suggested_parameters: Value,
    pub status: String, // proposed, approved, edited, rejected, regenerated
    pub engineer_notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeState {
    pub id: String,
    pub session_id: String,
    pub turn_index: usize,
    pub current_arc: Option<String>,
    pub current_scene: Option<String>,
    pub current_objective: Option<String>,
    pub character_states: Value,
    pub relationship_states: Value,
    pub established_facts: Vec<String>,
    pub unresolved_conflicts: Vec<String>,
    pub completed_milestones: Vec<String>,
    pub active_milestones: Vec<String>,
    pub next_objective: Option<String>,
    pub completion_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentEvaluation {
    pub id: String,
    pub session_id: String,
    pub turn_index: usize,
    pub consistency_score: f64,
    pub consistency_details: Option<String>,
    pub progress_score: f64,
    pub progress_details: Option<String>,
    pub quality_score: f64,
    pub quality_details: Option<String>,
    pub detected_contradictions: Vec<String>,
    pub repetition_detected: bool,
    pub next_recommended_action: String, // continue_objective, advance_milestone, revisit_objective, request_engineer_intervention, complete_session
    pub evaluation_summary: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryTemplate {
    pub id: String,
    pub name: String,
    pub interaction_type: String,
    pub description: Option<String>,
    pub is_builtin: bool,
    pub template: Value,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveStoryTemplateInput {
    pub name: String,
    pub interaction_type: String,
    pub description: Option<String>,
    pub template: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitToSFTInput {
    pub session_id: String,
    pub include_planning_metadata: bool,
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitToSFTResult {
    pub sft_session_id: String,
    pub sft_record_id: String,
    pub message_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoStepResult {
    pub action_taken: String, // "prompt_generated", "turn_executed", "cycle_completed", "paused", "completed", "error"
    pub session_status: String,
    pub engine_state: String, // "idle", "planning", "awaiting_approval", "generating", "evaluating", "updating_context", "next_prompt", "paused", "completed", "error"
    pub pause_reason: Option<String>,
    pub prompt: Option<PlanningPromptHistory>,
    pub message: Option<StoryMessage>,
    pub evaluation: Option<AgentEvaluation>,
    pub narrative_state: Option<NarrativeState>,
    pub logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionTurnResult {
    pub user_message: StoryMessage,
    pub assistant_message: StoryMessage,
    pub evaluation: AgentEvaluation,
    pub updated_narrative_state: NarrativeState,
}
