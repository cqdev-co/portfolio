"""Configuration management for ML predictor service."""

import os
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=[
            str(Path(__file__).parent.parent.parent.parent / ".env"),  # Root .env
            str(Path(__file__).parent.parent.parent / ".env"),  # Service .env
            ".env",  # Current directory .env
        ],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str = Field(..., validation_alias="SUPABASE_URL")
    supabase_key: str = Field(..., validation_alias="SUPABASE_ANON_KEY")

    # API
    api_host: str = Field(default="0.0.0.0", env="API_HOST")
    api_port: int = Field(default=8001, env="API_PORT")

    # Training
    n_jobs: int = Field(
        default=12, env="N_JOBS"
    )  # Default for M3 Pro Max performance cores
    use_gpu: bool = Field(default=False, env="USE_GPU")
    min_signals_for_retrain: int = Field(default=50, env="MIN_SIGNALS_FOR_RETRAIN")

    # Scheduling
    retrain_cron: str = Field(default="0 2 * * *", env="RETRAIN_CRON")  # 2 AM daily
    enable_scheduler: bool = Field(default=True, env="ENABLE_SCHEDULER")

    # Paths
    @property
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @property
    def models_dir(self) -> Path:
        """Get models directory."""
        path = self.project_root / "models"
        path.mkdir(exist_ok=True)
        return path

    @property
    def data_dir(self) -> Path:
        """Get data directory."""
        path = self.project_root / "data"
        path.mkdir(exist_ok=True)
        return path

    @property
    def labeled_data_dir(self) -> Path:
        """Get labeled data directory."""
        path = self.data_dir / "labeled"
        path.mkdir(exist_ok=True)
        return path

    @property
    def cache_dir(self) -> Path:
        """Get cache directory."""
        path = self.data_dir / "cache"
        path.mkdir(exist_ok=True)
        return path


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get application settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

