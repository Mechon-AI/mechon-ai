# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Model & Boundary

**Mechon AI** is built on a local-first, in-process desktop security model:
1. **Local-First & In-Process**: The application runs completely in-process using native Rust (Tauri 2) with embedded SQLite. No internal HTTP daemon or network server is exposed.
2. **Local Storage**: User datasets and configurations are stored solely on the local filesystem according to XDG standards (`~/.local/share/mechon-ai/`).
3. **Secure Credential Vault**: API keys are stored via the FreeDesktop Secret Service / KDE Wallet with AES-256-GCM encrypted fallback. Plaintext API keys are never stored in SQLite.
4. **Zero Telemetry**: No user data, prompts, completions, or metrics are transmitted to any external server. Network access occurs only when the user explicitly queries remote AI model APIs.

## Reporting a Vulnerability

If you discover a security vulnerability or boundary breach within Mechon AI:

1. **Do not open a public issue.**
2. Send an advisory email with reproduction details to **cemetery394@gmail.com** or use GitHub's private vulnerability reporting feature on the repository.
3. We will acknowledge receipt within 48 hours and work with you to analyze and resolve the issue before public disclosure.
