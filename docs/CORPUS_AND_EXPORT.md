# Mechon Corpus & Export Center
**Version 1.2.8 | Mechon AI Fine-Tuning Workstation**

**Mechon Corpus** is the central data workspace of Mechon AI. It bridges interactive conversation engineering with final downstream model training. 

Rather than treating dataset storage as an immutable graveyard, Corpus functions as an active engineering hub where records can be browsed, audited, loaded back into studios for further evolution, and selectively exported into standard fine-tuning formats.

---

## 1. Mechon Corpus Workspace

```mermaid
flowchart LR
    SFT[SFT Studio] -->|Commit Record| Corpus[(Mechon Corpus)]
    Story[Story Architect] -->|Commit Record| Corpus
    Forge[Dataset Forge / Parser] -->|Commit Record| Corpus
    Mobile[Mechon Mobile] -->|Sync Session| Corpus

    Corpus -->|Select & Load| SFT
    Corpus -->|Filter & Select| Export[Export Center]
    Export --> JSONL[JSONL (ShareGPT / Alpaca)]
    Export --> JSON[Standard JSON]
    Export --> CSV[Tabular CSV]
```

### Key Capabilities in Corpus

- **Browse & Inspect**: Inspect complete multi-turn dialogues with message roles, token counts, and session metadata.
- **Multilingual Viewer**: View primary text alongside any generated secondary or tertiary language translations.
- **Search & Filter**: Filter records by project, tags, language code, token length range, or text query.
- **Selective Multi-Selection**: Select specific subsets of records using checkboxes or keyboard multi-select.
- **Two-Way Studio Bridge**: Select any record and click **Load into SFT Studio** to continue dialogue turns, edit responses, run additional translations, and recommit.

---

## 2. Export Center

The **Export Center** transforms curated Corpus records into machine-readable formats optimized for popular training frameworks (Axolotl, Unsloth, LLaMA-Factory, HuggingFace TRL).

### Supported Export Formats

| Format | Target Use Case | Structure |
|---|---|---|
| **JSONL (ShareGPT)** | Conversational SFT (Axolotl, FastChat, TRL) | One JSON line per conversation with `conversations: [{from, value}]` |
| **JSONL (Alpaca)** | Instruction-Tuned SFT | One JSON line per sample with `instruction`, `input`, `output` |
| **Standard JSON** | Programmatic ingestion & custom data loaders | Formatted array of conversation objects with full metadata |
| **Tabular CSV** | Spreadsheet auditing & quick inspections | Flat rows with serialized message columns |

---

## 3. Selective vs. Full-Corpus Export

- **Full-Corpus Export**: Exports every active record within the selected project workspace.
- **Selective Export**: When one or more rows are selected in the Corpus table, the Export Center activates **Selective Export** mode, producing a dataset bundle containing *only* the chosen records.

---

## 4. Multilingual Export Options

When exporting records containing multilingual translations:
1. **Primary Language Only**: Exports only the primary language text.
2. **Target Language Only**: Emits translated text in place of original turns.
3. **Parallel Multilingual**: Emits distinct dataset records for each language version, doubling or tripling corpus diversity for cross-lingual fine-tuning.
4. **Metadata Preservation**: All exports retain language codes (`en`, `id`, `ja`, etc.) in record metadata headers.

---

## 5. Dataset Integrity & Cryptographic Checksums

During export, Mechon AI automatically calculates and writes:
- **SHA-256 Checksum**: Computed directly over the exported file bytes and saved to an accompanying `.sha256` manifest.
- **Integrity Validation**: Guarantees that files transferred to remote GPU training clusters have not suffered bitrot or accidental modification.
- **Export Audit Log**: Logs export timestamp, sample count, total tokens, and MD5/SHA-256 signatures in the local SQLite database.
