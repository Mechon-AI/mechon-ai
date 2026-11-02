# User Guide: Mechon AI

Welcome to **Mechon AI** — the native desktop workstation for language model Supervised Fine-Tuning (SFT) and Direct Preference Optimization (DPO) dataset engineering.

Tagline: **Engineer the Data. Shape the Intelligence.**

---

## 1. Projects & Workspaces
All datasets are partitioned by project:
- Switch active projects using the sidebar dropdown.
- Manage projects via the **Projects** view in the sidebar.
- You can create, duplicate, archive, or delete projects at any time.

---

## 2. Mechon SFT: Interactive Multi-Turn Authoring

Mechon SFT allows human curators to converse directly with local or remote models to build high-quality multi-turn demonstrations:

1. **Start a Chat Session**:
   - Click **New Chat** in the Mechon SFT sidebar.
   - Configure the **System Instructions** by toggling the header button.
2. **Interact with the Model**:
   - Type user prompts in the bottom input bar.
   - Press `Enter` to send; press `Shift+Enter` for a newline.
   - The selected model responds in real time.
3. **Edit Any Turn**:
   - Hover over any message to click the **Edit** icon.
   - Make corrections, refine tone, or improve factual accuracy.
4. **Truncate Downstream**:
   - If a conversation took a wrong turn, truncate all messages after a specific point and re-prompt.
5. **Commit to Dataset**:
   - Click **Commit to SFT Dataset**.
   - The entire conversation is saved as **one atomic multi-turn SFT record**.

---

## 3. Mechon DPO: Preference Pair Engineering

Mechon DPO streamlines pairwise comparison for preference alignment:

1. **Create Task**:
   - Enter your prompt and optional system instructions.
2. **Generate Candidates**:
   - Click **Generate A & B** to invoke parallel inference.
   - Alternatively, write or paste candidate responses manually.
3. **Compare Side-by-Side**:
   - Inspect markdown formatting, code blocks, and token counts.
4. **Annotate**:
   - Press `A` to choose Response A.
   - Press `B` to choose Response B.
   - Press `T` to mark as Tie.
   - Press `X` to Flag for low quality.
   - Press `S` to Skip.
   - Add optional rationales in the reasoning box.

---

## 4. Mechon Corpus: Unified Dataset Explorer

- Switch between **SFT Records** and **DPO Pairs**.
- Filter by search keywords, regex, or metadata tags.
- Toggle between **Rendered View** and **Raw JSON View**.
- Inspect token metrics and message counts per record.

---

## 5. Export Center

Export your datasets in standard formats:
- **ShareGPT JSONL**: Standard multi-turn format (`conversations` array).
- **Alpaca JSONL**: Single-turn instruction-input-output format.
- **Hugging Face TRL DPO JSONL**: Standard `prompt`, `chosen`, and `rejected` keys.
- **Apache Parquet**: Compressed columnar binary format for large-scale training pipelines.
