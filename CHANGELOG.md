# Changelog

All notable changes to **Mechon AI** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.4] - 2026-11-04

### Added
- **Mechon AI Android Companion (`ai.mechon.companion`):**
  - Native Android application built with Jetpack Compose, Material 3, and Kotlin Coroutines.
  - Room local database persistence for chat sessions, messages, and roleplay prompt configurations.
  - **Structured Roleplay Studio:** 9 modular prompt sections (Character Identity, Appearance, Personality, Speech & Voice, World Setting, Scenario, User Persona, Interaction Rules, Custom Directives) with live prompt assembly and preset management.
  - Multi-session chat interface with real-time markdown rendering and syntax-highlighted code blocks with copy actions.
  - Multimodal vision support with base64 attachment pipeline and optional web search grounding.
  - Multi-select conversation batch export and one-tap "Send to Mechon Desktop" workflow with idempotency.
- **Desktop Local Network Gateway:**
  - Embedded high-performance Axum HTTP server running on LAN port 38475.
  - Secure QR code pairing protocol with rotating 15-minute codes and SHA-256 token authentication.
  - Isolated provider model discovery proxy and single-inference chat execution without invoking desktop Tri-Agent steps.
  - Mobile synchronization staging queue in SQLite (`paired_devices`, `mobile_sync_transfers`, `mobile_imported_conversations`).
  - Native desktop SFT draft conversion and atomic commit to Mechon Corpus.
- **Android CI/CD Automation:**
  - Added `.github/workflows/android-ci.yml` with JDK 17, Android SDK setup, version validation, unit tests, and debug APK artifact packaging.

---

## [1.1.3] - 2026-11-03

### Added
- **Mechon Story Architect & Autonomous Conversation Engine:**
  - Structured multi-phase interaction planning with objective definitions and persona alignment.
  - Dual-agent loop combining a Planning Agent for prompt engineering and a Narrative / Task Evaluation Agent for context tracking.
  - Deterministic state machine (`IDLE` → `PLANNING` → `AWAITING_APPROVAL` → `GENERATING` → `EVALUATING` → `UPDATING_CONTEXT` → `NEXT_PROMPT` → `GENERATING`).
  - Three execution policies: `Manual Review`, `Hybrid Safety`, and `Step Autonomous Turn`.
  - In-flight prompt revision workbench and historical turn editing with automatic downstream branch truncation.
  - Direct atomic commitment from Story Architect into canonical Supervised Fine-Tuning (SFT) datasets.
- **4-Tier Operational Diagnostics Suite:**
  - End-to-end multi-step verification pipeline in Provider Manager testing Network Connection, Credential Authentication, Dynamic Model Discovery, Non-Streaming Generation, and Token Streaming SSE.
  - Interactive diagnostics inspection modal with latency, token count, and health reporting.
- **Anthropic Dynamic Model Discovery:** Added `/v1/models` integration for live enumeration of user-accessible Claude models.

### Fixed
- **Anthropic Claude 5.5 HTTP 400 Parameter Deprecation:**
  - Automatically suppresses deprecated/disallowed `temperature` and `top_p` sampling parameters for Claude 5.5 generation models (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-1`).
  - Added adaptive runtime auto-recovery in both non-streaming and streaming handlers to catch client parameter deprecations and retry transparently without interruption.
  - Sanitized error diagnostics reporting request ID, error type, model ID, and parameter details without exposing credentials.
- **Multi-Provider Adapter Integrity:**
  - Fixed reasoning parameter handling for OpenAI `o1`/`o3`/`o4` models (`max_completion_tokens`, `developer` role, suppressed sampling).
  - Normalized URL path parsing across local and cloud providers (vLLM, LM Studio, Ollama, GLM, Groq).
  - Fixed token metrics extraction across Gemini, Ollama, Anthropic, and OpenAI.
- **Provider Switching & Stale Model References:**
  - Eliminated stale session-level model persistence and desynchronization in Mechon SFT and Story Architect.
  - Sidebar drafts and model dropdown selectors immediately synchronize with SQLite state.

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

### Fixed
- **Engineering Workspace Defensive Data Handling:** Resolved uncaught runtime exceptions (`d.target_model.toUpperCase()`) and blank-screen rendering failures across all Engineering views.
- **Dual-Alias Schema Backward Compatibility:** Introduced dual Serde aliases in Rust engineering models and safe normalization pipelines in `frontend/src/utils/engineeringNormalizers.ts`, ensuring seamless backward compatibility with historical SQLite records.
- **Fault-Tolerant Workspace Error Boundaries:** Embedded component-level `<ErrorBoundary>` wrappers around all Engineering workspace routes in `App.tsx` with dedicated recovery cards.

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
