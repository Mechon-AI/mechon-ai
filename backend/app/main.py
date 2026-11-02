"""
Mechon AI - Main FastAPI Application.
Runs locally bound to 127.0.0.1 with SQLite database backend.
"""

import argparse
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure database schema is created and initialized."""
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Mechon AI — Native Cross-Platform Desktop Workstation for SFT and DPO Dataset Engineering",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS configuration for desktop and web interfaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:18420",
        "http://127.0.0.1:18420",
        "http://tauri.localhost",
        "tauri://localhost",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/api/health")
def root_health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": str(settings.DB_PATH)
    }


def main():
    parser = argparse.ArgumentParser(description="Mechon AI Backend Server")
    parser.add_argument("--host", default=settings.HOST, help="Loopback host to bind (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=settings.PORT, help="Port to bind (default 18420)")
    args = parser.parse_args()

    print(f"Starting {settings.APP_NAME} backend on {args.host}:{args.port}")
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
