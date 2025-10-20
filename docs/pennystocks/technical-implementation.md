# PennyStocks Scan Service - Technical Implementation

## Implementation Strategy

This document provides detailed technical specifications for implementing the PennyStocks Scan Service, building upon the existing reddit-source architecture while introducing penny stock specific intelligence and risk management capabilities.

## Technology Stack

### Core Technologies
- **Language**: Python 3.11+
- **Web Framework**: FastAPI for API services
- **Database**: PostgreSQL with Supabase
- **Task Queue**: Redis for async processing
- **Monitoring**: Structured JSON logging

### AI/ML Components
- **OCR**: PaddleOCR for image text extraction
- **VLM**: Qwen2-VL for structured data extraction
- **NLP**: spaCy and transformers for text analysis
- **ML**: scikit-learn for classification and scoring

### Infrastructure
- **Containerization**: Docker for deployment
- **Orchestration**: Docker Compose for development
- **Monitoring**: Prometheus and Grafana
- **Alerting**: Custom webhook system

## Project Structure

```
ps-source-service/
├── src/
│   └── pennystocks_scanner/
│       ├── __init__.py
│       ├── config/
│       │   ├── __init__.py
│       │   └── settings.py
│       ├── ingestion/
│       │   ├── __init__.py
│       │   ├── reddit_client.py
│       │   ├── rate_limiter.py
│       │   └── deduplicator.py
│       ├── classification/
│       │   ├── __init__.py
│       │   ├── classifier.py
│       │   ├── content_detector.py
│       │   ├── ocr_processor.py
│       │   ├── vlm_analyzer.py
│       │   └── quality_scorer.py
│       ├── intelligence/
│       │   ├── __init__.py
│       │   ├── ticker_extractor.py
│       │   ├── manipulation_detector.py
│       │   ├── author_analyzer.py
│       │   └── market_validator.py
│       ├── signals/
│       │   ├── __init__.py
│       │   ├── signal_generator.py
│       │   ├── scoring_engine.py
│       │   └── performance_tracker.py
│       ├── integration/
│       │   ├── __init__.py
│       │   ├── volatility_integration.py
│       │   ├── rds_integration.py
│       │   └── market_data_client.py
│       ├── storage/
│       │   ├── __init__.py
│       │   ├── database.py
│       │   ├── models.py
│       │   └── repositories.py
│       ├── api/
│       │   ├── __init__.py
│       │   ├── routes.py
│       │   ├── models.py
│       │   └── dependencies.py
│       ├── monitoring/
│       │   ├── __init__.py
│       │   ├── monitor.py
│       │   ├── alerts.py
│       │   └── metrics.py
│       └── cli/
│           ├── __init__.py
│           └── commands.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── docs/
├── scripts/
├── requirements.txt
├── pyproject.toml
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## Core Implementation Details

### 1. Configuration Management

```python
# src/pennystocks_scanner/config/settings.py
from pydantic import BaseSettings, Field
from typing import List, Optional
from decimal import Decimal

class RedditConfig(BaseSettings):
    client_id: str = Field(..., env="REDDIT_CLIENT_ID")
    client_secret: str = Field(..., env="REDDIT_CLIENT_SECRET")
    user_agent: str = Field(..., env="REDDIT_USER_AGENT")
    
class SupabaseConfig(BaseSettings):
    url: str = Field(..., env="SUPABASE_URL")
    key: str = Field(..., env="SUPABASE_KEY")
    service_key: Optional[str] = Field(None, env="SUPABASE_SERVICE_KEY")

class PennyStocksConfig(BaseSettings):
    # Reddit settings
    reddit: RedditConfig = RedditConfig()
    
    # Database settings
    supabase: SupabaseConfig = SupabaseConfig()
    
    # Monitoring settings
    subreddits: List[str] = ["pennystocks", "RobinHoodPennyStocks"]
    polling_interval: int = 300  # 5 minutes
    max_posts_per_batch: int = 100
    
    # Penny stock criteria
    max_price_threshold: Decimal = Decimal("5.00")
    min_market_cap: int = 1_000_000  # $1M
    max_market_cap: int = 300_000_000  # $300M
    
    # Quality filters
    min_post_score: int = 5
    min_comment_count: int = 3
    min_author_karma: int = 100
    
    # Signal generation
    min_signal_strength: float = 0.6
    signal_expiry_days: int = 7
    
    # Processing limits
    max_concurrent_posts: int = 10
    processing_timeout: int = 120  # seconds
    
    class Config:
        env_file = ".env"
        case_sensitive = False

def get_config() -> PennyStocksConfig:
    return PennyStocksConfig()
```

### 2. Database Models

```python
# src/pennystocks_scanner/storage/models.py
from sqlalchemy import Column, String, Integer, Decimal, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class PennyStocksPost(Base):
    __tablename__ = "pennystocks_posts"
    __table_args__ = {"schema": "pennystocks_scanner"}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reddit_post_id = Column(String, unique=True, nullable=False)
    
    # Reddit metadata
    subreddit = Column(String, nullable=False, default="pennystocks")
    author = Column(String, nullable=False)
    created_utc = Column(Integer, nullable=False)
    created_datetime = Column(DateTime(timezone=True), nullable=False)
    title = Column(Text, nullable=False)
    content = Column(Text, default="")
    url = Column(Text)
    permalink = Column(Text, nullable=False)
    
    # Engagement metrics
    score = Column(Integer, default=0)
    upvote_ratio = Column(Decimal(4, 3), default=0.0)
    num_comments = Column(Integer, default=0)
    awards_count = Column(Integer, default=0)
    flair = Column(String)
    
    # Content analysis
    content_type = Column(String)  # dd, ta, news, discussion, meme, pump
    quality_tier = Column(String)  # premium, good, average, poor, spam
    confidence_score = Column(Decimal(5, 4), default=0.0)
    
    # Extracted data
    mentioned_tickers = Column(JSONB, default=list)
    validated_tickers = Column(JSONB, default=list)
    price_targets = Column(JSONB, default=dict)
    sentiment = Column(String)  # bullish, bearish, neutral
    investment_horizon = Column(String)  # intraday, swing, long
    
    # Image analysis
    has_images = Column(Boolean, default=False)
    image_urls = Column(JSONB, default=list)
    ocr_text = Column(Text)
    image_analysis = Column(JSONB, default=dict)
    
    # VLM extraction
    vlm_analysis = Column(JSONB, default=dict)
    structured_data = Column(JSONB, default=dict)
    
    # NLP analysis
    nlp_entities = Column(JSONB, default=list)
    key_phrases = Column(JSONB, default=list)
    sentiment_scores = Column(JSONB, default=dict)
    
    # Risk assessment
    manipulation_risk_score = Column(Decimal(5, 4), default=0.0)
    manipulation_risk_level = Column(String)  # LOW, MEDIUM, HIGH
    risk_factors = Column(JSONB, default=dict)
    
    # Processing metadata
    processing_status = Column(String, default="pending")
    processed_at = Column(DateTime(timezone=True))
    processing_duration_ms = Column(Integer)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PennyStocksSignal(Base):
    __tablename__ = "pennystocks_signals"
    __table_args__ = {"schema": "pennystocks_scanner"}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Signal identification
    ticker_symbol = Column(String(10), nullable=False)
    signal_type = Column(String, nullable=False)
    signal_strength = Column(Decimal(5, 4), nullable=False)
    signal_strength_category = Column(String)
    
    # Source analysis
    source_post_id = Column(UUID(as_uuid=True))
    source_posts_count = Column(Integer, nullable=False, default=1)
    unique_authors_count = Column(Integer, nullable=False, default=1)
    total_engagement_score = Column(Integer, nullable=False, default=0)
    quality_weighted_score = Column(Decimal(8, 4), nullable=False, default=0.0)
    
    # Component scores
    content_quality_score = Column(Decimal(5, 4), nullable=False)
    market_opportunity_score = Column(Decimal(5, 4), nullable=False)
    risk_assessment_score = Column(Decimal(5, 4), nullable=False)
    community_validation_score = Column(Decimal(5, 4), nullable=False)
    technical_confirmation_score = Column(Decimal(5, 4), nullable=False)
    
    # Market context
    current_price = Column(Decimal(12, 4), nullable=False)
    market_cap = Column(Integer)
    daily_volume = Column(Integer)
    avg_volume_20d = Column(Integer)
    price_change_24h = Column(Decimal(8, 4))
    
    # Risk assessment
    manipulation_risk_score = Column(Decimal(5, 4), nullable=False)
    liquidity_risk_score = Column(Decimal(5, 4), nullable=False)
    volatility_risk_score = Column(Decimal(5, 4), nullable=False)
    overall_risk_grade = Column(String(1))
    
    # Opportunity metrics
    opportunity_score = Column(Decimal(5, 4), nullable=False)
    opportunity_rank = Column(Integer)
    expected_return_7d = Column(Decimal(8, 4))
    confidence_interval = Column(Decimal(5, 4))
    
    # Integration data
    volatility_squeeze_signal = Column(JSONB, default=dict)
    technical_indicators = Column(JSONB, default=dict)
    rds_integration_status = Column(String, default="pending")
    
    # Lifecycle management
    signal_generated_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    deactivated_at = Column(DateTime(timezone=True))
    deactivation_reason = Column(String)
    
    # Performance tracking
    actual_return_1d = Column(Decimal(8, 4))
    actual_return_3d = Column(Decimal(8, 4))
    actual_return_7d = Column(Decimal(8, 4))
    max_drawdown = Column(Decimal(8, 4))
    max_gain = Column(Decimal(8, 4))
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AuthorProfile(Base):
    __tablename__ = "author_profiles"
    __table_args__ = {"schema": "pennystocks_scanner"}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False)
    
    # Reddit profile data
    account_created_utc = Column(Integer)
    comment_karma = Column(Integer, default=0)
    link_karma = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    
    # Performance tracking
    total_posts = Column(Integer, default=0)
    successful_predictions = Column(Integer, default=0)
    failed_predictions = Column(Integer, default=0)
    success_rate = Column(Decimal(5, 4), default=0.0)
    
    # Risk indicators
    pump_attempts = Column(Integer, default=0)
    spam_posts = Column(Integer, default=0)
    manipulation_score = Column(Decimal(5, 4), default=0.0)
    
    # Credibility metrics
    credibility_score = Column(Decimal(5, 4), default=0.5)
    expert_rating = Column(Decimal(5, 4), default=0.0)
    community_trust_score = Column(Decimal(5, 4), default=0.0)
    
    # Activity patterns
    avg_posts_per_day = Column(Decimal(6, 2), default=0.0)
    last_post_date = Column(DateTime(timezone=True))
    posting_pattern_score = Column(Decimal(5, 4), default=0.0)
    
    # Metadata
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

### 3. Reddit Ingestion Implementation

```python
# src/pennystocks_scanner/ingestion/reddit_client.py
import asyncio
import logging
from typing import AsyncGenerator, List, Optional
from datetime import datetime, timedelta
import praw
from praw.models import Submission

from ..config.settings import get_config
from .rate_limiter import IntelligentRateLimiter
from .deduplicator import ContentDeduplicator

logger = logging.getLogger(__name__)

class PennyStocksRedditClient:
    """
    Specialized Reddit client for r/pennystocks monitoring.
    Extends base reddit-source functionality with penny stock specific features.
    """
    
    def __init__(self):
        self.config = get_config()
        self.reddit = self._initialize_reddit_client()
        self.rate_limiter = IntelligentRateLimiter()
        self.deduplicator = ContentDeduplicator()
        
    def _initialize_reddit_client(self) -> praw.Reddit:
        """Initialize Reddit client with configuration."""
        return praw.Reddit(
            client_id=self.config.reddit.client_id,
            client_secret=self.config.reddit.client_secret,
            user_agent=self.config.reddit.user_agent,
            check_for_async=False
        )
    
    async def monitor_subreddit(self, subreddit: str = "pennystocks") -> AsyncGenerator[dict, None]:
        """
        Continuously monitor r/pennystocks for new posts.
        
        Args:
            subreddit: Subreddit name to monitor
            
        Yields:
            dict: Enriched post data
        """
        logger.info(f"Starting monitoring of r/{subreddit}")
        
        subreddit_obj = self.reddit.subreddit(subreddit)
        processed_ids = set()
        
        while True:
            try:
                # Rate limiting
                await self.rate_limiter.wait_if_needed()
                
                # Get new posts
                new_posts = list(subreddit_obj.new(limit=self.config.max_posts_per_batch))
                
                for submission in new_posts:
                    if submission.id not in processed_ids:
                        # Check for duplicates
                        if not await self.deduplicator.is_duplicate(submission):
                            post_data = await self._enrich_post_metadata(submission)
                            
                            if self._meets_initial_criteria(post_data):
                                processed_ids.add(submission.id)
                                yield post_data
                
                # Clean up old processed IDs
                if len(processed_ids) > 10000:
                    processed_ids = set(list(processed_ids)[-5000:])
                
                # Wait before next poll
                await asyncio.sleep(self.config.polling_interval)
                
            except Exception as e:
                logger.error(f"Error monitoring subreddit: {e}")
                await asyncio.sleep(60)  # Wait before retry
    
    async def fetch_historical_posts(self, days: int = 30, subreddit: str = "pennystocks") -> List[dict]:
        """
        Fetch historical posts for backtesting and analysis.
        
        Args:
            days: Number of days to look back
            subreddit: Subreddit name
            
        Returns:
            List[dict]: Historical post data
        """
        logger.info(f"Fetching {days} days of historical posts from r/{subreddit}")
        
        subreddit_obj = self.reddit.subreddit(subreddit)
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        posts = []
        
        try:
            for submission in subreddit_obj.new(limit=None):
                post_time = datetime.fromtimestamp(submission.created_utc)
                
                if post_time < cutoff_time:
                    break
                
                post_data = await self._enrich_post_metadata(submission)
                if self._meets_initial_criteria(post_data):
                    posts.append(post_data)
                
                # Rate limiting
                await self.rate_limiter.wait_if_needed()
        
        except Exception as e:
            logger.error(f"Error fetching historical posts: {e}")
        
        logger.info(f"Fetched {len(posts)} historical posts")
        return posts
    
    async def _enrich_post_metadata(self, submission: Submission) -> dict:
        """
        Add penny stock specific metadata to posts.
        
        Args:
            submission: Reddit submission object
            
        Returns:
            dict: Enriched post data
        """
        # Extract image URLs
        image_urls = []
        if hasattr(submission, 'preview') and 'images' in submission.preview:
            for image in submission.preview['images']:
                if 'source' in image:
                    image_urls.append(image['source']['url'])
        
        # Check for gallery posts
        if hasattr(submission, 'is_gallery') and submission.is_gallery:
            if hasattr(submission, 'media_metadata'):
                for item_id, media_item in submission.media_metadata.items():
                    if 's' in media_item and 'u' in media_item['s']:
                        image_urls.append(media_item['s']['u'])
        
        return {
            'reddit_post_id': submission.id,
            'subreddit': submission.subreddit.display_name,
            'author': submission.author.name if submission.author else '[deleted]',
            'created_utc': int(submission.created_utc),
            'created_datetime': datetime.fromtimestamp(submission.created_utc),
            'title': submission.title,
            'content': submission.selftext,
            'url': submission.url,
            'permalink': f"https://reddit.com{submission.permalink}",
            'score': submission.score,
            'upvote_ratio': submission.upvote_ratio,
            'num_comments': submission.num_comments,
            'flair': submission.link_flair_text,
            'has_images': len(image_urls) > 0,
            'image_urls': image_urls,
            'is_video': submission.is_video,
            'is_self': submission.is_self,
            'awards_count': len(submission.all_awardings) if hasattr(submission, 'all_awardings') else 0
        }
    
    def _meets_initial_criteria(self, post_data: dict) -> bool:
        """
        Check if post meets initial filtering criteria.
        
        Args:
            post_data: Post data dictionary
            
        Returns:
            bool: Whether post meets criteria
        """
        return (
            post_data['score'] >= self.config.min_post_score and
            post_data['num_comments'] >= self.config.min_comment_count and
            len(post_data['title']) > 10 and
            post_data['author'] != '[deleted]'
        )
```

### 4. Content Classification Implementation

```python
# src/pennystocks_scanner/classification/classifier.py
import asyncio
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

from .content_detector import ContentTypeDetector
from .ocr_processor import OCRProcessor
from .vlm_analyzer import VLMAnalyzer
from .quality_scorer import QualityScorer
from ..intelligence.nlp_processor import NLPProcessor

logger = logging.getLogger(__name__)

@dataclass
class ClassificationResult:
    content_type: str
    quality_score: float
    confidence: float
    ocr_data: Optional[Dict[str, Any]] = None
    vlm_data: Optional[Dict[str, Any]] = None
    nlp_data: Optional[Dict[str, Any]] = None
    processing_time_ms: int = 0

class ContentClassifier:
    """
    Multi-stage content classification system for penny stock posts.
    """
    
    def __init__(self):
        self.content_detector = ContentTypeDetector()
        self.ocr_processor = OCRProcessor()
        self.vlm_analyzer = VLMAnalyzer()
        self.nlp_processor = NLPProcessor()
        self.quality_scorer = QualityScorer()
        
    async def classify_post(self, post_data: dict) -> ClassificationResult:
        """
        Classify post through multiple stages:
        1. Content type detection (DD, TA, news, etc.)
        2. Quality assessment
        3. Manipulation risk scoring
        4. Ticker extraction and validation
        
        Args:
            post_data: Post data dictionary
            
        Returns:
            ClassificationResult: Comprehensive classification result
        """
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Stage 1: Basic content type classification
            content_type = await self.content_detector.detect_content_type(post_data)
            logger.debug(f"Detected content type: {content_type} for post {post_data['reddit_post_id']}")
            
            # Stage 2: OCR processing for images
            ocr_data = None
            if post_data.get('has_images', False) and post_data.get('image_urls'):
                try:
                    ocr_data = await self.ocr_processor.extract_text(post_data['image_urls'])
                    logger.debug(f"OCR extracted {len(ocr_data.get('text', ''))} characters")
                except Exception as e:
                    logger.warning(f"OCR processing failed: {e}")
            
            # Stage 3: VLM analysis for structured data extraction
            vlm_data = None
            if post_data.get('has_images') or content_type in ["dd", "ta"]:
                try:
                    vlm_data = await self.vlm_analyzer.extract_structured_data(
                        post_data, ocr_data
                    )
                    logger.debug(f"VLM extracted {len(vlm_data.get('entities', []))} entities")
                except Exception as e:
                    logger.warning(f"VLM analysis failed: {e}")
            
            # Stage 4: NLP processing for sentiment and entities
            text_content = f"{post_data['title']} {post_data.get('content', '')}"
            nlp_data = await self.nlp_processor.analyze_text(text_content)
            
            # Stage 5: Quality scoring
            quality_score = await self.quality_scorer.calculate_score(
                post_data, content_type, ocr_data, vlm_data, nlp_data
            )
            
            # Calculate confidence based on available data and consistency
            confidence = self._calculate_confidence(
                content_type, quality_score, ocr_data, vlm_data, nlp_data
            )
            
            processing_time = int((asyncio.get_event_loop().time() - start_time) * 1000)
            
            return ClassificationResult(
                content_type=content_type,
                quality_score=quality_score,
                confidence=confidence,
                ocr_data=ocr_data,
                vlm_data=vlm_data,
                nlp_data=nlp_data,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            logger.error(f"Classification failed for post {post_data['reddit_post_id']}: {e}")
            return ClassificationResult(
                content_type="unknown",
                quality_score=0.0,
                confidence=0.0,
                processing_time_ms=int((asyncio.get_event_loop().time() - start_time) * 1000)
            )
    
    def _calculate_confidence(
        self, 
        content_type: str, 
        quality_score: float,
        ocr_data: Optional[Dict],
        vlm_data: Optional[Dict],
        nlp_data: Optional[Dict]
    ) -> float:
        """
        Calculate confidence score based on data availability and consistency.
        
        Args:
            content_type: Detected content type
            quality_score: Quality assessment score
            ocr_data: OCR extraction results
            vlm_data: VLM analysis results
            nlp_data: NLP processing results
            
        Returns:
            float: Confidence score (0.0 to 1.0)
        """
        confidence_factors = []
        
        # Base confidence from content type detection
        if content_type != "unknown":
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.3)
        
        # Quality score contribution
        confidence_factors.append(quality_score)
        
        # Data availability bonus
        if ocr_data and ocr_data.get('text'):
            confidence_factors.append(0.8)
        
        if vlm_data and vlm_data.get('entities'):
            confidence_factors.append(0.9)
        
        if nlp_data and nlp_data.get('sentiment'):
            confidence_factors.append(0.8)
        
        # Calculate weighted average
        if confidence_factors:
            return sum(confidence_factors) / len(confidence_factors)
        else:
            return 0.5  # Default medium confidence
```

### 5. Signal Generation Implementation

```python
# src/pennystocks_scanner/signals/signal_generator.py
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass

from .scoring_engine import ScoringEngine
from ..intelligence.risk_assessor import RiskAssessor
from ..integration.technical_analyzer import TechnicalAnalyzer
from .performance_tracker import PerformanceTracker

logger = logging.getLogger(__name__)

@dataclass
class PennyStockSignal:
    ticker_symbol: str
    signal_strength: float
    signal_type: str
    source_post_id: str
    component_scores: Dict[str, float]
    risk_assessment: Dict[str, Any]
    market_data: Dict[str, Any]
    expires_at: datetime
    
    @property
    def signal_strength_category(self) -> str:
        if self.signal_strength >= 0.9:
            return "very_strong"
        elif self.signal_strength >= 0.8:
            return "strong"
        elif self.signal_strength >= 0.7:
            return "moderate"
        else:
            return "weak"

class SignalGenerator:
    """
    Generate trading signals based on multi-dimensional analysis.
    """
    
    def __init__(self):
        self.scoring_engine = ScoringEngine()
        self.risk_assessor = RiskAssessor()
        self.technical_analyzer = TechnicalAnalyzer()
        self.performance_tracker = PerformanceTracker()
        
    async def generate_signal(
        self, 
        post_data: dict, 
        classification_result: Any,
        validated_tickers: List[Dict[str, Any]],
        manipulation_risk: Dict[str, Any]
    ) -> Optional[PennyStockSignal]:
        """
        Generate a comprehensive trading signal.
        
        Args:
            post_data: Original post data
            classification_result: Content classification results
            validated_tickers: List of validated ticker symbols
            manipulation_risk: Risk assessment results
            
        Returns:
            Optional[PennyStockSignal]: Generated signal or None
        """
        
        if not validated_tickers or manipulation_risk.get('risk_level') == "HIGH":
            logger.debug(f"Skipping signal generation: no tickers or high risk")
            return None
        
        primary_ticker = validated_tickers[0]  # Focus on primary ticker
        ticker_symbol = primary_ticker['symbol']
        
        logger.info(f"Generating signal for {ticker_symbol}")
        
        try:
            # Calculate component scores
            content_quality_score = await self._calculate_content_quality_score(
                post_data, classification_result
            )
            
            market_opportunity_score = await self._calculate_market_opportunity_score(
                primary_ticker, post_data
            )
            
            community_validation_score = await self._calculate_community_validation_score(
                ticker_symbol, post_data
            )
            
            technical_confirmation_score = await self._calculate_technical_confirmation_score(
                ticker_symbol
            )
            
            risk_assessment_score = 1.0 - manipulation_risk.get('overall_score', 0.5)
            
            # Apply weighted scoring formula
            final_score = (
                content_quality_score * 0.25 +
                market_opportunity_score * 0.30 +
                risk_assessment_score * 0.20 +
                community_validation_score * 0.15 +
                technical_confirmation_score * 0.10
            )
            
            # Apply confidence multiplier
            confidence_multiplier = self._calculate_confidence_multiplier(
                classification_result.confidence, 
                manipulation_risk.get('confidence', 0.5)
            )
            
            final_score *= confidence_multiplier
            
            logger.debug(f"Signal scores for {ticker_symbol}: "
                        f"content={content_quality_score:.3f}, "
                        f"market={market_opportunity_score:.3f}, "
                        f"risk={risk_assessment_score:.3f}, "
                        f"community={community_validation_score:.3f}, "
                        f"technical={technical_confirmation_score:.3f}, "
                        f"final={final_score:.3f}")
            
            # Generate signal if score meets threshold
            if final_score >= 0.6:  # Minimum signal threshold
                signal = PennyStockSignal(
                    ticker_symbol=ticker_symbol,
                    signal_strength=final_score,
                    signal_type=self._determine_signal_type(
                        classification_result, market_opportunity_score
                    ),
                    source_post_id=post_data['reddit_post_id'],
                    component_scores={
                        "content_quality": content_quality_score,
                        "market_opportunity": market_opportunity_score,
                        "risk_assessment": risk_assessment_score,
                        "community_validation": community_validation_score,
                        "technical_confirmation": technical_confirmation_score
                    },
                    risk_assessment=manipulation_risk,
                    market_data=primary_ticker.get('market_data', {}),
                    expires_at=datetime.utcnow() + timedelta(days=7)
                )
                
                # Track signal for performance analysis
                await self.performance_tracker.track_signal(signal)
                
                logger.info(f"Generated {signal.signal_strength_category} signal for {ticker_symbol} "
                           f"with strength {final_score:.3f}")
                
                return signal
            else:
                logger.debug(f"Signal strength {final_score:.3f} below threshold for {ticker_symbol}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating signal for {ticker_symbol}: {e}")
            return None
    
    async def _calculate_content_quality_score(
        self, post_data: dict, classification_result: Any
    ) -> float:
        """Calculate content quality component score."""
        return await self.scoring_engine.calculate_content_quality(
            post_data, classification_result
        )
    
    async def _calculate_market_opportunity_score(
        self, ticker_data: Dict[str, Any], post_data: dict
    ) -> float:
        """Calculate market opportunity component score."""
        return await self.scoring_engine.calculate_market_opportunity(
            ticker_data, post_data
        )
    
    async def _calculate_community_validation_score(
        self, ticker_symbol: str, post_data: dict
    ) -> float:
        """Calculate community validation component score."""
        return await self.scoring_engine.calculate_community_validation(
            ticker_symbol, post_data
        )
    
    async def _calculate_technical_confirmation_score(
        self, ticker_symbol: str
    ) -> float:
        """Calculate technical confirmation component score."""
        return await self.technical_analyzer.get_confirmation_score(ticker_symbol)
    
    def _calculate_confidence_multiplier(
        self, classification_confidence: float, risk_confidence: float
    ) -> float:
        """Calculate confidence multiplier for final score."""
        avg_confidence = (classification_confidence + risk_confidence) / 2
        # Scale confidence to multiplier range (0.8 to 1.2)
        return 0.8 + (avg_confidence * 0.4)
    
    def _determine_signal_type(
        self, classification_result: Any, market_opportunity_score: float
    ) -> str:
        """Determine signal type based on analysis results."""
        content_type = classification_result.content_type
        
        if content_type == "dd" and market_opportunity_score > 0.7:
            return "value"
        elif content_type == "ta" and market_opportunity_score > 0.8:
            return "breakout"
        elif market_opportunity_score > 0.8:
            return "momentum"
        elif content_type in ["news", "dd"]:
            return "catalyst"
        else:
            return "momentum"
```

## Deployment Configuration

### Docker Configuration

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Set Python path
ENV PYTHONPATH=/app/src

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Default command
CMD ["python", "-m", "pennystocks_scanner.cli", "serve"]
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  pennystocks-scanner:
    build: .
    environment:
      - REDDIT_CLIENT_ID=${REDDIT_CLIENT_ID}
      - REDDIT_CLIENT_SECRET=${REDDIT_CLIENT_SECRET}
      - REDDIT_USER_AGENT=${REDDIT_USER_AGENT}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    ports:
      - "8000:8000"
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    depends_on:
      - redis
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped
    
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    restart: unless-stopped

volumes:
  redis_data:
  prometheus_data:
  grafana_data:
```

## Testing Strategy

### Unit Testing Framework

```python
# tests/unit/test_signal_generator.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal

from src.pennystocks_scanner.signals.signal_generator import SignalGenerator, PennyStockSignal

@pytest.fixture
def signal_generator():
    generator = SignalGenerator()
    generator.scoring_engine = AsyncMock()
    generator.risk_assessor = AsyncMock()
    generator.technical_analyzer = AsyncMock()
    generator.performance_tracker = AsyncMock()
    return generator

@pytest.fixture
def sample_post_data():
    return {
        'reddit_post_id': 'test123',
        'title': 'Great DD on TICKER - undervalued gem!',
        'content': 'This is a comprehensive analysis...',
        'author': 'test_user',
        'score': 50,
        'num_comments': 25
    }

@pytest.fixture
def sample_classification():
    mock_classification = MagicMock()
    mock_classification.content_type = 'dd'
    mock_classification.confidence = 0.8
    return mock_classification

@pytest.fixture
def sample_validated_tickers():
    return [{
        'symbol': 'TEST',
        'context_score': 0.9,
        'market_data': {
            'price': Decimal('2.50'),
            'market_cap': 50_000_000,
            'volume': 1_000_000
        }
    }]

@pytest.fixture
def sample_manipulation_risk():
    return {
        'overall_score': 0.2,
        'risk_level': 'LOW',
        'confidence': 0.8
    }

@pytest.mark.asyncio
async def test_generate_signal_success(
    signal_generator, 
    sample_post_data, 
    sample_classification,
    sample_validated_tickers,
    sample_manipulation_risk
):
    """Test successful signal generation."""
    # Mock component scores
    signal_generator.scoring_engine.calculate_content_quality.return_value = 0.8
    signal_generator.scoring_engine.calculate_market_opportunity.return_value = 0.7
    signal_generator.scoring_engine.calculate_community_validation.return_value = 0.6
    signal_generator.technical_analyzer.get_confirmation_score.return_value = 0.5
    
    # Generate signal
    signal = await signal_generator.generate_signal(
        sample_post_data,
        sample_classification,
        sample_validated_tickers,
        sample_manipulation_risk
    )
    
    # Assertions
    assert signal is not None
    assert signal.ticker_symbol == 'TEST'
    assert signal.signal_strength >= 0.6
    assert signal.signal_type in ['value', 'breakout', 'momentum', 'catalyst']
    assert signal.source_post_id == 'test123'

@pytest.mark.asyncio
async def test_generate_signal_high_risk_rejection(
    signal_generator,
    sample_post_data,
    sample_classification,
    sample_validated_tickers
):
    """Test signal rejection for high manipulation risk."""
    high_risk = {
        'overall_score': 0.9,
        'risk_level': 'HIGH',
        'confidence': 0.8
    }
    
    signal = await signal_generator.generate_signal(
        sample_post_data,
        sample_classification,
        sample_validated_tickers,
        high_risk
    )
    
    assert signal is None

@pytest.mark.asyncio
async def test_generate_signal_no_tickers(
    signal_generator,
    sample_post_data,
    sample_classification,
    sample_manipulation_risk
):
    """Test signal rejection when no validated tickers."""
    signal = await signal_generator.generate_signal(
        sample_post_data,
        sample_classification,
        [],  # No tickers
        sample_manipulation_risk
    )
    
    assert signal is None
```

This technical implementation provides a comprehensive foundation for building the PennyStocks Scan Service with production-ready code, proper testing, and deployment configurations.
