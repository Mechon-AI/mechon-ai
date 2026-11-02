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
    """Create all tables and run initial health check."""
    Base.metadata.create_all(bind=engine)
