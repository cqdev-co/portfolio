"""
Supabase Client Factory

Provides a consistent way to create Supabase clients across all Python services.
Handles environment variable resolution with fallbacks for different naming conventions.

Usage:
    from portfolio_core import get_supabase_client, get_service_client

    # Anonymous client (respects RLS)
    client = get_supabase_client()

    # Service role client (bypasses RLS - use for backend operations)
    client = get_service_client()
"""

import os
from functools import lru_cache
from typing import Optional

from loguru import logger

# Lazy import to avoid startup overhead
_client_cache: dict[str, object] = {}


def _resolve_env(primary: str, *fallbacks: str) -> Optional[str]:
    """Resolve an environment variable with fallback names."""
    value = os.getenv(primary)
    if value:
        return value
    for fallback in fallbacks:
        value = os.getenv(fallback)
        if value:
            logger.debug(f"Using fallback env var {fallback} for {primary}")
            return value
    return None


def _get_supabase_url() -> str:
    """Get Supabase URL from environment."""
    url = _resolve_env(
        "SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
    )
    if not url:
        raise ValueError(
            "Supabase URL not found. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
        )
    return url


def _get_anon_key() -> str:
    """Get Supabase anonymous key from environment."""
    key = _resolve_env(
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_KEY",
    )
    if not key:
        raise ValueError(
            "Supabase anon key not found. "
            "Set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
        )
    return key


def _get_service_key() -> str:
    """Get Supabase service role key from environment."""
    key = _resolve_env(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
        "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    )
    if not key:
        raise ValueError(
            "Supabase service role key not found. Set SUPABASE_SERVICE_ROLE_KEY"
        )
    return key


def get_supabase_client():
    """
    Get a Supabase client using the anonymous key.

    Respects Row Level Security (RLS) policies.
    Cached after first creation.

    Returns:
        supabase.Client: Authenticated Supabase client
    """
    cache_key = "anon"
    if cache_key not in _client_cache:
        from supabase import create_client

        url = _get_supabase_url()
        key = _get_anon_key()
        _client_cache[cache_key] = create_client(url, key)
        logger.debug(f"Created Supabase anon client for {url}")
    return _client_cache[cache_key]


def get_service_client():
    """
    Get a Supabase client using the service role key.

    Bypasses Row Level Security (RLS) — use for backend operations only.
    Cached after first creation.

    Returns:
        supabase.Client: Service role Supabase client
    """
    cache_key = "service"
    if cache_key not in _client_cache:
        from supabase import create_client

        url = _get_supabase_url()
        key = _get_service_key()
        _client_cache[cache_key] = create_client(url, key)
        logger.debug(f"Created Supabase service client for {url}")
    return _client_cache[cache_key]
