export type InteractionType =
  | 'storytelling'
  | 'interactive_roleplay'
  | 'technical_discussion'
  | 'educational_tutoring'
  | 'interview_simulation'
  | 'debate'
  | 'customer_support_simulation'
  | 'custom';

export type ExecutionMode = 'manual' | 'hybrid' | 'auto_allow';

export type SessionStatus = 'draft' | 'in_progress' | 'paused' | 'completed' | 'archived';

export interface CharacterProfile {
  name: string;
  role: string;
  personality: string;
  relationship_to_assistant?: string;
  background?: string;
}

export interface StorySession {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  interaction_type: InteractionType | string;
  primary_language: string;
  secondary_language?: string;
  target_turns: number;
  status: SessionStatus | string;
  execution_mode: ExecutionMode | string;
  auto_pause_conditions: string[];
  planning_provider_id?: string;
  planning_model?: string;
  inference_provider_id?: string;
  inference_model?: string;
  evaluation_provider_id?: string;
  evaluation_model?: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  max_turns: number;
  max_agent_iterations: number;
  token_budget: number;
  tokens_used: number;
  sft_session_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PlanningSpecification {
  id: string;
  session_id: string;
  premise: string;
  world_environment: string;
  character_profiles: CharacterProfile[];
  main_conflict: string;
  secondary_conflicts: string;
  important_events: string[];
  narrative_progression: string;
  desired_ending: string;
  constraints_forbidden_developments: string;
  learning_objectives: string[];
  reasoning_objectives: string[];
  communication_objectives: string[];
  expected_assistant_behavior: string;
  quality_requirements: string;
  completion_criteria: string;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlanningMilestone {
  id: string;
  session_id: string;
  order_index: number;
  title: string;
  description?: string;
  objective: string;
  status: 'pending' | 'active' | 'completed' | 'blocked' | string;
  completion_criteria?: string;
  associated_turn_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface StoryMessage {
  id: string;
  session_id: string;
  turn_index: number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  prompt_history_id?: string;
  milestone_id?: string;
  provider_id?: string;
  model?: string;
  token_count: number;
  latency_ms: number;
  translations?: Record<string, string>;
  is_outdated?: boolean;
  revision_count?: number;
  updated_at?: string;
  created_at: string;
}

export interface StoryMessageRevision {
  id: string;
  message_id: string;
  session_id: string;
  turn_index: number;
  role: string;
  original_content: string;
  modified_content: string;
  provider_id?: string;
  model?: string;
  revision_reason: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface EditStoryMessageInput {
  session_id: string;
  message_id: string;
  content: string;
  reason?: string;
}

export interface RegenerateAssistantTurnInput {
  session_id: string;
  turn_index: number;
  provider_id?: string;
  model?: string;
}

export interface RestoreRevisionInput {
  session_id: string;
  revision_id: string;
}

export interface ExecutionTurnResult {
  user_message: StoryMessage;
  assistant_message: StoryMessage;
  evaluation: AgentEvaluation;
  updated_narrative_state: NarrativeState;
}

export interface PlanningPromptHistory {
  id: string;
  session_id: string;
  turn_index: number;
  prompt_content: string;
  current_objective: string;
  related_milestone_id?: string;
  expected_outcome?: string;
  contextual_rationale?: string;
  suggested_parameters?: Record<string, any>;
  status: 'proposed' | 'approved' | 'edited' | 'rejected' | 'regenerated' | string;
  engineer_notes?: string;
  created_at: string;
}

export interface NarrativeState {
  id: string;
  session_id: string;
  turn_index: number;
  current_arc?: string;
  current_scene?: string;
  pacing_summary?: string;
  character_states: Record<string, any>;
  relationship_states: Record<string, any>;
  established_facts: string[];
  unresolved_conflicts: string[];
  completed_milestones: string[];
  open_questions: string[];
  next_objective_hint?: string;
  continuity_status: string;
  created_at: string;
}

export interface AgentEvaluation {
  id: string;
  session_id: string;
  turn_index: number;
  consistency_score: number;
  consistency_details?: string;
  progress_score: number;
  progress_details?: string;
  quality_score: number;
  quality_details?: string;
  detected_contradictions: string[];
  repetition_detected: boolean;
  next_recommended_action: string;
  evaluation_summary: string;
  created_at: string;
}

export interface CreateStorySessionInput {
  project_id: string;
  title: string;
  description?: string;
  interaction_type?: string;
  primary_language?: string;
  secondary_language?: string;
  target_turns?: number;
  execution_mode?: string;
  auto_pause_conditions?: string[];
  planning_provider_id?: string;
  planning_model?: string;
  inference_provider_id?: string;
  inference_model?: string;
  evaluation_provider_id?: string;
  evaluation_model?: string;
  template_id?: string;
}

export interface UpdateStorySessionInput {
  id: string;
  title?: string;
  description?: string;
  interaction_type?: string;
  primary_language?: string;
  secondary_language?: string;
  target_turns?: number;
  status?: string;
  execution_mode?: string;
  auto_pause_conditions?: string[];
  planning_provider_id?: string;
  planning_model?: string;
  inference_provider_id?: string;
  inference_model?: string;
  evaluation_provider_id?: string;
  evaluation_model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_turns?: number;
  token_budget?: number;
}

export interface SavePlanningSpecInput {
  session_id: string;
  premise: string;
  world_environment?: string;
  character_profiles?: CharacterProfile[];
  main_conflict?: string;
  secondary_conflicts?: string;
  important_events?: string[];
  narrative_progression?: string;
  desired_ending?: string;
  constraints_forbidden_developments?: string;
  learning_objectives?: string[];
  reasoning_objectives?: string[];
  communication_objectives?: string[];
  expected_assistant_behavior?: string;
  quality_requirements?: string;
  completion_criteria?: string;
  custom_fields?: Record<string, any>;
}

export interface SaveMilestoneInput {
  id?: string;
  order_index: number;
  title: string;
  description?: string;
  objective: string;
  status?: string;
  completion_criteria?: string;
}

export interface CommitToSFTInput {
  session_id: string;
  title?: string;
  description?: string;
  include_planning_metadata: boolean;
}

export interface CommitToSFTResult {
  sft_session_id: string;
  sft_record_id: string;
  message_count: number;
}

export interface AutoStepResult {
  action_taken: string;
  session_status: string;
  engine_state: string;
  pause_reason?: string;
  prompt?: PlanningPromptHistory;
  message?: StoryMessage;
  evaluation?: AgentEvaluation;
  narrative_state?: NarrativeState;
  logs: string[];
}

export interface StoryTemplate {
  id: string;
  title: string;
  description: string;
  interaction_type: InteractionType;
  default_spec: Partial<PlanningSpecification>;
  default_milestones: Array<{
    title: string;
    description: string;
    objective: string;
  }>;
}
