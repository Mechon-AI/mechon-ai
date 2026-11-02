"""
Quality Control and Dataset Validation Service.
Implements rigorous diagnostics for both SFT and DPO datasets without altering data silently.
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import SFTRecord, DPOTask
from app.schemas.schemas import ValidationReport, ValidationIssue


class ValidationService:
    @staticmethod
    def validate_sft(db: Session, project_id: str) -> ValidationReport:
        records = db.query(SFTRecord).filter(SFTRecord.project_id == project_id).all()
        issues: List[ValidationIssue] = []
        seen_prompts: Dict[str, str] = {}  # first user prompt -> record_id

        error_count = 0
        warning_count = 0
        failed_records_set = set()

        for r in records:
            rec_id = r.id
            try:
                msgs = json.loads(r.messages_json or "[]")
            except Exception as e:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="sft",
                    severity="error",
                    issue_type="json_syntax_error",
                    message=f"Malformed messages JSON: {str(e)}",
                    suggested_fix="Re-serialize or repair the conversation messages structure."
                ))
                error_count += 1
                failed_records_set.add(rec_id)
                continue

            # 1. Empty message array
            if not msgs:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="sft",
                    severity="error",
                    issue_type="empty_conversation",
                    message="Conversation contains zero messages.",
                    suggested_fix="Add at least one user prompt and one assistant response."
                ))
                error_count += 1
                failed_records_set.add(rec_id)
                continue

            first_user_content = None
            has_assistant = False
            last_role = None

            for idx, m in enumerate(msgs):
                role = m.get("role")
                content = m.get("content", "")

                # 2. Invalid role
                if role not in ("system", "user", "assistant"):
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="sft",
                        severity="error",
                        issue_type="invalid_role",
                        message=f"Message #{idx+1} has unrecognized role '{role}'.",
                        suggested_fix="Change role to 'system', 'user', or 'assistant'."
                    ))
                    error_count += 1
                    failed_records_set.add(rec_id)

                # 3. Empty message content
                if not content or not content.strip():
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="sft",
                        severity="error",
                        issue_type="empty_content",
                        message=f"Message #{idx+1} ({role}) has blank or empty content.",
                        suggested_fix="Provide non-empty text for this message turn."
                    ))
                    error_count += 1
                    failed_records_set.add(rec_id)

                # Track first user message for duplicate check
                if role == "user" and first_user_content is None:
                    first_user_content = content.strip().lower()

                if role == "assistant":
                    has_assistant = True

                # 4. Role ordering check (consecutive identical roles)
                if last_role and role == last_role and role != "system":
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="sft",
                        severity="warning",
                        issue_type="consecutive_same_role",
                        message=f"Message #{idx+1} has identical role '{role}' directly following another '{role}'.",
                        suggested_fix="Merge consecutive turns or ensure alternating turns."
                    ))
                    warning_count += 1
                    failed_records_set.add(rec_id)

                # 5. Excessive message length
                if len(content) > 30000:
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="sft",
                        severity="warning",
                        issue_type="excessive_length",
                        message=f"Message #{idx+1} length is {len(content)} characters, which may exceed model context limits.",
                        suggested_fix="Consider condensing or splitting this turn."
                    ))
                    warning_count += 1
                    failed_records_set.add(rec_id)

                last_role = role

            # 6. Missing assistant response
            if not has_assistant:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="sft",
                    severity="error",
                    issue_type="missing_assistant_response",
                    message="Conversation does not contain any assistant response.",
                    suggested_fix="Generate or write at least one assistant answer."
                ))
                error_count += 1
                failed_records_set.add(rec_id)

            # 7. Duplicate conversation check
            if first_user_content:
                if first_user_content in seen_prompts:
                    dup_orig = seen_prompts[first_user_content]
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="sft",
                        severity="warning",
                        issue_type="duplicate_conversation",
                        message=f"Initial user prompt is identical to record {dup_orig}.",
                        suggested_fix="Verify if this is an intentional variant or an accidental duplicate."
                    ))
                    warning_count += 1
                    failed_records_set.add(rec_id)
                else:
                    seen_prompts[first_user_content] = rec_id

        total = len(records)
        failed_count = len(failed_records_set)
        passed_count = total - failed_count

        return ValidationReport(
            dataset_type="sft",
            total_records=total,
            passed_records=passed_count,
            failed_records=failed_count,
            error_count=error_count,
            warning_count=warning_count,
            issues=issues,
            generated_at=datetime.utcnow()
        )

    @staticmethod
    def validate_dpo(db: Session, project_id: str) -> ValidationReport:
        tasks = db.query(DPOTask).filter(DPOTask.project_id == project_id).all()
        issues: List[ValidationIssue] = []
        seen_prompts: Dict[str, str] = {}

        error_count = 0
        warning_count = 0
        failed_records_set = set()

        for t in tasks:
            rec_id = t.id
            prompt = t.prompt.strip() if t.prompt else ""
            resp_a = t.response_a.strip() if t.response_a else ""
            resp_b = t.response_b.strip() if t.response_b else ""
            pref = t.preference

            # 1. Empty prompt
            if not prompt:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="dpo",
                    severity="error",
                    issue_type="empty_prompt",
                    message="DPO task has an empty prompt.",
                    suggested_fix="Enter a valid prompt."
                ))
                error_count += 1
                failed_records_set.add(rec_id)

            # 2. Incomplete responses
            if not resp_a or not resp_b:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="dpo",
                    severity="error",
                    issue_type="missing_completions",
                    message="Both Response A and Response B must be generated to form a comparison pair.",
                    suggested_fix="Generate or enter the missing completion."
                ))
                error_count += 1
                failed_records_set.add(rec_id)

            # 3. Identical completions
            if resp_a and resp_b and resp_a == resp_b:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="dpo",
                    severity="error",
                    issue_type="identical_responses",
                    message="Response A and Response B are completely identical.",
                    suggested_fix="Regenerate one response or vary generation parameters."
                ))
                error_count += 1
                failed_records_set.add(rec_id)

            # 4. Unannotated or Pending
            if not pref:
                issues.append(ValidationIssue(
                    record_id=rec_id,
                    dataset_type="dpo",
                    severity="warning",
                    issue_type="pending_annotation",
                    message="Preference rating has not yet been selected.",
                    suggested_fix="Choose A, B, Tie, or Both Bad in DPO Studio."
                ))
                warning_count += 1
                failed_records_set.add(rec_id)

            # 5. Duplicate prompt
            if prompt:
                norm_prompt = prompt.lower()
                if norm_prompt in seen_prompts:
                    orig_id = seen_prompts[norm_prompt]
                    issues.append(ValidationIssue(
                        record_id=rec_id,
                        dataset_type="dpo",
                        severity="warning",
                        issue_type="duplicate_prompt",
                        message=f"Prompt is identical to task {orig_id}.",
                        suggested_fix="Remove duplicate task or ensure distinct completions."
                    ))
                    warning_count += 1
                    failed_records_set.add(rec_id)
                else:
                    seen_prompts[norm_prompt] = rec_id

        total = len(tasks)
        failed_count = len(failed_records_set)
        passed_count = total - failed_count

        return ValidationReport(
            dataset_type="dpo",
            total_records=total,
            passed_records=passed_count,
            failed_records=failed_count,
            error_count=error_count,
            warning_count=warning_count,
            issues=issues,
            generated_at=datetime.utcnow()
        )
