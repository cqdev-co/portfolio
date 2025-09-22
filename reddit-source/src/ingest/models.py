"""Pydantic models for Reddit data ingestion and processing."""

from datetime import datetime
from typing import Dict, List, Literal, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator


class PostCore(BaseModel):
    """Core Reddit post data model."""
    
    id: UUID = Field(default_factory=uuid4, description="Internal unique identifier")
    post_id: str = Field(..., description="Reddit post ID")
    subreddit: str = Field(..., description="Subreddit name")
    author: Optional[str] = Field(None, description="Post author username")
    created_utc: int = Field(..., description="Post creation timestamp (UTC)")
    created_datetime: datetime = Field(..., description="Post creation datetime")
    title: str = Field(..., description="Post title")
    selftext: str = Field(default="", description="Post self text content")
    permalink: str = Field(..., description="Reddit permalink")
    url: Optional[str] = Field(None, description="External URL if present")
    score: int = Field(default=0, description="Post score (upvotes - downvotes)")
    upvote_ratio: float = Field(default=0.0, description="Upvote ratio")
    num_comments: int = Field(default=0, description="Number of comments")
    flair: Optional[str] = Field(None, description="Post flair text")
    is_image: bool = Field(default=False, description="Whether post contains image")
    is_video: bool = Field(default=False, description="Whether post contains video")
    is_self: bool = Field(default=False, description="Whether post is self post")
    is_nsfw: bool = Field(default=False, description="Whether post is NSFW")
    is_spoiler: bool = Field(default=False, description="Whether post is spoiler")
    image_path: Optional[str] = Field(None, description="Local image file path")
    image_hash: Optional[str] = Field(None, description="Perceptual hash of image")
    
    # Processing metadata
    ingested_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = Field(None)
    processing_status: Literal["pending", "processing", "completed", "failed"] = (
        Field(default="pending")
    )
    processing_error: Optional[str] = Field(None)
    
    @validator("created_datetime", pre=True, always=True)
    def set_created_datetime(cls, v, values):
        """Set created_datetime from created_utc if not provided."""
        if v is None and "created_utc" in values:
            return datetime.fromtimestamp(values["created_utc"])
        return v
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class ImageExtraction(BaseModel):
    """Structured data extracted from images using VLM."""
    
    post_id: str = Field(..., description="Associated Reddit post ID")
    image_type: Optional[Literal["chart", "pnl", "slide", "meme", "other"]] = (
        Field(None, description="Classified image type")
    )
    primary_ticker: Optional[str] = Field(
        None, 
        description="Primary ticker symbol identified"
    )
    tickers: List[str] = Field(
        default_factory=list, 
        description="All ticker symbols found"
    )
    timeframe: Optional[Literal["1m", "5m", "15m", "1h", "4h", "D", "W", "M"]] = (
        Field(None, description="Chart timeframe if applicable")
    )
    stance: Optional[Literal["bull", "bear", "neutral"]] = Field(
        None, 
        description="Trading stance/sentiment"
    )
    horizon: Optional[Literal["intraday", "swing", "long"]] = Field(
        None, 
        description="Investment time horizon"
    )
    claims: List[str] = Field(
        default_factory=list, 
        description="Factual claims extracted from image"
    )
    numeric: Dict[str, float] = Field(
        default_factory=dict, 
        description="Numeric values (entry, stop, target, etc.)"
    )
    platform: Optional[str] = Field(
        None, 
        description="Trading platform identified"
    )
    field_confidence: Dict[str, float] = Field(
        default_factory=dict, 
        description="Confidence scores for each extracted field"
    )
    
    # Processing metadata
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    model_used: Optional[str] = Field(None, description="VLM model used")
    processing_time_ms: Optional[float] = Field(
        None, 
        description="Processing time in milliseconds"
    )
    
    class Config:
        use_enum_values = True


class TextExtraction(BaseModel):
    """Structured data extracted from post text."""
    
    post_id: str = Field(..., description="Associated Reddit post ID")
    tickers: List[str] = Field(
        default_factory=list, 
        description="Ticker symbols found in text"
    )
    stance: Optional[Literal["bull", "bear", "neutral"]] = Field(
        None, 
        description="Sentiment/stance from text"
    )
    horizon: Optional[Literal["intraday", "swing", "long"]] = Field(
        None, 
        description="Investment horizon from text"
    )
    claims: List[str] = Field(
        default_factory=list, 
        description="Key claims from text"
    )
    confidence: float = Field(
        default=0.0, 
        description="Overall extraction confidence"
    )
    sentiment_score: float = Field(
        default=0.0, 
        description="Sentiment score (-1 to 1)"
    )
    entities: Dict[str, List[str]] = Field(
        default_factory=dict, 
        description="Named entities extracted"
    )
    
    # Processing metadata
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class MarketEnrichment(BaseModel):
    """Market data enrichment for posts."""
    
    post_id: str = Field(..., description="Associated Reddit post ID")
    ticker: str = Field(..., description="Ticker symbol")
    price_at_post: Optional[float] = Field(
        None, 
        description="Stock price at post time"
    )
    volume_at_post: Optional[float] = Field(
        None, 
        description="Volume at post time"
    )
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    iv_rank_at_post: Optional[float] = Field(
        None, 
        description="Implied volatility rank at post time"
    )
    earnings_window: Optional[int] = Field(
        None, 
        description="Days until/since earnings"
    )
    
    # Forward returns (computed nightly)
    fwd_1d_ret: Optional[float] = Field(
        None, 
        description="1-day forward return"
    )
    fwd_5d_ret: Optional[float] = Field(
        None, 
        description="5-day forward return"
    )
    fwd_10d_ret: Optional[float] = Field(
        None, 
        description="10-day forward return"
    )
    fwd_30d_ret: Optional[float] = Field(
        None, 
        description="30-day forward return"
    )
    
    # Processing metadata
    enriched_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class QualityScore(BaseModel):
    """Quality scoring for posts."""
    
    post_id: str = Field(..., description="Associated Reddit post ID")
    
    # Component scores (0-1)
    content_score: float = Field(
        default=0.0, 
        description="Content quality score"
    )
    image_signal_score: float = Field(
        default=0.0, 
        description="Image signal strength score"
    )
    evidence_score: float = Field(
        default=0.0, 
        description="Evidence/proof score"
    )
    crosscheck_score: float = Field(
        default=0.0, 
        description="Cross-validation score"
    )
    engagement_score: float = Field(
        default=0.0, 
        description="Community engagement score"
    )
    
    # Overall scores
    value_score: float = Field(
        default=0.0, 
        description="Overall value score (0-1)"
    )
    quality_tier: Literal["valuable", "soft_quarantine", "hard_drop"] = Field(
        default="hard_drop", 
        description="Quality classification"
    )
    
    # Flags
    is_duplicate: bool = Field(default=False, description="Duplicate content flag")
    is_spam: bool = Field(default=False, description="Spam flag")
    has_ticker_verified: bool = Field(
        default=False, 
        description="Ticker verification flag"
    )
    has_market_sanity: bool = Field(
        default=False, 
        description="Market data sanity check flag"
    )
    
    # Processing metadata
    scored_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class RedditFeatures(BaseModel):
    """Aggregated Reddit features for scanner integration."""
    
    ticker: str = Field(..., description="Ticker symbol")
    bucket_2h: datetime = Field(..., description="2-hour time bucket")
    
    # Volume metrics
    post_count: int = Field(default=0, description="Number of posts")
    unique_authors: int = Field(default=0, description="Unique author count")
    total_score: int = Field(default=0, description="Sum of post scores")
    total_comments: int = Field(default=0, description="Sum of comment counts")
    
    # Sentiment metrics
    bull_count: int = Field(default=0, description="Bullish posts count")
    bear_count: int = Field(default=0, description="Bearish posts count")
    neutral_count: int = Field(default=0, description="Neutral posts count")
    bull_pct: float = Field(default=0.0, description="Bullish percentage")
    avg_sentiment: float = Field(default=0.0, description="Average sentiment")
    
    # Quality metrics
    valuable_count: int = Field(default=0, description="Valuable posts count")
    has_tradeplan: bool = Field(
        default=False, 
        description="Contains trade plan flag"
    )
    has_chart: bool = Field(default=False, description="Contains chart flag")
    has_pnl: bool = Field(default=False, description="Contains P&L flag")
    
    # Buzz metrics
    buzz_score: float = Field(default=0.0, description="Raw buzz score")
    buzz_z: float = Field(default=0.0, description="Z-scored buzz metric")
    
    # Processing metadata
    computed_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        use_enum_values = True


class ProcessingJob(BaseModel):
    """Processing job tracking."""
    
    id: UUID = Field(default_factory=uuid4)
    job_type: Literal["ingest", "ocr", "vlm", "enrich", "aggregate"] = Field(
        ..., 
        description="Type of processing job"
    )
    status: Literal["pending", "running", "completed", "failed"] = Field(
        default="pending"
    )
    post_ids: List[str] = Field(
        default_factory=list, 
        description="Post IDs being processed"
    )
    started_at: Optional[datetime] = Field(None)
    completed_at: Optional[datetime] = Field(None)
    error_message: Optional[str] = Field(None)
    progress: float = Field(default=0.0, description="Progress percentage")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }
