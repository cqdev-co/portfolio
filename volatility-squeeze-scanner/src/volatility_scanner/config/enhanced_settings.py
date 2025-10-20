"""
Enhanced configuration settings for the Volatility Squeeze Scanner.
Uses pydantic-settings with validation, environment support, and type safety.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, validator, root_validator
from typing import Optional, Dict, Any, List
from enum import Enum
from decimal import Decimal
import os
from pathlib import Path


class Environment(str, Enum):
    """Application environment types."""
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    """Logging levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogFormat(str, Enum):
    """Log format types."""
    JSON = "json"
    TEXT = "text"
    STRUCTURED = "structured"


class DataProvider(str, Enum):
    """Supported data providers."""
    YFINANCE = "yfinance"
    ALPHA_VANTAGE = "alpha_vantage"
    POLYGON = "polygon"
    IEX_CLOUD = "iex_cloud"


class DatabaseConfig(BaseSettings):
    """Database configuration settings."""
    
    url: Optional[str] = Field(None, description="Database connection URL")
    host: str = Field("localhost", description="Database host")
    port: int = Field(5432, description="Database port")
    name: str = Field("volatility_scanner", description="Database name")
    username: Optional[str] = Field(None, description="Database username")
    password: Optional[str] = Field(None, description="Database password")
    pool_size: int = Field(10, description="Connection pool size")
    max_overflow: int = Field(20, description="Maximum pool overflow")
    pool_timeout: int = Field(30, description="Pool timeout in seconds")
    
    @validator('url')
    def validate_url(cls, v, values):
        """Build URL from components if not provided."""
        if v is None and values.get('username') and values.get('password'):
            host = values.get('host', 'localhost')
            port = values.get('port', 5432)
            name = values.get('name', 'volatility_scanner')
            username = values['username']
            password = values['password']
            return f"postgresql://{username}:{password}@{host}:{port}/{name}"
        return v or "sqlite+aiosqlite:///./volatility_scanner.db"
    
    class Config:
        env_prefix = "DB_"


class RedisConfig(BaseSettings):
    """Redis configuration settings."""
    
    url: Optional[str] = Field(None, description="Redis connection URL")
    host: str = Field("localhost", description="Redis host")
    port: int = Field(6379, description="Redis port")
    db: int = Field(0, description="Redis database number")
    password: Optional[str] = Field(None, description="Redis password")
    max_connections: int = Field(20, description="Maximum connections")
    socket_timeout: int = Field(5, description="Socket timeout in seconds")
    
    @validator('url')
    def build_url(cls, v, values):
        """Build Redis URL from components if not provided."""
        if v is None:
            host = values.get('host', 'localhost')
            port = values.get('port', 6379)
            db = values.get('db', 0)
            password = values.get('password')
            
            if password:
                return f"redis://:{password}@{host}:{port}/{db}"
            else:
                return f"redis://{host}:{port}/{db}"
        return v
    
    class Config:
        env_prefix = "REDIS_"


class SecurityConfig(BaseSettings):
    """Security configuration settings."""
    
    secret_key: str = Field("your-secret-key-change-in-production-min-32-chars", description="Application secret key")
    jwt_algorithm: str = Field("HS256", description="JWT algorithm")
    jwt_expiration_hours: int = Field(24, description="JWT expiration in hours")
    api_key_header: str = Field("X-API-Key", description="API key header name")
    cors_origins: List[str] = Field(["*"], description="CORS allowed origins")
    rate_limit_per_minute: int = Field(60, description="Rate limit per minute")
    
    @validator('secret_key')
    def validate_secret_key(cls, v):
        """Validate secret key strength."""
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters long")
        return v
    
    class Config:
        env_prefix = "SECURITY_"


class MonitoringConfig(BaseSettings):
    """Monitoring and observability configuration."""
    
    enable_metrics: bool = Field(True, description="Enable metrics collection")
    enable_tracing: bool = Field(False, description="Enable distributed tracing")
    metrics_port: int = Field(9090, description="Metrics server port")
    health_check_interval: int = Field(30, description="Health check interval in seconds")
    
    # External monitoring services
    datadog_api_key: Optional[str] = Field(None, description="Datadog API key")
    newrelic_license_key: Optional[str] = Field(None, description="New Relic license key")
    sentry_dsn: Optional[str] = Field(None, description="Sentry DSN")
    
    class Config:
        env_prefix = "MONITORING_"


class EnhancedSettings(BaseSettings):
    """
    Enhanced application settings with comprehensive configuration management.
    Supports multiple environments, validation, and structured configuration.
    """
    
    # Environment Configuration
    environment: Environment = Field(Environment.DEVELOPMENT, description="Application environment")
    debug: bool = Field(False, description="Enable debug mode")
    app_name: str = Field("Volatility Squeeze Scanner", description="Application name")
    app_version: str = Field("1.0.0", description="Application version")
    
    # API Configuration
    openai_api_key: Optional[str] = Field(None, description="OpenAI API key for AI analysis")
    anthropic_api_key: Optional[str] = Field(None, description="Anthropic API key for AI analysis")
    
    # Analysis Parameters (using Decimal for precision)
    squeeze_percentile: Decimal = Field(Decimal('10.0'), description="Percentile threshold for squeeze detection")
    squeeze_lookback_periods: int = Field(180, description="Lookback periods for squeeze calculation")
    expansion_threshold: Decimal = Field(Decimal('0.20'), description="Threshold for expansion detection")
    
    # Technical Indicators
    bb_period: int = Field(20, description="Bollinger Bands period")
    bb_std_dev: Decimal = Field(Decimal('2.0'), description="Bollinger Bands standard deviation")
    kc_period: int = Field(20, description="Keltner Channels period")
    kc_atr_multiplier: Decimal = Field(Decimal('2.0'), description="Keltner Channels ATR multiplier")
    ema_short_period: int = Field(20, description="Short EMA period")
    ema_long_period: int = Field(50, description="Long EMA period")
    
    # Risk Management
    atr_stop_multiplier: Decimal = Field(Decimal('1.5'), description="ATR multiplier for stop loss")
    max_position_size: Decimal = Field(Decimal('0.10'), description="Maximum position size as percentage")
    max_correlation: Decimal = Field(Decimal('0.7'), description="Maximum correlation between positions")
    
    # Data Sources
    data_provider: DataProvider = Field(DataProvider.YFINANCE, description="Primary data provider")
    fallback_providers: List[DataProvider] = Field([DataProvider.YFINANCE], description="Fallback data providers")
    cache_ttl_minutes: int = Field(60, description="Cache TTL in minutes")
    
    # Logging Configuration
    log_level: LogLevel = Field(LogLevel.INFO, description="Logging level")
    log_format: LogFormat = Field(LogFormat.JSON, description="Log format")
    log_file_path: Optional[Path] = Field(None, description="Log file path")
    log_rotation_size: str = Field("100 MB", description="Log rotation size")
    log_retention_days: int = Field(30, description="Log retention in days")
    
    # Performance Configuration
    max_concurrent_requests: int = Field(5, description="Maximum concurrent API requests")
    request_timeout_seconds: int = Field(30, description="Request timeout in seconds")
    request_delay_seconds: float = Field(0.2, description="Delay between individual API requests")
    rate_limit_backoff_factor: float = Field(2.0, description="Exponential backoff factor for rate limiting")
    max_retries: int = Field(3, description="Maximum number of retries for failed requests")
    retry_delay_base: float = Field(1.0, description="Base delay for exponential backoff retries")
    batch_size: int = Field(100, description="Default batch processing size")
    worker_threads: int = Field(4, description="Number of worker threads")
    bulk_scan_concurrency: int = Field(3, description="Concurrency for bulk scanning operations")
    chunk_delay_seconds: float = Field(2.0, description="Delay between processing chunks in bulk operations")
    
    # Server Configuration
    host: str = Field("0.0.0.0", description="Server host")
    port: int = Field(8000, description="Server port")
    workers: int = Field(1, description="Number of server workers")
    
    # External Service Configuration
    database: DatabaseConfig = Field(default_factory=DatabaseConfig, description="Database configuration")
    redis: RedisConfig = Field(default_factory=RedisConfig, description="Redis configuration")
    security: SecurityConfig = Field(default_factory=SecurityConfig, description="Security configuration")
    monitoring: MonitoringConfig = Field(default_factory=MonitoringConfig, description="Monitoring configuration")
    
    # Feature Flags
    enable_ai_analysis: bool = Field(True, description="Enable AI-powered analysis")
    enable_backtesting: bool = Field(True, description="Enable backtesting features")
    enable_real_time_alerts: bool = Field(False, description="Enable real-time alerting")
    enable_paper_trading: bool = Field(False, description="Enable paper trading simulation")
    timeframes: List[str] = Field(['1d', '1wk'], description="Timeframes for multi-confirmation")
    volume_anomaly_threshold: float = Field(2.0, description="Z-score threshold for volume anomaly")
    enable_sentiment: bool = Field(False, description="Enable sentiment analysis integration")
    ml_local_only: bool = Field(True, description="Run ML ranking locally only")
    
    @validator('squeeze_percentile')
    def validate_squeeze_percentile(cls, v):
        """Validate squeeze percentile is within valid range."""
        if not (0 < v <= 50):
            raise ValueError("Squeeze percentile must be between 0 and 50")
        return v
    
    @validator('expansion_threshold')
    def validate_expansion_threshold(cls, v):
        """Validate expansion threshold is reasonable."""
        if not (0 < v <= 1):
            raise ValueError("Expansion threshold must be between 0 and 1")
        return v
    
    @validator('max_position_size')
    def validate_position_size(cls, v):
        """Validate maximum position size."""
        if not (0 < v <= 1):
            raise ValueError("Maximum position size must be between 0 and 1")
        return v
    
    @validator('port')
    def validate_port(cls, v):
        """Validate port number."""
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v
    
    @root_validator
    def validate_ai_configuration(cls, values):
        """Validate AI configuration consistency."""
        enable_ai = values.get('enable_ai_analysis', True)
        openai_key = values.get('openai_api_key')
        anthropic_key = values.get('anthropic_api_key')
        
        if enable_ai and not (openai_key or anthropic_key):
            # Don't raise error, just disable AI
            values['enable_ai_analysis'] = False
        
        return values
    
    @root_validator
    def validate_environment_settings(cls, values):
        """Validate settings based on environment."""
        env = values.get('environment', Environment.DEVELOPMENT)
        debug = values.get('debug', False)
        
        # Production environment validations
        if env == Environment.PRODUCTION:
            if debug:
                raise ValueError("Debug mode cannot be enabled in production")
        
        return values
    
    def get_database_url(self) -> str:
        """Get the database connection URL."""
        return self.database.url or "sqlite+aiosqlite:///./volatility_scanner.db"
    
    def get_redis_url(self) -> str:
        """Get the Redis connection URL."""
        return self.redis.url
    
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == Environment.DEVELOPMENT
    
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == Environment.PRODUCTION
    
    def get_log_config(self) -> Dict[str, Any]:
        """Get logging configuration dictionary."""
        return {
            "level": self.log_level.value,
            "format": self.log_format.value,
            "file_path": str(self.log_file_path) if self.log_file_path else None,
            "rotation": self.log_rotation_size,
            "retention": f"{self.log_retention_days} days"
        }
    
    class Config:
        env_file = [".env.local", ".env"]
        env_file_encoding = "utf-8"
        env_nested_delimiter = "__"  # Allows nested config like DB__HOST
        case_sensitive = False
        validate_assignment = True


# Singleton pattern for settings
_enhanced_settings: Optional[EnhancedSettings] = None


def get_enhanced_settings() -> EnhancedSettings:
    """
    Get enhanced application settings instance (singleton).
    Loads settings once and reuses the instance.
    """
    global _enhanced_settings
    if _enhanced_settings is None:
        _enhanced_settings = EnhancedSettings()
    return _enhanced_settings


def reload_enhanced_settings() -> EnhancedSettings:
    """
    Reload enhanced settings from environment (useful for testing).
    """
    global _enhanced_settings
    _enhanced_settings = None
    return get_enhanced_settings()


def override_enhanced_settings(**kwargs) -> EnhancedSettings:
    """
    Override specific enhanced settings (useful for testing).
    """
    current_settings = get_enhanced_settings()
    overridden = current_settings.copy(update=kwargs)
    
    global _enhanced_settings
    _enhanced_settings = overridden
    return _enhanced_settings
