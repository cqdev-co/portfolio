# PennyStocks Scan Service - Technical Implementation Guide

## Architecture Overview

The PennyStocks Scan Service follows a modular, event-driven architecture that extends the proven patterns from the existing reddit-source service. The system is designed for high throughput, reliability, and seamless integration with existing portfolio components.

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PennyStocks Scan Service                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Reddit    │    │   Content    │    │ Intelligence│    │   Signal    │ │
│  │  Ingestion  │───▶│Classification│───▶│   Engine    │───▶│ Generation  │ │
│  │   Engine    │    │   Pipeline   │    │             │    │   System    │ │
│  └─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘ │
│         │                   │                   │                   │       │
│         ▼                   ▼                   ▼                   ▼       │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        Supabase Database                               │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │ Posts Table │  │Author Scores│  │Signal Cache │  │Performance  │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                       │
├─────────────────────────────────────┼─────────────────────────────────────────┤
│                Integration Layer    │                                       │
│                                     ▼                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ Volatility  │    │    RDS      │    │   Market    │    │    Alert    │ │
│  │  Scanner    │    │   Ticker    │    │    Data     │    │   System    │ │
│  │Integration  │    │  Analysis   │    │   Service   │    │             │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Reddit Ingestion Engine

#### Architecture
```python
# src/pennystocks_scanner/ingestion/reddit_client.py
class PennyStocksRedditClient:
    """
    Specialized Reddit client for r/pennystocks monitoring.
    Extends base reddit-source functionality with penny stock specific features.
    """
    
    def __init__(self, config: PennyStocksConfig):
        self.config = config
        self.reddit = self._initialize_reddit_client()
        self.rate_limiter = IntelligentRateLimiter()
        self.deduplicator = ContentDeduplicator()
        
    async def monitor_subreddit(self, subreddit: str = "pennystocks") -> AsyncGenerator[RedditPost, None]:
        """Continuously monitor r/pennystocks for new posts."""
        
    async def fetch_historical_posts(self, days: int = 30) -> List[RedditPost]:
        """Fetch historical posts for backtesting and analysis."""
        
    async def enrich_post_metadata(self, post: RedditPost) -> EnrichedPost:
        """Add penny stock specific metadata to posts."""
```

#### Key Features
- **Intelligent Rate Limiting**: Adaptive rate limiting based on Reddit API response headers
- **Content Deduplication**: Advanced similarity detection to prevent duplicate processing
- **Historical Analysis**: Ability to fetch and analyze historical posts for pattern recognition
- **Error Recovery**: Robust error handling with exponential backoff and circuit breakers

#### Configuration
```python
# src/pennystocks_scanner/config/settings.py
class PennyStocksConfig:
    # Reddit API settings
    reddit_client_id: str
    reddit_client_secret: str
    reddit_user_agent: str
    
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
```

### 2. Content Classification Pipeline

#### Multi-Stage Classification System

```python
# src/pennystocks_scanner/classification/classifier.py
class ContentClassifier:
    """
    Multi-stage content classification system for penny stock posts.
    """
    
    def __init__(self):
        self.ocr_processor = OCRProcessor()
        self.vlm_analyzer = VLMAnalyzer()
        self.nlp_processor = NLPProcessor()
        self.quality_scorer = QualityScorer()
        
    async def classify_post(self, post: EnrichedPost) -> ClassificationResult:
        """
        Classify post through multiple stages:
        1. Content type detection (DD, TA, news, etc.)
        2. Quality assessment
        3. Manipulation risk scoring
        4. Ticker extraction and validation
        """
        
        # Stage 1: Basic content type classification
        content_type = await self._classify_content_type(post)
        
        # Stage 2: OCR processing for images
        ocr_data = None
        if post.has_images:
            ocr_data = await self.ocr_processor.extract_text(post.image_urls)
            
        # Stage 3: VLM analysis for structured data extraction
        vlm_data = None
        if post.has_images or content_type in ["dd", "ta"]:
            vlm_data = await self.vlm_analyzer.extract_structured_data(post, ocr_data)
            
        # Stage 4: NLP processing for sentiment and entities
        nlp_data = await self.nlp_processor.analyze_text(post.title + " " + post.content)
        
        # Stage 5: Quality scoring
        quality_score = await self.quality_scorer.calculate_score(
            post, content_type, ocr_data, vlm_data, nlp_data
        )
        
        return ClassificationResult(
            content_type=content_type,
            quality_score=quality_score,
            ocr_data=ocr_data,
            vlm_data=vlm_data,
            nlp_data=nlp_data,
            confidence=self._calculate_confidence(content_type, quality_score)
        )
```

#### Content Type Detection

```python
class ContentTypeDetector:
    """Detect content type using multiple signals."""
    
    CONTENT_PATTERNS = {
        "dd": [
            r"\b(due diligence|DD|research|analysis|fundamentals)\b",
            r"\b(revenue|earnings|profit|loss|balance sheet)\b",
            r"\b(catalyst|upcoming|announcement|merger|acquisition)\b"
        ],
        "ta": [
            r"\b(technical analysis|TA|chart|pattern|support|resistance)\b",
            r"\b(breakout|breakdown|trend|moving average|RSI|MACD)\b",
            r"\b(fibonacci|bollinger|volume|momentum)\b"
        ],
        "news": [
            r"\b(news|announcement|press release|SEC filing)\b",
            r"\b(FDA approval|partnership|contract|deal)\b"
        ],
        "pump": [
            r"\b(moon|rocket|diamond hands|to the moon)\b",
            r"\b(buy now|last chance|don't miss out)\b",
            r"🚀|💎|🌙",  # Emoji patterns
            r"\b(guaranteed|sure thing|can't lose)\b"
        ]
    }
    
    async def detect_content_type(self, post: EnrichedPost) -> str:
        """Detect content type based on text patterns and metadata."""
        scores = {}
        text = f"{post.title} {post.content}".lower()
        
        for content_type, patterns in self.CONTENT_PATTERNS.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches
            scores[content_type] = score
            
        # Additional heuristics
        if post.flair:
            flair_lower = post.flair.lower()
            if "dd" in flair_lower or "due diligence" in flair_lower:
                scores["dd"] += 10
            elif "ta" in flair_lower or "technical" in flair_lower:
                scores["ta"] += 10
                
        # Length-based scoring
        if len(post.content) > 1000:
            scores["dd"] += 5
        elif len(post.content) < 100:
            scores["pump"] += 3
            
        return max(scores, key=scores.get) if scores else "discussion"
```

### 3. Penny Stock Intelligence Engine

#### Ticker Extraction and Validation

```python
# src/pennystocks_scanner/intelligence/ticker_extractor.py
class SmartTickerExtractor:
    """
    Advanced ticker extraction with context validation and false positive reduction.
    """
    
    def __init__(self):
        self.ticker_database = TickerDatabase()
        self.market_data_client = MarketDataClient()
        self.context_analyzer = ContextAnalyzer()
        
    async def extract_and_validate_tickers(self, post: EnrichedPost) -> List[ValidatedTicker]:
        """
        Extract tickers from post content and validate them.
        """
        # Step 1: Extract potential tickers using multiple methods
        potential_tickers = await self._extract_potential_tickers(post)
        
        # Step 2: Context validation
        validated_tickers = []
        for ticker in potential_tickers:
            context_score = await self.context_analyzer.analyze_ticker_context(
                ticker, post.title, post.content
            )
            
            if context_score > 0.7:  # High confidence threshold
                # Step 3: Market validation
                market_data = await self.market_data_client.get_ticker_data(ticker)
                
                if market_data and self._meets_penny_stock_criteria(market_data):
                    validated_tickers.append(ValidatedTicker(
                        symbol=ticker,
                        context_score=context_score,
                        market_data=market_data,
                        extraction_method="smart_extraction"
                    ))
                    
        return validated_tickers
    
    def _meets_penny_stock_criteria(self, market_data: MarketData) -> bool:
        """Check if ticker meets penny stock criteria."""
        return (
            market_data.price <= 5.00 and
            market_data.market_cap >= 1_000_000 and
            market_data.market_cap <= 300_000_000 and
            market_data.average_volume >= 100_000
        )
```

#### Manipulation Detection System

```python
# src/pennystocks_scanner/intelligence/manipulation_detector.py
class ManipulationDetector:
    """
    Advanced system for detecting pump-and-dump schemes and market manipulation.
    """
    
    def __init__(self):
        self.pattern_database = ManipulationPatternDatabase()
        self.author_tracker = AuthorTracker()
        self.sentiment_analyzer = SentimentAnalyzer()
        
    async def assess_manipulation_risk(self, post: EnrichedPost, tickers: List[ValidatedTicker]) -> ManipulationRisk:
        """
        Assess the risk of market manipulation for a post.
        """
        risk_factors = []
        
        # Factor 1: Author analysis
        author_risk = await self._analyze_author_risk(post.author)
        risk_factors.append(("author_risk", author_risk))
        
        # Factor 2: Language patterns
        language_risk = await self._analyze_language_patterns(post)
        risk_factors.append(("language_risk", language_risk))
        
        # Factor 3: Timing patterns
        timing_risk = await self._analyze_timing_patterns(post, tickers)
        risk_factors.append(("timing_risk", timing_risk))
        
        # Factor 4: Coordination detection
        coordination_risk = await self._detect_coordination(post, tickers)
        risk_factors.append(("coordination_risk", coordination_risk))
        
        # Factor 5: Historical patterns
        historical_risk = await self._analyze_historical_patterns(tickers)
        risk_factors.append(("historical_risk", historical_risk))
        
        # Calculate overall risk score
        overall_risk = self._calculate_risk_score(risk_factors)
        
        return ManipulationRisk(
            overall_score=overall_risk,
            risk_factors=dict(risk_factors),
            risk_level=self._categorize_risk_level(overall_risk),
            confidence=self._calculate_confidence(risk_factors)
        )
    
    async def _analyze_author_risk(self, author: str) -> float:
        """Analyze author's historical behavior for manipulation patterns."""
        author_history = await self.author_tracker.get_author_history(author)
        
        if not author_history:
            return 0.5  # Unknown author, medium risk
            
        risk_score = 0.0
        
        # Check for pump history
        if author_history.pump_attempts > 0:
            risk_score += 0.3
            
        # Check account age and karma
        if author_history.account_age_days < 30:
            risk_score += 0.2
        if author_history.karma < 100:
            risk_score += 0.2
            
        # Check posting patterns
        if author_history.posts_per_day > 10:
            risk_score += 0.2
            
        # Check success rate
        if author_history.successful_predictions < 0.3:
            risk_score += 0.1
            
        return min(risk_score, 1.0)
```

### 4. Signal Generation System

#### Multi-Dimensional Scoring Algorithm

```python
# src/pennystocks_scanner/signals/signal_generator.py
class SignalGenerator:
    """
    Generate trading signals based on multi-dimensional analysis.
    """
    
    def __init__(self):
        self.scoring_engine = ScoringEngine()
        self.risk_assessor = RiskAssessor()
        self.technical_analyzer = TechnicalAnalyzer()
        self.performance_tracker = PerformanceTracker()
        
    async def generate_signal(self, 
                            post: EnrichedPost, 
                            classification: ClassificationResult,
                            tickers: List[ValidatedTicker],
                            manipulation_risk: ManipulationRisk) -> Optional[PennyStockSignal]:
        """
        Generate a comprehensive trading signal.
        """
        
        if not tickers or manipulation_risk.risk_level == "HIGH":
            return None
            
        primary_ticker = tickers[0]  # Focus on primary ticker
        
        # Calculate component scores
        content_quality_score = await self._calculate_content_quality_score(
            post, classification
        )
        
        market_opportunity_score = await self._calculate_market_opportunity_score(
            primary_ticker, post
        )
        
        community_validation_score = await self._calculate_community_validation_score(
            primary_ticker, post
        )
        
        technical_confirmation_score = await self._calculate_technical_confirmation_score(
            primary_ticker
        )
        
        risk_assessment_score = 1.0 - manipulation_risk.overall_score
        
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
            classification.confidence, manipulation_risk.confidence
        )
        
        final_score *= confidence_multiplier
        
        # Generate signal if score meets threshold
        if final_score >= 0.6:  # Minimum signal threshold
            signal = PennyStockSignal(
                ticker_symbol=primary_ticker.symbol,
                signal_strength=final_score,
                signal_type=self._determine_signal_type(classification, market_opportunity_score),
                source_post_id=post.id,
                component_scores={
                    "content_quality": content_quality_score,
                    "market_opportunity": market_opportunity_score,
                    "risk_assessment": risk_assessment_score,
                    "community_validation": community_validation_score,
                    "technical_confirmation": technical_confirmation_score
                },
                risk_assessment=manipulation_risk,
                market_data=primary_ticker.market_data,
                expires_at=datetime.utcnow() + timedelta(days=7)
            )
            
            # Track signal for performance analysis
            await self.performance_tracker.track_signal(signal)
            
            return signal
            
        return None
```

#### Signal Types and Classification

```python
class SignalType(Enum):
    BREAKOUT = "breakout"      # Technical breakout pattern
    MOMENTUM = "momentum"      # Strong momentum play
    VALUE = "value"           # Undervalued opportunity
    CATALYST = "catalyst"     # Catalyst-driven opportunity
    SQUEEZE = "squeeze"       # Volatility squeeze play

class SignalStrength(Enum):
    WEAK = "weak"         # 0.6 - 0.7
    MODERATE = "moderate" # 0.7 - 0.8
    STRONG = "strong"     # 0.8 - 0.9
    VERY_STRONG = "very_strong"  # 0.9 - 1.0
```

### 5. Integration Layer

#### Volatility Scanner Integration

```python
# src/pennystocks_scanner/integration/volatility_integration.py
class VolatilityIntegration:
    """
    Integration with existing volatility squeeze scanner.
    """
    
    def __init__(self):
        self.volatility_client = VolatilitySqueezeClient()
        
    async def enhance_signal_with_volatility_data(self, signal: PennyStockSignal) -> PennyStockSignal:
        """
        Enhance penny stock signal with volatility squeeze data.
        """
        try:
            volatility_data = await self.volatility_client.get_squeeze_signal(
                signal.ticker_symbol
            )
            
            if volatility_data:
                # Boost signal strength if volatility squeeze detected
                if volatility_data.is_squeeze:
                    signal.signal_strength = min(signal.signal_strength * 1.2, 1.0)
                    signal.signal_type = SignalType.SQUEEZE
                    
                signal.volatility_squeeze_signal = volatility_data.to_dict()
                
        except Exception as e:
            logger.warning(f"Failed to get volatility data for {signal.ticker_symbol}: {e}")
            
        return signal
```

#### RDS Ticker Analysis Integration

```python
# src/pennystocks_scanner/integration/rds_integration.py
class RDSIntegration:
    """
    Integration with RDS ticker analysis system.
    """
    
    def __init__(self):
        self.rds_client = RDSTickerAnalysisClient()
        
    async def feed_signal_to_rds(self, signal: PennyStockSignal) -> bool:
        """
        Feed penny stock signal into RDS ticker analysis pipeline.
        """
        try:
            ticker_opportunity = TickerOpportunity(
                ticker_symbol=signal.ticker_symbol,
                reddit_composite_score=signal.signal_strength,
                signal_strength=signal.signal_strength_category,
                source_system="pennystocks_scanner",
                analysis_data={
                    "signal_type": signal.signal_type,
                    "component_scores": signal.component_scores,
                    "risk_assessment": signal.risk_assessment.to_dict(),
                    "source_post_id": signal.source_post_id
                }
            )
            
            await self.rds_client.create_ticker_opportunity(ticker_opportunity)
            return True
            
        except Exception as e:
            logger.error(f"Failed to feed signal to RDS: {e}")
            return False
```

## Database Schema Implementation

### Complete SQL Schema

```sql
-- PennyStocks Scanner Database Schema
-- Extends existing portfolio database structure

-- Create schema for pennystocks scanner
CREATE SCHEMA IF NOT EXISTS pennystocks_scanner;

-- Set search path
SET search_path TO pennystocks_scanner, public;

-- Posts table with comprehensive metadata
CREATE TABLE pennystocks_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reddit_post_id TEXT UNIQUE NOT NULL,
    
    -- Reddit metadata
    subreddit TEXT NOT NULL DEFAULT 'pennystocks',
    author TEXT NOT NULL,
    created_utc BIGINT NOT NULL,
    created_datetime TIMESTAMPTZ NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    url TEXT,
    permalink TEXT NOT NULL,
    
    -- Engagement metrics
    score INTEGER DEFAULT 0,
    upvote_ratio DECIMAL(4,3) DEFAULT 0.0,
    num_comments INTEGER DEFAULT 0,
    awards_count INTEGER DEFAULT 0,
    flair TEXT,
    
    -- Content analysis
    content_type TEXT CHECK (content_type IN ('dd', 'ta', 'news', 'discussion', 'meme', 'pump')),
    quality_tier TEXT CHECK (quality_tier IN ('premium', 'good', 'average', 'poor', 'spam')),
    confidence_score DECIMAL(5,4) DEFAULT 0.0,
    
    -- Extracted data
    mentioned_tickers JSONB DEFAULT '[]',
    validated_tickers JSONB DEFAULT '[]',
    price_targets JSONB DEFAULT '{}',
    sentiment TEXT CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
    investment_horizon TEXT CHECK (investment_horizon IN ('intraday', 'swing', 'long')),
    
    -- Image analysis
    has_images BOOLEAN DEFAULT FALSE,
    image_urls JSONB DEFAULT '[]',
    ocr_text TEXT,
    image_analysis JSONB DEFAULT '{}',
    
    -- VLM extraction
    vlm_analysis JSONB DEFAULT '{}',
    structured_data JSONB DEFAULT '{}',
    
    -- NLP analysis
    nlp_entities JSONB DEFAULT '[]',
    key_phrases JSONB DEFAULT '[]',
    sentiment_scores JSONB DEFAULT '{}',
    
    -- Risk assessment
    manipulation_risk_score DECIMAL(5,4) DEFAULT 0.0,
    manipulation_risk_level TEXT CHECK (manipulation_risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    risk_factors JSONB DEFAULT '{}',
    
    -- Processing metadata
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals table with comprehensive tracking
CREATE TABLE pennystocks_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Signal identification
    ticker_symbol VARCHAR(10) NOT NULL,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('breakout', 'momentum', 'value', 'catalyst', 'squeeze')),
    signal_strength DECIMAL(5,4) NOT NULL CHECK (signal_strength >= 0.0 AND signal_strength <= 1.0),
    signal_strength_category TEXT CHECK (signal_strength_category IN ('weak', 'moderate', 'strong', 'very_strong')),
    
    -- Source analysis
    source_post_id UUID REFERENCES pennystocks_posts(id),
    source_posts_count INTEGER NOT NULL DEFAULT 1,
    unique_authors_count INTEGER NOT NULL DEFAULT 1,
    total_engagement_score INTEGER NOT NULL DEFAULT 0,
    quality_weighted_score DECIMAL(8,4) NOT NULL DEFAULT 0.0,
    
    -- Component scores
    content_quality_score DECIMAL(5,4) NOT NULL,
    market_opportunity_score DECIMAL(5,4) NOT NULL,
    risk_assessment_score DECIMAL(5,4) NOT NULL,
    community_validation_score DECIMAL(5,4) NOT NULL,
    technical_confirmation_score DECIMAL(5,4) NOT NULL,
    
    -- Market context
    current_price DECIMAL(12,4) NOT NULL,
    market_cap BIGINT,
    daily_volume BIGINT,
    avg_volume_20d BIGINT,
    price_change_24h DECIMAL(8,4),
    
    -- Risk assessment
    manipulation_risk_score DECIMAL(5,4) NOT NULL,
    liquidity_risk_score DECIMAL(5,4) NOT NULL,
    volatility_risk_score DECIMAL(5,4) NOT NULL,
    overall_risk_grade CHAR(1) CHECK (overall_risk_grade IN ('A', 'B', 'C', 'D', 'F')),
    
    -- Opportunity metrics
    opportunity_score DECIMAL(5,4) NOT NULL,
    opportunity_rank INTEGER,
    expected_return_7d DECIMAL(8,4),
    confidence_interval DECIMAL(5,4),
    
    -- Integration data
    volatility_squeeze_signal JSONB DEFAULT '{}',
    technical_indicators JSONB DEFAULT '{}',
    rds_integration_status TEXT DEFAULT 'pending',
    
    -- Lifecycle management
    signal_generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    deactivated_at TIMESTAMPTZ,
    deactivation_reason TEXT,
    
    -- Performance tracking
    actual_return_1d DECIMAL(8,4),
    actual_return_3d DECIMAL(8,4),
    actual_return_7d DECIMAL(8,4),
    max_drawdown DECIMAL(8,4),
    max_gain DECIMAL(8,4),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Author tracking for credibility scoring
CREATE TABLE author_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    
    -- Reddit profile data
    account_created_utc BIGINT,
    comment_karma INTEGER DEFAULT 0,
    link_karma INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Performance tracking
    total_posts INTEGER DEFAULT 0,
    successful_predictions INTEGER DEFAULT 0,
    failed_predictions INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0,
    
    -- Risk indicators
    pump_attempts INTEGER DEFAULT 0,
    spam_posts INTEGER DEFAULT 0,
    manipulation_score DECIMAL(5,4) DEFAULT 0.0,
    
    -- Credibility metrics
    credibility_score DECIMAL(5,4) DEFAULT 0.5,
    expert_rating DECIMAL(5,4) DEFAULT 0.0,
    community_trust_score DECIMAL(5,4) DEFAULT 0.0,
    
    -- Activity patterns
    avg_posts_per_day DECIMAL(6,2) DEFAULT 0.0,
    last_post_date TIMESTAMPTZ,
    posting_pattern_score DECIMAL(5,4) DEFAULT 0.0,
    
    -- Metadata
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance tracking table
CREATE TABLE signal_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES pennystocks_signals(id),
    
    -- Performance metrics
    entry_price DECIMAL(12,4),
    current_price DECIMAL(12,4),
    return_1d DECIMAL(8,4),
    return_3d DECIMAL(8,4),
    return_7d DECIMAL(8,4),
    return_30d DECIMAL(8,4),
    
    -- Risk metrics
    max_drawdown DECIMAL(8,4),
    max_gain DECIMAL(8,4),
    volatility DECIMAL(8,4),
    sharpe_ratio DECIMAL(8,4),
    
    -- Volume analysis
    avg_volume_during_signal BIGINT,
    volume_spike_factor DECIMAL(8,4),
    
    -- Market context
    market_performance_1d DECIMAL(8,4),
    market_performance_7d DECIMAL(8,4),
    relative_performance DECIMAL(8,4),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    closed_at TIMESTAMPTZ,
    close_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pennystocks_posts_reddit_id ON pennystocks_posts(reddit_post_id);
CREATE INDEX idx_pennystocks_posts_author ON pennystocks_posts(author);
CREATE INDEX idx_pennystocks_posts_created ON pennystocks_posts(created_datetime);
CREATE INDEX idx_pennystocks_posts_tickers ON pennystocks_posts USING GIN(mentioned_tickers);
CREATE INDEX idx_pennystocks_posts_processing ON pennystocks_posts(processing_status);

CREATE INDEX idx_pennystocks_signals_ticker ON pennystocks_signals(ticker_symbol);
CREATE INDEX idx_pennystocks_signals_strength ON pennystocks_signals(signal_strength DESC);
CREATE INDEX idx_pennystocks_signals_generated ON pennystocks_signals(signal_generated_at);
CREATE INDEX idx_pennystocks_signals_active ON pennystocks_signals(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_pennystocks_signals_expires ON pennystocks_signals(expires_at);

CREATE INDEX idx_author_profiles_username ON author_profiles(username);
CREATE INDEX idx_author_profiles_credibility ON author_profiles(credibility_score DESC);

CREATE INDEX idx_signal_performance_signal_id ON signal_performance(signal_id);
CREATE INDEX idx_signal_performance_return ON signal_performance(return_7d DESC);
```

## API Design

### RESTful API Endpoints

```python
# src/pennystocks_scanner/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/v1/pennystocks", tags=["PennyStocks Scanner"])

@router.get("/signals", response_model=List[PennyStockSignalResponse])
async def get_active_signals(
    limit: int = Query(50, le=200),
    min_strength: float = Query(0.6, ge=0.0, le=1.0),
    signal_type: Optional[str] = Query(None),
    ticker: Optional[str] = Query(None)
):
    """Get active penny stock signals with filtering options."""
    
@router.get("/signals/{signal_id}", response_model=PennyStockSignalResponse)
async def get_signal_details(signal_id: str):
    """Get detailed information about a specific signal."""
    
@router.get("/signals/{signal_id}/performance", response_model=SignalPerformanceResponse)
async def get_signal_performance(signal_id: str):
    """Get performance tracking data for a signal."""
    
@router.get("/tickers/{ticker}/signals", response_model=List[PennyStockSignalResponse])
async def get_ticker_signals(
    ticker: str,
    days: int = Query(30, le=90)
):
    """Get all signals for a specific ticker in the last N days."""
    
@router.get("/authors/{username}/profile", response_model=AuthorProfileResponse)
async def get_author_profile(username: str):
    """Get author credibility profile and statistics."""
    
@router.get("/posts", response_model=List[PostResponse])
async def get_recent_posts(
    limit: int = Query(100, le=500),
    quality_tier: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None)
):
    """Get recent posts with filtering options."""
    
@router.post("/signals/{signal_id}/feedback")
async def submit_signal_feedback(
    signal_id: str,
    feedback: SignalFeedbackRequest
):
    """Submit feedback on signal quality for system improvement."""
    
@router.get("/analytics/performance", response_model=PerformanceAnalyticsResponse)
async def get_performance_analytics(
    days: int = Query(30, le=365)
):
    """Get system performance analytics and metrics."""
```

## Monitoring and Alerting

### Comprehensive Monitoring System

```python
# src/pennystocks_scanner/monitoring/monitor.py
class SystemMonitor:
    """
    Comprehensive monitoring system for penny stocks scanner.
    """
    
    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.alert_manager = AlertManager()
        self.performance_tracker = PerformanceTracker()
        
    async def monitor_system_health(self):
        """Monitor overall system health and performance."""
        
        # Monitor ingestion pipeline
        ingestion_metrics = await self._monitor_ingestion_pipeline()
        
        # Monitor signal generation
        signal_metrics = await self._monitor_signal_generation()
        
        # Monitor performance
        performance_metrics = await self._monitor_signal_performance()
        
        # Monitor data quality
        quality_metrics = await self._monitor_data_quality()
        
        # Check for alerts
        await self._check_alert_conditions({
            **ingestion_metrics,
            **signal_metrics,
            **performance_metrics,
            **quality_metrics
        })
    
    async def _monitor_ingestion_pipeline(self) -> Dict[str, float]:
        """Monitor Reddit ingestion pipeline health."""
        return {
            "posts_per_hour": await self._get_posts_per_hour(),
            "processing_latency": await self._get_avg_processing_latency(),
            "error_rate": await self._get_error_rate(),
            "api_rate_limit_usage": await self._get_api_usage()
        }
    
    async def _monitor_signal_generation(self) -> Dict[str, float]:
        """Monitor signal generation metrics."""
        return {
            "signals_per_day": await self._get_signals_per_day(),
            "avg_signal_strength": await self._get_avg_signal_strength(),
            "signal_accuracy": await self._get_signal_accuracy(),
            "false_positive_rate": await self._get_false_positive_rate()
        }
```

### Alert Configuration

```python
# src/pennystocks_scanner/monitoring/alerts.py
class AlertManager:
    """
    Intelligent alert management system.
    """
    
    ALERT_THRESHOLDS = {
        "posts_per_hour": {"min": 5, "max": 100},
        "processing_latency": {"max": 60},  # seconds
        "error_rate": {"max": 0.05},  # 5%
        "signal_accuracy": {"min": 0.7},  # 70%
        "false_positive_rate": {"max": 0.15},  # 15%
        "system_uptime": {"min": 0.99}  # 99%
    }
    
    async def check_alert_conditions(self, metrics: Dict[str, float]):
        """Check metrics against alert thresholds."""
        alerts = []
        
        for metric, value in metrics.items():
            if metric in self.ALERT_THRESHOLDS:
                threshold = self.ALERT_THRESHOLDS[metric]
                
                if "min" in threshold and value < threshold["min"]:
                    alerts.append(Alert(
                        type="LOW_VALUE",
                        metric=metric,
                        value=value,
                        threshold=threshold["min"],
                        severity="HIGH" if metric == "signal_accuracy" else "MEDIUM"
                    ))
                    
                if "max" in threshold and value > threshold["max"]:
                    alerts.append(Alert(
                        type="HIGH_VALUE",
                        metric=metric,
                        value=value,
                        threshold=threshold["max"],
                        severity="HIGH" if metric == "error_rate" else "MEDIUM"
                    ))
        
        if alerts:
            await self._send_alerts(alerts)
```

This comprehensive implementation guide provides the technical foundation for building a sophisticated penny stock monitoring system that integrates seamlessly with your existing portfolio architecture while providing advanced intelligence and risk management capabilities.