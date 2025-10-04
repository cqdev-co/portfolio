"""
RDS Ticker Analysis - Enterprise-grade Reddit-based ticker sentiment analysis.

This package provides comprehensive analysis of stock tickers mentioned in Reddit
financial subreddits to identify potential buying opportunities through:

- Multi-subreddit sentiment aggregation with bot detection
- Mathematical scoring algorithms for opportunity ranking  
- AI-powered qualitative analysis integration
- Real-time market data enrichment via yfinance
- Integration with volatility squeeze scanner signals

Key Features:
- Enterprise-grade architecture with proper separation of concerns
- Comprehensive bot detection and content filtering
- Multi-factor scoring combining sentiment, volume, and technical indicators
- Scalable async processing with Redis caching
- Full observability with structured logging
- Production-ready FastAPI web service and CLI interface
"""

__version__ = "0.1.0"
__author__ = "Conor Quinlan"
__email__ = "conor@example.com"

from rds_ticker_analysis.models import (
    TickerMention,
    SentimentAnalysis,
    TickerOpportunity,
    RedditMetrics,
)
from rds_ticker_analysis.services import (
    RedditSentimentService,
    TickerAnalysisService,
    MarketDataService,
)

__all__ = [
    "TickerMention",
    "SentimentAnalysis", 
    "TickerOpportunity",
    "RedditMetrics",
    "RedditSentimentService",
    "TickerAnalysisService",
    "MarketDataService",
]
