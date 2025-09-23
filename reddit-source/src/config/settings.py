"""Configuration settings for Reddit Source application."""

import os
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import Field, validator
from pydantic_settings import BaseSettings

# Load environment variables from .env file
load_dotenv()


class RedditConfig:
    """Reddit API configuration."""
    
    def __init__(self):
        self.client_id = os.getenv("REDDIT_CLIENT_ID", "")
        self.client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
        self.user_agent = os.getenv("REDDIT_USER_AGENT", "reddit-source/0.1")


class SupabaseConfig:
    """Supabase configuration."""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL", "")
        self.key = os.getenv("SUPABASE_KEY", "")
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY")


class DataConfig:
    """Data collection and processing configuration."""
    
    def __init__(self):
        self.subreddits_str = os.getenv("SUBREDDITS", "")
        self.poll_window_minutes = int(os.getenv("POLL_WINDOW_MINUTES", "120"))
        self.poll_interval_seconds = int(os.getenv("POLL_INTERVAL_SECONDS", "600"))
        self.max_posts_per_poll = int(os.getenv("MAX_POSTS_PER_POLL", "100"))
    
    @property
    def subreddits(self) -> List[str]:
        """Parse comma-separated subreddits string."""
        if self.subreddits_str:
            return [s.strip() for s in self.subreddits_str.split(",") if s.strip()]
        return [
            "stocks", "investing", "options", "Daytrading", "wallstreetbets",
            "pennystocks", "biotech", "semiconductors", "ETFs", "SecurityAnalysis",
            "ValueInvesting", "financialindependence"
        ]


class StorageConfig(BaseSettings):
    """Storage configuration."""
    
    data_dir: Path = Field(default=Path("./data"), env="DATA_DIR")
    image_storage_path: Path = Field(
        default=Path("./data/images"), 
        env="IMAGE_STORAGE_PATH"
    )
    cache_dir: Path = Field(default=Path("./data/cache"), env="CACHE_DIR")
    
    @validator("data_dir", "image_storage_path", "cache_dir", pre=True)
    def parse_path(cls, v):
        """Convert string paths to Path objects."""
        return Path(v)


class VLMConfig(BaseSettings):
    """Vision Language Model configuration."""
    
    use_local_vlm: bool = Field(default=True, env="USE_LOCAL_VLM")
    model_name: str = Field(
        default="Qwen/Qwen2-VL-7B-Instruct", 
        env="VLM_MODEL_NAME"
    )
    device: str = Field(default="mps", env="VLM_DEVICE")
    max_tokens: int = Field(default=2048, env="VLM_MAX_TOKENS")
    temperature: float = Field(default=0.1, env="VLM_TEMPERATURE")


class MarketConfig(BaseSettings):
    """Market data configuration."""
    
    provider: str = Field(default="yfinance", env="MARKET_DATA_PROVIDER")
    timezone: str = Field(default="America/New_York", env="TIMEZONE")
    market_hours_start: str = Field(default="09:30", env="MARKET_HOURS_START")
    market_hours_end: str = Field(default="16:00", env="MARKET_HOURS_END")


class ProcessingConfig(BaseSettings):
    """Processing configuration."""
    
    batch_size: int = Field(default=50, env="BATCH_SIZE")
    max_concurrent_requests: int = Field(
        default=10, 
        env="MAX_CONCURRENT_REQUESTS"
    )
    request_timeout: int = Field(default=30, env="REQUEST_TIMEOUT")
    retry_attempts: int = Field(default=3, env="RETRY_ATTEMPTS")
    retry_delay: float = Field(default=1.0, env="RETRY_DELAY")


class QualityConfig(BaseSettings):
    """Quality filtering configuration."""
    
    min_score_threshold: int = Field(default=5, env="MIN_SCORE_THRESHOLD")
    min_comment_threshold: int = Field(default=2, env="MIN_COMMENT_THRESHOLD")
    value_score_keep_threshold: float = Field(
        default=0.60, 
        env="VALUE_SCORE_KEEP_THRESHOLD"
    )
    value_score_quarantine_threshold: float = Field(
        default=0.30, 
        env="VALUE_SCORE_QUARANTINE_THRESHOLD"
    )
    
    # Storage filtering thresholds - prevent low-quality data from being stored
    min_confidence_to_store: float = Field(default=0.3, env="MIN_CONFIDENCE_TO_STORE")
    min_quality_tiers_to_store: str = Field(default="valuable,soft_quarantine", env="MIN_QUALITY_TIERS_TO_STORE")
    require_tickers_to_store: bool = Field(default=True, env="REQUIRE_TICKERS_TO_STORE")
    require_sentiment_to_store: bool = Field(default=False, env="REQUIRE_SENTIMENT_TO_STORE")
    min_text_length_to_store: int = Field(default=50, env="MIN_TEXT_LENGTH_TO_STORE")
    max_posts_per_batch: int = Field(default=50, env="MAX_POSTS_PER_BATCH")
    
    @property
    def allowed_quality_tiers(self) -> List[str]:
        """Get list of allowed quality tiers for storage."""
        return [tier.strip() for tier in self.min_quality_tiers_to_store.split(",")]


class FeatureConfig(BaseSettings):
    """Feature engineering configuration."""
    
    aggregation_window_hours: int = Field(
        default=2, 
        env="AGGREGATION_WINDOW_HOURS"
    )
    buzz_zscore_window_days: int = Field(
        default=7, 
        env="BUZZ_ZSCORE_WINDOW_DAYS"
    )
    min_posts_for_buzz: int = Field(default=3, env="MIN_POSTS_FOR_BUZZ")


class LoggingConfig(BaseSettings):
    """Logging configuration."""
    
    level: str = Field(default="INFO", env="LOG_LEVEL")
    format: str = Field(default="json", env="LOG_FORMAT")
    file: Optional[Path] = Field(
        default=Path("./logs/reddit-source.log"), 
        env="LOG_FILE"
    )
    
    @validator("file", pre=True)
    def parse_log_file(cls, v):
        """Convert string path to Path object."""
        return Path(v) if v else None


class DevelopmentConfig(BaseSettings):
    """Development configuration."""
    
    debug: bool = Field(default=False, env="DEBUG")
    enable_profiling: bool = Field(default=False, env="ENABLE_PROFILING")
    mock_vlm_responses: bool = Field(default=False, env="MOCK_VLM_RESPONSES")


class Settings:
    """Main application settings."""
    
    def __init__(self):
        """Initialize settings with lazy loading."""
        self.reddit = RedditConfig()
        self.supabase = SupabaseConfig()
        self.data = DataConfig()
        self.storage = StorageConfig()
        self.vlm = VLMConfig()
        self.market = MarketConfig()
        self.processing = ProcessingConfig()
        self.quality = QualityConfig()
        self.features = FeatureConfig()
        self.logging = LoggingConfig()
        self.development = DevelopmentConfig()


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get application settings."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
