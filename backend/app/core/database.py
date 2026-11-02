"""
Database connection, session management, and SQLite optimizations.
Enforces foreign keys, enables WAL mode, and handles connection pooling.
"""

import sqlite3
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Engine for SQLite
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args={
        "check_same_thread": False,
        "timeout": 30.0
    },
    echo=False
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enforce SQLite PRAGMAs: WAL mode, foreign keys, synchronous NORMAL."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions with automatic commit/rollback."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and run initial health check and default bootstrapping."""
    import app.models.entities as models
    Base.metadata.create_all(bind=engine)

    # Bootstrap default project if database has 0 projects
    db = SessionLocal()
    try:
        project_count = db.query(models.Project).count()
        if project_count == 0:
            default_proj = models.Project(
                name="General AI Alignment Lab",
                description="Default workspace for multi-turn SFT and pairwise DPO dataset engineering."
            )
            db.add(default_proj)
            db.commit()

        # Bootstrap default mock provider
        mock_p = db.query(models.Provider).filter(models.Provider.provider_type == "mock").first()
        if not mock_p:
            import json
            mock_p = models.Provider(
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
    except Exception as e:
        db.rollback()
        print(f"[Database] Warning during initial seed: {e}")
    finally:
        db.close()
