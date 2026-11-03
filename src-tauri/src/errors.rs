use serde::{Serialize, Serializer};
use thiserror::Error;
use crate::providers::errors::ProviderError;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("HTTP request error: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("Provider error: {0}")]
    Provider(String),

    #[error("Provider error: {0}")]
    ProviderStructured(#[from] ProviderError),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("message", &self.to_string())?;

        let (code, status) = match self {
            AppError::ProviderStructured(pe) => (format!("{:?}", pe.code), pe.http_status),
            AppError::Provider(_) => ("PROVIDER_ERROR".to_string(), None),
            AppError::NotFound(_) => ("NOT_FOUND".to_string(), Some(404)),
            AppError::Validation(_) => ("VALIDATION_ERROR".to_string(), Some(400)),
            AppError::Database(_) => ("DATABASE_ERROR".to_string(), None),
            AppError::Io(_) => ("IO_ERROR".to_string(), None),
            AppError::Json(_) => ("JSON_ERROR".to_string(), None),
            AppError::Reqwest(e) => ("NETWORK_ERROR".to_string(), e.status().map(|s| s.as_u16())),
            AppError::Internal(_) => ("INTERNAL_ERROR".to_string(), Some(500)),
        };

        map.serialize_entry("code", &code)?;
        if let Some(s) = status {
            map.serialize_entry("status", &s)?;
        }

        map.end()
    }
}
