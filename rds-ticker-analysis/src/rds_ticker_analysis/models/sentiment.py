"""Sentiment analysis models."""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, validator

from rds_ticker_analysis.models.base import BaseEntity


class SentimentLabel(str, Enum):
    """Sentiment classification labels."""
    VERY_BULLISH = "very_bullish"
    BULLISH = "bullish"
    SLIGHTLY_BULLISH = "slightly_bullish"
    NEUTRAL = "neutral"
    SLIGHTLY_BEARISH = "slightly_bearish"
    BEARISH = "bearish"
    VERY_BEARISH = "very_bearish"


class EmotionLabel(str, Enum):
    """Emotion classification labels."""
    JOY = "joy"
    ANGER = "anger"
    FEAR = "fear"
    SADNESS = "sadness"
    SURPRISE = "surprise"
    DISGUST = "disgust"
    TRUST = "trust"
    ANTICIPATION = "anticipation"


class InvestmentHorizon(str, Enum):
    """Investment time horizon classifications."""
    INTRADAY = "intraday"
    SWING = "swing"  # Days to weeks
    MEDIUM_TERM = "medium_term"  # Weeks to months
    LONG_TERM = "long_term"  # Months to years
    UNKNOWN = "unknown"


class ContentClassification(BaseModel):
    """Content classification and quality assessment."""
    
    # Content type classification
    is_due_diligence: bool = Field(
        description="Whether content contains due diligence"
    )
    is_technical_analysis: bool = Field(
        description="Whether content contains technical analysis"
    )
    is_news_discussion: bool = Field(
        description="Whether content discusses news"
    )
    is_earnings_related: bool = Field(
        description="Whether content is earnings-related"
    )
    is_meme_content: bool = Field(
        description="Whether content is meme/joke"
    )
    is_pump_attempt: bool = Field(
        description="Whether content appears to be pump attempt"
    )
    
    # Quality indicators
    has_supporting_evidence: bool = Field(
        description="Whether claims have supporting evidence"
    )
    has_financial_data: bool = Field(
        description="Whether content includes financial data"
    )
    has_price_targets: bool = Field(
        description="Whether content includes price targets"
    )
    has_risk_discussion: bool = Field(
        description="Whether content discusses risks"
    )
    
    # Investment context
    investment_horizon: InvestmentHorizon = Field(
        description="Implied investment time horizon"
    )
    position_type: Optional[str] = Field(
        None,
        description="Type of position discussed (calls, puts, shares, etc.)"
    )
    
    # Confidence scores
    classification_confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in content classification"
    )
    quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall content quality score"
    )


class SentimentScore(BaseModel):
    """Detailed sentiment scoring."""
    
    # Primary sentiment
    label: SentimentLabel = Field(description="Primary sentiment label")
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in sentiment classification"
    )
    
    # Numerical scores
    polarity: float = Field(
        ge=-1.0,
        le=1.0,
        description="Sentiment polarity (-1 to 1)"
    )
    subjectivity: float = Field(
        ge=0.0,
        le=1.0,
        description="Subjectivity score (0 to 1)"
    )
    
    # Intensity
    intensity: float = Field(
        ge=0.0,
        le=1.0,
        description="Sentiment intensity (0 to 1)"
    )
    
    # Method-specific scores
    vader_compound: float = Field(
        ge=-1.0,
        le=1.0,
        description="VADER compound sentiment score"
    )
    textblob_polarity: float = Field(
        ge=-1.0,
        le=1.0,
        description="TextBlob polarity score"
    )
    
    @validator('confidence', 'intensity', 'subjectivity')
    def validate_zero_to_one(cls, v: float) -> float:
        """Ensure scores are between 0 and 1."""
        return max(0.0, min(1.0, v))
    
    @validator('polarity', 'vader_compound', 'textblob_polarity')
    def validate_negative_one_to_one(cls, v: float) -> float:
        """Ensure scores are between -1 and 1."""
        return max(-1.0, min(1.0, v))


class EmotionAnalysis(BaseModel):
    """Emotion detection and scoring."""
    
    # Primary emotion
    primary_emotion: EmotionLabel = Field(
        description="Dominant emotion detected"
    )
    emotion_confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in emotion detection"
    )
    
    # Emotion scores
    emotion_scores: Dict[EmotionLabel, float] = Field(
        description="Scores for each emotion category"
    )
    
    # Emotional intensity
    emotional_intensity: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall emotional intensity"
    )
    
    # Market-relevant emotions
    fear_greed_index: float = Field(
        ge=0.0,
        le=1.0,
        description="Fear vs greed indicator (0=fear, 1=greed)"
    )
    fomo_indicator: float = Field(
        ge=0.0,
        le=1.0,
        description="Fear of missing out indicator"
    )
    panic_indicator: float = Field(
        ge=0.0,
        le=1.0,
        description="Panic/urgency indicator"
    )


class SentimentAnalysis(BaseEntity):
    """Complete sentiment analysis for a piece of content."""
    
    # Source identification
    content_id: str = Field(description="ID of analyzed content")
    content_type: str = Field(description="Type of content (post/comment)")
    ticker_symbol: str = Field(description="Ticker being analyzed")
    
    # Content metadata
    analyzed_text: str = Field(description="Text that was analyzed")
    text_length: int = Field(ge=0, description="Length of analyzed text")
    language: str = Field(default="en", description="Detected language")
    
    # Sentiment analysis
    sentiment: SentimentScore = Field(description="Sentiment analysis results")
    emotion: EmotionAnalysis = Field(description="Emotion analysis results")
    classification: ContentClassification = Field(
        description="Content classification results"
    )
    
    # Context and keywords
    key_phrases: List[str] = Field(
        default_factory=list,
        description="Key phrases extracted from content"
    )
    financial_keywords: List[str] = Field(
        default_factory=list,
        description="Financial keywords found"
    )
    ticker_context_words: List[str] = Field(
        default_factory=list,
        description="Words surrounding ticker mention"
    )
    
    # Price and target information
    mentioned_price_targets: List[float] = Field(
        default_factory=list,
        description="Price targets mentioned in content"
    )
    mentioned_support_levels: List[float] = Field(
        default_factory=list,
        description="Support levels mentioned"
    )
    mentioned_resistance_levels: List[float] = Field(
        default_factory=list,
        description="Resistance levels mentioned"
    )
    
    # Quality and reliability
    content_quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall content quality assessment"
    )
    reliability_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Reliability of sentiment analysis"
    )
    
    # Processing metadata
    analysis_timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="When analysis was performed"
    )
    model_version: str = Field(
        description="Version of sentiment analysis model used"
    )
    processing_time_ms: int = Field(
        ge=0,
        description="Time taken for analysis in milliseconds"
    )
