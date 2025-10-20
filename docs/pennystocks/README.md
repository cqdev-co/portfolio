# PennyStocks Scan Service Documentation

## Overview

The PennyStocks Scan Service is an intelligent Reddit monitoring system specifically designed to identify high-potential penny stock opportunities from r/pennystocks. This service extends the proven architecture of the existing reddit-source service and integrates seamlessly with the portfolio's volatility scanner and ticker analysis systems.

## Key Features

### 🎯 Intelligent Signal Generation
- Multi-dimensional scoring algorithm with 5 core components
- Advanced filtering to identify genuine opportunities
- Real-time signal generation with configurable thresholds
- Integration with volatility squeeze detection

### 🛡️ Advanced Risk Management
- Pump-and-dump scheme detection
- Author credibility tracking and scoring
- Market manipulation pattern recognition
- Comprehensive risk assessment framework

### 🔍 Content Intelligence
- OCR processing for chart and screenshot analysis
- VLM (Vision Language Model) structured data extraction
- NLP sentiment analysis and entity extraction
- Multi-stage content classification (DD, TA, News, etc.)

### 📊 Performance Tracking
- Real-time signal performance monitoring
- Historical backtesting capabilities
- Risk-adjusted return calculations
- Comprehensive analytics dashboard

### 🔗 System Integration
- Seamless integration with existing volatility scanner
- Direct feed into RDS ticker analysis pipeline
- Unified database schema with portfolio systems
- RESTful API for external consumption

## Architecture Components

### 1. Reddit Ingestion Engine
- Specialized Reddit client for r/pennystocks monitoring
- Intelligent rate limiting and error recovery
- Advanced content deduplication
- Historical post analysis capabilities

### 2. Content Classification Pipeline
- Multi-stage classification system
- OCR processing for images
- VLM analysis for structured data
- Quality scoring and filtering

### 3. Intelligence Engine
- Advanced ticker extraction and validation
- Market data verification
- Penny stock criteria enforcement
- Manipulation detection algorithms

### 4. Signal Generation System
- Multi-dimensional scoring algorithm
- Risk assessment integration
- Signal strength categorization
- Performance tracking initialization

### 5. Integration Layer
- Volatility scanner enhancement
- RDS ticker analysis feeding
- Market data enrichment
- Alert system integration

## Documentation Structure

- **[System Overview](system-overview.md)** - High-level architecture and design principles
- **[Technical Implementation](technical-implementation.md)** - Detailed technical specifications
- **[API Reference](api-reference.md)** - Complete API documentation
- **[Database Schema](database-schema.md)** - Database design and relationships
- **[Integration Guide](integration-guide.md)** - Integration with existing systems
- **[Deployment Guide](deployment-guide.md)** - Installation and deployment instructions
- **[User Guide](user-guide.md)** - End-user documentation and tutorials
- **[Performance Metrics](performance-metrics.md)** - KPIs and monitoring guidelines

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL with Supabase
- Reddit API credentials
- Access to existing portfolio database

### Installation
```bash
cd ps-source-service
pip install -r requirements.txt
python -m pennystocks_scanner init
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your credentials
```

### Basic Usage
```bash
# Start monitoring
python -m pennystocks_scanner monitor

# Generate signals
python -m pennystocks_scanner analyze

# View dashboard
python -m pennystocks_scanner dashboard
```

## Performance Targets

### Signal Quality Metrics
- **Signal Accuracy**: >80% positive movement within 7 days
- **False Positive Rate**: <15% pump-and-dump detection
- **Processing Speed**: <30 seconds from post to signal
- **Coverage**: 100% of r/pennystocks posts with <5 minute latency

### System Performance
- **Uptime**: >99% availability
- **Throughput**: 100+ posts per hour processing
- **Latency**: <60 seconds average processing time
- **Error Rate**: <5% processing failures

## Integration Points

### Existing Systems
- **Reddit Source**: Extends base architecture and patterns
- **Volatility Scanner**: Enhances signals with squeeze detection
- **RDS Ticker Analysis**: Feeds opportunities into analysis pipeline
- **Portfolio Database**: Unified schema and data models

### External APIs
- **Reddit API**: Post ingestion and metadata
- **Market Data APIs**: Price and volume validation
- **Supabase**: Cloud database and storage
- **Alert Systems**: Notification and monitoring

## Risk Management

### Technical Risks
- API rate limiting mitigation
- Data quality assurance
- System performance optimization
- Integration complexity management

### Business Risks
- False positive reduction
- Market manipulation detection
- Regulatory compliance
- User expectation management

## Support and Maintenance

### Monitoring
- Real-time system health monitoring
- Performance metrics tracking
- Alert threshold management
- Error rate monitoring

### Maintenance
- Regular model retraining
- Database optimization
- Performance tuning
- Security updates

## Contributing

### Development Guidelines
- Follow existing code patterns from reddit-source
- Maintain comprehensive test coverage
- Document all API changes
- Update performance benchmarks

### Testing
- Unit tests for all components
- Integration tests for system workflows
- Performance tests for scalability
- End-to-end tests for user scenarios

## License and Compliance

This service is part of the portfolio trading system and follows the same licensing and compliance requirements as other portfolio components.

## Contact and Support

For technical support, feature requests, or bug reports, please refer to the main portfolio documentation or contact the development team.
