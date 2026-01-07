"""Pytest configuration and fixtures."""

from typing import Any

import pytest


@pytest.fixture
def mock_config() -> dict[str, Any]:
    """Mock configuration for testing."""
    return {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_KEY": "test_key",
        "SUPABASE_SERVICE_KEY": "test_service_key",
        "DATA_PROVIDER": "yfinance",
        "VOLUME_MULTIPLIER_THRESHOLD": 3.0,
        "OI_CHANGE_THRESHOLD": 0.20,
        "MIN_PREMIUM_FLOW": 100000,
        "MIN_MARKET_CAP": 1000000000,
        "MIN_AVG_VOLUME": 1000000,
        "LOG_LEVEL": "DEBUG",
    }


@pytest.fixture
def sample_ticker() -> str:
    """Sample ticker for testing."""
    return "AAPL"
