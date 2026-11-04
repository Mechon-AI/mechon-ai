<div align="center">

<img src="assets/mechon-logo.svg" alt="Mechon AI Logo" width="520" />

<br/>

**Engineer the Data. Shape the Intelligence.**

*A local-first AI Dataset Engineering Workstation for creating, curating, translating, evaluating, and exporting high-quality training datasets for language model alignment.*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/Mechon-AI/mechon-ai?color=brightgreen&label=release)](https://github.com/Mechon-AI/mechon-ai/releases)
[![Version](https://img.shields.io/badge/Version-1.2.8-blue.svg)](CHANGELOG.md)
[![Platform](https://img.shields.io/badge/Platform-Linux_%7C_Android-informational.svg)](#platform-support)
[![Desktop Core](https://img.shields.io/badge/Desktop-Rust_2021_%2B_Tauri_2_%2B_React_18-orange.svg)](#platform-support)
[![Mobile Companion](https://img.shields.io/badge/Mobile-Android_14%2B_%7C_Jetpack_Compose-green.svg)](#platform-support)

</div>

---

## 1. Why Mechon AI?

State-of-the-art language model alignment requires more than raw web scrapes or generic data annotation tools. Fine-tuning models for multi-turn chat, nuanced roleplay, step-by-step reasoning, and domain-specific instruction adherence demands **high-context conversational data** engineered with intent.

**Mechon AI** is an integrated desktop workstation and mobile companion designed for dataset engineers. It replaces fragmented scripts, ad-hoc API notebooks, and spreadsheet annotators with a local-first engineering environment where you can interactively converse with models, orchestrate agentic narrative simulations, translate conversations across languages, annotate preference pairs, and export verified datasets directly into training pipelines.

---

## 2. Main Feature Overview

- **Interactive Multi-Turn SFT Studio**: Converse freely with local or cloud LLMs, edit message turns, regenerate responses, and commit multi-turn dialogues as atomic training records.
- **Story Architect (Tri-Agent Simulation)**: Automated narrative and roleplay conversation generation orchestrated by three specialized agents: Planning, Inference, and Evaluation.
- **Multilingual Translation Engine**: Integrated LLM-driven translation with turn-by-turn side-by-side editing, regeneration, and parallel multi-language dataset export.
- **Mechon Corpus**: Central dataset repository with a bidirectional bridge—load any saved record back into SFT Studio to edit, extend, re-translate, and recommit.
- **DPO Studio**: Side-by-side candidate comparison, winner/tie/flag selection, and human rationale tagging for preference alignment.
- **Dataset Forge (Document Parser)**: Transform unstructured documents and source code into semantic chunks and conversational SFT pairs.
- **Model Playground**: Test and evaluate prompt completions across connected providers before committing to datasets.
- **Training Readiness Certification**: Comprehensive 8-dimension pre-flight audit certifying dataset readiness for fine-tuning.
- **Model-Aware Chat Template Validation**: In-process Jinja2 template verification across Meta Llama 3, Qwen 2.5, Gemma 2, Mistral, Phi-3/4, and ChatML.
- **Train / Eval Splitting with Leakage Shield**: Deterministic seeded partitioning (e.g. 80/10/10) with group-level isolation ensuring 0 data leakage.
- **System Prompt & Persona Audit**: Detect persona drift, instruction contradictions, and enforce compliance across single or multi-persona policies.
- **Deduplication & Sequence Analytics**: Exact SHA-256 and 3-gram MinHash near-duplicate clustering with token percentile distributions.
- **Mechon Mobile Companion**: Native Android companion (`ai.mechon.companion`) for remote conversation authoring over LAN or Tailscale, with standalone `@Web Search`.
- **Local-First & Zero Telemetry**: Embedded SQLite WAL storage and OS-native credential vaults (Secret Service / KWallet); your proprietary data and API keys never leave your control.

---

## 3. The Dataset Engineering Lifecycle

```mermaid
flowchart TD
    subgraph Capture ["1. Data Capture & Ingestion"]
        Mobile["Mechon Mobile<br/>(Android Companion)"] -->|Zero-Trust Gateway| DeskGW["Desktop Gateway"]
        DeskGW --> SFT["SFT Studio<br/>(Interactive Chat)"]
        User["Desktop Engineer"] --> SFT
        Story["Story Architect<br/>(Tri-Agent Simulation)"] --> Corpus
        Forge["Dataset Forge<br/>(Document Parser)"] --> Corpus
        DPO["DPO Studio<br/>(Pairwise Preference)"] --> Corpus
    end

    subgraph Curation ["2. Curation & Multilingual Engineering"]
        SFT --> Trans["Translation Engine<br/>(Primary & Target Languages)"]
        Trans --> Review["Turn-by-Turn Human Review<br/>(Edit / Regenerate / Approve)"]
        Review --> Corpus[("Mechon Corpus<br/>(Central Storage & Search)")]
        Corpus -.->|Load / Edit / Extend| SFT
    end

    subgraph Validation_Suite ["3. Pre-Flight Auditing & Validation"]
        Corpus --> Readiness["Training Readiness (8-Dimension Audit)"]
        Corpus --> Templates["Chat Template Validation (Jinja2)"]
        Corpus --> PersonaAudit["Persona & System Prompt Audit"]
        Corpus --> Splits["Train / Eval Split (Leakage Shield)"]
        Corpus --> Dedup["Deduplication & Analytics"]
    end

    subgraph Delivery ["4. Delivery & Training"]
        Splits --> Export["Export Center<br/>(Full or Selective Export)"]
        Export --> ShareGPT["JSONL (ShareGPT / Axolotl)"]
        Export --> Alpaca["JSONL (Alpaca / TRL)"]
        Export --> CSV["Tabular CSV / JSON"]
        Export --> SHA["SHA-256 Checksum Manifest"]
    end
```

---

## 4. System Architecture

```mermaid
graph TD
    subgraph Mobile ["Mechon Mobile (Android 14+ Companion)"]
        UI_MobileChat["Obsidian Mobile Chat<br/>Streaming SSE & Actions"]
        UI_MobileSearch["Standalone @Web Search<br/>Tavily / Brave / Serp / SearXNG"]
        MobileKeystore["Android Keystore<br/>AES-256 GCM Isolated Vault"]
        MobileNet["LAN UDP (38476) & Tailscale Mesh<br/>Verified Connection State Machine"]
        UI_MobileSearch --> MobileKeystore
        UI_MobileChat --> MobileNet
    end

    subgraph Frontend ["Frontend Shell (React 18 + TypeScript + Vite 6)"]
        UI_Dashboard["Dashboard & Workspace Explorer"]
        
        subgraph UI_CoreStudios ["Core Authoring Studios"]
            UI_SFT["SFT Studio<br/>Chat, Multilingual & In-Flight Curation"]
            UI_Story["Story Architect<br/>Tri-Agent Simulation & Narrative Loop"]
            UI_DPO["DPO Studio<br/>Dual Inference & Preference Annotation"]
            UI_Forge["Dataset Forge<br/>Document Ingestion & Chunking"]
            UI_Corpus["Mechon Corpus<br/>Unified SFT/DPO Explorer & Bridge"]
            UI_Playground["Model Playground<br/>Pre-Commit Generation Testing"]
        end

        subgraph UI_EngSuite ["Dataset Engineering Suite"]
            UI_Readiness["Training Readiness<br/>8-Dimension Certification Audit"]
            UI_Templates["Chat Template Validation<br/>Jinja2: Llama 3, Qwen, Gemma, Mistral, Phi"]
            UI_Persona["System Prompt & Persona Audit<br/>Policy Checks & Clustering"]
            UI_Splits["Train / Eval Splitting<br/>Seeded 80/10/10 & Leakage Shield"]
            UI_Dedup["Deduplication Engine<br/>Exact & Near-Duplicate Detection"]
            UI_SeqAnalytics["Sequence Analytics<br/>Token Distribution & Context Limits"]
            UI_Diagnostics["Diagnostics & QC<br/>Role Alignment & Structural Fixes"]
        end

        UI_Export["Export Center<br/>Selective, ShareGPT, Alpaca, TRL & CSV"]
        UI_Providers["Provider Manager<br/>Registry & Model Discovery"]
        UI_Layout["Modular Editor UI<br/>5-Region Shell & Custom Presets"]
        UI_State["Zustand Stores & TanStack Query"]
    end

    subgraph IPC ["Tauri 2 Native IPC Boundary"]
        Bridge["Type-Safe Tauri Commands"]
        Events["Tauri Event Bus<br/>Streaming, Progress & Agent Events"]
    end

    subgraph Rust_Core ["Native Rust Backend Core"]

        subgraph Mobile_Gateway ["Mobile Remote Gateway (Axum Engine)"]
            AxumServer["Axum HTTP Gateway (TCP Port 38475)<br/>SSE Streaming & Session Auth"]
            DiscoveryBeacon["UDP Discovery Beacon (Port 38476)<br/>Broadcast & SSDP Multicast"]
            TailscaleProbe["Tailscale Mesh Probe<br/>100.64.0.0/10 & MagicDNS"]
            DeviceAuth["Device Authorization Vault<br/>Cryptographic Bearer Handshake"]
        end

        subgraph Authoring ["Dataset Authoring Services"]
            Svc_SFT["SFT Service<br/>Session & Atomic Commits"]
            Svc_DPO["DPO Service<br/>Dual Generation & Annotation"]
            Svc_Story["Story Planning Service<br/>Premise, Characters & Objectives"]
            Svc_Conversation["Conversation Engine<br/>Multi-Turn Context & Execution"]
            Svc_Revision["Revision Service<br/>Edit, Regenerate & Truncate"]
        end

        subgraph Agentic ["Agentic Dataset Engineering Engine"]
            Planner["Planning Agent<br/>Narrative-to-Prompt Generation"]
            Context["Narrative Context Manager<br/>Continuity & World Lore"]
            Evaluator["Progress Evaluation Agent<br/>Consistency, Objectives & Depth"]
            Approval["Human-in-the-Loop Controller<br/>Manual / Hybrid / Auto-Allow"]
            Orchestrator["Agent Orchestrator<br/>Autonomous Execution Loop"]
            Provenance["Agent Provenance Tracker<br/>Prompt & Turn History"]
        end

        subgraph Provider_System ["Model Provider Orchestration"]
            Config["Authoritative Provider Config<br/>Canonical Alias Normalization"]
            Router["Provider Router<br/>Request Dispatch & Session Overrides"]
            Registry["Provider Registry"]
            Capabilities["Model Capability Registry<br/>Parameters & Protocol Support"]
            Diagnostics["Provider Diagnostics<br/>Health, Auth & Latency Tests"]
            Retry["Error & Retry Manager<br/>429, Timeout & Recovery"]

            Mock["Mock Adapter"]
            Ollama["Ollama Local Adapter"]
            Gemini["Google Gemini Adapter"]
            Anthropic["Anthropic Messages Adapter"]
            OpenAI["OpenAI-Compatible Adapter<br/>OpenAI, Groq, Mistral, OpenRouter, vLLM"]
            Streaming["Unified Streaming Engine<br/>Server-Sent Events (SSE) Streamer"]
        end

        subgraph Data_Engineering ["Dataset Engineering Services"]
            Dataset["Dataset Service<br/>Corpus & Record Management"]
            Translation["Translation Service<br/>Dynamic Language Pairs"]
            Export["Export Service<br/>JSONL, JSON, CSV & SHA-256 Checksums"]
            Validation["Quality Validation Service<br/>Schema & Structural Audits"]
            ReadinessEng["Readiness Engine<br/>8-Dimension Pre-Flight Audit"]
            TemplateEng["Template Engine<br/>Model-Aware Jinja2 Compiler"]
            PersonaEng["Persona Audit Engine<br/>Clustering & Contradiction Detection"]
            SplitEng["Split Engine<br/>Group-Level Leakage Prevention"]
            DedupEng["Deduplication Engine<br/>MinHash & Exact Match"]
            AnalyticsEng["Sequence & Token Analytics"]
            Versioning["Dataset Versioning<br/>Snapshots & Rollback"]
        end

        subgraph Security ["Security & Credential Vault"]
            Vault["HybridCredentialVault"]
            Secret["FreeDesktop Secret Service / KWallet"]
            AES["AES-256-GCM Encrypted Fallback"]
        end

        subgraph Storage ["Persistent Storage"]
            Pool["SQLx Connection Pool<br/>WAL Mode & Foreign Keys"]
            DB[("SQLite Database<br/>mechon.db")]
            FileStore["Local Dataset, Backup & Manifest Store"]
        end
    end

    MobileNet <--> DiscoveryBeacon
    MobileNet <--> TailscaleProbe
    MobileNet <--> AxumServer
    AxumServer --> DeviceAuth
    AxumServer --> Svc_Conversation
    AxumServer --> Router

    UI_CoreStudios --> Bridge
    UI_EngSuite --> Bridge
    UI_Export --> Bridge
    UI_Providers --> Bridge
    UI_Layout --> Bridge

    Bridge --> Svc_SFT
    Bridge --> Svc_DPO
    Bridge --> Svc_Story
    Bridge --> Svc_Conversation
    Bridge --> Svc_Revision
    Bridge --> Dataset
    Bridge --> Translation
    Bridge --> Export
    Bridge --> Validation
    Bridge --> ReadinessEng
    Bridge --> TemplateEng
    Bridge --> PersonaEng
    Bridge --> SplitEng
    Bridge --> DedupEng
    Bridge --> Diagnostics

    Svc_Story --> Planner
    Planner --> Context
    Context --> Evaluator
    Evaluator --> Approval
    Approval --> Orchestrator
    Orchestrator --> Svc_Conversation
    Svc_Conversation --> Planner

    Orchestrator --> Provenance
    Svc_Conversation --> Provenance
    Svc_Revision --> Provenance

    Approval --> Events
    Orchestrator --> Events
    Streaming --> Events
    Events --> UI_State

    Svc_SFT --> Router
    Svc_DPO --> Router
    Translation --> Router
    Planner --> Router
    Svc_Conversation --> Router
    Svc_Revision --> Router

    Config --> Router
    Router --> Registry
    Registry --> Capabilities
    Registry --> Mock
    Registry --> Ollama
    Registry --> Gemini
    Registry --> Anthropic
    Registry --> OpenAI

    Registry --> Streaming
    Router --> Retry
    Router --> Vault
    Diagnostics --> Registry

    Svc_SFT --> Dataset
    Svc_Conversation --> Dataset
    Svc_Revision --> Dataset
    Dataset --> Validation
    Dataset --> ReadinessEng
    Dataset --> TemplateEng
    Dataset --> PersonaEng
    Dataset --> SplitEng
    Dataset --> DedupEng
    Dataset --> AnalyticsEng
    Dataset --> Versioning
    Dataset --> Export

    Translation --> Dataset
    Validation --> Versioning
    Versioning --> FileStore
    Export --> FileStore

    Router --> Pool
    Svc_SFT --> Pool
    Svc_DPO --> Pool
    Svc_Story --> Pool
    Svc_Conversation --> Pool
    Svc_Revision --> Pool
    Dataset --> Pool
    Translation --> Pool
    Versioning --> Pool
    ReadinessEng --> Pool
    PersonaEng --> Pool
    SplitEng --> Pool
    DeviceAuth --> Pool
    Pool --> DB

    Vault --> Secret
    Vault --> AES
```

---

## 5. Workstations & Studio Components

### A. SFT Studio
SFT Studio treats conversations as **atomic multi-turn records**. Engineers configure system prompts, model hyper-parameters, and language modes. During dialogue, curators can edit any message, truncate downstream trajectories, regenerate turns, and trigger the integrated **Translation Engine** to produce parallel multilingual versions before committing to Corpus.  
*Documentation: [docs/SFT_STUDIO.md](docs/SFT_STUDIO.md)*

### B. Story Architect
An agentic conversation engineering environment designed for complex roleplay and narrative datasets. Story Architect employs a **Tri-Agent architecture**:
1. **Planning Agent**: Formulates narrative beats, tracks milestones, and generates the next prompt.
2. **Inference Model**: Generates the in-character story progression and dialogue.
3. **Evaluation Agent**: Quantitatively scores Persona Consistency, Objective Progress, and Synthesis Quality.

Supports both **Manual Approval** and autonomous **Auto-Allow** execution loops. Completed stories can be committed directly to Corpus or opened in SFT Studio for multilingual expansion.  
*Documentation: [docs/STORY_ARCHITECT.md](docs/STORY_ARCHITECT.md)*

### C. Mechon Corpus
The central dataset intelligence hub. Search, filter, and inspect complete multi-turn conversations and preference pairs. Because dataset engineering is iterative, Corpus includes a **bidirectional studio bridge**: select any record, click *Load into SFT Studio*, extend the conversation with new turns, and recommit the updated record.  
*Documentation: [docs/CORPUS_AND_EXPORT.md](docs/CORPUS_AND_EXPORT.md)*

### D. Export Center
Transform Corpus records into standardized training formats, including **ShareGPT JSONL**, **Alpaca JSONL**, **DPO JSONL**, **JSON**, and **CSV**. Features **Selective Export** (export only chosen records) and automatically generates **SHA-256 checksum manifests** for cryptographic dataset integrity verification on GPU clusters.  
*Documentation: [docs/DATA_FORMATS.md](docs/DATA_FORMATS.md)*

### E. DPO Studio
Author preference pairs for Direct Preference Optimization and RLHF. Configure independent models for Candidate A and Candidate B, generate parallel completions, compare outputs side-by-side, assign preference decisions (Chosen, Rejected, Tie, Flag), and record human evaluation rationales.  
*Documentation: [docs/DPO_STUDIO.md](docs/DPO_STUDIO.md)*

### F. Dataset Forge (Document Parser)
Ingest source documents, text, and code. Semantic chunking algorithms partition content with token estimation, while configured LLMs synthesize structured question-and-answer SFT candidate pairs for human review and Corpus commitment.

### G. Dataset Engineering & Quality Suite
- **Training Readiness**: Pre-flight certification checking 8 critical dimensions (token boundaries, chat template fidelity, exact duplicates, empty turns).
- **Chat Template Validation**: Real Jinja2 rendering against Meta Llama 3, Qwen 2.5, Gemma 2, Mistral, and Phi-3/4 templates.
- **Train / Eval Splitting**: Deterministic pseudo-random partition (e.g. 80/10/10) with **Group-Level Leakage Shield** preventing near-duplicates from crossing split boundaries.
- **System Prompt & Persona Audit**: Enforce single-persona consistency or analyze intentional multi-persona clusters.
- **Deduplication & Diagnostics**: Exact and 3-gram MinHash similarity scans with automated role-alternation repair suggestions.

### H. Mechon Mobile Companion
A native Android client (`ai.mechon.companion`) enabling engineers to create conversational data away from the desktop. Connects securely via local Wi-Fi UDP discovery (port 38476) or Tailscale mesh. Android inherits the desktop's configured providers and credentials, runs standalone `@Web Search`, and transfers mobile sessions directly into the desktop SFT pipeline.  
*Documentation: [docs/MECHON_MOBILE.md](docs/MECHON_MOBILE.md)*

---

## 6. Platform Support

| Component | Platform | Technology Stack | Distribution |
|---|---|---|---|
| **Desktop Workstation** | Linux (Arch, Ubuntu, Debian, Fedora) | Rust 2021, Tauri 2, React 18, Vite 6, SQLite WAL | Native Arch package (`PKGBUILD`), AppImage, Tarball |
| **Mobile Companion** | Android 14+ (API 34+) | Kotlin, Jetpack Compose, Material 3, OkHttp | Release APK (16 KB page-size ready) |

---

## 7. Supported Model Providers

Mechon AI features a vendor-neutral inference layer with automatic canonical alias normalization:

- **Local / Offline**: [Ollama](https://ollama.com/) (100% offline, local GPU inference)
- **Cloud Providers**: Google Gemini, Anthropic Claude, OpenAI, Groq (ultra-low latency LPU), Mistral AI, OpenRouter
- **Self-Hosted**: Any OpenAI-compatible endpoint (vLLM, TGI, LM Studio, LocalAI)

API credentials are encrypted in the **OS-native Secret Service / KDE KWallet** via D-Bus, backed by an AES-256-GCM hardware-derived fallback.  
*Documentation: [docs/PROVIDERS.md](docs/PROVIDERS.md)*

---

## 8. Documentation Index

- [User Guide](docs/USER_GUIDE.md) — Comprehensive user guide and studio workflows
- [Architecture Specification](docs/ARCHITECTURE.md) — Technical architecture, Rust core, and storage
- [SFT Studio Guide](docs/SFT_STUDIO.md) — Multi-turn conversation curation & translation
- [Story Architect Guide](docs/STORY_ARCHITECT.md) — Tri-Agent narrative simulation & prompt planning
- [Corpus & Export Guide](docs/CORPUS_AND_EXPORT.md) — Central dataset workspace & selective export
- [DPO Studio Guide](docs/DPO_STUDIO.md) — Pairwise preference dataset generation
- [Mechon Mobile Guide](docs/MECHON_MOBILE.md) — Android setup, Tailscale mesh & LAN pairing
- [Model Providers](docs/PROVIDERS.md) — Supported engines, endpoints, and credential storage
- [Dataset Formats](docs/DATA_FORMATS.md) — Schema specifications for ShareGPT, Alpaca, and DPO
- [Security & Privacy](docs/SECURITY.md) — Zero-telemetry, encryption, and authorization architecture
- [Development Guide](docs/DEVELOPMENT.md) — Building, testing, and packaging from source

---

## 9. Development Quick Start

### Desktop Workstation
```bash
# Clone the repository
git clone https://github.com/Mechon-AI/mechon-ai.git
cd mechon-ai

# Install dependencies and start desktop dev server
cd frontend && npm install
cd ..
npm run tauri dev
```

### Android Companion
```bash
cd android
./gradlew testDebugUnitTest assembleDebug
```

---

## 10. License

Mechon AI is open-source software licensed under the **[Apache License 2.0](LICENSE)**.
