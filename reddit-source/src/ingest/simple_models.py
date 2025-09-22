"""Simplified Pydantic models for the single table RDS approach."""

from datetime import datetime
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field, validator


class RDSDataSource(BaseModel):
    """Simplified Reddit Data Source model for the single table approach."""
    
    # Primary identifiers
    post_id: str
    
    # Reddit post metadata
    subreddit: str
    author: Optional[str] = None
    created_utc: int
    created_datetime: Optional[datetime] = None
    title: str
    selftext: str = ""
    permalink: str
    url: Optional[str] = None
    
    # Post metrics
    score: int = 0
    upvote_ratio: float = 0.0
    num_comments: int = 0
    flair: Optional[str] = None
    
    # Content classification
    is_image: bool = False
    is_video: bool = False
    is_self: bool = False
    image_path: Optional[str] = None
    
    # Extracted data
    tickers: List[str] = Field(default_factory=list)
    sentiment: Optional[Literal["bull", "bear", "neutral"]] = None
    horizon: Optional[Literal["intraday", "swing", "long"]] = None
    claims: List[str] = Field(default_factory=list)
    numeric_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Image analysis
    image_type: Optional[Literal["chart", "pnl", "slide", "meme", "other"]] = None
    ocr_text: Optional[str] = None
    
    # Quality and confidence
    confidence_score: float = 0.0
    quality_tier: str = "unprocessed"
    
    # Market data
    market_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Processing status
    processed_at: Optional[datetime] = None
    processing_status: str = "pending"
    error_message: Optional[str] = None
    
    @validator("created_datetime", pre=True, always=True)
    def set_created_datetime(cls, v, values):
        """Set created_datetime from created_utc if not provided."""
        if v is None and "created_utc" in values:
            return datetime.fromtimestamp(values["created_utc"])
        return v
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


def convert_post_core_to_rds(post_core) -> RDSDataSource:
    """Convert a PostCore model to RDSDataSource model."""
    return RDSDataSource(
        post_id=post_core.post_id,
        subreddit=post_core.subreddit,
        author=post_core.author,
        created_utc=post_core.created_utc,
        created_datetime=post_core.created_datetime,
        title=post_core.title,
        selftext=post_core.selftext,
        permalink=post_core.permalink,
        url=post_core.url,
        score=post_core.score,
        upvote_ratio=post_core.upvote_ratio,
        num_comments=post_core.num_comments,
        flair=post_core.flair,
        is_image=post_core.is_image,
        is_video=post_core.is_video,
        is_self=post_core.is_self,
        image_path=post_core.image_path
    )
