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

    let eng_schema_sql = include_str!("../../migrations/20261103000000_engineering_expansion.sql");
    sqlx::raw_sql(eng_schema_sql)
        .execute(&pool)
        .await?;

    let story_schema_sql = include_str!("../../migrations/20261103100000_story_architect.sql");
    sqlx::raw_sql(story_schema_sql)
        .execute(&pool)
        .await?;

    let mobile_schema_sql = include_str!("../../migrations/20261104000000_mobile_companion.sql");
    sqlx::raw_sql(mobile_schema_sql)
        .execute(&pool)
        .await?;

    // Story Architect Revision History and Invalidation Tracking
    let _ = sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS story_architect_message_revisions (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            turn_index INTEGER NOT NULL,
            role TEXT NOT NULL,
            original_content TEXT NOT NULL,
            modified_content TEXT NOT NULL,
            provider_id TEXT,
            model TEXT,
            revision_reason TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES story_architect_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY(message_id) REFERENCES story_architect_messages(id) ON DELETE CASCADE
        )
    "#).execute(&pool).await;

    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_story_revisions_msg ON story_architect_message_revisions(message_id)").execute(&pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_story_revisions_sess ON story_architect_message_revisions(session_id)").execute(&pool).await;

    let _ = sqlx::query("ALTER TABLE story_architect_messages ADD COLUMN is_outdated INTEGER DEFAULT 0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE story_architect_messages ADD COLUMN revision_count INTEGER DEFAULT 0").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE story_architect_messages ADD COLUMN updated_at TEXT").execute(&pool).await;

    // Ensure independent tri-agent runtime config columns exist
    let _ = sqlx::query("ALTER TABLE story_architect_sessions ADD COLUMN planning_agent_config_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE story_architect_sessions ADD COLUMN inference_agent_config_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE story_architect_sessions ADD COLUMN evaluation_agent_config_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;

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

    // Ensure dynamic multilingual language metadata columns exist
    let _ = sqlx::query("ALTER TABLE sft_sessions ADD COLUMN language_metadata_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE sft_records ADD COLUMN language_metadata_json TEXT NOT NULL DEFAULT '{}'").execute(&pool).await;

    // Migrate any legacy records to Canonical Schema v2.0 language structure
    migrate_legacy_language_metadata(&pool).await?;

    info!("Migrations completed successfully.");

    // Seed default data if needed
    seed_defaults(&pool).await?;

    Ok(pool)
}

pub async fn migrate_legacy_language_metadata(pool: &SqlitePool) -> Result<(), AppError> {
    // 1. Migrate SFT records
    let records: Vec<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT id, language_mode, primary_language, secondary_language, language_metadata_json FROM sft_records"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (id, mode, p_lang, s_lang, meta_str) in records {
        if meta_str.trim().is_empty() || meta_str == "{}" {
            let canon = crate::languages::LanguageRegistry::build_canonical_language_object(
                &mode,
                &p_lang,
                if mode == "bilingual" || mode == "multilingual" { Some(&s_lang) } else { None },
            );
            let s = serde_json::to_string(&canon).unwrap_or_else(|_| "{}".to_string());
            let _ = sqlx::query("UPDATE sft_records SET language_metadata_json = ? WHERE id = ?")
                .bind(&s)
                .bind(&id)
                .execute(pool)
                .await;
        }
    }

    // 2. Migrate SFT sessions
    let sessions: Vec<(String, String, String, String, String)> = sqlx::query_as(
        "SELECT id, language_mode, primary_language, secondary_language, language_metadata_json FROM sft_sessions"
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (id, mode, p_lang, s_lang, meta_str) in sessions {
        if meta_str.trim().is_empty() || meta_str == "{}" {
            let canon = crate::languages::LanguageRegistry::build_canonical_language_object(
                &mode,
                &p_lang,
                if mode == "bilingual" || mode == "multilingual" { Some(&s_lang) } else { None },
            );
            let s = serde_json::to_string(&canon).unwrap_or_else(|_| "{}".to_string());
            let _ = sqlx::query("UPDATE sft_sessions SET language_metadata_json = ? WHERE id = ?")
                .bind(&s)
                .bind(&id)
                .execute(pool)
                .await;
        }
    }

    Ok(())
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

        // Google Gemini canonical cloud definition
        sqlx::query(
            "INSERT INTO providers (id, name, provider_type, base_url, credential_ref, default_model, models_cache_json, timeout_seconds, is_active, settings_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, 60, 1, '{}', ?, ?)"
        )
        .bind("gemini")
        .bind("Google Gemini")
        .bind("gemini")
        .bind("https://generativelanguage.googleapis.com/v1beta")
        .bind("gemini-2.5-flash")
        .bind(r#"["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]"#)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await?;

        info!("Seeded default providers: Mechon Offline Mock Provider, Ollama Local, and Google Gemini");
    }

    Ok(())
}
