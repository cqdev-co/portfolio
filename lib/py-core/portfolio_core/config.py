"""
Base Configuration

Provides a base settings class that all services can extend.
Handles .env file discovery across the monorepo.

Usage:
    from portfolio_core import BaseServiceSettings, find_env_file

    class MySettings(BaseServiceSettings):
        my_api_key: str = ""
        batch_size: int = 100

    settings = MySettings(_env_file=find_env_file())
"""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


def find_env_file(
    filename: str = ".env",
    start_dir: Optional[str] = None,
    max_depth: int = 5,
) -> Optional[str]:
    """
    Search for a .env file starting from start_dir and moving up.

    Searches up to max_depth parent directories to find the env file.
    This handles running from service directories, repo root, or scripts.

    Args:
        filename: Name of the env file to find (default: ".env")
        start_dir: Starting directory (default: current working directory)
        max_depth: Maximum parent directories to search

    Returns:
        Path to the env file, or None if not found
    """
    current = Path(start_dir or os.getcwd()).resolve()

    for _ in range(max_depth):
        env_path = current / filename
        if env_path.exists():
            return str(env_path)
        parent = current.parent
        if parent == current:
            break
        current = parent

    return None


class BaseServiceSettings(BaseSettings):
    """
    Base settings class for all portfolio Python services.

    Provides common configuration fields that all services need.
    Services should extend this class with their own fields.

    Environment variables are loaded from .env files and the process
    environment. The model_config can be overridden per-service.
    """

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Logging
    log_level: str = "INFO"

    # Discord notifications
    discord_webhook_url: str = ""

    model_config = {
        "env_prefix": "",
        "extra": "ignore",
        "env_nested_delimiter": "__",
    }
