# PennyStocks Scan Service - Comprehensive Plan

## Executive Summary

The PennyStocks Scan Service will be an intelligent Reddit monitoring system specifically designed to identify high-potential penny stock opportunities from r/pennystocks. Building on the proven architecture of the existing reddit-source service, this system will implement advanced filtering, ranking, and signal generation to surface the most promising penny stock discussions while filtering out noise and pump-and-dump schemes.

## Strategic Objectives

### Primary Goals
1. **Intelligent Signal Generation**: Identify genuine penny stock opportunities with high growth potential
2. **Noise Reduction**: Filter out pump-and-dump schemes, bot activity, and low-quality content
3. **Risk Assessment**: Provide comprehensive risk analysis for each identified opportunity
4. **Integration**: Seamlessly integrate with existing volatility scanner and ticker analysis systems
5. **Real-time Monitoring**: Provide continuous monitoring with configurable alert thresholds

### Success Metrics
- **Signal Quality**: >80% of identified signals should show positive movement within 7 days
- **False Positive Rate**: <15% pump-and-dump detection rate
- **Processing Speed**: <30 seconds from post ingestion to signal generation
- **Coverage**: Monitor 100% of r/pennystocks posts with <5 minute latency

## Technical Architecture

### System Components

#### 1. Reddit Ingestion Engine
- **Base**: Extend existing reddit-source architecture
- **Target**: r/pennystocks subreddit with configurable expansion
- **Rate Limiting**: Respect Reddit API limits with intelligent backoff
- **Deduplication**: Advanced post deduplication with content similarity detection

#### 2. Content Classification Pipeline
- **OCR Processing**: Extract text from chart images and screenshots
- **VLM Analysis**: Use local Qwen2-VL for structured data extraction
- **Content Routing**: Classify posts as DD, TA, news, meme, or pump attempt
- **Quality Scoring**: Multi-factor quality assessment

#### 3. Penny Stock Intelligence Engine
- **Ticker Extraction**: Advanced ticker identification with context validation
- **Market Validation**: Real-time price and volume verification
- **Penny Stock Criteria**: Enforce price thresholds and market cap limits
- **Historical Analysis**: Track ticker mention patterns and outcomes

#### 4. Signal Generation System
- **Opportunity Scoring**: Multi-dimensional scoring algorithm
- **Risk Assessment**: Comprehensive risk analysis including liquidity, volatility, and manipulation risk
- **Ranking Engine**: Priority-based ranking system
- **Alert Generation**: Configurable alert thresholds and notification system

#### 5. Integration Layer
- **Volatility Scanner**: Integrate with existing volatility squeeze detection
- **Ticker Analysis**: Feed into RDS ticker analysis pipeline
- **Database**: Unified schema with existing systems
- **API**: RESTful API for external consumption

## Data Models and Schema

### Core Entities

#### PennyStock Post
```sql
CREATE TABLE pennystocks_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reddit_post_id TEXT UNIQUE NOT NULL,
    
    -- Reddit metadata
    subreddit TEXT NOT NULL DEFAULT 'pennystocks',
    author TEXT NOT NULL,
    created_utc BIGINT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT,
    
    -- Engagement metrics
    score INTEGER DEFAULT 0,
    upvote_ratio DECIMAL(4,3) DEFAULT 0.0,
    num_comments INTEGER DEFAULT 0,
    awards_count INTEGER DEFAULT 0,
    
    -- Content classification
    content_type TEXT, -- 'dd', 'ta', 'news', 'discussion', 'meme', 'pump'
    quality_tier TEXT, -- 'premium', 'good', 'average', 'poor', 'spam'
    confidence_score DECIMAL(5,4) DEFAULT 0.0,
    
    -- Extracted data
    mentioned_tickers JSONB DEFAULT '[]',
    price_targets JSONB DEFAULT '{}',
    sentiment TEXT, -- 'bullish', 'bearish', 'neutral'
    investment_horizon TEXT, -- 'intraday', 'swing', 'long'
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### PennyStock Signals
```sql
CREATE TABLE pennystocks_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Signal identification
    ticker_symbol VARCHAR(10) NOT NULL,
    signal_type TEXT NOT NULL, -- 'breakout', 'momentum', 'value', 'catalyst'
    signal_strength DECIMAL(5,4) NOT NULL, -- 0.0 to 1.0
    
    -- Source analysis
    source_posts_count INTEGER NOT NULL,
    unique_authors_count INTEGER NOT NULL,
    total_engagement_score INTEGER NOT NULL,
    quality_weighted_score DECIMAL(8,4) NOT NULL,
    
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
    overall_risk_grade CHAR(1), -- 'A', 'B', 'C', 'D', 'F'
    
    -- Opportunity metrics
    opportunity_score DECIMAL(5,4) NOT NULL,
    opportunity_rank INTEGER,
    expected_return_7d DECIMAL(8,4),
    confidence_interval DECIMAL(5,4),
    
    -- Integration data
    volatility_squeeze_signal JSONB,
    technical_indicators JSONB,
    
    -- Tracking
    signal_generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Performance tracking
    actual_return_1d DECIMAL(8,4),
    actual_return_3d DECIMAL(8,4),
    actual_return_7d DECIMAL(8,4),
    max_drawdown DECIMAL(8,4),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Intelligent Filtering Strategy

### Multi-Layer Filtering Approach

#### Layer 1: Content Quality Filter
- **Author Credibility**: Track author history and success rate
- **Post Structure**: Analyze post formatting, length, and completeness
- **Supporting Evidence**: Detect presence of charts, data, and research
- **Language Analysis**: Identify professional vs. promotional language

#### Layer 2: Market Validation Filter
- **Price Verification**: Confirm ticker prices and market cap
- **Volume Analysis**: Validate trading volume and liquidity
- **Penny Stock Criteria**: Enforce price < $5 and market cap thresholds
- **Exchange Listing**: Verify legitimate exchange listings

#### Layer 3: Manipulation Detection
- **Pump Pattern Recognition**: Identify coordinated promotion attempts
- **Bot Detection**: Recognize automated posting patterns
- **Sentiment Manipulation**: Detect artificial sentiment inflation
- **Historical Pattern Analysis**: Compare to known pump-and-dump patterns

#### Layer 4: Opportunity Validation
- **Catalyst Identification**: Detect legitimate business catalysts
- **Technical Confirmation**: Validate with technical analysis
- **Fundamental Screening**: Basic fundamental health checks
- **Risk-Reward Assessment**: Calculate risk-adjusted opportunity scores

## Ranking Algorithm

### Multi-Dimensional Scoring System

#### Core Scoring Components (Weighted)

1. **Content Quality Score (25%)**
   - Author credibility: 40%
   - Post structure and depth: 30%
   - Supporting evidence: 20%
   - Community engagement: 10%

2. **Market Opportunity Score (30%)**
   - Price momentum: 35%
   - Volume surge: 25%
   - Technical setup: 25%
   - Catalyst strength: 15%

3. **Risk Assessment Score (20%)**
   - Manipulation risk (inverse): 40%
   - Liquidity risk (inverse): 30%
   - Volatility risk (inverse): 20%
   - Market cap risk (inverse): 10%

4. **Community Validation Score (15%)**
   - Multiple independent mentions: 40%
   - Expert community endorsement: 30%
   - Discussion quality: 20%
   - Contrarian analysis presence: 10%

5. **Technical Confirmation Score (10%)**
   - Volatility squeeze signal: 50%
   - Breakout patterns: 30%
   - Volume confirmation: 20%

#### Final Ranking Formula
```
Final_Score = (
    Content_Quality * 0.25 +
    Market_Opportunity * 0.30 +
    (1 - Risk_Assessment) * 0.20 +
    Community_Validation * 0.15 +
    Technical_Confirmation * 0.10
) * Confidence_Multiplier
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up project structure and dependencies
- [ ] Implement basic Reddit ingestion for r/pennystocks
- [ ] Create database schema and models
- [ ] Implement basic content classification
- [ ] Set up logging and monitoring infrastructure

### Phase 2: Intelligence Engine (Weeks 3-4)
- [ ] Implement advanced ticker extraction and validation
- [ ] Build content quality scoring system
- [ ] Develop manipulation detection algorithms
- [ ] Create opportunity scoring framework
- [ ] Implement risk assessment models

### Phase 3: Signal Generation (Weeks 5-6)
- [ ] Build ranking algorithm and signal generation
- [ ] Implement alert system and notifications
- [ ] Create performance tracking system
- [ ] Develop backtesting framework
- [ ] Build monitoring dashboard

### Phase 4: Integration (Weeks 7-8)
- [ ] Integrate with volatility squeeze scanner
- [ ] Connect to ticker analysis pipeline
- [ ] Implement API endpoints
- [ ] Create data export capabilities
- [ ] Build admin interface

### Phase 5: Optimization (Weeks 9-10)
- [ ] Performance optimization and tuning
- [ ] Advanced filtering improvements
- [ ] Machine learning model integration
- [ ] Comprehensive testing and validation
- [ ] Documentation and deployment

## Risk Mitigation Strategies

### Technical Risks
- **API Rate Limits**: Implement intelligent rate limiting and caching
- **Data Quality**: Multi-layer validation and quality checks
- **System Performance**: Async processing and horizontal scaling
- **Integration Complexity**: Modular architecture with clear interfaces

### Business Risks
- **False Positives**: Comprehensive backtesting and validation
- **Market Manipulation**: Advanced detection algorithms and human oversight
- **Regulatory Compliance**: Clear disclaimers and risk warnings
- **User Expectations**: Transparent performance metrics and limitations

## Success Metrics and KPIs

### Performance Metrics
- **Signal Accuracy**: Percentage of signals with positive 7-day returns
- **Risk-Adjusted Returns**: Sharpe ratio of generated signals
- **Processing Latency**: Time from post to signal generation
- **System Uptime**: Service availability and reliability

### Quality Metrics
- **False Positive Rate**: Percentage of pump-and-dump schemes detected
- **Coverage Rate**: Percentage of legitimate opportunities identified
- **User Satisfaction**: Feedback scores and adoption rates
- **Data Quality**: Completeness and accuracy of extracted data

## Technology Stack

### Core Technologies
- **Language**: Python 3.11+
- **Framework**: FastAPI for API, Streamlit for UI
- **Database**: PostgreSQL with Supabase
- **Message Queue**: Redis for task processing
- **Monitoring**: Structured logging with JSON output

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

## Next Steps

1. **Immediate Actions**
   - Review and approve this comprehensive plan
   - Set up development environment and project structure
   - Begin Phase 1 implementation with Reddit ingestion

2. **Resource Requirements**
   - Development time: 10 weeks full-time equivalent
   - Infrastructure: Supabase Pro plan, VPS for processing
   - API access: Reddit API credentials

3. **Success Criteria**
   - Complete implementation of all phases
   - Achieve target performance metrics
   - Successful integration with existing systems
   - Positive user feedback and adoption

This plan provides a comprehensive roadmap for building a sophisticated penny stock monitoring system that leverages advanced AI and filtering techniques to identify genuine opportunities while minimizing risk and false positives.