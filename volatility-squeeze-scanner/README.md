# Volatility Squeeze Scanner

Enterprise-grade volatility squeeze detection service for equities and ETFs with AI-powered analysis and comprehensive backtesting capabilities.

## 🚀 Features

- **Technical Analysis**: Bollinger Bands, Keltner Channels, ATR, EMAs
- **Volatility Squeeze Detection**: Automated pattern recognition
- **AI Integration**: OpenAI GPT-4 and Anthropic Claude analysis
- **Backtesting Framework**: Comprehensive strategy validation
- **REST API**: FastAPI-based web service
- **CLI Interface**: Command-line tools for analysis
- **Enterprise-Ready**: Scalable, modular, and production-ready

## 📋 Requirements

- Python 3.11+
- Poetry package manager
- Optional: OpenAI/Anthropic API keys for AI analysis
- Optional: Redis for caching, PostgreSQL for persistence

## 🛠️ Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd volatility-squeeze-scanner

# Install dependencies
make dev-install

# Copy environment configuration
cp env.example .env
# Edit .env with your API keys

# Run tests
make test
```

### Basic Usage

```bash
# Analyze a single symbol
volatility-scanner analyze AAPL

# Batch analysis
volatility-scanner batch AAPL MSFT GOOGL

# Run backtest
volatility-scanner backtest AAPL MSFT \
  --start-date 2023-01-01 \
  --end-date 2023-12-31

# Start API server
volatility-scanner server
```

## 🔬 Technical Approach

### Core Algorithm

```python
# Volatility Squeeze Detection
BBWidth = (BB_upper - BB_lower) / middle_band

# Squeeze Condition
is_squeeze = BBWidth <= 10th_percentile(past_180_days)

# Trend Filter
trend = "bullish" if EMA_20 > EMA_50 else "bearish"

# Expansion Trigger
expansion = (
    BBWidth_change >= 20% AND 
    current_range >= 1.25 * ATR_20
)
```

### AI Enhancement

The service integrates LLMs to analyze squeeze patterns and provide:
- Signal classification (Continuation/Reversal/Chop)
- Confidence scoring and rationale
- Invalidation levels and targets
- Risk/reward analysis

### Backtesting Engine

Comprehensive backtesting with:
- Historical simulation
- Performance metrics (Sharpe, max drawdown, win rate)
- Risk management (stop loss, profit targets)
- Trade-by-trade analysis

## 📊 API Endpoints

- `POST /api/v1/analysis/analyze` - Single symbol analysis
- `POST /api/v1/analysis/batch` - Multi-symbol analysis
- `POST /api/v1/backtest/run` - Run backtest
- `GET /health/` - Health check

Full API documentation available at `/docs` when server is running.

## 🏗️ Architecture

```
volatility_scanner/
├── api/           # FastAPI web service
├── services/      # Business logic layer
├── models/        # Data models and schemas
├── utils/         # Technical indicators and helpers
├── config/        # Configuration management
└── cli.py         # Command-line interface
```

## 📈 Performance

- **Data Caching**: Configurable TTL for market data
- **Concurrent Processing**: Batch analysis with rate limiting
- **Memory Efficient**: Optimized data structures
- **Scalable**: Modular design for horizontal scaling

## 🔧 Configuration

Key environment variables:

```bash
# AI Integration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Data & Caching
YFINANCE_CACHE_TTL=3600
MAX_CONCURRENT_REQUESTS=10

# Technical Parameters
BB_PERIOD=20
SQUEEZE_PERCENTILE=10.0
EXPANSION_THRESHOLD=0.20
```

## 🧪 Testing

```bash
# Run all tests
make test

# Run specific test suites
make test-unit
make test-integration

# Check code quality
make lint
make format
```

## 📚 Documentation

Comprehensive documentation available in `/docs/volatility-squeeze-scanner.md` including:
- Architecture overview
- API reference
- Deployment guides
- Troubleshooting

## 🚀 Deployment

### Docker

```bash
make docker-build
make docker-run
```

### Production

```bash
# Production server
make server-prod

# With custom configuration
volatility-scanner server --workers 4 --host 0.0.0.0
```

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Support

- Documentation: `/docs` directory
- API Docs: `http://localhost:8000/docs`
- Issues: GitHub issues for bug reports