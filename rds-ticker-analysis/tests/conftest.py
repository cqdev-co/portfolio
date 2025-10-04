"""Pytest configuration and fixtures for RDS Ticker Analysis tests."""

import asyncio
from typing import Generator
from unittest.mock import AsyncMock, MagicMock

import pytest

from rds_ticker_analysis.models.analysis import OpportunityScore, RiskAssessment
from rds_ticker_analysis.models.base import RedditMetrics
from rds_ticker_analysis.models.market import MarketData, TickerInfo
from rds_ticker_analysis.models.sentiment import SentimentAnalysis, SentimentScore, SentimentLabel
from rds_ticker_analysis.services.scoring import ScoringService


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_reddit_client():
    """Mock Reddit client."""
    client = MagicMock()
    client.subreddit.return_value.new.return_value = []
    return client


@pytest.fixture
def sample_ticker_info():
    """Sample ticker information."""
    return TickerInfo(
        symbol="AAPL",
        name="Apple Inc.",
        exchange="NASDAQ",
        security_type="stock",
        sector="technology",
        market_cap=3000000000000,  # $3T
        pe_ratio=25.5,
        beta=1.2,
        average_volume=50000000,
    )


@pytest.fixture
def sample_market_data():
    """Sample market data."""
    return MarketData(
        ticker_symbol="AAPL",
        current_price=150.25,
        previous_close=148.50,
        open_price=149.00,
        day_high=151.00,
        day_low=148.75,
        current_volume=45000000,
        average_volume=50000000,
        price_change=1.75,
        price_change_pct=1.18,
        last_trade_time="2025-09-26T16:00:00Z",
        market_hours=False,
    )


@pytest.fixture
def sample_sentiment_analysis():
    """Sample sentiment analysis."""
    return SentimentAnalysis(
        content_id="test_post_123",
        content_type="post",
        ticker_symbol="AAPL",
        analyzed_text="Apple looks bullish with strong fundamentals",
        text_length=45,
        sentiment=SentimentScore(
            label=SentimentLabel.BULLISH,
            confidence=0.85,
            polarity=0.65,
            subjectivity=0.4,
            intensity=0.7,
            vader_compound=0.6,
            textblob_polarity=0.7,
        ),
        content_quality_score=0.8,
        reliability_score=0.75,
        model_version="test-v1.0",
    )


@pytest.fixture
def sample_reddit_metrics():
    """Sample Reddit metrics."""
    return RedditMetrics(
        total_mentions=25,
        unique_posts=15,
        unique_comments=10,
        unique_authors=18,
        total_upvotes=450,
        total_downvotes=50,
        total_comments=35,
        average_score=8.5,
        high_quality_mentions=20,
        bot_filtered_mentions=23,
        spam_filtered_mentions=25,
        mentions_last_hour=2,
        mentions_last_day=8,
        mentions_last_week=25,
        subreddit_distribution={"stocks": 15, "investing": 10},
        engagement_rate=12.5,
        quality_ratio=0.8,
        momentum_score=0.65,
    )


@pytest.fixture
def scoring_service():
    """Scoring service instance."""
    return ScoringService()


@pytest.fixture
def mock_ai_service():
    """Mock AI analysis service."""
    service = AsyncMock()
    service.generate_comprehensive_analysis.return_value = None
    return service


@pytest.fixture
def mock_market_service():
    """Mock market data service."""
    service = AsyncMock()
    service.get_ticker_info.return_value = None
    service.get_current_market_data.return_value = None
    service.validate_tickers.return_value = {}
    return service


@pytest.fixture
def mock_reddit_service():
    """Mock Reddit sentiment service."""
    service = AsyncMock()
    service.analyze_subreddit_activity.return_value = []
    return service
