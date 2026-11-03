use minijinja::{context, Environment};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelTemplateDef {
    pub id: String,
    pub name: String,
    pub family: String,
    pub default_hf_repo: String,
    pub bos_token: String,
    pub eos_token: String,
    #[serde(alias = "supports_system_role")]
    pub supports_system: bool,
    pub required_roles: Vec<String>,
    pub template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub record_id: String,
    pub is_valid: bool,
    #[serde(alias = "rendered_template")]
    pub rendered: Option<String>,
    pub token_estimate: usize,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateCompatibilitySummary {
    pub model_id: String,
    pub model_name: String,
    pub family: String,
    #[serde(alias = "total_records")]
    pub total_examples: usize,
    #[serde(alias = "compliant_records")]
    pub compliant_count: usize,
    #[serde(alias = "non_compliant_records")]
    pub non_compliant_count: usize,
    pub compliance_rate: f64,
    pub common_errors: Vec<(String, usize)>,
    #[serde(alias = "results")]
    pub sample_results: Vec<ValidationResult>,
}

pub struct ChatTemplateEngine;

impl ChatTemplateEngine {
    pub fn get_curated_models() -> Vec<ModelTemplateDef> {
        vec![
            ModelTemplateDef {
                id: "llama-3".to_string(),
                name: "Meta Llama 3 / 3.1 / 3.2 / 3.3".to_string(),
                family: "llama".to_string(),
                default_hf_repo: "meta-llama/Llama-3.1-8B-Instruct".to_string(),
                bos_token: "<|begin_of_text|>".to_string(),
                eos_token: "<|eot_id|>".to_string(),
                supports_system: true,
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{{- bos_token }}\n{%- for message in messages %}\n{{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\n\n' + message['content'] | trim + '<|eot_id|>' }}\n{%- endfor %}\n{%- if add_generation_prompt %}\n{{- '<|start_header_id|>assistant<|end_header_id|>\n\n' }}\n{%- endif %}".to_string(),
            },
            ModelTemplateDef {
                id: "qwen-2.5".to_string(),
                name: "Qwen 2.5 / 2".to_string(),
                family: "qwen".to_string(),
                default_hf_repo: "Qwen/Qwen2.5-7B-Instruct".to_string(),
                bos_token: "".to_string(),
                eos_token: "<|im_end|>".to_string(),
                supports_system: true,
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{%- for message in messages %}\n{{- '<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>\n' }}\n{%- endfor %}\n{%- if add_generation_prompt %}\n{{- '<|im_start|>assistant\n' }}\n{%- endif %}".to_string(),
            },
            ModelTemplateDef {
                id: "gemma-2".to_string(),
                name: "Google Gemma 2 / Gemma".to_string(),
                family: "gemma".to_string(),
                default_hf_repo: "google/gemma-2-9b-it".to_string(),
                bos_token: "<bos>".to_string(),
                eos_token: "<end_of_turn>".to_string(),
                supports_system: false, // Gemma 2 treats system as part of user prompt or raises role incompatibility
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{{- bos_token }}\n{%- for message in messages %}\n{{- '<start_of_turn>' + (message['role'] if message['role'] != 'assistant' else 'model') + '\n' + message['content'] | trim + '<end_of_turn>\n' }}\n{%- endfor %}\n{%- if add_generation_prompt %}\n{{- '<start_of_turn>model\n' }}\n{%- endif %}".to_string(),
            },
            ModelTemplateDef {
                id: "mistral-instruct".to_string(),
                name: "Mistral Instruct / Nemo".to_string(),
                family: "mistral".to_string(),
                default_hf_repo: "mistralai/Mistral-7B-Instruct-v0.3".to_string(),
                bos_token: "<s>".to_string(),
                eos_token: "</s>".to_string(),
                supports_system: true,
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{{- bos_token }}\n{%- for message in messages %}\n{%- if message['role'] == 'user' %}\n{{- '[INST] ' + message['content'] | trim + ' [/INST]' }}\n{%- elif message['role'] == 'assistant' %}\n{{- message['content'] | trim + eos_token }}\n{%- elif message['role'] == 'system' %}\n{{- '[INST] <<SYS>>\n' + message['content'] | trim + '\n<</SYS>>\n\n' }}\n{%- endif %}\n{%- endfor %}".to_string(),
            },
            ModelTemplateDef {
                id: "phi-3".to_string(),
                name: "Microsoft Phi-3 / Phi-3.5 / Phi-4".to_string(),
                family: "phi".to_string(),
                default_hf_repo: "microsoft/Phi-3-mini-4k-instruct".to_string(),
                bos_token: "<s>".to_string(),
                eos_token: "<|end|>".to_string(),
                supports_system: true,
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{%- for message in messages %}\n{{- '<|' + message['role'] + '|>\n' + message['content'] + '<|end|>\n' }}\n{%- endfor %}\n{%- if add_generation_prompt %}\n{{- '<|assistant|>\n' }}\n{%- endif %}".to_string(),
            },
            ModelTemplateDef {
                id: "chatml".to_string(),
                name: "Standard ChatML (Hugging Face / OpenAI)".to_string(),
                family: "chatml".to_string(),
                default_hf_repo: "HuggingFaceH4/zephyr-7b-beta".to_string(),
                bos_token: "".to_string(),
                eos_token: "<|im_end|>".to_string(),
                supports_system: true,
                required_roles: vec!["user".to_string(), "assistant".to_string()],
                template: "{%- for message in messages %}\n{{- '<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>\n' }}\n{%- endfor %}\n{%- if add_generation_prompt %}\n{{- '<|im_start|>assistant\n' }}\n{%- endif %}".to_string(),
            },
        ]
    }

    pub fn get_model_def(model_id: &str) -> Option<ModelTemplateDef> {
        let models = Self::get_curated_models();
        let target = model_id.trim().to_lowercase();
        models.into_iter().find(|m| {
            m.id.to_lowercase() == target || m.family.to_lowercase() == target
        })
    }

    pub fn validate_example(
        record_id: &str,
        messages: &[Value],
        model: &ModelTemplateDef,
        add_generation_prompt: bool,
    ) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        if messages.is_empty() {
            errors.push("Empty conversation: No messages found in record.".to_string());
            return ValidationResult {
                record_id: record_id.to_string(),
                is_valid: false,
                rendered: None,
                token_estimate: 0,
                errors,
                warnings,
            };
        }

        let mut has_user = false;
        let mut has_assistant = false;
        let mut last_role: Option<String> = None;
        let mut cleaned_messages = Vec::new();

        for (idx, msg) in messages.iter().enumerate() {
            let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("").trim();
            let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("").trim();

            if role.is_empty() {
                errors.push(format!("Turn {}: Message missing 'role' identifier.", idx + 1));
            } else if role == "system" {
                if !model.supports_system {
                    warnings.push(format!(
                        "Target model '{}' does not have a native system role; system prompt will be adapted or prefixed.",
                        model.name
                    ));
                }
                if idx > 0 {
                    warnings.push(format!(
                        "Turn {}: System prompt placed after first turn. Most foundation models expect system prompts exclusively at turn 1.",
                        idx + 1
                    ));
                }
            } else if role == "user" {
                has_user = true;
                if last_role.as_deref() == Some("user") {
                    warnings.push(format!(
                        "Turn {}: Consecutive user turn detected. Some chat templates require strict user/assistant alternation.",
                        idx + 1
                    ));
                }
            } else if role == "assistant" || role == "model" {
                has_assistant = true;
                if last_role.as_deref() == Some("assistant") || last_role.as_deref() == Some("model") {
                    warnings.push(format!(
                        "Turn {}: Consecutive assistant turn detected without intervening user prompt.",
                        idx + 1
                    ));
                }
            } else {
                errors.push(format!(
                    "Turn {}: Unsupported role '{}'. Model family '{}' only supports 'system', 'user', 'assistant'.",
                    idx + 1,
                    role,
                    model.family
                ));
            }

            if content.trim().is_empty() {
                errors.push(format!("Turn {}: empty content in message turn.", idx + 1));
            }

            // Check for special token injection
            if content.contains("<|end_of_text|>")
                || content.contains("<|eot_id|>")
                || content.contains("<|im_end|>")
                || (content.contains(&model.eos_token) && !model.eos_token.is_empty())
            {
                errors.push(format!(
                    "Turn {}: Special token injection detected in text.",
                    idx + 1
                ));
            }

            last_role = Some(role.to_string());
            cleaned_messages.push(serde_json::json!({
                "role": role,
                "content": content
            }));
        }

        if !has_user {
            errors.push("Missing required 'user' turn in conversation.".to_string());
        }
        if !has_assistant {
            warnings.push("No 'assistant' response turn found; dataset may only contain prompt inputs.".to_string());
        }

        // Jinja template rendering test using minijinja
        let mut env = Environment::new();
        let template_name = "chat_template";
        let render_res = if let Err(e) = env.add_template(template_name, &model.template) {
            errors.push(format!("Chat template syntax error: {}", e));
            None
        } else {
            let tmpl = env.get_template(template_name).unwrap();
            let minijinja_msgs = minijinja::Value::from(minijinja::value::Serde(&cleaned_messages));
            match tmpl.render(context!(
                bos_token => &model.bos_token,
                eos_token => &model.eos_token,
                messages => minijinja_msgs,
                add_generation_prompt => add_generation_prompt,
            )) {
                Ok(rendered) => Some(rendered),
                Err(err) => {
                    errors.push(format!("Template rendering failed for conversation: {}", err));
                    None
                }
            }
        };

        let token_estimate = if let Some(ref s) = render_res {
            crate::engineering::sequence_analytics::SequenceAnalyticsEngine::estimate_tokens(s, &model.family)
        } else {
            0
        };

        ValidationResult {
            record_id: record_id.to_string(),
            is_valid: errors.is_empty(),
            rendered: render_res,
            token_estimate,
            errors,
            warnings,
        }
    }
}
