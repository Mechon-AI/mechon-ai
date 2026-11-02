import json
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Provider
from app.schemas.schemas import (
    ProviderCreate, ProviderUpdate, ProviderResponse,
    ModelTestRequest
)
from app.providers.manager import provider_manager

router = APIRouter()


def _ensure_default_mock(db: Session):
    """Ensure at least the built-in Mock provider is registered."""
    mock_p = db.query(Provider).filter(Provider.provider_type == "mock").first()
    if not mock_p:
        mock_p = Provider(
            id="mock",
            name="Built-in Mock LLM (Offline)",
            provider_type="mock",
            base_url="mock://internal",
            default_model="mock-llama-3-8b",
            models_cache_json=json.dumps(["mock-llama-3-8b", "mock-qwen-2.5-7b", "mock-mistral-nemo"]),
            is_active=True
        )
        db.add(mock_p)
        db.commit()


@router.get("/providers", response_model=List[ProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    _ensure_default_mock(db)
    providers = db.query(Provider).all()
    res = []
    for p in providers:
        res.append({
            "id": p.id,
            "name": p.name,
            "provider_type": p.provider_type,
            "base_url": p.base_url,
            "has_api_key": bool(p.api_key_encrypted),
            "default_model": p.default_model,
            "models_cache": json.loads(p.models_cache_json or "[]"),
            "timeout_seconds": p.timeout_seconds,
            "is_active": p.is_active,
            "settings": json.loads(p.settings_json or "{}"),
            "created_at": p.created_at,
            "updated_at": p.updated_at
        })
    return res


@router.post("/providers", response_model=ProviderResponse)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db)):
    p = Provider(
        name=data.name.strip(),
        provider_type=data.provider_type,
        base_url=data.base_url.strip(),
        api_key_encrypted=data.api_key,
        default_model=data.default_model,
        timeout_seconds=data.timeout_seconds or 60,
        settings_json=json.dumps(data.settings or {})
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "name": p.name,
        "provider_type": p.provider_type,
        "base_url": p.base_url,
        "has_api_key": bool(p.api_key_encrypted),
        "default_model": p.default_model,
        "models_cache": [],
        "timeout_seconds": p.timeout_seconds,
        "is_active": p.is_active,
        "settings": json.loads(p.settings_json or "{}"),
        "created_at": p.created_at,
        "updated_at": p.updated_at
    }


@router.put("/providers/{provider_id}", response_model=ProviderResponse)
def update_provider(provider_id: str, data: ProviderUpdate, db: Session = Depends(get_db)):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")

    if data.name is not None:
        p.name = data.name.strip()
    if data.base_url is not None:
        p.base_url = data.base_url.strip()
    if data.api_key is not None:
        p.api_key_encrypted = data.api_key
    if data.default_model is not None:
        p.default_model = data.default_model
    if data.timeout_seconds is not None:
        p.timeout_seconds = data.timeout_seconds
    if data.is_active is not None:
        p.is_active = data.is_active
    if data.settings is not None:
        p.settings_json = json.dumps(data.settings)

    db.commit()
    db.refresh(p)
    provider_manager.invalidate(p.id)

    return {
        "id": p.id,
        "name": p.name,
        "provider_type": p.provider_type,
        "base_url": p.base_url,
        "has_api_key": bool(p.api_key_encrypted),
        "default_model": p.default_model,
        "models_cache": json.loads(p.models_cache_json or "[]"),
        "timeout_seconds": p.timeout_seconds,
        "is_active": p.is_active,
        "settings": json.loads(p.settings_json or "{}"),
        "created_at": p.created_at,
        "updated_at": p.updated_at
    }


@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: str, db: Session = Depends(get_db)):
    if provider_id == "mock":
        raise HTTPException(status_code=400, detail="Cannot delete the built-in mock provider")
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    db.delete(p)
    db.commit()
    provider_manager.invalidate(provider_id)
    return {"message": "Provider deleted"}


@router.post("/providers/{provider_id}/test")
async def test_provider(provider_id: str, db: Session = Depends(get_db)):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    adapter = provider_manager.get_provider(provider_id, p)
    healthy = await adapter.health_check()
    models = await adapter.list_models()
    if p:
        p.models_cache_json = json.dumps(models)
        db.commit()
    return {
        "healthy": healthy,
        "models": models
    }


# ==========================================
# Unified Inference Endpoints
# ==========================================
@router.post("/inference/generate")
async def generate_completion(
    req: ModelTestRequest,
    db: Session = Depends(get_db)
):
    p = db.query(Provider).filter(Provider.id == req.provider_id).first()
    adapter = provider_manager.get_provider(req.provider_id, p)
    messages = [{"role": "user", "content": req.prompt}]
    try:
        res = await adapter.generate(
            messages=messages,
            system_prompt=req.system_prompt,
            model=req.model or (p.default_model if p else None),
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@router.post("/inference/stream")
async def stream_completion(
    provider_id: str = Query(...),
    model: Optional[str] = Query(None),
    system_prompt: Optional[str] = Query(None),
    temperature: float = Query(0.7),
    top_p: float = Query(0.9),
    max_tokens: int = Query(2048),
    messages: List[Dict[str, str]] = [],
    db: Session = Depends(get_db)
):
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    adapter = provider_manager.get_provider(provider_id, p)

    async def sse_event_generator():
        try:
            async for token in adapter.generate_stream(
                messages=messages,
                system_prompt=system_prompt,
                model=model or (p.default_model if p else None),
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_tokens
            ):
                yield f"data: {json.dumps({'chunk': token})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


@router.post("/inference/dpo-pair")
async def generate_dpo_pair(
    provider_id: str = Query(...),
    prompt: str = Query(...),
    system_prompt: Optional[str] = Query(None),
    model_a: Optional[str] = Query(None),
    model_b: Optional[str] = Query(None),
    temp_a: float = Query(0.7),
    temp_b: float = Query(0.9),
    db: Session = Depends(get_db)
):
    """Generates Response A and Response B concurrently."""
    p = db.query(Provider).filter(Provider.id == provider_id).first()
    adapter = provider_manager.get_provider(provider_id, p)
    messages = [{"role": "user", "content": prompt}]

    task_a = adapter.generate(
        messages=messages,
        system_prompt=system_prompt,
        model=model_a or (p.default_model if p else None),
        temperature=temp_a
    )
    task_b = adapter.generate(
        messages=messages,
        system_prompt=system_prompt,
        model=model_b or (p.default_model if p else None),
        temperature=temp_b
    )

    res_a, res_b = await asyncio.gather(task_a, task_b, return_exceptions=True)
    
    out_a = res_a if not isinstance(res_a, Exception) else {"content": f"Error: {str(res_a)}", "tokens": 0}
    out_b = res_b if not isinstance(res_b, Exception) else {"content": f"Error: {str(res_b)}", "tokens": 0}

    return {
        "response_a": out_a.get("content", ""),
        "response_b": out_b.get("content", ""),
        "meta_a": out_a,
        "meta_b": out_b
    }
