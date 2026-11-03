# Mechon AI: Dataset Formats & Schema Specification

This document provides the definitive specification for datasets created, curated, validated, and exported by **Mechon AI**.

All exported formats are compliant with standard machine learning training pipelines, including **Hugging Face TRL**, **Axolotl**, **Llama-Factory**, and **Torchtune**.

---

## 1. Supervised Fine-Tuning (SFT) Formats

### 1.1 Canonical Aligned Format (Standard JSONL)

In Mechon AI, a multi-turn conversation is **always committed as exactly one atomic record**. It is never fragmented into disconnected turn rows.

Each line in the exported JSONL file represents a complete conversation session:

```json
{
  "id": "e4b29c18-9a4f-4d32-b7e1-8f5c3a290d11",
  "project_id": "c1a8d052-7e3f-4890-a59e-1148e69efb32",
  "session_id": "58f12d4a-3882-4110-8ec4-d8863f61b072",
  "title": "Quantum Computing Fundamentals",
  "language_mode": "bilingual",
  "primary_language": "id",
  "secondary_language": "en",
  "messages": [
    {
      "id": "msg-001",
      "role": "system",
      "content": "Anda adalah asisten AI yang ahli dalam fisika kuantum.",
      "translations": {
        "en": "You are an AI assistant specialized in quantum physics."
      },
      "translation_status": {
        "en": "approved"
      }
    },
    {
      "id": "msg-002",
      "role": "user",
      "content": "Jelaskan konsep dasar superposisi kuantum dalam satu paragraf.",
      "translations": {
        "en": "Explain the fundamental concept of quantum superposition in one paragraph."
      },
      "translation_status": {
        "en": "approved"
      }
    },
    {
      "id": "msg-003",
      "role": "assistant",
      "content": "Superposisi kuantum adalah prinsip dasar mekanika kuantum di mana sebuah partikel dapat berada dalam beberapa keadaan sekaligus sebelum dilakukan pengukuran.",
      "translations": {
        "en": "Quantum superposition is a fundamental principle of quantum mechanics where a particle can exist in multiple states simultaneously before measurement."
      },
      "translation_status": {
        "en": "approved"
      }
    }
  ],
  "metadata": {
    "domain": "Physics",
    "difficulty": "intermediate",
    "verified_by": "human_expert",
    "turn_count": 3
  },
  "created_at": "2026-11-03T08:15:00Z",
  "updated_at": "2026-11-03T08:30:00Z"
}
```

---

### 1.2 Bilingual SFT Export Projections

When exporting bilingual conversation records, Mechon AI supports three transformation modes:

#### Mode A: `canonical_aligned`
Retains the full nested structure including source text, all secondary language translations in `translations`, and verification statuses in `translation_status`. Ideal for cross-lingual alignment and translation evaluation pipelines.

#### Mode B: `primary_only`
Projects only the primary language text. Strips all translation metadata to yield pure, clean monolingual dialogue in the primary language (e.g., Indonesian):
```json
{
  "id": "e4b29c18-9a4f-4d32-b7e1-8f5c3a290d11",
  "messages": [
    {"role": "system", "content": "Anda adalah asisten AI yang ahli dalam fisika kuantum."},
    {"role": "user", "content": "Jelaskan konsep dasar superposisi kuantum dalam satu paragraf."},
    {"role": "assistant", "content": "Superposisi kuantum adalah prinsip dasar mekanika kuantum di mana sebuah partikel dapat berada dalam beberapa keadaan sekaligus sebelum dilakukan pengukuran."}
  ]
}
```

#### Mode C: `secondary_only`
Swaps the main `content` string with the translated text of the designated secondary language (e.g., English), producing clean monolingual dialogue targeted for English training:
```json
{
  "id": "e4b29c18-9a4f-4d32-b7e1-8f5c3a290d11",
  "messages": [
    {"role": "system", "content": "You are an AI assistant specialized in quantum physics."},
    {"role": "user", "content": "Explain the fundamental concept of quantum superposition in one paragraph."},
    {"role": "assistant", "content": "Quantum superposition is a fundamental principle of quantum mechanics where a particle can exist in multiple states simultaneously before measurement."}
  ]
}
```

---

## 2. Direct Preference Optimization (DPO) Formats

### 2.1 Standard Pairwise JSONL (Hugging Face TRL Compatible)

In DPO tasks, each record pairs a prompt with a chosen (preferred) response and a rejected (non-preferred) response.

```json
{
  "id": "dpo-8821fa0c-512a-4ce7-bb91-03829031ef82",
  "project_id": "c1a8d052-7e3f-4890-a59e-1148e69efb32",
  "prompt": "Tuliskan implementasi fungsi binary search rekursif di Rust.",
  "chosen": "Berikut adalah implementasi binary search rekursif yang idiomatik di Rust:\n\n```rust\npub fn binary_search<T: Ord>(slice: &[T], target: &T) -> Option<usize> {\n    fn helper<T: Ord>(slice: &[T], target: &T, low: usize, high: usize) -> Option<usize> {\n        if low > high || high >= slice.len() {\n            return None;\n        }\n        let mid = low + (high - low) / 2;\n        match slice[mid].cmp(target) {\n            std::cmp::Ordering::Equal => Some(mid),\n            std::cmp::Ordering::Greater if mid > 0 => helper(slice, target, low, mid - 1),\n            std::cmp::Ordering::Less => helper(slice, target, mid + 1, high),\n            _ => None,\n        }\n    }\n    if slice.is_empty() { None } else { helper(slice, target, 0, slice.len() - 1) }\n}\n```",
  "rejected": "Ini kodenya:\n\n```rust\nfn search(arr: Vec<i32>, x: i32) -> i32 {\n    for i in 0..arr.len() {\n        if arr[i] == x { return i as i32; }\n    }\n    -1\n}\n```",
  "metadata": {
    "model_a": "claude-3-5-sonnet-20241022",
    "model_b": "llama-3.1-8b-instruct",
    "winner": "A",
    "rationale": "Response A menyediakan algoritma binary search rekursif generic yang benar dan aman terhadap overflow. Response B hanya linear search iteratif.",
    "is_flagged": false
  },
  "created_at": "2026-11-03T07:20:00Z"
}
```

---

## 3. CSV Export Format

When exporting to tabular CSV format, multiline strings are escaped per RFC 4180.

### 3.1 SFT CSV Layout
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | Unique identifier for the atomic record |
| `title` | String | Conversation title |
| `turn_count` | Integer | Total turns in conversation |
| `language_mode` | String | `monolingual` or `bilingual` |
| `primary_language` | String | ISO 639-1 code (e.g. `id`) |
| `secondary_language` | String | ISO 639-1 code (e.g. `en`) |
| `messages_json` | String (JSON) | Serialized message turn array |
| `metadata_json` | String (JSON) | Custom key-value tagging and provenance |
| `created_at` | String (ISO 8601) | Record creation timestamp |

### 3.2 DPO CSV Layout
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (UUID) | Unique identifier for the preference task |
| `prompt` | String | The input prompt or instruction |
| `chosen` | String | The annotated winning completion |
| `rejected` | String | The annotated losing completion |
| `winner` | String | `A`, `B`, or `tie` |
| `rationale` | String | Annotator explanation for the preference decision |
| `model_a` | String | Identifier of model generating candidate A |
| `model_b` | String | Identifier of model generating candidate B |
| `created_at` | String (ISO 8601) | Annotation timestamp |

---

## 4. Conversational DPO (TRL Schema)

Mechon AI provides full support for Hugging Face TRL multi-turn preference schemas:

```json
{
  "prompt": [
    {
      "role": "system",
      "content": "You are a helpful coding assistant specialized in Rust."
    },
    {
      "role": "user",
      "content": "Write a function to compute factorial recursively."
    }
  ],
  "chosen": [
    {
      "role": "assistant",
      "content": "pub fn factorial(n: u64) -> u64 {\n    match n {\n        0 | 1 => 1,\n        _ => n * factorial(n - 1),\n    }\n}"
    }
  ],
  "rejected": [
    {
      "role": "assistant",
      "content": "fn factorial(n: i32) -> i32 {\n    if n <= 1 { return 1; }\n    return n * factorial(n - 1);\n}"
    }
  ],
  "id": "dpo-task-9012",
  "rationale": "Pattern matching with u64 avoids signed negative edge cases in Rust.",
  "metadata": {
    "model_chosen": "qwen-2.5-coder-32b",
    "model_rejected": "llama-3.1-8b"
  }
}
```

---

## 5. Dataset Split Partition Schema

Train, validation, and evaluation partitions are generated deterministically and stored in SQLite:

```json
{
  "split_id": "split-20261103-01",
  "name": "llama-3-train-eval-v1",
  "seed": 42,
  "train_pct": 0.80,
  "val_pct": 0.10,
  "eval_pct": 0.10,
  "total_count": 1000,
  "train_count": 800,
  "val_count": 100,
  "eval_count": 100,
  "zero_leakage_verified": true,
  "assignments": [
    {
      "record_id": "rec-001",
      "record_type": "sft",
      "split_name": "train",
      "group_id": "grp-dedup-0012"
    }
  ]
}
```

---

## 6. Training Readiness Report Schema

The flagship pre-flight certification report evaluates 8 dimensions of fine-tuning readiness:

```json
{
  "report_id": "rep-8924b102",
  "project_id": "proj-default",
  "title": "Production Fine-Tuning Certification",
  "status": "READY",
  "model_family": "llama",
  "max_seq_len": 4096,
  "generated_at": "2026-11-03T12:00:00Z",
  "total_records": 1250,
  "sft_count": 1000,
  "dpo_count": 250,
  "total_estimated_tokens": 1420500,
  "checks": [
    {
      "category": "Dataset Overview",
      "name": "Dataset Volume & Balance",
      "passed": true,
      "is_mandatory": true,
      "severity": "info",
      "message": "Dataset contains 1250 total examples."
    },
    {
      "category": "Chat Template Compliance",
      "name": "Target Model Jinja2 Compatibility",
      "passed": true,
      "is_mandatory": true,
      "severity": "critical",
      "message": "100.0% of records passed chat template validation."
    }
  ]
}
```

---

## 7. JSON vs. JSONL

- **JSON Lines (`.jsonl`) — Recommended**:
  - Each record is serialized onto a single line separated by `\n`.
  - Enables streaming reads, out-of-core dataset loading, and chunked processing without loading entire multi-gigabyte files into RAM.
  - Standard format expected by Hugging Face Datasets (`load_dataset('json', data_files='...')`).
- **Standard JSON (`.json`)**:
  - Encoded as a root array of objects (`[ {...}, {...} ]`).
  - Useful for inspection in web dashboards, API mocking, and lightweight configuration exchange.
