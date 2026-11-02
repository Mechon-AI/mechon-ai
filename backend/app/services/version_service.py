"""
Dataset Versioning Service.
Creates immutable snapshots, calculates SHA-256 checksums, supports diffing, and enables rollbacks.
"""

import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import DatasetVersion, SFTRecord, DPOTask, AuditLog
from app.schemas.schemas import SnapshotCreateRequest


class VersionService:
    @staticmethod
    def list_versions(db: Session, project_id: str, dataset_type: Optional[str] = None) -> List[Dict[str, Any]]:
        query = db.query(DatasetVersion).filter(DatasetVersion.project_id == project_id)
        if dataset_type:
            query = query.filter(DatasetVersion.dataset_type == dataset_type)
        versions = query.order_by(DatasetVersion.created_at.desc()).all()
        return [VersionService._format_version(v) for v in versions]

    @staticmethod
    def get_version(db: Session, version_id: str) -> Optional[Dict[str, Any]]:
        v = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
        if not v:
            return None
        return VersionService._format_version(v, include_data=True)

    @staticmethod
    def create_snapshot(db: Session, req: SnapshotCreateRequest) -> Dict[str, Any]:
        """
        Creates a snapshot of the current state of SFT or DPO datasets.
        Computes SHA-256 of the dataset records.
        """
        snapshot_records = []
        count = 0

        if req.dataset_type in ("sft", "combined"):
            sft_records = db.query(SFTRecord).filter(SFTRecord.project_id == req.project_id).all()
            for r in sft_records:
                snapshot_records.append({
                    "type": "sft",
                    "id": r.id,
                    "messages": json.loads(r.messages_json or "[]"),
                    "turn_count": r.turn_count,
                    "character_count": r.character_count,
                    "metadata": json.loads(r.metadata_json or "{}"),
                    "created_at": r.created_at.isoformat()
                })
            count += len(sft_records)

        if req.dataset_type in ("dpo", "combined"):
            dpo_tasks = db.query(DPOTask).filter(DPOTask.project_id == req.project_id).all()
            for t in dpo_tasks:
                snapshot_records.append({
                    "type": "dpo",
                    "id": t.id,
                    "prompt": t.prompt,
                    "system_prompt": t.system_prompt,
                    "response_a": t.response_a,
                    "response_b": t.response_b,
                    "preference": t.preference,
                    "rationale": t.rationale,
                    "status": t.status,
                    "metadata": json.loads(t.metadata_json or "{}"),
                    "created_at": t.created_at.isoformat()
                })
            count += len(dpo_tasks)

        # Compute checksum
        serialized = json.dumps(snapshot_records, sort_keys=True)
        checksum = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # Find latest parent version
        parent = db.query(DatasetVersion).filter(
            DatasetVersion.project_id == req.project_id,
            DatasetVersion.dataset_type == req.dataset_type
        ).order_by(DatasetVersion.created_at.desc()).first()

        summary = f"Snapshot of {count} records."
        if parent:
            summary = f"Snapshot after {parent.version_tag} ({count} total records)."

        ver = DatasetVersion(
            project_id=req.project_id,
            dataset_type=req.dataset_type,
            version_tag=req.version_tag.strip(),
            record_count=count,
            checksum_sha256=checksum,
            parent_version_id=parent.id if parent else None,
            change_summary=summary,
            description=req.description,
            snapshot_data_json=serialized
        )
        db.add(ver)
        db.commit()
        db.refresh(ver)

        audit = AuditLog(
            project_id=req.project_id,
            event_type="dataset_version_created",
            entity_type="dataset_version",
            entity_id=ver.id,
            details_json=json.dumps({"tag": ver.version_tag, "count": count})
        )
        db.add(audit)
        db.commit()

        return VersionService._format_version(ver)

    @staticmethod
    def restore_snapshot(db: Session, version_id: str) -> bool:
        """Restores dataset to the exact state saved in this snapshot."""
        ver = db.query(DatasetVersion).filter(DatasetVersion.id == version_id).first()
        if not ver:
            return False

        records = json.loads(ver.snapshot_data_json)
        project_id = ver.project_id

        if ver.dataset_type in ("sft", "combined"):
            # Clear existing SFT records
            db.query(SFTRecord).filter(SFTRecord.project_id == project_id).delete()
            for r in records:
                if r.get("type") == "sft":
                    new_r = SFTRecord(
                        id=r["id"],
                        project_id=project_id,
                        session_id=None,
                        messages_json=json.dumps(r["messages"], ensure_ascii=False),
                        turn_count=r.get("turn_count", len(r["messages"])),
                        character_count=r.get("character_count", 0),
                        metadata_json=json.dumps(r.get("metadata", {}), ensure_ascii=False),
                        revision=1
                    )
                    db.add(new_r)

        if ver.dataset_type in ("dpo", "combined"):
            # Clear existing DPO tasks
            db.query(DPOTask).filter(DPOTask.project_id == project_id).delete()
            for r in records:
                if r.get("type") == "dpo":
                    new_t = DPOTask(
                        id=r["id"],
                        project_id=project_id,
                        prompt=r["prompt"],
                        system_prompt=r.get("system_prompt"),
                        response_a=r["response_a"],
                        response_b=r["response_b"],
                        preference=r.get("preference"),
                        rationale=r.get("rationale"),
                        status=r.get("status", "pending"),
                        metadata_json=json.dumps(r.get("metadata", {}), ensure_ascii=False)
                    )
                    db.add(new_t)

        db.commit()
        return True

    @staticmethod
    def compare_snapshots(db: Session, version_id_a: str, version_id_b: str) -> Dict[str, Any]:
        """Compares two snapshots and reports added, removed, and modified records."""
        va = db.query(DatasetVersion).filter(DatasetVersion.id == version_id_a).first()
        vb = db.query(DatasetVersion).filter(DatasetVersion.id == version_id_b).first()
        if not va or not vb:
            raise ValueError("One or both snapshot versions not found.")

        recs_a = {r["id"]: r for r in json.loads(va.snapshot_data_json)}
        recs_b = {r["id"]: r for r in json.loads(vb.snapshot_data_json)}

        added_ids = list(set(recs_b.keys()) - set(recs_a.keys()))
        removed_ids = list(set(recs_a.keys()) - set(recs_b.keys()))
        common_ids = set(recs_a.keys()) & set(recs_b.keys())

        modified_ids = []
        for cid in common_ids:
            if recs_a[cid] != recs_b[cid]:
                modified_ids.append(cid)

        return {
            "version_a": {"id": va.id, "tag": va.version_tag, "count": va.record_count},
            "version_b": {"id": vb.id, "tag": vb.version_tag, "count": vb.record_count},
            "added_count": len(added_ids),
            "removed_count": len(removed_ids),
            "modified_count": len(modified_ids),
            "added_ids": added_ids[:50],
            "removed_ids": removed_ids[:50],
            "modified_ids": modified_ids[:50]
        }

    @staticmethod
    def _format_version(v: DatasetVersion, include_data: bool = False) -> Dict[str, Any]:
        res = {
            "id": v.id,
            "project_id": v.project_id,
            "dataset_type": v.dataset_type,
            "version_tag": v.version_tag,
            "record_count": v.record_count,
            "checksum_sha256": v.checksum_sha256,
            "parent_version_id": v.parent_version_id,
            "change_summary": v.change_summary,
            "description": v.description,
            "created_at": v.created_at
        }
        if include_data:
            res["records"] = json.loads(v.snapshot_data_json)
        return res
