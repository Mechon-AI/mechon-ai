"""
Dataset Export Service.
Generates compliant training exports for fine-tuning pipelines (JSONL, JSON, CSV).
"""

import json
import csv
import io
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import SFTRecord, DPOTask, AuditLog


class ExportService:
    @staticmethod
    def export_sft(
        db: Session,
        project_id: str,
        format_type: str = "jsonl",
        include_metadata: bool = True,
        system_role_in_messages: bool = True
    ) -> str:
        records = db.query(SFTRecord).filter(SFTRecord.project_id == project_id).order_by(SFTRecord.created_at.asc()).all()

        if format_type == "jsonl":
            output = io.StringIO()
            for r in records:
                msgs = json.loads(r.messages_json or "[]")
                if not system_role_in_messages:
                    msgs = [m for m in msgs if m.get("role") != "system"]

                row = {
                    "id": r.id,
                    "messages": msgs
                }
                if include_metadata:
                    row["metadata"] = json.loads(r.metadata_json or "{}")

                output.write(json.dumps(row, ensure_ascii=False) + "\n")
            return output.getvalue()

        elif format_type == "json":
            rows = []
            for r in records:
                msgs = json.loads(r.messages_json or "[]")
                if not system_role_in_messages:
                    msgs = [m for m in msgs if m.get("role") != "system"]

                row = {
                    "id": r.id,
                    "messages": msgs
                }
                if include_metadata:
                    row["metadata"] = json.loads(r.metadata_json or "{}")
                rows.append(row)
            return json.dumps(rows, ensure_ascii=False, indent=2)

        elif format_type == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["id", "turn_count", "character_count", "conversation_text", "metadata"])
            for r in records:
                msgs = json.loads(r.messages_json or "[]")
                dialogue = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in msgs])
                writer.writerow([
                    r.id,
                    r.turn_count,
                    r.character_count,
                    dialogue,
                    r.metadata_json if include_metadata else ""
                ])
            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format '{format_type}' for SFT")

    @staticmethod
    def export_dpo(
        db: Session,
        project_id: str,
        format_type: str = "jsonl",
        include_metadata: bool = True,
        only_completed: bool = True
    ) -> str:
        query = db.query(DPOTask).filter(DPOTask.project_id == project_id)
        if only_completed:
            query = query.filter(DPOTask.preference.in_(["a", "b"]))

        tasks = query.order_by(DPOTask.created_at.asc()).all()

        if format_type == "jsonl":
            output = io.StringIO()
            for t in tasks:
                if t.preference == "a":
                    chosen = t.response_a
                    rejected = t.response_b
                elif t.preference == "b":
                    chosen = t.response_b
                    rejected = t.response_a
                else:
                    continue  # skip ties or unannotated in strict DPO JSONL

                row = {
                    "id": t.id,
                    "prompt": t.prompt,
                    "chosen": chosen,
                    "rejected": rejected
                }
                if t.system_prompt:
                    row["system"] = t.system_prompt

                if include_metadata:
                    meta = json.loads(t.metadata_json or "{}")
                    meta["preference"] = t.preference
                    if t.rationale:
                        meta["rationale"] = t.rationale
                    row["metadata"] = meta

                output.write(json.dumps(row, ensure_ascii=False) + "\n")
            return output.getvalue()

        elif format_type == "json":
            rows = []
            for t in tasks:
                if t.preference == "a":
                    chosen, rejected = t.response_a, t.response_b
                elif t.preference == "b":
                    chosen, rejected = t.response_b, t.response_a
                else:
                    continue

                row = {
                    "id": t.id,
                    "prompt": t.prompt,
                    "chosen": chosen,
                    "rejected": rejected
                }
                if t.system_prompt:
                    row["system"] = t.system_prompt
                if include_metadata:
                    meta = json.loads(t.metadata_json or "{}")
                    meta["preference"] = t.preference
                    row["metadata"] = meta
                rows.append(row)
            return json.dumps(rows, ensure_ascii=False, indent=2)

        elif format_type == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["id", "prompt", "chosen", "rejected", "preference", "rationale"])
            for t in tasks:
                chosen = t.response_a if t.preference == "a" else (t.response_b if t.preference == "b" else "")
                rejected = t.response_b if t.preference == "a" else (t.response_a if t.preference == "b" else "")
                writer.writerow([
                    t.id,
                    t.prompt,
                    chosen,
                    rejected,
                    t.preference or "",
                    t.rationale or ""
                ])
            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format '{format_type}' for DPO")
