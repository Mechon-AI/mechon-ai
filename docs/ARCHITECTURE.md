# Architecture Specification: Mechon AI

## 1. System Overview

**Mechon AI** is an offline-first desktop workstation designed for local LLM dataset engineering. It specializes in two core training regimes:
1. **Mechon SFT (Supervised Fine-Tuning)**: Human-in-the-loop multi-turn conversation authoring where an entire multi-turn session commits as **one atomic dataset record**.
2. **Mechon DPO (Direct Preference Optimization)**: Side-by-side preference collection capturing chosen/rejected pairs with annotator rationale.

```
+-------------------------------------------------------------------+
|               Tauri 2 Native Desktop Shell (Rust)                 |
|  - Window Lifecycle & Native OS Menus                             |
|  - Managed Python Subprocess Lifecycle (Loopback 127.0.0.1)       |
|  - Dynamic Port Allocation & Health Check Polling                 |
+---------------------------------+---------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
+-----------v-----------------------+   +---------------v-------------------+
|      React 18 Frontend (Vite)     |   |       FastAPI Backend Subprocess  |
| - TypeScript & Tailwind CSS       |   | - Loopback Bound: 127.0.0.1       |
| - TanStack Query & Zustand        |   | - SQLite + WAL Mode + Foreign Keys|
| - Mechon SFT (Multi-turn editor)  |   | - Provider Abstraction Engine     |
| - Mechon DPO (Side-by-side UI)    |   | - SFT & DPO Core Engines          |
| - Mechon Corpus Explorer          |   | - Quality Control Validator       |
| - Analytics & Version Snapshots   |   | - Export & Import Serializers     |
+-----------------------------------+   +-----------------------------------+
```

---

## 2. Directory Layout & Storage

Mechon AI strictly adheres to the **XDG Base Directory Specification**:

```
~/.local/share/mechon-ai/
├── mechon.db                  # Primary SQLite 3 database
├── mechon.db-wal              # Write-Ahead Logging journal
├── mechon.db-shm              # Shared memory index
├── backups/                   # Hot online SQLite backups
└── snapshots/                 # Cryptographic JSON snapshots

~/.config/mechon-ai/
└── settings.json              # Persistent user preferences & providers
```

---

## 3. Data Integrity & Concurrency

- **Engine**: SQLite 3 with `journal_mode=WAL` and `synchronous=NORMAL`.
- **Foreign Keys**: Enforced on every connection via `PRAGMA foreign_keys=ON`.
- **Atomic SFT Commits**: A drafted multi-turn conversation with $N$ messages is validated, serialized, and inserted as exactly one row in the `sft_records` table, with the full canonical message array stored as JSON.
- **Rollback & Snapshots**: Every dataset version records a SHA-256 hash across all active records, enabling verifiable rollback to any previous state.
