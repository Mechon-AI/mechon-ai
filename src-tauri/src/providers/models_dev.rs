use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use super::capabilities::ModelCapabilities;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadataEntry {
    pub id: String,
    pub name: Option<String>,
    pub context_window: Option<i64>,
    pub max_output_tokens: Option<i64>,
    pub capabilities: Option<ModelCapabilities>,
    pub provider: Option<String>,
}

pub struct ModelsDevRegistry {
    memory_cache: RwLock<HashMap<String, ModelMetadataEntry>>,
    cache_path: PathBuf,
}

impl ModelsDevRegistry {
    pub fn new() -> Self {
        let cache_dir = if let Ok(xdg_cache) = std::env::var("XDG_CACHE_HOME") {
            PathBuf::from(xdg_cache)
        } else if let Some(home) = dirs::cache_dir() {
            home
        } else {
            PathBuf::from(".").join(".cache")
        };

        let app_cache = cache_dir.join("mechon-ai");
        let _ = fs::create_dir_all(&app_cache);
        let cache_path = app_cache.join("models_dev_cache.json");

        let mut instance = Self {
            memory_cache: RwLock::new(HashMap::new()),
            cache_path,
        };

        instance.load_bundled_snapshot();
        instance.load_persistent_cache();
        instance
    }

    fn load_bundled_snapshot(&mut self) {
        let bundled: Vec<ModelMetadataEntry> = vec![
            ModelMetadataEntry {
                id: "gpt-4o".to_string(),
                name: Some("GPT-4o".to_string()),
                context_window: Some(128000),
                max_output_tokens: Some(16384),
                capabilities: Some(ModelCapabilities::all()),
                provider: Some("openai".to_string()),
            },
            ModelMetadataEntry {
                id: "gpt-4o-mini".to_string(),
                name: Some("GPT-4o Mini".to_string()),
                context_window: Some(128000),
                max_output_tokens: Some(16384),
                capabilities: Some(ModelCapabilities::all()),
                provider: Some("openai".to_string()),
            },
            ModelMetadataEntry {
                id: "claude-3-5-sonnet".to_string(),
                name: Some("Claude 3.5 Sonnet".to_string()),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: Some(ModelCapabilities::all()),
                provider: Some("anthropic".to_string()),
            },
            ModelMetadataEntry {
                id: "claude-3-5-haiku".to_string(),
                name: Some("Claude 3.5 Haiku".to_string()),
                context_window: Some(200000),
                max_output_tokens: Some(8192),
                capabilities: Some(ModelCapabilities::all()),
                provider: Some("anthropic".to_string()),
            },
            ModelMetadataEntry {
                id: "gemini-2.0-flash".to_string(),
                name: Some("Gemini 2.0 Flash".to_string()),
                context_window: Some(1048576),
                max_output_tokens: Some(8192),
                capabilities: Some(ModelCapabilities::all()),
                provider: Some("gemini".to_string()),
            },
            ModelMetadataEntry {
                id: "deepseek-chat".to_string(),
                name: Some("DeepSeek V3".to_string()),
                context_window: Some(64000),
                max_output_tokens: Some(8192),
                capabilities: Some(ModelCapabilities::default()),
                provider: Some("deepseek".to_string()),
            },
            ModelMetadataEntry {
                id: "deepseek-reasoner".to_string(),
                name: Some("DeepSeek R1".to_string()),
                context_window: Some(64000),
                max_output_tokens: Some(8192),
                capabilities: Some(ModelCapabilities {
                    reasoning: true,
                    ..ModelCapabilities::default()
                }),
                provider: Some("deepseek".to_string()),
            },
        ];

        let mut lock = self.memory_cache.write().unwrap();
        for item in bundled {
            lock.insert(item.id.clone(), item);
        }
    }

    fn load_persistent_cache(&mut self) {
        if self.cache_path.exists() {
            if let Ok(data) = fs::read_to_string(&self.cache_path) {
                if let Ok(entries) = serde_json::from_str::<HashMap<String, ModelMetadataEntry>>(&data) {
                    let mut lock = self.memory_cache.write().unwrap();
                    for (k, v) in entries {
                        lock.insert(k, v);
                    }
                }
            }
        }
    }

    /// Boundary-aware lookup: exact match first, then delimiter-aware prefix match
    pub fn lookup(&self, model_id: &str) -> Option<ModelMetadataEntry> {
        let lock = self.memory_cache.read().unwrap();

        // 1. Exact match
        if let Some(entry) = lock.get(model_id) {
            return Some(entry.clone());
        }

        // 2. Boundary-aware prefix matching
        let clean = model_id.to_lowercase();
        for (key, entry) in lock.iter() {
            let key_lower = key.to_lowercase();
            if clean.starts_with(&key_lower) {
                let rest = &clean[key_lower.len()..];
                // Must be at word boundary (e.g. -, _, :, /)
                if rest.starts_with('-') || rest.starts_with('_') || rest.starts_with(':') || rest.starts_with('/') || rest.starts_with('@') {
                    return Some(entry.clone());
                }
            }
        }

        None
    }
}
