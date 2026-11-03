# Changelog

All notable changes to **Mechon AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.2] - 2026-11-03

### Added
- **Fine-Tuning Engineering Workstation Expansion ("Let the Engineers Control the Quality"):**
  - **Model-Aware Chat Template Engine:** Real-time Jinja2 rendering via `minijinja` with curated support for Meta Llama 3, Alibaba Qwen 2.5, Google Gemma 2, Mistral Instruct, Microsoft Phi-3/Phi-4, and ChatML Generic. Includes role sequence validation, empty turn detection, and special token injection scanning.
  - **Sequence Length Analytics & Multi-Limit Truncation Impact Matrix:** Model-aware multilingual BPE token estimation across CJK, Arabic, and Latin text, percentiles ($P_{50}$, $P_{90}$, $P_{95}$, $P_{99}$), 10-interval histogram distribution, and non-mutating multi-limit truncation simulations (1024, 2048, 4096, 8192, 16384, 32768 tokens).
  - **Deduplication & Near-Duplicate Review:** Exact SHA-256, Unicode/whitespace normalization, and 3-gram Jaccard similarity detection with persistent engineer decisions (`retain`, `exclude`, `acceptable`).
  - **System Prompt & Persona Consistency Audit:** Frequency clustering of system instructions, dominant persona share analysis, and contradictory instruction detection across explicit policies (`single_consistent_persona`, `multiple_intentional_personas`, `mixed_instruction`).
  - **Train / Eval Splitting with Zero-Leakage Guarantee:** Seeded SplitMix64 deterministic pseudo-random partitioning with atomic group-based isolation, ensuring multi-turn sessions and near-duplicate clusters never leak across train and eval sets.
  - **Training Readiness Pre-Flight Certification Report (Flagship):** Comprehensive 8-dimension pre-flight evaluation classifying dataset readiness into `READY`, `READY_WITH_WARNINGS`, or `BLOCKED` with downloadable GitHub Flavored Markdown and JSON diagnostics.
  - **Conversational DPO Preference Schema:** Native support for Hugging Face TRL multi-turn conversational format (`prompt: [...]`, `chosen: [...]`, `rejected: [...]`).
  - **Fine-Tuning Engineering Navigation:** Grouped sidebar navigation separating Core Studio, Fine-Tuning Engineering, and Dataset Management.

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
