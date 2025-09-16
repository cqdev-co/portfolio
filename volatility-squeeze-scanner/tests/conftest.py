"""Pytest configuration and fixtures."""

import pytest
from datetime import datetime, timedelta
from typing import List

from volatility_scanner.config.settings import Settings
from volatility_scanner.models.market_data import MarketData, OHLCV
from volatility_scanner.services.data_service import DataService
from volatility_scanner.services.analysis_service import AnalysisService


@pytest.fixture
def test_settings() -> Settings:
    """Create test settings."""
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        redis_url="redis://localhost:6379/15",  # Test database
        debug=True,
        log_level="DEBUG",
        openai_api_key="test-key",
        anthropic_api_key="test-key",
        yfinance_cache_ttl=60,  # Short cache for tests
    )


@pytest.fixture
def sample_ohlcv_data() -> List[OHLCV]:
    """Create sample OHLCV data for testing."""
    base_date = datetime(2023, 1, 1)
    data = []
    
    # Generate 100 days of sample data
    for i in range(100):
        timestamp = base_date + timedelta(days=i)
        
        # Simple trending data with some volatility
        base_price = 100 + (i * 0.1)  # Slight uptrend
        volatility = 2.0
        
        open_price = base_price + (i % 3 - 1) * volatility
        high = open_price + abs(i % 4) * 0.5
        low = open_price - abs(i % 3) * 0.5
        close = open_price + (i % 5 - 2) * 0.3
        volume = 1000000 + (i % 10) * 100000
        
        # Ensure OHLC validity
        high = max(high, open_price, close)
        low = min(low, open_price, close)
        
        ohlcv = OHLCV(
            timestamp=timestamp,
            open=max(0.01, open_price),
            high=max(0.01, high),
            low=max(0.01, low),
            close=max(0.01, close),
            volume=max(1, int(volume))
        )
        data.append(ohlcv)
    
    return data


@pytest.fixture
def sample_market_data(sample_ohlcv_data: List[OHLCV]) -> MarketData:
    """Create sample market data for testing."""
    return MarketData(
        symbol="TEST",
        name="Test Stock",
        sector="Technology",
        market_cap=1000000000,
        ohlcv_data=sample_ohlcv_data,
        indicators=[],  # Will be populated by tests
        data_start=sample_ohlcv_data[0].timestamp,
        data_end=sample_ohlcv_data[-1].timestamp,
        last_updated=datetime.now()
    )


@pytest.fixture
def data_service(test_settings: Settings) -> DataService:
    """Create data service for testing."""
    return DataService(test_settings)


@pytest.fixture
def analysis_service(test_settings: Settings) -> AnalysisService:
    """Create analysis service for testing."""
    return AnalysisService(test_settings)
