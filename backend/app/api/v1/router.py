from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    projects,
    sft,
    dpo,
    providers,
    validation,
    versions,
    analytics,
    exports,
    settings,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(sft.router, prefix="/sft", tags=["SFT Studio"])
api_router.include_router(dpo.router, prefix="/dpo", tags=["DPO Studio"])
api_router.include_router(providers.router, tags=["Providers & Inference"])
api_router.include_router(validation.router, prefix="/quality", tags=["Quality Control"])
api_router.include_router(versions.router, prefix="/versions", tags=["Versioning"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(exports.router, tags=["Import & Export"])
api_router.include_router(settings.router, tags=["Settings & System"])
