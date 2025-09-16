"""Application settings and configuration management."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database Configuration
    database_url: str = Field(
        default="sqlite+aiosqlite:///./volatility_scanner.db",
        description="Database connection URL"
    )
    
    # Redis Configuration  
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for caching"
    )
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0", description="API host")
    api_port: int = Field(default=8000, description="API port")
    api_workers: int = Field(default=4, description="Number of API workers")
    debug: bool = Field(default=False, description="Debug mode")
    
    # AI/LLM Configuration
    openai_api_key: str = Field(default="", description="OpenAI API key")
    anthropic_api_key: str = Field(
        default="", 
        description="Anthropic API key"
    )
    default_llm_provider: Literal["openai", "anthropic"] = Field(
        default="openai",
        description="Default LLM provider"
    )
    
    # Market Data Configuration
    yfinance_cache_ttl: int = Field(
        default=3600,
        description="YFinance cache TTL in seconds"
    )
    max_concurrent_requests: int = Field(
        default=25,
        description="Maximum concurrent API requests"
    )
    
    # Performance optimization settings
    bulk_scan_concurrency: int = Field(
        default=100,
        description="Concurrency for bulk scanning operations"
    )
    bulk_scan_batch_size: int = Field(
        default=500,
        description="Batch size for bulk scanning operations"
    )
    analysis_concurrency: int = Field(
        default=20,
        description="Concurrent analysis operations"
    )
    
    # Logging Configuration
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level"
    )
    log_format: Literal["json", "text"] = Field(
        default="json",
        description="Log format"
    )
    
    # Security
    secret_key: str = Field(
        default="your-secret-key-change-in-production",
        description="Secret key for JWT tokens"
    )
    access_token_expire_minutes: int = Field(
        default=30,
        description="Access token expiration time in minutes"
    )
    
    # Performance Tuning
    backtest_batch_size: int = Field(
        default=100,
        description="Batch size for backtesting operations"
    )
    analysis_cache_ttl: int = Field(
        default=1800,
        description="Analysis cache TTL in seconds"
    )
    
    # Volatility Squeeze Parameters
    bb_period: int = Field(
        default=20,
        description="Bollinger Bands period"
    )
    bb_std: float = Field(
        default=2.0,
        description="Bollinger Bands standard deviation"
    )
    keltner_period: int = Field(
        default=20,
        description="Keltner Channel period"
    )
    keltner_multiplier: float = Field(
        default=1.5,
        description="Keltner Channel ATR multiplier"
    )
    atr_period: int = Field(
        default=14,
        description="ATR calculation period"
    )
    ema_short: int = Field(
        default=20,
        description="Short EMA period for trend filter"
    )
    ema_long: int = Field(
        default=50,
        description="Long EMA period for trend filter"
    )
    squeeze_lookback: int = Field(
        default=180,
        description="Lookback period for squeeze percentile calculation"
    )
    squeeze_percentile: float = Field(
        default=15.0,  # Increased from 10.0 for more signals
        description="Percentile threshold for squeeze detection"
    )
    expansion_threshold: float = Field(
        default=0.15,  # Reduced from 0.20 for more sensitive detection
        description="BBWidth expansion threshold (15%)"
    )
    range_multiplier: float = Field(
        default=1.1,   # Reduced from 1.25 for more sensitive detection
        description="Range multiplier for ATR comparison"
    )

    @validator("secret_key")
    def validate_secret_key(cls, v: str) -> str:
        """Validate secret key length."""
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")
        return v

    @validator("openai_api_key", "anthropic_api_key")
    def validate_api_keys(cls, v: str) -> str:
        """Validate API key format."""
        if v and len(v) < 10:
            raise ValueError("API key appears to be invalid")
        return v

    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
