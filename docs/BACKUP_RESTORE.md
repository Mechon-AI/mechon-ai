# Backup and Disaster Recovery Guide: Mechon AI

## 1. Local SQLite Database Architecture

Mechon AI stores all projects and datasets in a single local SQLite database:
- Default Location: `~/.local/share/mechon-ai/mechon.db`
- In development/sandbox: `mechon-ai/data/mechon.db`

The engine uses **Write-Ahead Logging (WAL)**:
- `mechon.db`: Main database file.
- `mechon.db-wal`: Write-Ahead Log journal.
- `mechon.db-shm`: Shared memory index.

---

## 2. Performing a Hot Online Backup

Mechon AI implements zero-downtime hot backups using SQLite's native C-level Backup API (`sqlite3_backup`). This ensures that even during active dataset drafting or background generation, the backup file is transactionally consistent.

### From Desktop UI:
1. Navigate to **Settings** in the left sidebar.
2. Under **SQLite Database Health & Operations**, click **Hot Online Backup**.
3. The backup file is written to: `mechon_backup.db`.

### From Command Line / REST API:
```bash
curl -X POST http://127.0.0.1:18420/api/v1/settings/backup
```

---

## 3. Restoring from Backup

### From Desktop UI:
1. Open **Settings**.
2. Click **Restore From Backup**.
3. Confirm the restoration prompt. Mechon AI will safely replace `mechon.db` with `mechon_backup.db`.

### Integrity Audits:
Click **Run PRAGMA Integrity Check** in Settings to run a deep byte-level check on B-trees, pages, and indexes:
```bash
curl http://127.0.0.1:18420/api/v1/settings/integrity
# Returns: {"status": "ok", "is_ok": true, "db_path": "..."}
```
