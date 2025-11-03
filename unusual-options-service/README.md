# Unusual Options Activity Scanner

Enterprise-grade unusual options activity detection system for identifying potential trading opportunities based on unusual institutional and informed trading patterns. This CLI-driven system monitors options flow, detects anomalies, and generates high-conviction signals that may indicate insider information or smart money positioning.

## 🚀 Features

### Core Capabilities
- **🕵️ Insider-Focused Detection**: Built to find suspicious plays that might indicate insider information
- **🚫 0DTE Noise Filter**: Automatically excludes 0-2 DTE gambling noise from TSLA/NVDA/META/AMZN
- **📊 Earnings Calendar Integration**: Shows earnings proximity and boosts pre-earnings positioning scores
- **Volume Anomaly Detection**: Identifies options contracts with unusual volume vs historical averages
- **Open Interest Analysis**: Tracks significant changes in open interest that may signal positioning
- **Premium Flow Tracking**: Monitors large premium expenditures and aggressive orders
- **Put/Call Ratio Analysis**: Detects unusual imbalances in put/call activity
- **Sweep Detection**: Identifies aggressive sweep orders across multiple exchanges
- **Time & Sales Analysis**: Real-time monitoring of large block trades
- **Historical Performance Tracking**: Backtests signals to measure predictive accuracy
- **Multi-timeframe Scoring**: Analyzes activity across intraday, daily, and weekly windows

### Technical Excellence
- **CLI-First Design**: Fast, scriptable command-line interface for automation
- **Supabase Integration**: Cloud-native storage for signals and historical performance
- **Async Architecture**: High-performance concurrent data processing
- **Rate Limit Management**: Intelligent request throttling for data providers
- **Signal Grading System**: S/A/B/C/D/F tier classification based on conviction
- **Risk Scoring**: Multi-factor risk assessment for each signal
- **Alert System**: Configurable notifications for high-conviction signals
- **🤖 Automated Hourly Scanning**: GitHub Actions + cron job support with deduplication
- **📊 Signal Continuity Tracking**: Tracks signal lifecycle (NEW → CONTINUING → INACTIVE)
- **🔄 Smart Deduplication**: Prevents duplicate signals, tracks re-detections

## 📊 Signal Detection

### What Makes Options Activity "Unusual"?

1. **Volume Anomalies**
   - Current volume > 3x average daily volume
   - Volume surge in specific strikes near current price
   - Concentration in near-term expiries (< 30 DTE)

2. **Premium Flow**
   - Large single orders > $100k premium
   - Aggressive buying at ask (not limit orders)
   - Sustained buying pressure over multiple time windows

3. **Open Interest Changes**
   - Significant OI build in single strikes (> 20% daily increase)
   - OI accumulation in ITM or ATM strikes
   - Unusual OI in far-dated options (potential hedging or positioning)

4. **Directional Signals**
   - Heavy call buying → bullish signal
   - Heavy put buying → bearish signal
   - Collar/spread building → volatility expectations

5. **Smart Money Indicators**
   - Block trades executed during low liquidity periods
   - Sweep orders across multiple exchanges (urgency signal)
   - Institutional order patterns (size, timing, execution style)

## 🛠 Installation

### Prerequisites
- Python 3.11+
- Poetry for dependency management
- Supabase account for data storage
- Market data API access (see Data Sources below)

### Setup
```bash
# Clone the repository
cd unusual-options-service

# Install dependencies
poetry install

# Configure environment variables
cp .env.example .env
# Edit .env with your API credentials

# Initialize database
unusual-options init

# Verify setup
unusual-options status
```

## 📊 Advanced Analysis Suite

The service includes a comprehensive suite of analysis tools designed for quants and investment professionals:

### Core Analysis Tools

1. **Insider Plays Detector** (`scripts/insider_plays.py`) 🎯 **[PRIMARY TOOL]** - Find suspicious insider-type plays
   - Deduplicated signal aggregation (each signal shown once with all matched patterns)
   - Mega-cap filter (excludes normal flow in TSLA, AAPL, etc.)
   - Surprise factor ranking (relative to ticker's normal volume)
   - Composite scoring: suspicion × surprise factor
   - See [Insider Plays Improvements](../docs/unusual-options-service/insider-plays-improvements.md)

2. **Signal Analysis** (`scripts/analyze_results.py`) - Statistical overview with AI insights
3. **Trade Sizing** (`scripts/trade_sizing.py`) - Kelly Criterion position sizing with Monte Carlo simulation  
4. **Correlation Analysis** (`scripts/signal_correlation.py`) - Cross-ticker correlations and market regime detection
5. **Flow Divergence** (`scripts/flow_divergence.py`) - Identify unusual patterns in positioning
6. **Momentum Tracker** (`scripts/momentum_tracker.py`) - Track acceleration, exhaustion, and reversals

### Quick Analysis
```bash
# PRIMARY: Find suspicious insider-type plays (with earnings + 0DTE filter)
poetry run python scripts/insider_plays.py --days 3 --min-grade A

# Statistical overview of signals
poetry run python scripts/analyze_results.py --days 7 --min-grade A
```

### Analysis Features
- **📈 Statistical Analysis**: Volume, premium flow, score distributions
- **🎯 Grade-Based Breakdown**: Performance by signal quality (S/A/B/C/D/F)
- **🏆 Top Performers**: Best tickers, signals, and opportunities
- **⚠️ Risk Analysis**: Risk level distribution and common risk factors
- **🤖 AI Insights**: OpenAI-powered analysis and recommendations (optional)
- **💰 Premium Flow Tracking**: Institutional money movement analysis

### Sample Output
```
📊 Signal Overview
┌──────────────────────┬────────────────┐
│ Total Signals        │ 770            │
│ Average Premium Flow │ $6,288,465     │
│ Total Premium Flow   │ $4,842,117,767 │
└──────────────────────┴────────────────┘

🏆 Top Tickers by Premium Flow
┌────────┬─────────┬────────────────┐
│ TSLA   │     129 │ $1,761,828,476 │
│ NVDA   │      72 │   $624,266,687 │
│ META   │     116 │   $612,807,299 │
└────────┴─────────┴────────────────┘
```

See [Signal Analysis Tool Documentation](docs/signal-analysis-tool.md) for complete details.

### Environment Variables
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Market Data APIs (choose one or more)
# Option 1: Polygon.io (recommended)
POLYGON_API_KEY=your_polygon_api_key

# Option 2: Tradier
TRADIER_API_KEY=your_tradier_api_key

# Option 3: CBOE DataShop
CBOE_API_KEY=your_cboe_api_key

# Optional: Alert Configuration
DISCORD_WEBHOOK_URL=your_discord_webhook
ALERT_MIN_GRADE=B
```

## 🚀 Quick Start

### Basic Scanning

```bash
# Scan single ticker
unusual-options scan AAPL

# Scan multiple tickers
unusual-options scan AAPL MSFT TSLA NVDA

# Scan watchlist from file
unusual-options scan --watchlist watchlists/tech.txt

# Continuous monitoring (refresh every 5 minutes)
unusual-options scan AAPL --watch --interval 300
```

### Automated Hourly Scanning (NEW! 🚀)

Run automated scans every hour with smart deduplication:

```bash
# Run hourly scan manually
poetry run python scripts/cron_scanner.py --scan-all --min-grade B

# Set up GitHub Actions (recommended)
# See docs/unusual-options-service/hourly-cron-setup.md

# Set up local cron job
30 9-16 * * 1-5 cd /path/to/unusual-options-service && \
  poetry run python scripts/cron_scanner.py --scan-all --min-grade B
```

**Key Features:**
- ✅ Automatic deduplication (no duplicate signals)
- ✅ Continuity tracking (NEW/CONTINUING badges)
- ✅ Stale signal cleanup (marks inactive signals)
- ✅ GitHub Actions integration
- ✅ Complete audit trail

**See:** [Hourly Cron Setup Guide](../docs/unusual-options-service/hourly-cron-setup.md)

### Advanced Analysis

```bash
# Include historical performance of similar signals
unusual-options scan AAPL --include-backtest

# Filter by minimum signal grade
unusual-options scan AAPL MSFT --min-grade A

# Export results to JSON
unusual-options scan AAPL --output results/aapl_options.json

# Run full market scan (top 500 liquid tickers)
unusual-options market-scan --limit 500 --min-grade B

# Analyze specific option chain
unusual-options analyze AAPL --expiry 2025-11-15 --strike 180
```

### Signal Management

```bash
# List recent signals
unusual-options signals list --days 7

# Show signal details
unusual-options signals show <signal_id>

# Track signal performance
unusual-options signals track <signal_id> --days 30

# Export signal history
unusual-options signals export --start 2025-09-01 --end 2025-10-01 --format csv
```

### Historical Analysis

```bash
# Backtest detection algorithm
unusual-options backtest --start 2024-01-01 --end 2024-12-31

# Analyze past signals performance
unusual-options performance --ticker AAPL --days 90

# Generate performance report
unusual-options report --month 2025-09
```

## 📈 Signal Grading System

### Grade Classifications

**S Tier (≥0.90)** - Exceptional Opportunity
- Multiple strong anomaly indicators
- Historical win rate > 70%
- Large premium flow (> $1M)
- Institutional order patterns detected
- Low implied volatility suggesting mispricing

**A Tier (0.80-0.89)** - High Conviction
- Strong volume and OI anomalies
- Premium flow > $500k
- Historical win rate > 60%
- Sweep orders detected
- Clear directional bias

**B Tier (0.70-0.79)** - Good Signal
- Significant volume anomaly (> 3x average)
- Moderate premium flow (> $200k)
- Historical win rate > 50%
- Worth monitoring closely

**C Tier (0.60-0.69)** - Watch List
- Moderate unusual activity
- May be early positioning
- Requires confirmation
- Consider waiting for stronger signals

**D Tier (0.50-0.59)** - Low Conviction
- Weak or mixed signals
- May be noise or retail activity
- High risk, low probability

**F Tier (<0.50)** - Avoid
- Likely false positive
- No clear directional bias
- Poor historical performance
- Potential manipulation or pump

### Scoring Components

1. **Volume Score (30%)**: Current volume vs historical average
2. **Premium Flow Score (25%)**: Size and aggressiveness of orders
3. **Open Interest Score (20%)**: OI changes and concentration
4. **Historical Performance Score (15%)**: Win rate of similar signals
5. **Technical Alignment Score (10%)**: Correlation with price action

## 🔍 Data Sources

### Recommended Providers

**Polygon.io** (Best Overall)
- ✅ Real-time options quotes
- ✅ Historical options data
- ✅ Time & sales data
- ✅ Unusual activity feed
- Cost: $199-$399/month

**Tradier** (Good Alternative)
- ✅ Real-time options chains
- ✅ Market data API
- ✅ Sandbox environment
- Cost: $10-$25/month (after free tier)

**CBOE DataShop** (Premium)
- ✅ Exchange-level data
- ✅ Most accurate volume/OI
- ✅ Historical depth
- Cost: $$$ (enterprise pricing)

**YFinance** (Free Tier Option)
- ⚠️ Limited real-time data
- ⚠️ No sweep detection
- ⚠️ Delayed unusual activity
- Cost: Free (with limitations)

## 🏗 Architecture

### System Components

```
unusual_options/
├── cli.py              # Command-line interface
├── scanner/            # Core scanning logic
│   ├── detector.py     # Anomaly detection algorithms
│   ├── analyzer.py     # Signal analysis and scoring
│   └── filters.py      # Data filtering and validation
├── data/               # Data acquisition layer
│   ├── providers/      # API client implementations
│   ├── options.py      # Options chain data models
│   └── cache.py        # Local caching strategy
├── scoring/            # Signal scoring system
│   ├── grader.py       # Grade calculation
│   ├── risk.py         # Risk assessment
│   └── performance.py  # Historical performance tracking
├── storage/            # Database layer
│   ├── supabase.py     # Supabase client
│   └── models.py       # Data models
├── alerts/             # Notification system
│   ├── discord.py      # Discord webhooks
│   └── filters.py      # Alert filtering logic
└── utils/              # Shared utilities
    ├── indicators.py   # Technical indicators
    └── logger.py       # Logging configuration
```

### Data Flow

```
1. Data Ingestion
   ↓
2. Options Chain Analysis
   ↓
3. Anomaly Detection
   ↓
4. Signal Scoring & Grading
   ↓
5. Storage (Supabase)
   ↓
6. Alert Dispatch (if threshold met)
   ↓
7. Performance Tracking
```

## 📊 Database Schema

### Tables

**unusual_options_signals**
- Signal metadata and detection details
- Ticker, expiry, strike, option type
- Volume, OI, premium flow metrics
- Signal grade and confidence score
- Detection timestamp

**signal_performance**
- Forward returns tracking (1d, 5d, 30d)
- Win/loss classification
- Entry and exit prices
- Actual vs expected outcomes

**options_flow_history**
- Raw options flow data
- Time & sales records
- Block trades and sweeps
- Premium calculations

**scanner_config**
- Detection thresholds
- Watchlist management
- Alert preferences

## 🎯 Use Cases

### 1. Day Trading Setup
```bash
# Morning scan for unusual premarket activity
unusual-options market-scan --premarket --min-grade B

# Monitor specific earnings plays
unusual-options scan TSLA NVDA --watch --interval 60
```

### 2. Swing Trading
```bash
# Find medium-term positioning (30-60 DTE)
unusual-options scan --dte-min 30 --dte-max 60 --min-premium 500000

# Track signal performance over weeks
unusual-options signals track <signal_id> --days 30
```

### 3. Event-Driven Trading
```bash
# Pre-earnings unusual activity
unusual-options scan --earnings-soon --days-before 7

# Post-news flow analysis
unusual-options scan AAPL --hours 2
```

### 4. Research & Backtesting
```bash
# Historical analysis
unusual-options backtest --start 2024-01-01 --end 2024-12-31

# Performance by ticker
unusual-options performance --ticker SPY --days 365

# Signal quality metrics
unusual-options metrics --month 2025-09
```

## ⚙️ Configuration

### Detection Thresholds

```python
# Volume anomaly detection
VOLUME_MULTIPLIER_THRESHOLD = 3.0  # 3x average volume
VOLUME_LOOKBACK_DAYS = 20

# Premium flow detection
MIN_PREMIUM_FLOW = 100000  # $100k minimum
AGGRESSIVE_ORDER_THRESHOLD = 0.7  # 70% at ask or above

# Open interest changes
OI_CHANGE_THRESHOLD = 0.20  # 20% increase
OI_LOOKBACK_DAYS = 5

# Sweep detection
MIN_SWEEP_LEGS = 3  # Minimum exchanges hit
SWEEP_TIME_WINDOW = 5  # seconds
```

### Watchlist Management

```bash
# Create watchlist
unusual-options watchlist create tech --tickers AAPL,MSFT,GOOGL,META

# Scan entire watchlist
unusual-options scan --watchlist tech

# Update watchlist
unusual-options watchlist add tech NVDA,AMD

# List all watchlists
unusual-options watchlist list
```

## 📈 Performance Metrics

### Signal Accuracy (Based on Historical Backtests)

- **S Tier Signals**: 65-75% win rate
- **A Tier Signals**: 55-65% win rate
- **B Tier Signals**: 50-55% win rate
- **C Tier Signals**: 45-50% win rate

*Win defined as: Underlying moves > 2% in signal direction within 5 trading days*

### Processing Speed

- Single ticker scan: < 2 seconds
- Market-wide scan (500 tickers): 5-10 minutes
- Historical backtest (1 year): 15-30 minutes

## ⚠️ Important Disclaimers

### Legal & Compliance

1. **Not Financial Advice**: This tool is for educational and research purposes only
2. **No Insider Trading**: Detecting unusual activity ≠ acting on insider information
3. **Market Risk**: Past unusual activity does not guarantee future results
4. **Data Limitations**: Accuracy depends on data provider quality

### Known Limitations

- Cannot detect off-exchange or dark pool activity
- Data may be delayed (depends on provider)
- False positives possible (retail herding, hedging activity)
- Does not account for broader market context

### Risk Management

- Never risk more than 1-2% per trade
- Use stop losses on all positions
- Consider signal grade in position sizing
- Verify unusual activity with multiple indicators
- Be aware of catalysts (earnings, FDA approvals, etc.)

## 🔬 Research & Development

### Planned Features

**Phase 1** (Current)
- ✅ Basic unusual volume detection
- ✅ CLI interface
- ✅ Supabase integration
- 🔄 Signal grading system
- 🔄 Historical performance tracking

**Phase 2** (Next 3 months)
- 📋 Real-time streaming data
- 📋 Advanced sweep detection
- 📋 Dark pool correlation
- 📋 Machine learning signal enhancement
- 📋 Discord/Telegram alerts

**Phase 3** (6+ months)
- 📋 Multi-asset support (futures options, index options)
- 📋 Portfolio-level risk management
- 📋 Signal correlation analysis
- 📋 Custom indicator builder
- 📋 Web dashboard

## 📚 Additional Resources

### Recent Updates
- [October 10, 2025 - Core Scanner Improvements](../docs/unusual-options-service/oct-10-2025-core-scanner-improvements.md) - 0DTE filter + earnings calendar
- [October 9, 2025 - Insider Plays Updates v2](../docs/unusual-options-service/oct-9-2025-updates-v2.md) - Deduplication, mega-cap filter, surprise factor
- [Insider Plays Improvements](../docs/unusual-options-service/insider-plays-improvements.md) - Detection algorithm details
- [Project Refocus](../docs/unusual-options-service/project-refocus.md) - Core mission and goals

### Learning Resources
- [Options Volume & Open Interest Guide](docs/volume-oi-guide.md)
- [Understanding Unusual Activity](docs/unusual-activity-patterns.md)
- [Signal Interpretation Guide](docs/signal-interpretation.md)
- [Risk Management Best Practices](docs/risk-management.md)

### API Documentation
- [CLI Command Reference](docs/cli-reference.md)
- [Python API Usage](docs/python-api.md)
- [Supabase Schema](docs/database-schema.md)

## 🤝 Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

## 📄 License

This project is proprietary software for personal use only. All rights reserved.

---

**Remember**: Unusual options activity can indicate smart money positioning, but it can also be hedging, speculation, or noise. Always combine with your own analysis, risk management, and trading plan.
