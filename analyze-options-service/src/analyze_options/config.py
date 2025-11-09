"""Configuration management."""

from pydantic import Field, ConfigDict
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Supabase (with multiple possible aliases)
    supabase_url: str = Field(..., validation_alias="SUPABASE_URL")
    supabase_key: str = Field(..., validation_alias="SUPABASE_ANON_KEY")
    supabase_service_key: Optional[str] = Field(None, validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    
    # ML Predictor (optional)
    ml_predictor_url: str = Field(default="http://localhost:8001", validation_alias="ML_PREDICTOR_URL")
    ml_predictor_enabled: bool = Field(default=True, validation_alias="ML_PREDICTOR_ENABLED")
    
    # Account Configuration
    default_account_size: float = Field(10000.0, alias="DEFAULT_ACCOUNT_SIZE")
    default_risk_pct: float = Field(1.5, alias="DEFAULT_RISK_PCT")
    risk_tolerance: str = Field("conservative", alias="RISK_TOLERANCE")
    
    # Analysis Parameters
    min_signal_grade: str = Field("A", alias="MIN_SIGNAL_GRADE")
    default_lookback_days: int = Field(7, alias="DEFAULT_LOOKBACK_DAYS")
    min_premium_flow: float = Field(100000, alias="MIN_PREMIUM_FLOW")
    min_dte: int = Field(7, alias="MIN_DTE")
    max_dte: int = Field(60, alias="MAX_DTE")
    
    # Technical Analysis Thresholds
    rsi_overbought: int = Field(70, alias="RSI_OVERBOUGHT")
    rsi_oversold: int = Field(30, alias="RSI_OVERSOLD")
    min_volume_ratio: float = Field(0.5, alias="MIN_VOLUME_RATIO")
    
    # Strategy Analysis (Phase 2)
    default_account_size: float = Field(10000, alias="DEFAULT_ACCOUNT_SIZE")
    default_risk_pct: float = Field(2.0, alias="DEFAULT_RISK_PCT")
    risk_tolerance: str = Field("conservative", alias="RISK_TOLERANCE")  # conservative, moderate, aggressive

    model_config = ConfigDict(
        env_file="../../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra fields from shared .env file
    )


def get_settings() -> Settings:
    """Alias for load_config for consistency with other services."""
    return load_config()


def load_config() -> Settings:
    """Load configuration from environment."""
    # Try multiple .env locations
    env_paths = [
        Path(__file__).parent.parent.parent.parent / ".env",  # Root of portfolio
        Path(__file__).parent.parent.parent / ".env",  # Service root
        Path.cwd() / ".env",  # Current directory
    ]
    
    for env_path in env_paths:
        if env_path.exists():
            return Settings(_env_file=str(env_path))
    
    # Fallback to no .env file (use environment variables)
    return Settings()

