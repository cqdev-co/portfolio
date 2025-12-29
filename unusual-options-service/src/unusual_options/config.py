"""Configuration management for unusual options scanner."""

import os
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv
from loguru import logger


def load_config() -> Dict[str, Any]:
    """
    Load configuration from environment variables.
    
    Returns:
        Dictionary containing all configuration values
    """
    # Load .env file if it exists
    env_path = Path(".env")
    if env_path.exists():
        load_dotenv(env_path)
        logger.info("Loaded configuration from .env file")
    else:
        logger.warning("No .env file found, using environment variables")
    
    config = {
        # Supabase
        "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
        "SUPABASE_KEY": os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY", ""),
        "SUPABASE_SERVICE_KEY": os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        
        # Data Provider
        "DATA_PROVIDER": os.getenv("DATA_PROVIDER", "yfinance"),
        "POLYGON_API_KEY": os.getenv("POLYGON_API_KEY", ""),
        "TRADIER_API_KEY": os.getenv("TRADIER_API_KEY", ""),
        "CBOE_API_KEY": os.getenv("CBOE_API_KEY", ""),
        
        # Detection Thresholds
        "VOLUME_MULTIPLIER_THRESHOLD": float(os.getenv("VOLUME_MULTIPLIER_THRESHOLD", "3.0")),
        "OI_CHANGE_THRESHOLD": float(os.getenv("OI_CHANGE_THRESHOLD", "0.20")),
        "MIN_PREMIUM_FLOW": float(os.getenv("MIN_PREMIUM_FLOW", "100000")),
        "SWEEP_MIN_EXCHANGES": int(os.getenv("SWEEP_MIN_EXCHANGES", "3")),
        "AGGRESSIVE_ORDER_THRESHOLD": float(os.getenv("AGGRESSIVE_ORDER_THRESHOLD", "0.70")),
        
        # Filtering
        "MIN_MARKET_CAP": float(os.getenv("MIN_MARKET_CAP", "1000000000")),
        "MIN_AVG_VOLUME": int(os.getenv("MIN_AVG_VOLUME", "1000000")),
        "MIN_OPTION_VOLUME": int(os.getenv("MIN_OPTION_VOLUME", "100")),
        "ENABLE_MEME_STOCK_FILTERING": os.getenv("ENABLE_MEME_STOCK_FILTERING", "true").lower() == "true",
        
        # DTE Filtering (based on performance analysis)
        # Analysis showed: Short DTE (≤10d) = 27% win rate, Mid DTE (11-21d) = 60% win rate
        "MIN_DTE_ALL_TICKERS": int(os.getenv("MIN_DTE_ALL_TICKERS", "10")),  # Minimum DTE for all tickers
        "MIN_DTE_HIGH_0DTE_TICKERS": int(os.getenv("MIN_DTE_HIGH_0DTE_TICKERS", "14")),  # Stricter for TSLA, SPY, etc.
        "MIN_DTE_STANDARD": int(os.getenv("MIN_DTE_STANDARD", "10")),  # Standard DTE filter
        
        # Hedge Detection (smarter than blanket PUT exclusion)
        # Note: Don't exclude all PUTs - in bearish weeks they could be the edge
        # Instead, flag likely hedges based on patterns
        "EXCLUDE_PUT_SIGNALS": os.getenv("EXCLUDE_PUT_SIGNALS", "false").lower() == "true",
        "FLAG_LIKELY_HEDGES": os.getenv("FLAG_LIKELY_HEDGES", "true").lower() == "true",
        
        # Ticker Caps (prevent single ticker from dominating)
        "MAX_SIGNALS_PER_TICKER": int(os.getenv("MAX_SIGNALS_PER_TICKER", "3")),  # Reduced from 5
        
        # Alerts
        "DISCORD_WEBHOOK_URL": os.getenv("DISCORD_UOS_WEBHOOK_URL", os.getenv("DISCORD_WEBHOOK_URL", "")),
        "ALERT_ENABLED": os.getenv("ALERT_ENABLED", "false").lower() == "true",
        "ALERT_MIN_GRADE": os.getenv("ALERT_MIN_GRADE", "B"),
        
        # Logging
        "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
        "LOG_FILE": os.getenv("LOG_FILE", "logs/unusual_options.log"),
        
        # Cache
        "REDIS_URL": os.getenv("REDIS_URL", ""),
        "CACHE_TTL_SECONDS": int(os.getenv("CACHE_TTL_SECONDS", "300")),
        
        # AI Analysis
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
    }
    
    # Validate required fields
    required_fields = ["SUPABASE_URL", "SUPABASE_KEY"]
    missing = [field for field in required_fields if not config[field]]
    
    if missing:
        logger.warning(f"Missing required configuration: {', '.join(missing)}")
    
    return config


def setup_logging(config: Dict[str, Any]) -> None:
    """
    Configure loguru logger based on config.
    
    Args:
        config: Configuration dictionary
    """
    log_level = config.get("LOG_LEVEL", "INFO")
    log_file = config.get("LOG_FILE", "logs/unusual_options.log")
    
    # Remove default handler
    logger.remove()
    
    # Add console handler with colors
    logger.add(
        sink=lambda msg: print(msg, end=""),
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level=log_level,
        colorize=True
    )
    
    # Add file handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.add(
            sink=log_file,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
            level=log_level,
            rotation="500 MB",
            retention="10 days",
            compression="zip"
        )
    
    logger.info(f"Logging configured: level={log_level}")

