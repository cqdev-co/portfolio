"""Base models and common data structures."""

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TimestampedModel(BaseModel):
    """Base model with timestamp fields."""
    
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp"
    )
    updated_at: Optional[datetime] = Field(
        None,
        description="Last update timestamp"
    )


class BaseEntity(TimestampedModel):
    """Base entity with ID and timestamps."""
    
    id: UUID = Field(
        default_factory=uuid4,
        description="Unique identifier"
    )


class RedditMetrics(BaseModel):
    """Aggregated Reddit metrics for a ticker."""
    
    # Volume metrics
    total_mentions: int = Field(
        ge=0,
        description="Total number of ticker mentions"
    )
    unique_posts: int = Field(
        ge=0,
        description="Number of unique posts mentioning ticker"
    )
    unique_comments: int = Field(
        ge=0,
        description="Number of unique comments mentioning ticker"
    )
    unique_authors: int = Field(
        ge=0,
        description="Number of unique authors discussing ticker"
    )
    
    # Engagement metrics
    total_upvotes: int = Field(
        ge=0,
        description="Total upvotes across all mentions"
    )
    total_downvotes: int = Field(
        ge=0,
        description="Total downvotes across all mentions"
    )
    total_comments: int = Field(
        ge=0,
        description="Total comments on posts mentioning ticker"
    )
    average_score: float = Field(
        description="Average post/comment score"
    )
    
    # Quality metrics
    high_quality_mentions: int = Field(
        ge=0,
        description="Mentions from accounts with good reputation"
    )
    bot_filtered_mentions: int = Field(
        ge=0,
        description="Mentions after bot filtering"
    )
    spam_filtered_mentions: int = Field(
        ge=0,
        description="Mentions after spam filtering"
    )
    
    # Temporal metrics
    mentions_last_hour: int = Field(
        ge=0,
        description="Mentions in the last hour"
    )
    mentions_last_day: int = Field(
        ge=0,
        description="Mentions in the last 24 hours"
    )
    mentions_last_week: int = Field(
        ge=0,
        description="Mentions in the last 7 days"
    )
    
    # Subreddit distribution
    subreddit_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Distribution of mentions across subreddits"
    )
    
    # Derived metrics
    engagement_rate: float = Field(
        description="Average engagement per mention"
    )
    quality_ratio: float = Field(
        ge=0.0,
        le=1.0,
        description="Ratio of high-quality to total mentions"
    )
    momentum_score: float = Field(
        description="Recent activity momentum indicator"
    )


class DataQuality(BaseModel):
    """Data quality assessment metrics."""
    
    completeness_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Data completeness score (0-1)"
    )
    accuracy_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Data accuracy score (0-1)"
    )
    freshness_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Data freshness score (0-1)"
    )
    consistency_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Data consistency score (0-1)"
    )
    overall_quality: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall data quality score (0-1)"
    )
    
    # Quality flags
    has_missing_data: bool = Field(
        description="Whether data has missing values"
    )
    has_outliers: bool = Field(
        description="Whether data contains statistical outliers"
    )
    is_stale: bool = Field(
        description="Whether data is considered stale"
    )
    
    # Quality metadata
    quality_checks: Dict[str, Any] = Field(
        default_factory=dict,
        description="Results of individual quality checks"
    )
    validation_timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When quality assessment was performed"
    )
