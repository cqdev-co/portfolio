# Reddit Source - Enterprise Financial Data Pipeline

## Overview

The Reddit Source project is an enterprise-grade data pipeline that ingests financial discussions from Reddit, processes them through advanced OCR and Vision Language Model (VLM) pipelines, and produces structured datasets for trading signal enhancement. This system is designed to integrate seamlessly with existing trading scanners like the Volatility Squeeze Scanner.

## Architecture

### System Components

1. **Data Ingestion Layer**
   - Reddit API client with OAuth2 authentication
   - Multi-subreddit polling with intelligent rate limiting
   - Image download and storage management
   - Duplicate detection and deduplication

2. **Processing Pipeline**
   - OCR processing using PaddleOCR for chart analysis
   - Image routing and classification system
   - Local VLM processing with Qwen2-VL for structured extraction
   - Ticker verification with collision detection
   - Market data enrichment via yfinance

3. **Storage Layer**
   - Supabase PostgreSQL database with enterprise schema
   - Optimized indexes for high-performance queries
   - Row-level security (RLS) policies
   - Materialized views for scanner integration

4. **Quality Assurance**
   - Multi-factor quality scoring algorithm
   - Automatic spam and duplicate detection
   - Content value assessment and filtering
   - Market sanity checks for price data

5. **Feature Engineering**
   - Real-time aggregation into 2-hour buckets
   - Buzz score calculation with z-score normalization
   - Sentiment analysis and stance detection
   - Author diversity and engagement metrics

## Database Schema

### Core Tables

- **posts**: Primary Reddit post data with metadata
- **image_extractions**: VLM-extracted structured data from images
- **text_extractions**: NLP-processed text content
- **market_enrichment**: Price data and forward returns
- **quality_scores**: Multi-factor quality assessments
- **reddit_features**: Aggregated features for scanner integration
- **processing_jobs**: Job tracking and monitoring

### Key Relationships

```sql
posts (1) -> (1) image_extractions
posts (1) -> (1) text_extractions  
posts (1) -> (1) quality_scores
posts (1) -> (N) market_enrichment [per ticker]
```

## Integration Points

### Volatility Squeeze Scanner Integration

The system provides a `scanner_ready_signals` materialized view that combines:
- Post metadata and content
- Extracted tickers and sentiment
- Quality scores and filtering
- Market data and forward returns
- Aggregated Reddit features (buzz_z, bull_pct)

### Join Strategy

```python
# Example integration code
scanner_df["bucket_2h"] = scanner_df.signal_ts.dt.floor("2H")
joined_df = scanner_df.merge(
    reddit_features_df, 
    on=["ticker", "bucket_2h"], 
    how="left"
)
joined_df["reddit_confirmed"] = (
    (joined_df.buzz_z >= 2) & 
    (joined_df.bull_pct >= 0.6)
)
```

## Data Quality Framework

### Quality Scoring Components

1. **Content Score (0-1)**
   - Verified ticker presence: +0.4
   - Stance/horizon detection: +0.2
   - Entry/stop/target levels: +0.2
   - Multiple claims: +0.2

2. **Image Signal Score (0-1)**
   - Router classification confidence
   - OCR text density and quality
   - Extracted timeframe and levels
   - Platform identification

3. **Evidence Score (0-1)**
   - Numeric values and units
   - Links to filings or catalysts
   - Specific catalyst keywords
   - Verifiable claims

4. **Cross-check Score (0-1)**
   - Price sanity validation
   - Ticker appears in multiple sources
   - Market data consistency
   - Author credibility

### Filtering Thresholds

- **Valuable**: value_score >= 0.60
- **Soft Quarantine**: 0.30 <= value_score < 0.60
- **Hard Drop**: value_score < 0.30

## Performance Characteristics

### Throughput Metrics

- **Ingestion Rate**: 1,000 posts/minute
- **OCR Processing**: 50 images/minute  
- **VLM Extraction**: 20 images/minute
- **Database Writes**: 500 records/second

### Resource Requirements

- **Memory**: 4-8GB peak (with local VLM)
- **Storage**: ~100MB per 1,000 posts
- **CPU**: Multi-core recommended for VLM processing
- **GPU**: Apple Silicon (MPS) or CUDA for acceleration

## Operational Procedures

### Daily Operations

1. **Morning Setup**
   ```bash
   reddit-source status
   reddit-source ingest --once  # Test run
   ```

2. **Continuous Monitoring**
   ```bash
   reddit-source ingest --watch  # Production mode
   ```

3. **Data Export**
   ```bash
   reddit-source export --date $(date +%Y-%m-%d)
   ```

### Maintenance Tasks

1. **Weekly Cleanup**
   - Archive old images (>30 days)
   - Refresh materialized views
   - Update ticker symbol tables

2. **Monthly Analysis**
   - Quality score calibration
   - Performance optimization
   - Feature effectiveness review

### Monitoring and Alerts

1. **Health Checks**
   - Supabase connection status
   - Reddit API rate limits
   - Processing pipeline status
   - Error rate monitoring

2. **Quality Metrics**
   - False positive rates
   - Extraction accuracy
   - Duplicate detection effectiveness
   - Market data consistency

## Security and Compliance

### Data Privacy

- No personal information stored
- Images processed locally only
- Configurable data retention periods
- GDPR compliance framework

### API Security

- OAuth2 authentication with Reddit
- Service role key protection
- Rate limit compliance
- Request timeout handling

### Access Control

- Row-level security policies
- Role-based permissions
- Audit logging
- Secure credential management

## Troubleshooting Guide

### Common Issues

1. **Authentication Failures**
   - Verify Reddit API credentials
   - Check token expiration
   - Validate user agent format

2. **Processing Bottlenecks**
   - Monitor VLM memory usage
   - Check OCR processing queue
   - Verify database connection pool

3. **Data Quality Issues**
   - Review ticker verification rules
   - Calibrate quality thresholds
   - Validate market data sources

### Performance Optimization

1. **Database Tuning**
   - Index optimization
   - Query plan analysis
   - Connection pooling
   - Batch operation sizing

2. **Processing Pipeline**
   - Async/await optimization
   - Memory management
   - Caching strategies
   - Load balancing

## Future Enhancements

### Phase 2 Development

- Real-time streaming pipeline
- Advanced sentiment models
- Multi-language support
- Enhanced duplicate detection

### Phase 3 Roadmap

- Machine learning integration
- Alternative data sources
- Real-time alerting system
- Advanced visualization tools

## Integration Examples

### Custom Scanner Integration

```python
from reddit_source.storage import get_storage_client

async def enhance_signals(scanner_signals):
    storage = get_storage_client()
    
    enhanced_signals = []
    for signal in scanner_signals:
        reddit_data = await storage.get_scanner_ready_signals(
            ticker=signal.ticker,
            min_buzz_z=1.5
        )
        
        signal.reddit_buzz = reddit_data[0].buzz_z if reddit_data else 0
        signal.reddit_sentiment = reddit_data[0].bull_pct if reddit_data else 0.5
        
        enhanced_signals.append(signal)
    
    return enhanced_signals
```

### Custom Feature Engineering

```python
from reddit_source.ingest.models import RedditFeatures

async def compute_custom_metrics(ticker, time_bucket):
    # Custom aggregation logic
    features = RedditFeatures(
        ticker=ticker,
        bucket_2h=time_bucket,
        custom_momentum_score=calculate_momentum(),
        custom_volatility_indicator=calculate_volatility()
    )
    
    await storage.insert_reddit_features(features)
```

This documentation provides a comprehensive overview of the Reddit Source system architecture, integration patterns, and operational procedures for enterprise deployment.
