# Changelog

All notable changes to **Mechon AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-03

### Changed
- **Hapus legacy code:** Completely removed obsolete Python backend directory (`backend/`), FastAPI / Uvicorn server, SQLAlchemy ORM, and Pydantic models.
- Upgraded desktop runtime to 100% native Rust, Tauri 2, and embedded SQLite with WAL mode.
- Direct Tauri IPC commands replace all legacy HTTP loopback endpoints, eliminating inter-process network overhead.
- Updated security model: application operates entirely in-process with OS keyring encryption (FreeDesktop Secret Service / KDE Wallet with AES-256-GCM fallback).

### Added
- **Selective Dataset Export:** Granular record-level checkboxes for SFT and DPO records in Mechon Corpus, allowing selective and filtered dataset exports.
- **Bilingual Dataset Engineering:** Full bilingual translation, side-by-side human review, and commit workflow with system prompt customization.
- **Linux Packaging:** Complete packaging manifests for Arch Linux (`PKGBUILD`), Debian (`control`), and RPM (`mechon-ai.spec`).

---

## [1.0.0] - 2026-11-02

### Added
- Initial public release of Mechon AI.
- SFT multi-turn conversation authoring studio.
- DPO pairwise preference collection studio.
- Mechon Corpus dataset management and analytics.
- Provider Registry with direct model inference and API key vault integration.
- Dataset export support for JSON, JSONL, CSV, and Hugging Face TRL format.
