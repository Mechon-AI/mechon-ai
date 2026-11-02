use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProviderErrorCode {
    Success,
    InvalidUrl,
    DnsFailure,
    ConnectionRefused,
    TlsError,
    AuthenticationFailed,
    RateLimited,
    QuotaExceeded,
    ModelNotFound,
    UnsupportedEndpoint,
    InvalidResponse,
    Timeout,
    UnknownError,
}

#[derive(Error, Debug, Clone, Serialize, Deserialize)]
#[error("[{code:?}] {message}")]
pub struct ProviderError {
    pub code: ProviderErrorCode,
    pub message: String,
    pub http_status: Option<u16>,
    pub provider_id: Option<String>,
}

impl ProviderError {
    pub fn new(code: ProviderErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: sanitize_error_message(&message.into()),
            http_status: None,
            provider_id: None,
        }
    }

    pub fn with_status(code: ProviderErrorCode, message: impl Into<String>, status: u16) -> Self {
        Self {
            code,
            message: sanitize_error_message(&message.into()),
            http_status: Some(status),
            provider_id: None,
        }
    }

    pub fn from_reqwest(err: &reqwest::Error, url: &str) -> Self {
        let msg = sanitize_error_message(&err.to_string());
        if err.is_timeout() {
            return Self::new(ProviderErrorCode::Timeout, format!("Connection timed out to {}", url));
        }
        if err.is_connect() {
            let lower = msg.to_lowercase();
            if lower.contains("connection refused") {
                return Self::new(
                    ProviderErrorCode::ConnectionRefused,
                    format!("Connection refused at {}. Ensure provider service is running.", url),
                );
            }
            if lower.contains("dns") || lower.contains("name resolution") || lower.contains("could not resolve") {
                return Self::new(
                    ProviderErrorCode::DnsFailure,
                    format!("DNS resolution failed for {}. Check host URL and network.", url),
                );
            }
            return Self::new(ProviderErrorCode::ConnectionRefused, format!("Could not connect to {}: {}", url, msg));
        }
        if err.is_builder() {
            return Self::new(ProviderErrorCode::InvalidUrl, format!("Invalid endpoint URL {}: {}", url, msg));
        }
        if msg.contains("certificate") || msg.contains("tls") || msg.contains("handshake") {
            return Self::new(ProviderErrorCode::TlsError, format!("TLS/SSL handshake error for {}: {}", url, msg));
        }

        Self::new(ProviderErrorCode::UnknownError, format!("HTTP error: {}", msg))
    }

    pub fn from_status(status: u16, body_text: &str, url: &str) -> Self {
        let clean_body = sanitize_error_message(body_text);
        let snippet = if clean_body.len() > 180 {
            format!("{}...", &clean_body[..180])
        } else {
            clean_body
        };

        match status {
            401 => Self::with_status(
                ProviderErrorCode::AuthenticationFailed,
                format!("Authentication failed (HTTP 401). Verify that your API key is valid: {}", snippet),
                401,
            ),
            402 => Self::with_status(
                ProviderErrorCode::QuotaExceeded,
                format!("Payment or billing required (HTTP 402). Check provider credit balance or billing setup: {}", snippet),
                402,
            ),
            403 => Self::with_status(
                ProviderErrorCode::AuthenticationFailed,
                format!("Access forbidden (HTTP 403). Check API key permissions and model access: {}", snippet),
                403,
            ),
            404 => Self::with_status(
                ProviderErrorCode::ModelNotFound,
                format!("Resource not found (HTTP 404) at {}. Endpoint or model may be missing: {}", url, snippet),
                404,
            ),
            429 => {
                let lower = snippet.to_lowercase();
                if lower.contains("quota") || lower.contains("credit") || lower.contains("balance") {
                    Self::with_status(
                        ProviderErrorCode::QuotaExceeded,
                        format!("Account quota or credit balance exceeded (HTTP 429): {}", snippet),
                        429,
                    )
                } else {
                    Self::with_status(
                        ProviderErrorCode::RateLimited,
                        format!("Rate limit exceeded (HTTP 429). Please back off request frequency: {}", snippet),
                        429,
                    )
                }
            }
            405 | 501 => Self::with_status(
                ProviderErrorCode::UnsupportedEndpoint,
                format!("Unsupported HTTP method or endpoint (HTTP {}): {}", status, snippet),
                status,
            ),
            500..=599 => Self::with_status(
                ProviderErrorCode::InvalidResponse,
                format!("Provider remote server error (HTTP {}): {}", status, snippet),
                status,
            ),
            _ => Self::with_status(
                ProviderErrorCode::UnknownError,
                format!("HTTP error {}: {}", status, snippet),
                status,
            ),
        }
    }
}

/// Scrub potential API key leaks from error strings
pub fn sanitize_error_message(msg: &str) -> String {
    let mut scrubbed = msg.to_string();
    let patterns = [
        "Bearer ",
        "sk-",
        "key=",
        "x-api-key: ",
        "api-key: ",
    ];
    for p in patterns {
        if let Some(pos) = scrubbed.find(p) {
            let start = pos + p.len();
            let end = scrubbed[start..]
                .find(|c: char| c.is_whitespace() || c == '&' || c == '"' || c == '\'')
                .map(|e| start + e)
                .unwrap_or(scrubbed.len());
            if end > start + 4 {
                let secret_part = &scrubbed[start..end];
                let masked = format!("••••••••{}", &secret_part[secret_part.len().saturating_sub(4)..]);
                scrubbed.replace_range(start..end, &masked);
            }
        }
    }
    scrubbed
}
