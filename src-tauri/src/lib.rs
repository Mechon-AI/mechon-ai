pub mod commands;
pub mod credentials;
pub mod database;
pub mod errors;
pub mod models;
pub mod providers;
pub mod services;

use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use credentials::{CredentialStore, HybridCredentialVault};

pub fn run() {
    // Initialize structured tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mechon_ai=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let vault: Arc<dyn CredentialStore> = Arc::new(HybridCredentialVault::new());

    let vault_for_setup = Arc::clone(&vault);

    tauri::Builder::default()
        .manage(vault)
        .setup(move |app| {
            // Asynchronously initialize SQLite pool and run migrations
            let app_handle = app.handle().clone();
            let vault_inner = Arc::clone(&vault_for_setup);
            tauri::async_runtime::block_on(async move {
                match database::init_pool().await {
                    Ok(pool) => {
                        // Migrate any legacy plaintext credentials into vault
                        let _ = services::provider_service::ProviderService::migrate_legacy_credentials(
                            &pool,
                            vault_inner.as_ref(),
                        ).await;

                        app_handle.manage(pool);
                        tracing::info!("SQLite connection pool and Credential Vault managed in Tauri state successfully.");
                    }
                    Err(e) => {
                        tracing::error!("FATAL: Failed to initialize SQLite database: {}", e);
                        panic!("Failed to initialize SQLite database: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Projects
            commands::projects::get_projects,
            commands::projects::get_project,
            commands::projects::create_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::duplicate_project,

            // SFT Studio
            commands::sft::get_sft_sessions,
            commands::sft::get_sft_session,
            commands::sft::create_sft_session,
            commands::sft::update_sft_session,
            commands::sft::delete_sft_session,
            commands::sft::duplicate_sft_session,
            commands::sft::add_sft_message,
            commands::sft::update_sft_message,
            commands::sft::delete_sft_message,
            commands::sft::truncate_sft_downstream,
            commands::sft::commit_sft_session,
            commands::sft::get_sft_records,
            commands::sft::get_sft_record,
            commands::sft::update_sft_record,
            commands::sft::delete_sft_record,
            commands::sft::duplicate_sft_record,

            // DPO Studio
            commands::dpo::get_dpo_tasks,
            commands::dpo::get_dpo_task,
            commands::dpo::create_dpo_task,
            commands::dpo::annotate_dpo_task,
            commands::dpo::undo_last_dpo_annotation,
            commands::dpo::update_dpo_task,
            commands::dpo::delete_dpo_task,
            commands::dpo::duplicate_dpo_task,

            // Providers & Inference
            commands::providers::get_provider_definitions,
            commands::providers::get_providers,
            commands::providers::get_provider,
            commands::providers::create_provider_cmd,
            commands::providers::update_provider_cmd,
            commands::providers::delete_provider_cmd,
            commands::providers::test_provider,
            commands::providers::save_provider_credentials,
            commands::providers::get_provider_credential_status,
            commands::providers::replace_provider_credentials,
            commands::providers::delete_provider_credentials,
            commands::providers::get_vault_diagnostics,
            commands::providers::generate_completion,
            commands::providers::generate_dpo_pair,
            commands::providers::stream_completion,

            // Quality Control & Validation
            commands::validation::validate_dataset,

            // Versioning
            commands::versions::get_versions,
            commands::versions::create_snapshot,
            commands::versions::restore_snapshot,
            commands::versions::compare_snapshots,

            // Analytics
            commands::analytics::get_dashboard_analytics,

            // Export & Import
            commands::export::export_sft_dataset,
            commands::export::export_dpo_dataset,
            commands::export::import_dataset_file,

            // Settings & Maintenance
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::check_database_integrity,
            commands::settings::create_database_backup,
            commands::settings::restore_database_backup,
            commands::settings::open_data_folder,
            commands::settings::get_backend_status,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Mechon AI");
}
