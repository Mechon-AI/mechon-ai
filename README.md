<div align="center">

<img src="assets/mechon-logo.svg" alt="Mechon AI Logo" width="480" />

<br/>

**Engineer the Data. Shape the Intelligence.**

*A professional, local-first desktop workstation for engineering high-quality AI training datasets, specializing in Supervised Fine-Tuning (SFT) and Direct Preference Optimization (DPO).*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![GitHub Organization](https://img.shields.io/badge/GitHub-Mechon--AI-181717.svg?logo=github)](https://github.com/Mechon-AI)
[![Target Platform](https://img.shields.io/badge/Platform-Arch_Linux_%7C_Linux-informational.svg)](#installation)
[![Core](https://img.shields.io/badge/Core-Native_Rust_%2B_Tokio_%2B_SQLx-orange.svg)](#technology-stack)
[![Desktop Shell](https://img.shields.io/badge/Desktop-Tauri_2-brightgreen.svg)](#technology-stack)
[![Frontend](https://img.shields.io/badge/Frontend-React_18_%2B_Vite_%2B_TypeScript-blueviolet.svg)](#technology-stack)

</div>

---

## 1. Product Vision

**Mechon AI** is a native, offline-first desktop application engineered for AI researchers, ML dataset engineers, and developers who demand complete sovereignty, rigor, and speed over language model alignment data.

Modern foundation models are only as good as the data that shapes them. Mechon AI bridges the gap between raw text generation and rigorous dataset curation by replacing fragile scripts and web dashboards with a purpose-built desktop workstation.

- **100% Native Architecture**: Built with Rust, Tauri 2, and SQLite. **Zero Python required at runtime.**
- **Local-First & Offline**: Direct in-process SQLite database with Write-Ahead Logging (WAL) and foreign-key integrity. Zero telemetry, zero external cloud dependencies.
- **Engineered Precision**: Direct Tauri IPC command architecture without HTTP server overhead. SHA-256 cryptographic dataset snapshots and rollback.
- **Full Workflow Breadth**: From multi-turn human-in-the-loop conversation crafting to pairwise preference evaluation and one-click Hugging Face TRL-compliant export.

---

## 2. Core Modules

| Module | Status | Description |
| :--- | :--- | :--- |
| **Mechon SFT** | **Production** | Supervised Fine-Tuning workspace for interactive multi-turn dialogue creation, turn editing, live tree branching, and atomic session commitment into unified record arrays. |
| **Mechon DPO** | **Production** | Direct Preference Optimization workspace for dual-candidate generation, side-by-side preference rating, tie/flag assignment, and reasoning capture. |
| **Mechon Corpus** | **Production** | Unified dataset repository featuring full-text search, regex filtering, metadata tagging, record duplication, and instant JSON/rendered inspection. |
| **Model Playground** | **Production** | Fast local inference testing workbench supporting multiple providers simultaneously with adjustable sampling parameters. |
| **Quality Control** | **Production** | Diagnostic engine auditing role alternations, prompt overlap, token length imbalances, and empty turn anomalies. |
| **Version Snapshots** | **Production** | Point-in-time immutable dataset versioning with SHA-256 hashing, diff viewers, and one-click rollback. |
| **Export Center** | **Production** | Multi-format export engine outputting to Hugging Face TRL JSONL (ShareGPT, Alpaca, Standard chosen/rejected) and CSV. |
| **Provider Manager** | **Production** | Provider orchestration for Ollama, OpenAI-compatible backends (vLLM, LM Studio, SGLang), and built-in offline Mock LLM. |
| **Mechon Train** | *Planned* | Integrated local LoRA/QLoRA runner for direct on-device model fine-tuning against curated datasets. |

---

## 3. Workflows

### Mechon SFT Workflow (Supervised Fine-Tuning)
1. **Initiate Session**: Create a drafting session with a system prompt and target model.
2. **Iterative Dialogue**: Add alternating `user` and `assistant` turns, or prompt a connected local provider to stream candidate responses.
3. **In-Flight Editing**: Modify any turn at any stage; truncate downstream turns or branch new variations.
4. **Atomic Commitment**: Commit the draft into an immutable SFT record. Multi-turn dialogue is packaged into **exactly one atomic record** with the complete messages array (`[{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]`).
5. **Idempotent Retention**: Multiple conversations append to the project's dataset; retrying a commit updates the existing record rather than duplicating it.

### Mechon DPO Workflow (Direct Preference Optimization)
1. **Task Creation**: Input a prompt and optional system instructions.
2. **Dual-Model Generation**: Generate Response A and Response B concurrently via Ollama, vLLM, or manual drafting.
3. **Pairwise Ranking**: Inspect side-by-side completions with live markdown rendering and token counters.
4. **Decision & Annotation**: Designate Winner (`A` or `B`), mark `Tie`, or `Flag` for low quality using keyboard shortcuts (`A`, `B`, `T`, `X`, `S`). Document rationale directly in the metadata.
5. **TRL Export**: Export preference pairs directly to standard format: `{"prompt": "...", "chosen": "...", "rejected": "..."}`.

---

## 4. Supported Model Providers

- **Built-in Mock Provider**: Ready out of the box with zero setup for immediate offline testing, prototyping, and UI verification.
- **Ollama**: Native local connection (`http://127.0.0.1:11434`) with model discovery, temperature, top-p, and max tokens.
- **OpenAI-Compatible Runtimes**: Universal connector for:
  - **vLLM**
  - **LM Studio**
  - **SGLang**
  - **LocalAI / text-generation-webui**
  - Any standard OpenAI `/v1/chat/completions` compliant endpoint.

---

## 5. Technology Stack

```text
Mechon AI Desktop Workstation
│
├── Tauri 2 Desktop Shell
│   └── Rust Application Core
│       ├── Command Handlers (Tauri generate_handler!)
│       ├── Application Services (Project, SFT, DPO, Dataset, Validation, Versioning)
│       ├── Provider Manager (Async trait ModelProvider: OpenAI, Ollama, Mock)
│       ├── Model Communication (Reqwest + Tokio SSE streaming)
│       ├── Validation Engine (Multi-turn dialogue and preference audits)
│       ├── Import / Export (JSONL, JSON, CSV)
│       └── SQLite Repository (SQLx + WAL Mode + Automatic Migrations)
│
├── React 18 + Vite 6 + TypeScript Frontend
│   ├── Application Shell (AppLayout with persistent theme toggle)
│   ├── Project Workspace
│   ├── Provider Manager
│   ├── SFT Studio (Multi-turn conversational tree & streaming inference)
│   ├── DPO Studio (Side-by-side pairwise annotation & hotkeys)
│   ├── Dataset Explorer (Corpus browser, full-text search & pagination)
│   ├── Analytics (KPIs & growth timelines)
│   └── Settings & Maintenance (Database integrity & atomic VACUUM backups)
│
└── SQLite Database (~/.local/share/mechon-ai/mechon.db)
    ├── projects
    ├── providers
    ├── sft_sessions & sft_messages
    ├── sft_records (atomic conversation records)
    ├── dpo_tasks
    ├── dataset_versions
    ├── app_settings
    └── audit_logs
```

---

## 6. Installation

### Arch Linux / EndeavourOS / Manjaro / CachyOS (Primary Platform)

Mechon AI provides a native Arch Linux `PKGBUILD`:

```bash
# Clone the repository
git clone https://github.com/Mechon-AI/mechon-ai.git
cd mechon-ai/packaging/arch

# Build and install using makepkg
makepkg -si
```

### Debian / Ubuntu / Pop!_OS / Linux Mint
```bash
cd mechon-ai/packaging/debian
dpkg-buildpackage -us -uc -b
sudo dpkg -i ../mechon-ai_1.0.0_amd64.deb
```

### Fedora / openSUSE / RHEL
```bash
cd mechon-ai/packaging/rpm
rpmbuild -ba mechon-ai.spec
```

### AppImage & Flatpak
- Standalone portable AppImage: run `scripts/package.sh` to package.
- Flatpak manifest provided at `packaging/flatpak/ai.mechon.Studio.yml`.

---

## 7. Development Setup

### Prerequisites
- **Linux** (Arch Linux or any modern distribution)
- **Rust** & **Cargo** (1.75+)
- **Node.js** (v18+) & **npm**

*(Notice: Python is NOT required by Mechon AI at runtime or build time)*

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Mechon-AI/mechon-ai.git
cd mechon-ai

# 2. Run automated setup script
./scripts/setup.sh

# 3. Launch in development mode
./scripts/dev.sh
```

### Running Test Suite
```bash
./scripts/test.sh
```

### Building Native Release Binary
```bash
./scripts/build.sh
```
The compiled desktop executable will be located at `src-tauri/target/release/mechon-ai`.

---

## 8. Standards & File Locations

Mechon AI strictly follows the **XDG Base Directory Specification**:

- **Data Directory**: `~/.local/share/mechon-ai/` (SQLite database `mechon.db`, backups, snapshots)
- **Configuration**: `~/.config/mechon-ai/` (User preferences, provider settings)
- **Cache**: `~/.cache/mechon-ai/` (Temporary staging and export artifacts)

---

## 9. License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for details.

Copyright © 2026 Mechon AI Team.
