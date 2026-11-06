use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tracing::info;

pub const EVENT_DATASET_CHANGE: &str = "dataset-change";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetChangeEvent {
    pub dataset_type: String, // "sft" | "dpo" | "all"
    pub action: String,       // "commit" | "update" | "delete" | "duplicate" | "import"
    pub project_id: Option<String>,
    pub record_id: Option<String>,
    pub timestamp: String,
}

pub fn emit_dataset_change(
    app: &AppHandle,
    dataset_type: &str,
    action: &str,
    project_id: Option<&str>,
    record_id: Option<&str>,
) {
    let payload = DatasetChangeEvent {
        dataset_type: dataset_type.to_string(),
        action: action.to_string(),
        project_id: project_id.map(|s| s.to_string()),
        record_id: record_id.map(|s| s.to_string()),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    info!(
        "[DATASET_SYNC] Emitting centralized dataset-change: type='{}' action='{}' project='{:?}' record='{:?}'",
        payload.dataset_type, payload.action, payload.project_id, payload.record_id
    );

    if let Err(e) = app.emit(EVENT_DATASET_CHANGE, &payload) {
        tracing::error!("[DATASET_SYNC] Failed to emit dataset-change event: {}", e);
    }
}
