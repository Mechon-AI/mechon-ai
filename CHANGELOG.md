# Changelog

All notable changes to **Mechon AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2026-11-03

### Added
- **Dynamic Multilingual Architecture:** Replaced hardcoded Indonesian/English constraints with a universal BCP-47 language identity system supporting arbitrary language pairs (e.g., `ja` → `ar`, `id` → `en`, `de` → `fr`, `es` → `ko`, `pt-BR` → `ja`).
- **Canonical Schema v2.0:** Standardized multilingual dataset representation featuring structured language metadata (`mode`, `primary`, `secondary`), turn-level translation mapping, and full round-trip import/export compatibility.
- **RTL Script Support:** Built-in Right-to-Left script detection and directionality rendering (`dir="rtl"`) for Arabic (`ar`), Hebrew (`he`), Urdu (`ur`), Persian (`fa`), and other RTL languages.
- **Interactive Multilingual UI Components:** Added `LanguagePicker` with BCP-47 search, `LanguagePairSelector` with one-click swap (`⇄`), `LanguageIdentityBadge`, `LanguageFilter`, and `MultilingualMessageViewer`.
- **Corpus Dynamic Language Discovery:** Implemented `get_corpus_languages` Tauri IPC command to inspect and aggregate all active language pairs, primary languages, and modes from project records.

### Changed
- SFT Studio bilingual review and translation workflows now adapt dynamically to any configured BCP-47 language pair.
- Mechon Corpus explorer now filters dynamically by active corpus language pairs with RTL-aware parallel inspection.
- Export Center now generates canonical v2.0 datasets with dynamic language descriptors instead of static labels.

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
