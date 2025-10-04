# RDS Ticker Analysis Documentation

## Overview

The RDS (Reddit Data Source) Ticker Analysis system is an enterprise-grade platform for analyzing stock ticker sentiment and identifying investment opportunities using Reddit data as the primary source. The system combines advanced sentiment analysis, bot detection, mathematical scoring algorithms, and AI-powered insights to provide comprehensive investment analysis.

## Architecture

### System Components

1. **Reddit Sentiment Service** - Multi-subreddit data collection and sentiment analysis
2. **Market Data Service** - Real-time market data integration via yfinance
3. **Scoring Service** - Mathematical opportunity ranking algorithms
4. **AI Analysis Service** - OpenAI-powered qualitative analysis
5. **Ticker Analysis Service** - Main orchestration service
6. **Volatility Squeeze Integration** - Integration with technical analysis signals

### Data Flow

```
Reddit Data → Bot Detection → Sentiment Analysis → Ticker Extraction
                                     ↓
Market Data ← yfinance API ← Ticker Validation ← Technical Analysis
                                     ↓
Scoring Algorithm ← Risk Assessment ← AI Analysis ← Combined Analysis
                                     ↓
Investment Opportunity ← Position Sizing ← Final Recommendations
```

## Key Features

### Advanced Bot Detection
- Account age analysis (filters accounts < 3 days old)
- Posting pattern analysis for suspicious behavior
- Content diversity scoring
- Karma-to-activity ratio analysis
- Username pattern recognition

### Multi-Model Sentiment Analysis
- VADER sentiment analyzer for social media text
- TextBlob polarity and subjectivity analysis
- Custom financial sentiment scoring
- Emotion detection (fear, greed, FOMO indicators)
- Content classification (DD, TA, news, memes, pump attempts)

### Mathematical Scoring Algorithm
- **Sentiment Score (25%)**: Weighted average of sentiment analyses
- **Volume Score (20%)**: Reddit activity and engagement metrics
- **Quality Score (20%)**: Content quality and reliability assessment
- **Momentum Score (15%)**: Recent activity trends
- **Technical Score (15%)**: Technical analysis indicators
- **Fundamental Score (5%)**: Basic valuation metrics

### Risk Assessment Framework
- **Market Risk**: Volatility and sector-specific risks
- **Liquidity Risk**: Trading volume and market depth
- **Volatility Risk**: Price instability indicators
- **Sentiment Risk**: Sentiment consistency and quality
- **Manipulation Risk**: Bot activity and pump detection

## Usage Examples

### CLI Usage

```bash
# Analyze a single ticker
rds-ticker-analysis analyze AAPL --hours 24 --ai

# Run comprehensive market scan
rds-ticker-analysis scan --min-mentions 5 --limit 20

# Analyze specific subreddit sentiment
rds-ticker-analysis sentiment wallstreetbets --hours 12

# Validate ticker symbols
rds-ticker-analysis validate "AAPL,MSFT,TSLA,GOOGL"
```

### Python API Usage

```python
from rds_ticker_analysis import TickerAnalysisService

# Initialize service
service = TickerAnalysisService(...)

# Analyze single ticker
opportunity = await service.analyze_ticker_opportunity(
    ticker_symbol="AAPL",
    analysis_hours=24,
    include_ai_analysis=True
)

# Run market scan
results = await service.run_comprehensive_scan(
    analysis_hours=24,
    min_mentions=3
)
```

## Configuration

### Environment Variables

```bash
# Reddit API (required)
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=rds-ticker-analysis/1.0

# OpenAI API (optional)
OPENAI_API_KEY=your_openai_key

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost/db
```

### Scoring Weights Customization

```python
from rds_ticker_analysis.services.scoring import ScoringService

scoring_service = ScoringService(
    sentiment_weight=0.30,
    volume_weight=0.25,
    quality_weight=0.20,
    momentum_weight=0.10,
    technical_weight=0.10,
    fundamental_weight=0.05,
)
```

## Data Models

### Core Models
- **TickerOpportunity**: Complete analysis result with scoring and recommendations
- **SentimentAnalysis**: Individual sentiment analysis with confidence scoring
- **RedditMetrics**: Aggregated Reddit activity metrics
- **OpportunityScore**: Mathematical scoring breakdown
- **RiskAssessment**: Comprehensive risk analysis
- **AIInsights**: AI-generated analysis and recommendations

### Database Schema
- Comprehensive PostgreSQL schema with 15+ tables
- Proper indexing for high-performance queries
- Row-level security for multi-tenant scenarios
- Materialized views for analytics and reporting

## Integration Points

### Volatility Squeeze Scanner Integration
- Combines Reddit sentiment with technical volatility signals
- Enhanced scoring for tickers with squeeze conditions
- Combined analysis export capabilities
- Real-time signal correlation

### External APIs
- **Reddit API**: Content collection and user data
- **yfinance**: Real-time and historical market data
- **OpenAI API**: AI-powered qualitative analysis
- **Supabase**: Optional cloud database integration

## Performance Characteristics

### Scalability
- Async/await architecture for high concurrency
- Configurable rate limiting and request batching
- Efficient caching with configurable TTL
- Database connection pooling and optimization

### Processing Rates
- 50-100 Reddit posts per second analysis
- 10-20 concurrent ticker analyses
- Sub-second response times for cached data
- Batch processing for large-scale scans

## Quality Assurance

### Testing Strategy
- Unit tests for individual components
- Integration tests for service interactions
- API tests for external service integration
- Performance tests for scalability validation

### Code Quality
- Type hints throughout codebase
- Comprehensive docstring documentation
- Linting with Ruff and formatting with Black
- Pre-commit hooks for code quality enforcement

## Monitoring and Observability

### Logging
- Structured logging with loguru
- Configurable log levels and outputs
- Performance metrics and timing data
- Error tracking and debugging information

### Metrics
- Analysis success/failure rates
- Processing times and throughput
- Data quality scores
- API response times and error rates

## Security Considerations

### Data Privacy
- No storage of personal Reddit data
- Anonymized user activity tracking
- Configurable data retention policies
- GDPR-compliant data handling

### API Security
- Rate limiting to prevent abuse
- API key validation and rotation
- Input sanitization and validation
- SQL injection prevention

## Deployment

### Local Development
```bash
poetry install
poetry run rds-ticker-analysis config
poetry run rds-ticker-analysis analyze AAPL
```

### Production Deployment
- Docker containerization support
- Environment-based configuration
- Database migration scripts
- Health check endpoints

## Troubleshooting

### Common Issues
1. **Reddit API Rate Limiting**: Implement exponential backoff
2. **Market Data Unavailable**: Graceful degradation without market data
3. **OpenAI API Errors**: Fallback to mathematical analysis only
4. **Database Connection Issues**: Connection pooling and retry logic

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
rds-ticker-analysis analyze AAPL --hours 24
```

## Future Enhancements

### Planned Features
- Real-time WebSocket streaming
- Advanced machine learning models
- Multi-language sentiment analysis
- Social media platform expansion
- Portfolio optimization integration

### Scalability Improvements
- Kubernetes deployment
- Horizontal scaling support
- Distributed caching with Redis
- Message queue integration

## Contributing

### Development Setup
```bash
git clone <repository-url>
cd rds-ticker-analysis
poetry install --with dev
pre-commit install
```

### Code Standards
- Follow PEP 8 style guidelines
- Maintain 80%+ test coverage
- Document all public APIs
- Use type hints consistently

## Support

For questions, issues, or feature requests:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information
4. Follow the contribution guidelines

## License

This project is licensed under the MIT License. See LICENSE file for details.
