import json
import pytest
from app.services.project_service import ProjectService
from app.services.sft_service import SFTService
from app.services.dpo_service import DPOService
from app.services.validation_service import ValidationService
from app.services.version_service import VersionService
from app.services.export_service import ExportService
from app.services.import_service import ImportService
from app.schemas.schemas import (
    ProjectCreate, SFTSessionCreate, SFTCommitRequest,
    DPOTaskCreate, DPOAnnotationUpdate, SnapshotCreateRequest
)
from app.providers.mock_provider import MockProvider


def test_project_lifecycle(db):
    # 1. Create Project
    p = ProjectService.create_project(db, ProjectCreate(name="Alignment Lab", description="LLM RLHF & SFT"))
    assert p["id"] is not None
    assert p["name"] == "Alignment Lab"

    # 2. List Projects
    projects = ProjectService.list_projects(db)
    assert len(projects) >= 1

    # 3. Duplicate Project
    cloned = ProjectService.duplicate_project(db, p["id"], "Alignment Lab Copy")
    assert cloned["name"] == "Alignment Lab Copy"


def test_sft_conversation_to_atomic_record_lifecycle(db):
    """
    CRITICAL ACCEPTANCE TEST:
    1. Create a project.
    2. Start a new chat session.
    3. Add multi-turn dialogue (User -> Assistant -> User -> Assistant).
    4. Edit an earlier message.
    5. Commit session to SFT dataset.
    6. Verify that EXACTLY ONE SFT record is created with the full messages array.
    7. Start a second session and commit it.
    8. Verify the SFT dataset now contains EXACTLY TWO records.
    """
    # 1. Project
    proj = ProjectService.create_project(db, ProjectCreate(name="SFT Math & Code"))
    pid = proj["id"]

    # 2. Start Session 1
    sess1 = SFTService.create_session(db, SFTSessionCreate(
        project_id=pid,
        title="Gradient Descent Tutorial",
        system_prompt="You are a machine learning tutor.",
        model="mock-llama-3-8b"
    ))
    sid1 = sess1["id"]
    assert sess1["status"] == "draft"

    # 3. Multi-turn additions
    # Turn 1: User
    SFTService.add_message(db, sid1, role="user", content="Explain gradient descent.")
    # Turn 2: Assistant
    SFTService.add_message(db, sid1, role="assistant", content="Gradient descent is an optimization algorithm...")
    # Turn 3: User
    msg3 = SFTService.add_message(db, sid1, role="user", content="Give me a simple numerical example.")
    # Turn 4: Assistant
    SFTService.add_message(db, sid1, role="assistant", content="Consider f(w) = w^2. The derivative is 2w...")

    # 4. Message Editing
    updated_msg3 = SFTService.update_message(db, msg3["id"], "Give me a step-by-step numerical example with eta = 0.1.")
    assert "eta = 0.1" in updated_msg3["content"]

    # 5. Commit Session 1
    rec1 = SFTService.commit_session(db, sid1, SFTCommitRequest(
        tags=["optimization", "math"],
        metadata={"domain": "machine_learning"}
    ))

    # 6. Verify Session 1 became ONE atomic record
    assert rec1["id"] is not None
    assert rec1["session_id"] == sid1
    assert len(rec1["messages"]) == 5  # 1 system + 4 conversation turns
    assert rec1["messages"][0]["role"] == "system"
    assert rec1["messages"][1]["role"] == "user"
    assert rec1["messages"][2]["role"] == "assistant"
    assert rec1["messages"][3]["role"] == "user"
    assert rec1["messages"][4]["role"] == "assistant"
    assert "eta = 0.1" in rec1["messages"][3]["content"]

    # Verify session status is committed
    refreshed_sess1 = SFTService.get_session(db, sid1)
    assert refreshed_sess1["status"] == "committed"

    # Verify project has exactly 1 SFT record
    records, total = SFTService.list_records(db, pid)
    assert total == 1
    assert len(records) == 1

    # 7. Start Session 2 and commit it
    sess2 = SFTService.create_session(db, SFTSessionCreate(
        project_id=pid,
        title="PyTorch Training Loop",
        system_prompt="You are a senior PyTorch engineer.",
        model="mock-llama-3-8b"
    ))
    sid2 = sess2["id"]
    SFTService.add_message(db, sid2, role="user", content="How do I zero gradients in PyTorch?")
    SFTService.add_message(db, sid2, role="assistant", content="Use optimizer.zero_grad() before backward().")

    rec2 = SFTService.commit_session(db, sid2, SFTCommitRequest(
        tags=["pytorch", "deep-learning"]
    ))

    # 8. Verify project SFT dataset now contains EXACTLY TWO records
    records, total = SFTService.list_records(db, pid)
    assert total == 2
    assert len(records) == 2


def test_dpo_preference_workflow(db):
    """
    CRITICAL ACCEPTANCE TEST:
    1. Create a DPO task.
    2. Populate response A and response B.
    3. Choose preferred response ('a').
    4. Verify chosen/rejected mapping in TRL export.
    5. Test undo functionality.
    """
    proj = ProjectService.create_project(db, ProjectCreate(name="DPO Preferences"))
    pid = proj["id"]

    # 1. Create task
    task = DPOService.create_task(db, DPOTaskCreate(
        project_id=pid,
        prompt="What is the capital of France?",
        response_a="The capital of France is Paris, famous for the Eiffel Tower and rich history.",
        response_b="It is Paris."
    ))
    tid = task["id"]
    assert task["status"] == "pending"

    # 2. Annotate preference ('a' is better)
    annotated = DPOService.annotate_task(db, tid, DPOAnnotationUpdate(
        preference="a",
        rationale="Response A provides helpful and engaging context.",
        helpfulness_rating=5,
        factuality_rating=5
    ))
    assert annotated["preference"] == "a"
    assert annotated["status"] == "completed"

    # 3. Verify TRL-compatible export
    dpo_export_jsonl = ExportService.export_dpo(db, pid, format_type="jsonl")
    lines = [json.loads(line) for line in dpo_export_jsonl.strip().splitlines()]
    assert len(lines) == 1
    assert lines[0]["prompt"] == "What is the capital of France?"
    assert lines[0]["chosen"] == annotated["response_a"]
    assert lines[0]["rejected"] == annotated["response_b"]

    # 4. Test Undo
    undone = DPOService.undo_last_annotation(db, pid)
    assert undone["id"] == tid
    assert undone["preference"] is None
    assert undone["status"] == "pending"


@pytest.mark.asyncio
async def test_mock_provider_offline_inference():
    provider = MockProvider()
    assert await provider.health_check() is True
    models = await provider.list_models()
    assert len(models) >= 1

    # Test full generation
    messages = [{"role": "user", "content": "Explain gradient descent."}]
    res = await provider.generate(messages)
    assert "gradient descent" in res["content"].lower()

    # Test streaming
    chunks = []
    async for chunk in provider.generate_stream(messages):
        chunks.append(chunk)
    streamed_text = "".join(chunks)
    assert len(streamed_text) > 0


def test_quality_control_validation(db):
    proj = ProjectService.create_project(db, ProjectCreate(name="QC Test"))
    pid = proj["id"]

    # Add an empty SFT record to trigger validation issue
    from app.models.entities import SFTRecord
    bad_rec = SFTRecord(
        project_id=pid,
        messages_json="[]",
        turn_count=0,
        character_count=0,
        metadata_json="{}"
    )
    db.add(bad_rec)
    db.commit()

    # Run validation
    report = ValidationService.validate_sft(db, pid)
    assert report.total_records == 1
    assert report.error_count >= 1
    assert report.issues[0].issue_type == "empty_conversation"


def test_dataset_versioning_and_rollback(db):
    proj = ProjectService.create_project(db, ProjectCreate(name="Versioning Test"))
    pid = proj["id"]

    # Create SFT session and commit
    sess = SFTService.create_session(db, SFTSessionCreate(project_id=pid, title="Test Versioning"))
    SFTService.add_message(db, sess["id"], role="user", content="Hello world")
    SFTService.add_message(db, sess["id"], role="assistant", content="Hello! How can I help?")
    rec = SFTService.commit_session(db, sess["id"], SFTCommitRequest())

    # Take Snapshot v1
    snap1 = VersionService.create_snapshot(db, SnapshotCreateRequest(
        project_id=pid,
        dataset_type="sft",
        version_tag="v1.0.0",
        description="Initial release"
    ))
    assert snap1["record_count"] == 1
    assert snap1["checksum_sha256"] is not None

    # Delete record
    SFTService.delete_record(db, rec["id"])
    records, total = SFTService.list_records(db, pid)
    assert total == 0

    # Restore Snapshot v1
    success = VersionService.restore_snapshot(db, snap1["id"])
    assert success is True

    # Verify record was restored
    records, total = SFTService.list_records(db, pid)
    assert total == 1
    assert records[0]["id"] == rec["id"]
