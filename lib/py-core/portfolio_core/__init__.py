"""
Portfolio Core - Shared Python library for trading services.

Provides:
- Supabase client factory with consistent configuration
- Common base models and types
- Shared utility functions
- Logging configuration
"""

from portfolio_core.database import get_supabase_client, get_service_client
from portfolio_core.config import BaseServiceSettings, find_env_file
from portfolio_core.utils import safe_divide, clamp, normalize_score, pct_change
from portfolio_core.logging import setup_logging

__all__ = [
    "get_supabase_client",
    "get_service_client",
    "BaseServiceSettings",
    "find_env_file",
    "safe_divide",
    "clamp",
    "normalize_score",
    "pct_change",
    "setup_logging",
]
