"""Reddit-specific data models."""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator

from rds_ticker_analysis.models.base import BaseEntity, TimestampedModel


class UserType(str, Enum):
    """User classification types."""
    VERIFIED_HUMAN = "verified_human"
    LIKELY_HUMAN = "likely_human"
    SUSPICIOUS = "suspicious"
    LIKELY_BOT = "likely_bot"
    CONFIRMED_BOT = "confirmed_bot"


class ContentType(str, Enum):
    """Content classification types."""
    POST = "post"
    COMMENT = "comment"
    REPLY = "reply"


class PostFlair(str, Enum):
    """Common post flair categories."""
    DD = "dd"  # Due Diligence
    DISCUSSION = "discussion"
    NEWS = "news"
    YOLO = "yolo"
    GAIN = "gain"
    LOSS = "loss"
    MEME = "meme"
    QUESTION = "question"
    TECHNICAL_ANALYSIS = "technical_analysis"
    OTHER = "other"


class RedditUser(BaseEntity):
    """Reddit user profile with bot detection metrics."""
    
    username: str = Field(description="Reddit username")
    account_created: datetime = Field(description="Account creation date")
    
    # Reputation metrics
    total_karma: int = Field(ge=0, description="Total user karma")
    post_karma: int = Field(ge=0, description="Post karma")
    comment_karma: int = Field(ge=0, description="Comment karma")
    
    # Activity metrics
    total_posts: int = Field(ge=0, description="Total posts by user")
    total_comments: int = Field(ge=0, description="Total comments by user")
    avg_posts_per_day: float = Field(
        ge=0.0, 
        description="Average posts per day"
    )
    avg_comments_per_day: float = Field(
        ge=0.0,
        description="Average comments per day"
    )
    
    # Bot detection features
    user_type: UserType = Field(description="User classification")
    bot_probability: float = Field(
        ge=0.0,
        le=1.0,
        description="Probability of being a bot (0-1)"
    )
    
    # Account characteristics
    has_verified_email: bool = Field(description="Email verification status")
    is_premium: bool = Field(description="Reddit premium status")
    is_moderator: bool = Field(description="Moderator status")
    
    # Behavioral patterns
    posting_pattern_score: float = Field(
        description="Regularity of posting pattern"
    )
    content_diversity_score: float = Field(
        description="Diversity of content posted"
    )
    interaction_authenticity_score: float = Field(
        description="Authenticity of user interactions"
    )
    
    @validator('bot_probability')
    def validate_bot_probability(cls, v: float) -> float:
        """Ensure bot probability is between 0 and 1."""
        return max(0.0, min(1.0, v))


class RedditPost(BaseEntity):
    """Reddit post with enhanced metadata."""
    
    post_id: str = Field(description="Reddit post ID")
    subreddit: str = Field(description="Subreddit name")
    author: str = Field(description="Post author username")
    author_profile: Optional[RedditUser] = Field(
        None, 
        description="Author profile data"
    )
    
    # Content
    title: str = Field(description="Post title")
    content: str = Field(description="Post content/selftext")
    url: Optional[str] = Field(None, description="External URL if link post")
    
    # Metadata
    posted_at: datetime = Field(description="Post creation timestamp")
    flair: Optional[PostFlair] = Field(None, description="Post flair category")
    is_self_post: bool = Field(description="Whether post is self/text post")
    is_nsfw: bool = Field(description="NSFW status")
    is_spoiler: bool = Field(description="Spoiler status")
    is_locked: bool = Field(description="Whether post is locked")
    is_pinned: bool = Field(description="Whether post is pinned")
    
    # Engagement metrics
    score: int = Field(description="Post score (upvotes - downvotes)")
    upvote_ratio: float = Field(
        ge=0.0,
        le=1.0,
        description="Upvote ratio"
    )
    num_comments: int = Field(ge=0, description="Number of comments")
    num_crossposts: int = Field(ge=0, description="Number of crossposts")
    
    # Awards and gilding
    total_awards_received: int = Field(
        ge=0,
        description="Total awards received"
    )
    gilded_count: int = Field(ge=0, description="Number of golds received")
    
    # Quality indicators
    quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Content quality score (0-1)"
    )
    spam_probability: float = Field(
        ge=0.0,
        le=1.0,
        description="Probability of being spam (0-1)"
    )


class RedditComment(BaseEntity):
    """Reddit comment with threading and quality metrics."""
    
    comment_id: str = Field(description="Reddit comment ID")
    post_id: str = Field(description="Parent post ID")
    parent_comment_id: Optional[str] = Field(
        None,
        description="Parent comment ID if reply"
    )
    
    subreddit: str = Field(description="Subreddit name")
    author: str = Field(description="Comment author username")
    author_profile: Optional[RedditUser] = Field(
        None,
        description="Author profile data"
    )
    
    # Content
    content: str = Field(description="Comment text content")
    posted_at: datetime = Field(description="Comment creation timestamp")
    
    # Threading
    depth: int = Field(ge=0, description="Comment nesting depth")
    is_top_level: bool = Field(description="Whether comment is top-level")
    
    # Engagement
    score: int = Field(description="Comment score")
    is_gilded: bool = Field(description="Whether comment received gold")
    
    # Moderation
    is_removed: bool = Field(description="Whether comment was removed")
    is_deleted: bool = Field(description="Whether comment was deleted")
    
    # Quality indicators
    quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Comment quality score (0-1)"
    )
    relevance_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Relevance to ticker discussion (0-1)"
    )


class TickerMention(BaseEntity):
    """Individual ticker mention with context and confidence."""
    
    ticker_symbol: str = Field(description="Stock ticker symbol")
    content_type: ContentType = Field(description="Type of content")
    content_id: str = Field(description="Reddit content ID")
    subreddit: str = Field(description="Subreddit where mention occurred")
    author: str = Field(description="Author of the mention")
    
    # Context
    mention_context: str = Field(
        description="Surrounding text context"
    )
    position_in_content: int = Field(
        ge=0,
        description="Character position of mention"
    )
    
    # Confidence and validation
    confidence_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence that this is a valid ticker mention"
    )
    is_ticker_validated: bool = Field(
        description="Whether ticker exists in market data"
    )
    validation_source: Optional[str] = Field(
        None,
        description="Source used for ticker validation"
    )
    
    # Sentiment context
    local_sentiment: Optional[str] = Field(
        None,
        description="Sentiment in immediate context"
    )
    sentiment_confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in sentiment classification"
    )
    
    # Temporal data
    mentioned_at: datetime = Field(description="When mention occurred")
    
    # Associated data
    post_score: Optional[int] = Field(None, description="Score of parent post")
    comment_score: Optional[int] = Field(
        None,
        description="Score of comment if applicable"
    )


class SubredditMetrics(BaseEntity):
    """Aggregated metrics for a specific subreddit."""
    
    subreddit_name: str = Field(description="Subreddit name")
    
    # Basic stats
    subscriber_count: int = Field(ge=0, description="Number of subscribers")
    active_users: int = Field(ge=0, description="Currently active users")
    
    # Activity metrics
    posts_per_day: float = Field(ge=0.0, description="Average posts per day")
    comments_per_day: float = Field(
        ge=0.0,
        description="Average comments per day"
    )
    
    # Quality indicators
    average_post_score: float = Field(description="Average post score")
    average_comment_score: float = Field(description="Average comment score")
    
    # Ticker-specific metrics
    ticker_mentions_per_day: float = Field(
        ge=0.0,
        description="Average ticker mentions per day"
    )
    unique_tickers_per_day: float = Field(
        ge=0.0,
        description="Average unique tickers mentioned per day"
    )
    
    # Bot activity
    estimated_bot_percentage: float = Field(
        ge=0.0,
        le=1.0,
        description="Estimated percentage of bot activity"
    )
    
    # Reputation
    subreddit_quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall subreddit quality score"
    )
    financial_relevance_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Relevance to financial discussions"
    )
    
    # Temporal data
    metrics_date: datetime = Field(description="Date of metrics calculation")
    last_updated: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last metrics update"
    )
