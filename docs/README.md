# Portfolio Documentation

Comprehensive documentation for all services in the portfolio.

## 📚 Services Documentation

### Trading & Analysis Services

#### [Penny Stock Scanner](penny-stock-scanner/) 🆕 ✅ Updated Nov 2025
Professional-grade scanner for identifying penny stocks before they explode.
- **Strategy**: Volume-focused (50%) explosion setup detection
- **Key Features**: Consolidation detection, volume spike analysis, signal continuity tracking, real-time web dashboard
- **Status**: Production-ready (fixed timezone & pagination issues)
- **Recent Fixes**: [Bug Fixes Nov 2025](penny-stock-scanner/bug-fixes-nov-2025.md)
- [System Overview](penny-stock-scanner/system-overview.md) | [User Guide](penny-stock-scanner/user-guide.md) | [Frontend Integration](penny-stock-scanner/frontend-integration.md)

#### [Volatility Squeeze Scanner](volatility-squeeze-scanner/)
Enterprise-grade scanner for volatility squeeze patterns.
- **Strategy**: Bollinger Band compression detection
- **Key Features**: ATR-based signals, AI analysis, backtesting
- **Status**: Production-ready
- [System Overview](volatility-squeeze-scanner/system-overview.md) | [User Guide](volatility-squeeze-scanner/user-guide.md)

#### [Unusual Options Service](unusual-options-service/)
Real-time unusual options activity tracker.
- **Strategy**: Volume, OI, and premium analysis
- **Key Features**: Signal expiration, performance tracking, spread detection
- **Status**: Production-ready
- [Quick Start](unusual-options-service/quick-start.md) | [System Overview](unusual-options-service/system-overview.md)

#### [Analyze Options Service](analyze-options-service/)
Comprehensive options analysis and strategy recommendation engine.
- **Strategy**: Multi-factor options analysis
- **Key Features**: Strategy recommendations, risk analysis, ML integration
- **Status**: Production-ready
- [User Guide](analyze-options-service/user-guide.md) | [Architecture](analyze-options-service/architecture.md)

#### [RDS Ticker Analysis](rds-ticker-analysis/)
Reddit sentiment analysis for stock tickers.
- **Strategy**: Social sentiment + market data integration
- **Key Features**: Reddit scraping, sentiment scoring, AI insights
- **Status**: Production-ready
- [System Overview](rds-ticker-analysis/system-overview.md)

#### [ML Options Predictor](ml-options-predictor/)
Machine learning-based options contract prediction.
- **Strategy**: Gradient boosting with feature engineering
- **Key Features**: Multi-timeframe prediction, confidence scoring
- **Status**: Beta
- [API Guide](ml-options-predictor/api-guide.md) | [CLI Guide](ml-options-predictor/cli-guide.md)

#### [Stock Opportunity Scanner](stock-scanner/) 🆕 ✅ Updated Dec 2025
CLI tool for identifying high-conviction stock buy opportunities.
- **Strategy**: Technical + Fundamental + Analyst confluence scoring
- **Key Features**: Narrative analysis, ASCII charts, AI-first architecture (v2.0.0), position management
- **New (v2.0.0)**: AI-first architecture, cloud mode default, simplified CLI
- **Status**: Production-ready (v2.0.0)
- [README](stock-scanner/README.md) | [Roadmap](stock-scanner/roadmap.md) | [Scan Analysis](screen-ticker/scan-command-analysis.md)

#### [AI Analyst "Victor Chen"](ai-analyst/) 🆕 ✅ Updated Dec 2025
AI "Employee" - a 67-year-old veteran Wall Street analyst with 45 years experience.
- **Strategy**: Deep ITM Call Debit Spreads with strict entry criteria
- **Personality**: Direct, decisive, protective of capital. Strong opinions backed by data.
- **Key Features**: 
  - **Thinking Mode**: See Victor's reasoning before his answer
  - **Agent Loop**: Victor can research proactively using tools
  - **Tool Calling**: web_search (Ollama API), get_ticker_data, scan_for_opportunities
  - **Fair Value**: "What is NVDA worth?" - P/E-based valuation analysis
  - Trade Grading (A/B/C/F), Risk Scoring (1-10), Scenario Analysis
- **Data Source**: Yahoo Finance + Ollama Web Search API
- **Status**: Production-ready (v1.7.0 - Thinking Mode)
- [README](ai-analyst/README.md)

#### [Odyssey](odyssey/) 🆕 ✅ New Nov 2025
Modern trading dashboard for market overview and opportunity detection.
- **Strategy**: Modular, extensible opportunity detection (Options, Technicals, Fundamentals)
- **Key Features**: Credit spread detection, market overview, sector analysis, configurable strategies
- **Status**: Production-ready
- [README](odyssey/README.md) | [Strategy Guide](odyssey/strategy-guide.md) | [User Guide](odyssey/user-guide.md)

### Shared Libraries

#### [AI Agent Shared Library](ai-agent/) 🆕 ✅ New Dec 2025
Shared AI agent logic for CLI (ai-analyst) and Frontend chat.
- **Components**: Victor persona prompts, tool definitions, question classification
- **Benefits**: Single source of truth, CLI testing → Frontend deployment
- [Integration Plan](ai-agent/INTEGRATION_PLAN.md) | [Library Guide](ai-agent/SHARED_LIBRARY.md)

### Supporting Services

#### [Database](db/)
Centralized database schemas and migrations.
- **Tables**: Tickers, penny_tickers, signals, options activity
- [README](db/README.md) | [Penny Tickers Guide](db/penny-tickers.md)

#### [Frontend](frontend/)
Next.js-based web interface for all services.
- **Features**: Dashboard, signal visualization, performance tracking, real-time updates
- **Scanners**: Volatility Squeeze, Unusual Options, Penny Stock Scanner
- [README](frontend/README.md) | [Vercel Build Fixes](frontend/vercel-build-fixes.md)

## 🔍 Service Comparison

| Service | Focus | Data Sources | Update Frequency | Best For |
|---------|-------|--------------|------------------|----------|
| Penny Stock Scanner | Penny stocks explosion setups | YFinance, Supabase | Daily | Finding penny breakouts |
| Volatility Squeeze Scanner | Volatility patterns | YFinance | Daily | Day/swing trading setups |
| Unusual Options | Options flow | Market data APIs | Real-time | Options trading signals |
| RDS Ticker Analysis | Social sentiment | Reddit, Market data | On-demand | Sentiment-driven trades |
| ML Options Predictor | Options prediction | Historical options | Batch | ML-based forecasting |
| Odyssey | Opportunity detection | YFinance | Real-time | Multi-strategy opportunity scanning |
| Stock Scanner | Buy opportunity scoring | YFinance | Daily | High-conviction long entries |
| AI Analyst | Entry decisions with history | YFinance, Supabase | On-demand | Ticker analysis + strategy |

## 🚀 Quick Start by Use Case

### "I want to find penny stocks before they explode"
→ Use **[Penny Stock Scanner](penny-stock-scanner/)**
```bash
cd penny-stock-scanner
# Quick test (recommended first run)
poetry run penny-scanner scan-all --min-score 0.50 --max-symbols 100

# Full scan (1715 symbols, ~15-20 minutes)
poetry run penny-scanner scan-all --min-score 0.50
```

### "I want to find volatility squeeze setups"
→ Use **[Volatility Squeeze Scanner](volatility-squeeze-scanner/)**
```bash
cd volatility-squeeze-scanner
volatility-scanner scan-all --min-score 0.7
```

### "I want to track unusual options activity"
→ Use **[Unusual Options Service](unusual-options-service/)**
```bash
cd unusual-options-service
unusual-options scan --volume-threshold 2.0
```

### "I want to analyze a specific stock with social sentiment"
→ Use **[RDS Ticker Analysis](rds-ticker-analysis/)**
```bash
cd rds-ticker-analysis
rds-analyze AEMD --fast
```

### "I want options strategy recommendations"
→ Use **[Analyze Options Service](analyze-options-service/)**
```bash
cd analyze-options-service
analyze-options AAPL --with-ml
```

### "I want a dashboard to monitor market conditions and opportunities"
→ Use **[Odyssey](odyssey/)**
```
Navigate to /odyssey in the frontend
Configure watchlist and strategy parameters
View real-time market overview and detected opportunities
```

### "I want to find high-conviction buy opportunities across S&P 500"
→ Use **[Stock Opportunity Scanner](stock-scanner/)**
```bash
cd screen-ticker
bun run scan:sp500
# Or specific tickers
bun run scan --tickers NVDA,AAPL,GOOGL --min-score 70
# AI-powered analysis (v2.0.0 - AI is now default)
bun run analyze NVDA
# Position management
bun run analyze NVDA --position "165/170 Call Debit Spread"
```

### "I want AI-powered analysis with my trade history"
→ Use **[AI Analyst](ai-analyst/)**
```bash
cd ai-analyst
bun install
# Analyze a ticker with AI
bun run analyze NVDA
# Import Robinhood export
bun run import ~/Downloads/robinhood-export.csv
# View trade history
bun run journal --stats
```

## 📊 Data Architecture

### Data Flow
```
External APIs (YFinance, Reddit, Market Data)
    ↓
Services (Scanners, Analyzers)
    ↓
Supabase Database (Signals, Tickers, Performance)
    ↓
Frontend Dashboard (Visualization)
```

### Database Tables
- `penny_tickers`: ~2000 penny stocks ($0.10-$5.00)
- `tickers`: ~12,000 all market tickers
- `penny_stock_signals`: Penny stock explosion signals
- `volatility_squeeze_signals`: Squeeze signals
- `unusual_options_activity`: Options flow data
- `signal_performance_tracking`: Performance metrics
- `stock_opportunities`: Daily buy opportunity scores
- `analyst_trades`: AI Analyst trade journal (from Robinhood CSV)
- `analyst_observations`: Trading patterns and rules learned over time
- `analyst_performance`: Weekly/monthly performance snapshots

## 🛠️ Development

### Prerequisites
- Python 3.11+
- Poetry (Python dependency management)
- Node.js 18+ (for frontend)
- Supabase account

### Environment Setup
Each service requires a `.env` file:
```bash
# Copy template
cp env.example .env

# Required for most services
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_key

# Optional: AI features
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OLLAMA_API_KEY=your_key  # For Stock Scanner AI (cloud mode)
```

### Running Services Locally
```bash
# Python services (most scanners/analyzers)
cd service-name/
poetry install
poetry run service-cli command

# Frontend
cd frontend/
bun install
bun dev
```

## 📝 Documentation Standards

All service documentation includes:
- ✅ README.md (quick start, features)
- ✅ system-overview.md (architecture, strategy)
- ✅ user-guide.md (CLI usage, examples)
- ✅ technical-implementation.md (developer docs)

## 🤝 Contributing

When adding new features:
1. Update relevant documentation in `docs/`
2. Add database schemas to `db/` if needed
3. Follow existing service patterns
4. Include comprehensive examples
5. Test full workflow before committing

## 📄 License

Proprietary software. All rights reserved.

## 🔗 Quick Links

- [Database Schemas](db/)
- [Frontend Documentation](frontend/)
- [Performance Optimization Guide](performance-optimization-complete.md)
- [Analysis Service Consolidation](analysis-service-consolidation.md)

---

**Last Updated**: 2025-12-27
**Services Count**: 10 active services + 1 shared library
**Documentation Coverage**: 100%
