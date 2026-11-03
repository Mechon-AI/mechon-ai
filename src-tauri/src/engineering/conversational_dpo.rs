use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageTurn {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationalDPORecord {
    pub prompt: Vec<ChatMessageTurn>,
    pub chosen: Vec<ChatMessageTurn>,
    pub rejected: Vec<ChatMessageTurn>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

pub struct ConversationalDPOEngine;

impl ConversationalDPOEngine {
    /// Formats a DPO task into Hugging Face TRL Conversational Preference format
    pub fn format_task(
        id: &str,
        system_prompt: Option<&str>,
        prompt: &str,
        response_a: &str,
        response_b: &str,
        preference: Option<&str>, // "a" or "b"
        rationale: Option<&str>,
        metadata: Option<Value>,
    ) -> Option<ConversationalDPORecord> {
        let pref = preference?.to_lowercase();
        let (chosen_text, rejected_text) = if pref == "a" {
            (response_a, response_b)
        } else if pref == "b" {
            (response_b, response_a)
        } else {
            return None; // Skip unannotated or tie/flagged records
        };

        let mut prompt_turns = Vec::new();

        if let Some(sys) = system_prompt {
            if !sys.trim().is_empty() {
                prompt_turns.push(ChatMessageTurn {
                    role: "system".to_string(),
                    content: sys.trim().to_string(),
                });
            }
        }

        prompt_turns.push(ChatMessageTurn {
            role: "user".to_string(),
            content: prompt.trim().to_string(),
        });

        let chosen_turns = vec![ChatMessageTurn {
            role: "assistant".to_string(),
            content: chosen_text.trim().to_string(),
        }];

        let rejected_turns = vec![ChatMessageTurn {
            role: "assistant".to_string(),
            content: rejected_text.trim().to_string(),
        }];

        Some(ConversationalDPORecord {
            prompt: prompt_turns,
            chosen: chosen_turns,
            rejected: rejected_turns,
            id: Some(id.to_string()),
            rationale: rationale.map(|r| r.to_string()),
            metadata,
        })
    }

    /// Serializes multiple DPO tasks into JSON or JSONL format
    pub fn serialize_dataset(
        records: &[ConversationalDPORecord],
        format_type: &str,
    ) -> Result<String, String> {
        match format_type.to_lowercase().as_str() {
            "jsonl" => {
                let lines: Result<Vec<String>, _> = records
                    .iter()
                    .map(|r| serde_json::to_string(r))
                    .collect();
                lines
                    .map(|l| l.join("\n"))
                    .map_err(|e| format!("Failed to serialize conversational DPO JSONL: {}", e))
            }
            _ => serde_json::to_string_pretty(records)
                .map_err(|e| format!("Failed to serialize conversational DPO JSON: {}", e)),
        }
    }
}
