"""
Application configuration for Mechon AI.
Handles XDG paths, database location, server binding, and environment variables.
Provides graceful fallbacks if ~/.local/share is read-only in sandbox environments.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


def get_default_data_dir() -> Path:
    """Get XDG compliant data directory with fallback to local project data dir."""
    env_dir = os.environ.get("DATA_DIR")
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        base = Path(xdg_data_home)
    else:
        base = Path.home() / ".local" / "share"

    candidate = base / "mechon-ai"
    try:
        candidate.mkdir(parents=True, exist_ok=True)
        # Test writeability
        test_file = candidate / ".test_write"
        test_file.touch()
        test_file.unlink()
        return candidate
    except (OSError, PermissionError):
        # Fallback to project-local data directory
        fallback = PROJECT_ROOT / "data"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def get_default_config_dir() -> Path:
    """Get XDG compliant configuration directory with fallback."""
    env_dir = os.environ.get("CONFIG_DIR")
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    xdg_config_home = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config_home:
        base = Path(xdg_config_home)
    else:
        base = Path.home() / ".config"

    candidate = base / "mechon-ai"
    try:
        candidate.mkdir(parents=True, exist_ok=True)
        test_file = candidate / ".test_write"
        test_file.touch()
        test_file.unlink()
        return candidate
    except (OSError, PermissionError):
        fallback = PROJECT_ROOT / "config"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


class Settings(BaseSettings):
    APP_NAME: str = "Mechon AI"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Loopback only binding for security
    HOST: str = "127.0.0.1"
    PORT: int = int(os.environ.get("PORT", "18420"))
    
    # Directory paths
    DATA_DIR: Path = get_default_data_dir()
    CONFIG_DIR: Path = get_default_config_dir()
    
    # SQLite Database Path
    @property
    def DB_PATH(self) -> Path:
        return self.DATA_DIR / "mechon.db"
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"sqlite:///{self.DB_PATH}"

    # Secret key for local token encryption
    SECRET_KEY: str = "local-studio-key-not-for-public-network"
    
    class Config:
        case_sensitive = True


settings = Settings()
