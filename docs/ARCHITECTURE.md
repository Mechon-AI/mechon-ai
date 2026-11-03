# Architecture Specification: Mechon AI

## 1. Architectural Philosophy

**Mechon AI** is an offline-first, local workstation engineered for AI dataset engineering, specializing in **Supervised Fine-Tuning (SFT)** and **Direct Preference Optimization (DPO)**.

### Core Architectural Principles:
1. **100% Native Desktop Architecture**:
   - Zero Python backend subprocesses or runtime dependencies.
   - Built entirely in **Rust** (Tauri 2 Core) and **TypeScript** (React 18 + Vite).
   - In-process native execution with sub-millisecond inter-process communication (IPC).
2. **Local-First & Data Sovereignty**:
   - Direct embedded **SQLite** storage with Write-Ahead Logging (WAL) and foreign keys.
   - All dataset records, drafts, annotations, and snapshots reside on local disk.
   - Zero telemetry, zero analytics beacons, zero mandatory internet connectivity.
3. **Atomic Dataset Records**:
   - In SFT, an entire multi-turn conversation draft commits as **exactly one atomic record** with an ordered array of turns (`messages: [...]`). Multi-turn dialogues are never split across loose database rows.
4. **Secure Credential Vault**:
   - API keys are never stored in plaintext within SQLite.
   - Direct integration with OS-native credential vaults (FreeDesktop Secret Service / KDE Wallet) via D-Bus, backed by an AES-256-GCM encrypted fallback when Secret Service is unavailable.

---

## 2. High-Level System Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend Shell (React 18 + TypeScript + Vite)"]
        UI_SFT["Mechon SFT Studio<br/>(Chat & Bilingual Review)"]
        UI_DPO["Mechon DPO Studio<br/>(Pairwise Evaluation)"]
        UI_Corpus["Mechon Corpus<br/>(Explorer & Multi-Select)"]
        UI_Export["Export Center<br/>(Selective & Canonical)"]
        UI_Providers["Provider Manager<br/>(Models & Vault Diagnostics)"]
        UI_Store["Zustand State Stores & TanStack Query"]
    end

    subgraph IPC ["Tauri 2 Native IPC Boundary"]
        Tauri_Bridge["tauri::generate_handler! (Type-Safe Direct IPC)"]
    end

    subgraph Rust_Core ["Native Rust Backend Core (src-tauri)"]
        Svc_SFT["SFT Service<br/>(Session Drafting & Atomic Commits)"]
        Svc_DPO["DPO Service<br/>(Dual Generation & Annotation)"]
        Svc_Dataset["Dataset Service<br/>(Corpus & Version Snapshots)"]
        Svc_Trans["Translation Service<br/>(Contextual Turn Alignment)"]
        Svc_Export["Export Service<br/>(JSONL, JSON, CSV Transforms)"]
        Svc_Valid["Validation Service<br/>(Anomaly & Alternation Audits)"]
        
        subgraph Providers ["Model Provider Subsystem"]
            Reg["Provider Registry"]
            Adapter_Mock["Mock Provider (Offline)"]
            Adapter_Ollama["Ollama Native Adapter"]
            Adapter_Groq["Groq Fast Inference Adapter"]
            Adapter_OpenAI["OpenAI-Compatible Universal Adapter"]
            Adapter_Anthropic["Anthropic Messages Adapter"]
        end

        subgraph Security ["Security & Credential Vault"]
            Vault["HybridCredentialVault"]
            KDE_Secret["FreeDesktop Secret Service / KWallet (D-Bus)"]
            AES_Enc["Encrypted Local Fallback (AES-256-GCM)"]
        end

        subgraph Storage ["Database Subsystem"]
            SQLx_Pool["SQLx Connection Pool (WAL Mode)"]
            SQLite_DB[("Local SQLite 3 Database<br/>~/.local/share/mechon-ai/mechon.db")]
        end
    end

    UI_SFT --> Tauri_Bridge
    UI_DPO --> Tauri_Bridge
    UI_Corpus --> Tauri_Bridge
    UI_Export --> Tauri_Bridge
    UI_Providers --> Tauri_Bridge

    Tauri_Bridge --> Svc_SFT
    Tauri_Bridge --> Svc_DPO
    Tauri_Bridge --> Svc_Dataset
    Tauri_Bridge --> Svc_Trans
    Tauri_Bridge --> Svc_Export
    Tauri_Bridge --> Svc_Valid

    Svc_SFT --> Reg
    Svc_DPO --> Reg
    Svc_Trans --> Reg

    Reg --> Adapter_Mock
    Reg --> Adapter_Ollama
    Reg --> Adapter_Groq
    Reg --> Adapter_OpenAI
    Reg --> Adapter_Anthropic

    Reg --> Vault
    Vault --> KDE_Secret
    Vault --> AES_Enc

    Svc_SFT --> SQLx_Pool
    Svc_DPO --> SQLx_Pool
    Svc_Dataset --> SQLx_Pool
    Svc_Trans --> SQLx_Pool
    Svc_Export --> SQLx_Pool
    SQLx_Pool --> SQLite_DB
```

---

## 3. Subsystem Breakdown

### 3.1 Model Provider Architecture
The provider subsystem uses the **Provider Registry Pattern** with dedicated model adapters implementing the asynchronous `ModelProvider` trait:
- **`ModelProvider` Trait**: Exposes unified async interfaces for `generate()`, `stream()`, `test_connection()`, and `list_models()`.
- **Declarative Registry**: Single source of truth for provider metadata, default base URLs, model discovery strategies, and header builders.
- **Fail-Safe Isolation**: When generating dual candidates for DPO, candidates run in parallel via `tokio::join!`. A failure in candidate B never cancels or corrupts candidate A.

### 3.2 Secure Credential Vault (`HybridCredentialVault`)
- **Zero Plaintext Storage**: The SQLite database stores only a random UUID `credential_ref`. The actual API key is never written to SQLite plaintext columns.
- **Cross-Desktop FreeDesktop Secret Service**: Communicates over session D-Bus directly with the active Secret Service daemon (e.g. `kwalletd5`, `kwalletd6`, or `org.kde.secretservicecompat`).
- **Encrypted Local Fallback**: When Secret Service is locked or unavailable, credentials fall back transparently to an AES-256-GCM encrypted file (`~/.local/share/mechon-ai/vault.enc`) keyed to a persistent machine identifier.

### 3.3 Translation & Bilingual Dataset Engineering
- **Contextual Translation Engine**: Translates multi-turn conversation dialogues turn-by-turn with grounding on previous turns.
- **Turn-Level Approval Lifecycle**: Turns cycle through verified states: `pending` → `generated` → `edited` → `approved` (or `failed`).
- **Bilingual Export Projections**: Transforms canonical aligned records into:
  - `canonical_aligned`: Retains primary text and aligned translations.
  - `primary_only`: Drops translation metadata for primary language training.
  - `secondary_only`: Replaces prompt/turn contents with translated text for secondary language training.

### 3.4 Selective Export Engine
- Supports exporting individually selected conversation sessions and preference pairs from Mechon Corpus without exporting the entire database.
- Validates selections upfront to prevent blank file exports.
- Computes SHA-256 checksums across all written files for provenance verification.

### 3.5 Fine-Tuning Engineering & Certification Subsystem
Mechon AI incorporates a dedicated engineering engine following the principle **"Let the Engineers Control the Quality"**:

1. **Model-Aware Chat Template Engine (`ChatTemplateEngine`)**:
   - In-process Jinja2 template rendering powered by `minijinja`.
   - Curated template definitions for **Meta Llama 3/3.1/3.2/3.3**, **Alibaba Qwen 2.5**, **Google Gemma 2**, **Mistral Instruct/Nemo**, **Microsoft Phi-3/Phi-4**, and **ChatML**.
   - Strict role alternation checking, empty turn detection, and raw special token injection scanning (`<|end_of_text|>`, `<|im_end|>`, `<end_of_turn>`).
2. **Sequence Length Analytics & Truncation Simulation (`SequenceAnalyticsEngine`)**:
   - Model-aware multilingual BPE token estimation across CJK, Arabic, and Latin scripts.
   - Exact percentiles ($P_{50}$, $P_{90}$, $P_{95}$, $P_{99}$) and 10-bucket histogram distribution.
   - Multi-limit comparison matrix (1024, 2048, 4096, 8192, 16384, 32768) comparing retained vs clipped tokens without mutating source records.
3. **Deduplication & Near-Duplicate Clustering (`DeduplicationEngine`)**:
   - Three-tier detection: Exact SHA-256 hash, Normalized text hash, and Near-duplicate 3-gram Jaccard similarity.
   - Persistent engineer decisions (`retain`, `exclude`, `acceptable`) stored in `duplicate_review_decisions`.
4. **System Prompt & Persona Audit (`PersonaAuditEngine`)**:
   - Frequency clustering and persona dominance calculations.
   - Tone and instruction drift detection against configurable policies (`single_consistent_persona`, `multiple_intentional_personas`, `mixed_instruction`).
5. **Deterministic Train/Eval Splitting (`SplitEngine`)**:
   - SplitMix64 pseudo-random permutation guaranteed reproducible across machines with seed configuration.
   - Atomic group isolation: Multi-turn dialogues and near-duplicate groups are assigned together to guarantee **0 data leakage** between train and eval sets.
6. **Training Readiness Certification Report (`ReadinessEngine`)**:
   - 8-dimension pre-flight evaluation classifying datasets into `READY`, `READY_WITH_WARNINGS`, or `BLOCKED`.
   - Exportable to GitHub Flavored Markdown and JSON diagnostics.
7. **Conversational DPO Preference Serialization (`ConversationalDPOEngine`)**:
   - Full support for Hugging Face TRL multi-turn conversational schema (`prompt: [...]`, `chosen: [...]`, `rejected: [...]`).

---

## 4. Database Schema Specification

Mechon AI uses SQLite with automatic schema migration on startup.

```mermaid
erDiagram
    PROJECTS ||--o{ SFT_SESSIONS : contains
    PROJECTS ||--o{ SFT_RECORDS : contains
    PROJECTS ||--o{ DPO_TASKS : contains
    PROJECTS ||--o{ DATASET_VERSIONS : tracks
    SFT_SESSIONS ||--o{ SFT_MESSAGES : holds

    PROJECTS {
        string id PK
        string name
        string description
        string default_system_prompt
        string created_at
        string updated_at
    }

    PROVIDERS {
        string id PK
        string name
        string provider_type
        string base_url
        string credential_ref
        string default_model
        int timeout_seconds
        int is_active
    }

    SFT_SESSIONS {
        string id PK
        string project_id FK
        string title
        string system_prompt
        string language_mode
        string primary_language
        string secondary_language
        string status
    }

    SFT_MESSAGES {
        string id PK
        string session_id FK
        string role
        string content
        string translations_json
        string translation_status_json
        int turn_index
    }

    SFT_RECORDS {
        string id PK
        string project_id FK
        string session_id
        string title
        string messages_json
        string language_mode
        string primary_language
        string secondary_language
        string metadata_json
    }

    DPO_TASKS {
        string id PK
        string project_id FK
        string prompt
        string response_a
        string response_b
        string winner
        string rationale
        string metadata_json
    }

    DATASET_VERSIONS {
        string id PK
        string project_id FK
        string version_tag
        string sha256_hash
        int record_count
        string snapshot_path
    }
```

---

## 5. Directory Layout & XDG Standards

Mechon AI strictly follows the **XDG Base Directory Specification**:

```text
~/.local/share/mechon-ai/
├── mechon.db                  # Primary SQLite 3 database (WAL mode)
├── mechon.db-wal              # Write-Ahead Logging journal
├── mechon.db-shm              # Shared memory index
├── vault.enc                  # AES-256-GCM encrypted fallback credential store
├── backups/                   # Hot online VACUUM INTO database backups
└── snapshots/                 # Cryptographic JSON version snapshots

~/.config/mechon-ai/
└── settings.json              # UI theme & layout configuration

~/.cache/mechon-ai/
└── exports/                   # Temporary export staging
```
