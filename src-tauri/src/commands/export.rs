use tauri::State;
use sqlx::SqlitePool;
use crate::errors::AppError;
use crate::services::export_service::ExportService;

#[tauri::command]
pub async fn export_sft_dataset(
    pool: State<'_, SqlitePool>,
    project_id: String,
    format_type: Option<String>,
    include_metadata: Option<bool>,
    record_ids: Option<Vec<String>>,
    bilingual_mode: Option<String>,
) -> Result<String, AppError> {
    ExportService::export_sft(
        &pool,
        &project_id,
        format_type.as_deref().unwrap_or("jsonl"),
        include_metadata.unwrap_or(true),
        record_ids,
        bilingual_mode.as_deref(),
    ).await
}

#[tauri::command]
pub async fn export_dpo_dataset(
    pool: State<'_, SqlitePool>,
    project_id: String,
    format_type: Option<String>,
    include_metadata: Option<bool>,
    only_completed: Option<bool>,
    record_ids: Option<Vec<String>>,
) -> Result<String, AppError> {
    ExportService::export_dpo(
        &pool,
        &project_id,
        format_type.as_deref().unwrap_or("jsonl"),
        include_metadata.unwrap_or(true),
        only_completed.unwrap_or(true),
        record_ids,
    ).await
}

#[tauri::command]
pub async fn import_dataset_file(
    pool: State<'_, SqlitePool>,
    project_id: String,
    content: String,
) -> Result<serde_json::Value, AppError> {
    ExportService::import_content(&pool, &project_id, &content).await
}

#[derive(serde::Deserialize)]
pub struct ExportToFileInput {
    pub project_id: String,
    pub pipeline: String, // "sft" | "dpo"
    pub format_type: String, // "jsonl" | "json" | "csv" | "txt"
    pub include_metadata: Option<bool>,
    pub only_completed: Option<bool>,
    pub destination_path: Option<String>,
    pub record_ids: Option<Vec<String>>,
    pub bilingual_mode: Option<String>,
}

#[derive(serde::Serialize)]
pub struct ExportToFileResult {
    pub success: bool,
    pub cancelled: bool,
    pub file_path: Option<String>,
    pub record_count: usize,
    pub file_size_bytes: usize,
    pub format: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn export_dataset_to_file(
    pool: State<'_, SqlitePool>,
    params: ExportToFileInput,
) -> Result<ExportToFileResult, AppError> {
    let project = crate::services::project_service::ProjectService::get(&pool, &params.project_id)
        .await
        .map_err(|e| AppError::NotFound(format!("Project not found: {}", e)))?;

    if let Some(ref ids) = params.record_ids {
        if ids.is_empty() {
            return Err(AppError::Validation("No examples selected. Select records from Mechon Corpus first.".to_string()));
        }
    }

    let fmt = params.format_type.to_lowercase();
    let ext = match fmt.as_str() {
        "json" => "json",
        "csv" => "csv",
        "txt" => "txt",
        _ => "jsonl",
    };

    let pipeline_lower = params.pipeline.to_lowercase();
    let (content, record_count) = if pipeline_lower == "dpo" {
        let count = ExportService::count_dpo(
            &pool,
            &params.project_id,
            params.only_completed.unwrap_or(true),
            params.record_ids.as_deref(),
        ).await?;
        if count == 0 {
            return Err(AppError::Validation("Cannot export empty dataset: no matching DPO records found.".to_string()));
        }
        let text = ExportService::export_dpo(
            &pool,
            &params.project_id,
            &fmt,
            params.include_metadata.unwrap_or(true),
            params.only_completed.unwrap_or(true),
            params.record_ids,
        ).await?;
        (text, count)
    } else {
        let count = ExportService::count_sft(
            &pool,
            &params.project_id,
            params.record_ids.as_deref(),
        ).await?;
        if count == 0 {
            return Err(AppError::Validation("Cannot export empty dataset: no matching SFT records found.".to_string()));
        }
        let text = ExportService::export_sft(
            &pool,
            &params.project_id,
            &fmt,
            params.include_metadata.unwrap_or(true),
            params.record_ids,
            params.bilingual_mode.as_deref(),
        ).await?;
        (text, count)
    };

    let target_path: std::path::PathBuf = if let Some(ref dest) = params.destination_path {
        std::path::PathBuf::from(dest)
    } else {
        let safe_name: String = project.name.chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect();
        let default_file_name = format!("{}_{}_export.{}", safe_name, pipeline_lower, ext);

        let dialog = rfd::AsyncFileDialog::new()
            .set_title(format!("Export {} Dataset ({})", pipeline_lower.to_uppercase(), fmt.to_uppercase()))
            .set_file_name(&default_file_name)
            .add_filter(format!("{} files", fmt.to_uppercase()), &[ext]);

        let handle = dialog.save_file().await;
        match handle {
            Some(h) => h.path().to_path_buf(),
            None => {
                return Ok(ExportToFileResult {
                    success: false,
                    cancelled: true,
                    file_path: None,
                    record_count,
                    file_size_bytes: 0,
                    format: fmt,
                    error: None,
                });
            }
        }
    };

    // Ensure parent directory exists
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await
                .map_err(AppError::Io)?;
        }
    }

    // Write content to destination
    tokio::fs::write(&target_path, content.as_bytes()).await
        .map_err(AppError::Io)?;

    // Post-write verification
    if !target_path.exists() {
        return Err(AppError::Internal(format!("Export verification failed: file does not exist at {}", target_path.display())));
    }

    let meta = tokio::fs::metadata(&target_path).await
        .map_err(AppError::Io)?;
    let file_size = meta.len() as usize;
    if record_count > 0 && file_size == 0 {
        return Err(AppError::Internal("Export verification failed: written file has 0 bytes despite containing records.".to_string()));
    }

    // Verify format parseability
    match fmt.as_str() {
        "json" => {
            serde_json::from_str::<serde_json::Value>(&content)
                .map_err(|e| AppError::Internal(format!("Export verification failed: invalid JSON produced ({})", e)))?;
        }
        "jsonl" => {
            for (idx, line) in content.lines().enumerate() {
                if !line.trim().is_empty() {
                    serde_json::from_str::<serde_json::Value>(line)
                        .map_err(|e| AppError::Internal(format!("Export verification failed: invalid JSON at line {} ({})", idx + 1, e)))?;
                }
            }
        }
        "csv" => {
            let mut rdr = csv::Reader::from_reader(content.as_bytes());
            for result in rdr.records() {
                result.map_err(|e| AppError::Internal(format!("Export verification failed: invalid CSV record ({})", e)))?;
            }
        }
        _ => {}
    }

    Ok(ExportToFileResult {
        success: true,
        cancelled: false,
        file_path: Some(target_path.display().to_string()),
        record_count,
        file_size_bytes: file_size,
        format: fmt,
        error: None,
    })
}
