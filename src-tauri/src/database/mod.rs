use std::fs;
use std::path::PathBuf;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use tracing::{info, warn};
use crate::errors::AppError;

pub async fn get_database_path() -> PathBuf {
    let data_dir = if let Ok(xdg_data) = std::env::var("XDG_DATA_HOME") {
        PathBuf::from(xdg_data)
    } else if let Some(home) = dirs::data_dir() {
        home
    } else {
        PathBuf::from(".").join(".local").join("share")
    };

    let app_dir = data_dir.join("mechon-ai");
    if let Err(e) = fs::create_dir_all(&app_dir) {
        warn!("Failed to create application data directory {}: {}", app_dir.display(), e);
    }
    app_dir.join("mechon.db")
}

pub async fn init_pool() -> Result<SqlitePool, AppError> {
    let db_path = get_database_path().await;
    info!("Initializing SQLite database at: {}", db_path.display());

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(10));

    let pool = SqlitePool::connect_with(options).await?;

    // Run schema initialization
    info!("Running database migrations...");
    let schema_sql = include_str!("../../migrations/20261102000000_init_schema.sql");
    sqlx::raw_sql(schema_sql)
        .execute(&pool)
        .await?;

    // Ensure credential_ref column exists on existing databases
    let _ = sqlx::query("ALTER TABLE providers ADD COLUMN credential_ref TEXT")
        .execute(&pool)
        .await;

    // Ensure bilingual columns exist on existing databases
    let _ = sqlx::query("ALTER TABLE sft_sessions ADD COLUMN language_mode TEXT NOT NULL DEFAULT 'monolingual'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_sessions ADD COLUMN primary_language TEXT NOT NULL DEFAULT 'id'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_sessions ADD COLUMN secondary_language TEXT NOT NULL DEFAULT 'en'").execute(&pool).await;

    let _ = sqlx::query("ALTER TABLE sft_messages ADD COLUMN translations_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_messages ADD COLUMN translation_status_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;

    let _ = sqlx::query("ALTER TABLE sft_records ADD COLUMN language_mode TEXT NOT NULL DEFAULT 'monolingual'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_records ADD COLUMN primary_language TEXT NOT NULL DEFAULT 'id'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_records ADD COLUMN secondary_language TEXT NOT NULL DEFAULT 'en'").execute(&pool).await;

    info!("Migrations completed successfully.");

    // Seed default data if needed
    seed_defaults(&pool).await?;

    Ok(pool)
}

pub async fn seed_defaults(pool: &SqlitePool) -> Result<(), AppError> {
    let project_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects")
        .fetch_one(pool)
        .await?;

    if project_count.0 == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        let default_project_id = "default-project-mechon-001";
        
        sqlx::query(
            "INSERT INTO projects (id, name, description, is_archived, created_at, updated_at, settings_json)
             VALUES (?, ?, ?, 0, ?, ?, '{}')"
        )
        .bind(default_project_id)
        .bind("General AI Alignment Lab")
        .bind("Primary workstation project for SFT multi-turn dialogues and DPO pairwise curation.")
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        info!("Seeded default project: General AI Alignment Lab");
    }

    let provider_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM providers")
        .fetch_one(pool)
        .await?;

    if provider_count.0 == 0 {
        let now = chrono::Utc::now().to_rfc3339();
        
        // Mock provider for offline testing and verification
        sqlx::query(
            "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, 30, 1, '{}', ?, ?)"
        )
        .bind("mock")
        .bind("Mechon Offline Mock Provider")
        .bind("mock")
        .bind("http://127.0.0.1:0")
        .bind("mock-llama-3-8b")
        .bind(r#"["mock-llama-3-8b", "mock-mistral-7b", "mock-qwen-2.5-7b"]"#)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        // Local Ollama default provider
        sqlx::query(
            "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, 60, 1, '{}', ?, ?)"
        )
        .bind("ollama-local")
        .bind("Ollama Local")
        .bind("ollama")
        .bind("http://127.0.0.1:11434")
        .bind("llama3")
        .bind(r#"["llama3", "mistral", "qwen2.5", "phi3"]"#)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        info!("Seeded default providers: Mechon Offline Mock Provider and Ollama Local");
    }

    Ok(())
}
