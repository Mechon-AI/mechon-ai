"""
Analytics Service.
Calculates real quantitative metrics and aggregates directly from SQLite database records.
No hardcoded sample figures.
"""

import json
from collections import Counter
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.entities import Project, SFTSession, SFTRecord, DPOTask, AuditLog


class AnalyticsService:
    @staticmethod
    def get_dashboard_analytics(db: Session, project_id: Optional[str] = None) -> Dict[str, Any]:
        proj_query = db.query(Project)
        if project_id:
            proj_query = proj_query.filter(Project.id == project_id)
        total_projects = proj_query.count()

        # -------------------
        # SFT Metrics
        # -------------------
        sft_sess_q = db.query(SFTSession)
        sft_rec_q = db.query(SFTRecord)
        if project_id:
            sft_sess_q = sft_sess_q.filter(SFTSession.project_id == project_id)
            sft_rec_q = sft_rec_q.filter(SFTRecord.project_id == project_id)

        total_sessions = sft_sess_q.count()
        draft_sessions = sft_sess_q.filter(SFTSession.status == "draft").count()
        in_progress_sessions = sft_sess_q.filter(SFTSession.status == "in_progress").count()
        committed_sessions = sft_sess_q.filter(SFTSession.status == "committed").count()

        total_sft_records = sft_rec_q.count()
        avg_turns = sft_rec_q.with_entities(func.avg(SFTRecord.turn_count)).scalar() or 0.0
        avg_chars = sft_rec_q.with_entities(func.avg(SFTRecord.character_count)).scalar() or 0.0

        # Model usage for SFT
        sft_models = Counter()
        sft_records = sft_rec_q.all()
        for r in sft_records:
            meta = json.loads(r.metadata_json or "{}")
            model = meta.get("model") or "unspecified"
            sft_models[model] += 1

        # Turn distribution buckets: 2 turns (1 pair), 3-4 turns, 5-8 turns, 9+ turns
        turn_dist = {"1-2 turns": 0, "3-4 turns": 0, "5-8 turns": 0, "9+ turns": 0}
        for r in sft_records:
            tc = r.turn_count
            if tc <= 2:
                turn_dist["1-2 turns"] += 1
            elif tc <= 4:
                turn_dist["3-4 turns"] += 1
            elif tc <= 8:
                turn_dist["5-8 turns"] += 1
            else:
                turn_dist["9+ turns"] += 1

        sft_metrics = {
            "total_sessions": total_sessions,
            "draft_sessions": draft_sessions,
            "in_progress_sessions": in_progress_sessions,
            "committed_sessions": committed_sessions,
            "total_sft_records": total_sft_records,
            "avg_turns": round(float(avg_turns), 1),
            "avg_characters": round(float(avg_chars), 1),
            "turn_distribution": turn_dist
        }

        # -------------------
        # DPO Metrics
        # -------------------
        dpo_q = db.query(DPOTask)
        if project_id:
            dpo_q = dpo_q.filter(DPOTask.project_id == project_id)

        total_dpo_tasks = dpo_q.count()
        pending_dpo = dpo_q.filter(DPOTask.status == "pending").count()
        completed_dpo = dpo_q.filter(DPOTask.status == "completed").count()
        skipped_dpo = dpo_q.filter(DPOTask.status == "skipped").count()
        flagged_dpo = dpo_q.filter(DPOTask.status == "flagged").count()

        a_count = dpo_q.filter(DPOTask.preference == "a").count()
        b_count = dpo_q.filter(DPOTask.preference == "b").count()
        tie_count = dpo_q.filter(DPOTask.preference == "tie").count()
        bad_count = dpo_q.filter(DPOTask.preference == "both_bad").count()

        decided_total = a_count + b_count + tie_count + bad_count
        ratio_a = round((a_count / decided_total * 100), 1) if decided_total > 0 else 0.0
        ratio_b = round((b_count / decided_total * 100), 1) if decided_total > 0 else 0.0
        ratio_tie = round((tie_count / decided_total * 100), 1) if decided_total > 0 else 0.0
        ratio_bad = round((bad_count / decided_total * 100), 1) if decided_total > 0 else 0.0

        dpo_metrics = {
            "total_tasks": total_dpo_tasks,
            "pending": pending_dpo,
            "completed": completed_dpo,
            "skipped": skipped_dpo,
            "flagged": flagged_dpo,
            "preference_counts": {
                "a": a_count,
                "b": b_count,
                "tie": tie_count,
                "both_bad": bad_count
            },
            "preference_ratios": {
                "a_percent": ratio_a,
                "b_percent": ratio_b,
                "tie_percent": ratio_tie,
                "both_bad_percent": ratio_bad
            }
        }

        # -------------------
        # Shared & Growth Timeline
        # -------------------
        shared_metrics = {
            "total_records": total_sft_records + completed_dpo,
            "total_active_projects": total_projects,
            "total_audit_events": db.query(AuditLog).count()
        }

        # Model usage combined
        combined_models = dict(sft_models)

        # Growth timeline (group records by date)
        timeline = []
        recent_sft = sft_rec_q.order_by(SFTRecord.created_at.asc()).all()
        by_date = Counter()
        for r in recent_sft:
            date_str = r.created_at.strftime("%Y-%m-%d")
            by_date[date_str] += 1

        cum = 0
        for date_k in sorted(by_date.keys()):
            cum += by_date[date_k]
            timeline.append({
                "date": date_k,
                "records_added": by_date[date_k],
                "cumulative": cum
            })

        return {
            "project_id": project_id,
            "total_projects": total_projects,
            "sft_metrics": sft_metrics,
            "dpo_metrics": dpo_metrics,
            "shared_metrics": shared_metrics,
            "model_usage": combined_models,
            "timeline_growth": timeline
        }
