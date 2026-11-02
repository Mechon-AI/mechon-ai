"""
Dataset Import Service.
Imports JSONL, JSON, and CSV files, detects schema, handles SFT vs DPO,
and commits records safely to the target project.
"""

import json
import csv
import io
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from app.models.entities import SFTRecord, DPOTask, AuditLog


class ImportService:
    @staticmethod
    def import_dataset(
        db: Session,
        project_id: str,
        content: str,
        filename: str
    ) -> Dict[str, Any]:
        lines = [line.strip() for line in content.strip().splitlines() if line.strip()]
        if not lines:
            raise ValueError("Import file is empty.")

        imported_sft = 0
        imported_dpo = 0
        skipped = 0
        errors = []

        is_jsonl = filename.endswith(".jsonl") or (lines[0].startswith("{") and lines[-1].endswith("}"))
        is_json = filename.endswith(".json") and lines[0].startswith("[")

        if is_json:
            try:
                items = json.loads(content)
            except Exception as e:
                raise ValueError(f"Invalid JSON array: {str(e)}")
        elif is_jsonl:
            items = []
            for i, line in enumerate(lines):
                try:
                    items.append(json.loads(line))
                except Exception as e:
                    errors.append(f"Line {i+1}: malformed JSON ({str(e)})")
                    skipped += 1
        else:
            # Try CSV parse
            reader = csv.DictReader(io.StringIO(content))
            items = list(reader)

        for item in items:
            try:
                # Detect SFT schema: contains 'messages'
                if "messages" in item and isinstance(item["messages"], list):
                    msgs = item["messages"]
                    turn_count = len(msgs)
                    char_count = sum(len(m.get("content", "")) for m in msgs)
                    meta = item.get("metadata", {})
                    meta["imported_from"] = filename

                    rec = SFTRecord(
                        project_id=project_id,
                        messages_json=json.dumps(msgs, ensure_ascii=False),
                        turn_count=turn_count,
                        character_count=char_count,
                        metadata_json=json.dumps(meta, ensure_ascii=False),
                        revision=1
                    )
                    db.add(rec)
                    imported_sft += 1

                # Detect DPO schema: contains prompt and chosen/rejected
                elif "prompt" in item and ("chosen" in item or "rejected" in item or "response_a" in item):
                    prompt = item.get("prompt", "")
                    if "chosen" in item and "rejected" in item:
                        resp_a = item.get("chosen", "")
                        resp_b = item.get("rejected", "")
                        pref = "a"
                        status = "completed"
                    else:
                        resp_a = item.get("response_a", "")
                        resp_b = item.get("response_b", "")
                        pref = item.get("preference")
                        status = "completed" if pref else "pending"

                    meta = item.get("metadata", {})
                    meta["imported_from"] = filename

                    task = DPOTask(
                        project_id=project_id,
                        prompt=prompt,
                        system_prompt=item.get("system"),
                        response_a=resp_a,
                        response_b=resp_b,
                        preference=pref,
                        status=status,
                        metadata_json=json.dumps(meta, ensure_ascii=False)
                    )
                    db.add(task)
                    imported_dpo += 1

                else:
                    skipped += 1
                    errors.append("Unrecognized record format: missing 'messages' or 'prompt/chosen/rejected'.")

            except Exception as e:
                skipped += 1
                errors.append(f"Failed to import record: {str(e)}")

        db.commit()

        # Audit log
        audit = AuditLog(
            project_id=project_id,
            event_type="dataset_imported",
            entity_type="project",
            entity_id=project_id,
            details_json=json.dumps({
                "filename": filename,
                "imported_sft": imported_sft,
                "imported_dpo": imported_dpo,
                "skipped": skipped
            })
        )
        db.add(audit)
        db.commit()

        return {
            "filename": filename,
            "imported_sft_records": imported_sft,
            "imported_dpo_tasks": imported_dpo,
            "skipped_records": skipped,
            "errors": errors[:20]
        }
