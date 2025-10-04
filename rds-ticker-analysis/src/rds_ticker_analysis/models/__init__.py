"""Data models for RDS ticker analysis system."""

from rds_ticker_analysis.models.reddit import (
    RedditPost,
    RedditComment,
    RedditUser,
    SubredditMetrics,
    TickerMention,
)
from rds_ticker_analysis.models.sentiment import (
    SentimentAnalysis,
    SentimentScore,
    EmotionAnalysis,
    ContentClassification,
)
from rds_ticker_analysis.models.market import (
    MarketData,
    TickerInfo,
    PriceHistory,
    TechnicalIndicators,
)
from rds_ticker_analysis.models.analysis import (
    TickerOpportunity,
    OpportunityScore,
    RiskAssessment,
    AIInsights,
    AnalysisResult,
)
from rds_ticker_analysis.models.base import (
    BaseEntity,
    TimestampedModel,
    RedditMetrics,
)

__all__ = [
    # Reddit models
    "RedditPost",
    "RedditComment", 
    "RedditUser",
    "SubredditMetrics",
    "TickerMention",
    # Sentiment models
    "SentimentAnalysis",
    "SentimentScore",
    "EmotionAnalysis", 
    "ContentClassification",
    # Market models
    "MarketData",
    "TickerInfo",
    "PriceHistory",
    "TechnicalIndicators",
    # Analysis models
    "TickerOpportunity",
    "OpportunityScore",
    "RiskAssessment",
    "AIInsights",
    "AnalysisResult",
    # Base models
    "BaseEntity",
    "TimestampedModel",
    "RedditMetrics",
]
