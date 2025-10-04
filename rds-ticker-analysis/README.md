# RDS Ticker Analysis - Enterprise Reddit-Based Stock Analysis

An enterprise-grade system for analyzing stock ticker sentiment and opportunities using Reddit data as a primary source. This system combines advanced sentiment analysis, bot detection, mathematical scoring algorithms, and AI-powered insights to identify potential stock buying opportunities.

## 🚀 Features

### Core Capabilities
- **Multi-subreddit sentiment analysis** with intelligent bot detection and filtering
- **Advanced ticker extraction** with validation and confidence scoring
- **Mathematical opportunity scoring** using weighted multi-factor algorithms
- **Real-time market data integration** via yfinance with technical indicators
- **AI-powered qualitative analysis** using OpenAI GPT for investment insights
- **Comprehensive risk assessment** with position sizing recommendations
- **Enterprise-grade architecture** with proper separation of concerns and scalability

### Technical Excellence
- **Async/await architecture** for high-performance concurrent processing
- **Comprehensive bot detection** using behavioral analysis and account characteristics
- **Multi-model sentiment analysis** combining VADER, TextBlob, and custom algorithms
- **Rich CLI interface** with progress tracking and colored output
- **RESTful API service** built with FastAPI for integration
- **Comprehensive database schema** with PostgreSQL support
- **Full observability** with structured logging and monitoring
- **Production-ready deployment** with Docker and configuration management

## 📊 Analysis Components

### 1. Reddit Sentiment Analysis
- **Bot Detection**: Advanced filtering using account age, posting patterns, and behavioral analysis
- **Content Classification**: Identifies DD, technical analysis, news discussion, and pump attempts
- **Multi-model Sentiment**: Combines VADER and TextBlob with custom financial sentiment scoring
- **Quality Assessment**: Scores content based on evidence, financial data, and risk discussion

### 2. Market Data Integration
- **Real-time Price Data**: Current prices, volume, and market metrics via yfinance
- **Technical Indicators**: 20+ indicators including RSI, MACD, Bollinger Bands, ATR
- **Historical Analysis**: Price history with OHLCV data and volatility metrics
- **Ticker Validation**: Comprehensive validation against known ticker databases

### 3. Mathematical Scoring
- **Multi-factor Algorithm**: Weighted scoring across 6 key components
  - Sentiment Score (25%): Aggregated Reddit sentiment with confidence weighting
  - Volume Score (20%): Activity levels and engagement metrics
  - Quality Score (20%): Content quality and reliability assessment
  - Momentum Score (15%): Recent activity trends and buzz indicators
  - Technical Score (15%): Technical analysis indicators and volatility signals
  - Fundamental Score (5%): Basic fundamental metrics and valuation
- **Grade Classification**: S/A/B/C/D/F tier system for opportunity ranking
- **Risk Assessment**: Comprehensive risk analysis across 5 categories

### 4. AI-Powered Analysis
- **Investment Thesis Generation**: Structured analysis combining all data sources
- **Risk Analysis**: Identification of key risks and mitigation strategies
- **Catalyst Identification**: Potential upcoming events and market drivers
- **Contrarian Viewpoints**: Alternative perspectives and bearish arguments
- **Trading Strategies**: Specific recommendations based on opportunity profile

## 🛠 Installation

### Prerequisites
- Python 3.11+
- Poetry for dependency management
- Reddit API credentials
- OpenAI API key (optional, for AI analysis)
- PostgreSQL database (optional, for persistence)

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd rds-ticker-analysis

# Install dependencies
poetry install

# Configure environment variables
cp .env.example .env
# Edit .env with your API credentials

# Initialize the system
poetry run rds-ticker-analysis config
```

### Environment Variables
```bash
# Reddit API (required)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=rds-ticker-analysis/1.0

# OpenAI API (optional, for AI analysis)
OPENAI_API_KEY=your_openai_api_key

# Database (optional, for persistence)
DATABASE_URL=postgresql://user:pass@localhost/rds_ticker_analysis
```

## 🚀 Quick Start

### Command Line Interface

#### Analyze a Single Ticker
```bash
# Basic analysis
poetry run rds-ticker-analysis analyze AAPL

# Include AI analysis
poetry run rds-ticker-analysis analyze AAPL --ai

# Custom time window
poetry run rds-ticker-analysis analyze AAPL --hours 48

# Save results to file
poetry run rds-ticker-analysis analyze AAPL --output results/aapl_analysis.json
```

#### Comprehensive Market Scan
```bash
# Scan all monitored subreddits
poetry run rds-ticker-analysis scan

# Custom subreddits and parameters
poetry run rds-ticker-analysis scan --subreddits "stocks,investing,options" --min-mentions 5

# Include AI analysis (expensive)
poetry run rds-ticker-analysis scan --ai --limit 10
```

#### Sentiment Analysis
```bash
# Analyze specific subreddit sentiment
poetry run rds-ticker-analysis sentiment wallstreetbets --hours 12

# Validate ticker symbols
poetry run rds-ticker-analysis validate "AAPL,MSFT,TSLA,GOOGL"
```

### Python API

#### Basic Usage
```python
import asyncio
from rds_ticker_analysis import TickerAnalysisService

async def analyze_ticker():
    # Initialize services (see documentation for full setup)
    service = TickerAnalysisService(...)
    
    # Analyze a ticker
    opportunity = await service.analyze_ticker_opportunity(
        ticker_symbol="AAPL",
        analysis_hours=24,
        include_ai_analysis=True
    )
    
    if opportunity:
        print(f"Score: {opportunity.opportunity_score.overall_score}")
        print(f"Grade: {opportunity.opportunity_score.opportunity_grade}")
        print(f"Risk: {opportunity.risk_assessment.risk_level}")
        print(f"Action: {opportunity.recommended_action}")

asyncio.run(analyze_ticker())
```

## 📈 Scoring Algorithm

### Component Weights
- **Sentiment Score (25%)**: Reddit sentiment aggregated with quality weighting
- **Volume Score (20%)**: Activity levels, engagement, and author diversity
- **Quality Score (20%)**: Content quality, evidence, and reliability metrics
- **Momentum Score (15%)**: Recent activity trends and buzz indicators
- **Technical Score (15%)**: Technical analysis and volatility signals
- **Fundamental Score (5%)**: Basic valuation and fundamental metrics

### Grade Classifications
- **S Tier (≥0.90)**: Exceptional opportunities with strong signals
- **A Tier (0.80-0.90)**: Excellent opportunities with good risk/reward
- **B Tier (0.70-0.80)**: Good opportunities worth considering
- **C Tier (0.60-0.70)**: Fair opportunities with higher risk
- **D Tier (0.50-0.60)**: Poor opportunities, monitor only
- **F Tier (<0.50)**: Avoid, significant risks identified

### Risk Assessment
- **Market Risk**: General market and sector-specific risks
- **Liquidity Risk**: Trading volume and market depth considerations
- **Volatility Risk**: Price volatility and technical instability
- **Sentiment Risk**: Sentiment consistency and quality concerns
- **Manipulation Risk**: Bot activity and pump-and-dump indicators

## 🏗 Architecture

### Service Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 TickerAnalysisService                       │
│                 (Main Orchestrator)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Reddit  │    │   Market    │    │   Scoring   │
│Sentiment│    │    Data     │    │   Service   │
│Service  │    │   Service   │    │             │
└─────────┘    └─────────────┘    └─────────────┘
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Bot     │    │  Technical  │    │ Risk        │
│Detection│    │  Analysis   │    │Assessment   │
└─────────┘    └─────────────┘    └─────────────┘
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=rds_ticker_analysis

# Run specific test categories
poetry run pytest -m unit
poetry run pytest -m integration
```

## 🤝 Contributing

### Development Setup
```bash
# Clone and setup development environment
git clone <repository-url>
cd rds-ticker-analysis
poetry install --with dev

# Install pre-commit hooks
pre-commit install

# Run linting and formatting
poetry run ruff check .
poetry run black .
poetry run mypy .
```

## ⚠️ Disclaimer

This software is for educational and research purposes only. It is not intended as financial advice or investment recommendations. Always conduct your own research and consult with qualified financial professionals before making investment decisions. The authors are not responsible for any financial losses incurred from using this software.

## 🔗 Related Projects

- **Volatility Squeeze Scanner**: Technical analysis system for volatility-based signals
- **Reddit Data Source**: Enterprise Reddit data collection and processing pipeline
- **Portfolio Management System**: Comprehensive portfolio tracking and analysis tools