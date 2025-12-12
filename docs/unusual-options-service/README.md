# Unusual Options Activity Scanner - Documentation

This directory contains comprehensive documentation for the Unusual Options Activity Scanner system.

## 📚 Documentation Index

### Getting Started
- [System Overview](system-overview.md) - High-level architecture and concepts
- [Installation Guide](installation-guide.md) - Setup and configuration
- [Quick Start Tutorial](quick-start.md) - First scans and basic usage
- [FAQ](faq.md) - Frequently asked questions and troubleshooting

### Core Concepts
- [Understanding Unusual Activity](understanding-unusual-activity.md) - What makes options activity unusual
- [Signal Grading System](signal-grading.md) - How signals are scored and classified
- [Detection Algorithms](detection-algorithms.md) - Technical details of anomaly detection

### User Guides
- [CLI Reference](cli-reference.md) - Complete command-line interface documentation
- [Scanning Strategies](scanning-strategies.md) - How to scan effectively for different trading styles
- [Signal Interpretation](signal-interpretation.md) - How to read and act on signals
- [Watchlist Management](watchlist-management.md) - Creating and managing ticker watchlists
- [Grouped Ticker View](grouped-ticker-view.md) - Frontend UI for aggregated signal display
- [Filter System](filter-system.md) - Comprehensive filtering and search capabilities
- [Price Chart Visualization](price-chart-visualization.md) - Interactive charts with option detection overlay
- [Spread Detection](spread-detection.md) - Multi-leg strategy detection system
- [Frontend Spread Updates](frontend-spread-detection-updates.md) - UI changes for spread visualization
- [Spread Detection Results](spread-detection-results.md) - Analysis of recent scan data
- [Spread Detection Quick Start](SPREAD_DETECTION_QUICKSTART.md) - 3-step guide to see spreads

### Technical Documentation
- [Architecture](architecture.md) - System design and components
- [Database Schema](database-schema.md) - Supabase table structures and relationships
- [Signal Expiration](signal-expiration.md) - Automated daily expiration system
- [API Integration](api-integration.md) - Data provider integration details
- [Performance Tuning](performance-tuning.md) - Optimization and scaling
- [Timezone Handling](../timezone-handling.md) - UTC storage and EST display strategy

### Advanced Topics
- [Backtesting](backtesting.md) - Historical performance analysis
- [Risk Management](risk-management.md) - Position sizing and risk controls
- [Alert Configuration](alerts.md) - Setting up notifications
- [Custom Indicators](custom-indicators.md) - Extending the detection system
- [0DTE and Meme Stock Filtering](0dte-meme-stock-filtering.md) - Enhanced noise reduction system
- [Hourly Cron Job Setup](hourly-cron-setup.md) - Automated scanning with deduplication and continuity tracking

### Research & Analysis
- [Options Flow Patterns](options-flow-patterns.md) - Common patterns and their meanings
- [Case Studies](case-studies.md) - Real-world examples and lessons learned
- [Performance Metrics](performance-metrics.md) - Historical accuracy and statistics
- [Signal Analysis - November 2025](signal-analysis-nov-2025.md) - Deep dive analysis of 1,025 signals with trading strategies
- [Trading Strategy Framework](trading-strategy-framework.md) - Systematic approach to identify and execute best plays

## 🎯 Quick Links

### For Traders
- **Day Traders**: See [Intraday Scanning](scanning-strategies.md#intraday-scanning)
- **Swing Traders**: See [Multi-Day Signals](scanning-strategies.md#swing-trading)
- **Options Sellers**: See [High IV Opportunities](signal-interpretation.md#selling-premium)
- **Systematic Trading**: See [Trading Strategy Framework](trading-strategy-framework.md) - Complete playbook for signal execution

### For Automation
- **GitHub Actions Workflow**: See [GitHub Actions Setup](github-actions-setup.md) - Complete automated scanning guide
- **Fast Scanner Workflow**: Hard-coded ticker watchlist for focused scanning (see below)
- **Signal Lifecycle**: See [Signal Lifecycle](github-actions-setup.md#signal-lifecycle) - How signals are tracked over time
- **Signal Expiration**: See [Signal Expiration](signal-expiration.md) - Automatic daily expiration of options signals
- **Deduplication**: See [How It Works](github-actions-setup.md#how-it-works) - Prevents duplicate signals
- **Troubleshooting**: See [Troubleshooting](github-actions-setup.md#-troubleshooting) - Common issues and solutions

### Troubleshooting
- **Common Questions**: See [FAQ](faq.md) - Frequently asked questions and solutions
- **Frontend Not Showing Signals**: See [RLS Troubleshooting](troubleshooting-rls.md) - Fix Row Level Security issues
- **Signal Lifecycle Questions**: See [FAQ - Signal Lifecycle](faq.md#signal-lifecycle)
- **Database Connection Issues**: Verify Supabase credentials

### For Developers
- **Integration**: See [Python API](python-api.md)
- **Contributing**: See [Development Guide](development.md)
- **Testing**: See [Testing Guide](testing.md)

## 📖 Documentation Standards

All documentation follows these principles:
1. **Practical Examples**: Every concept includes working examples
2. **Risk Awareness**: Clear disclaimers and risk warnings
3. **Progressive Detail**: Start simple, offer deep dives for advanced users
4. **Up-to-date**: Documentation updated with each feature release

## ⚡ Fast Scanner Workflow

The portfolio includes a **fast scanner workflow** (`.github/workflows/uos-fast.yml`) that scans a hard-coded watchlist of tickers. This is ideal for:
- Focused scanning on your favorite tickers
- Faster execution times
- Lower API usage
- Custom watchlist monitoring

### Configured Tickers
The workflow is pre-configured to scan these tickers:
```
PLTR TSLA SPY QQQ HIMS
```

### How to Customize
1. Open `.github/workflows/uos-fast.yml`
2. Find the `HARDCODED_TICKERS` variable (around line 76)
3. Edit the space-separated list of tickers (note: use spaces, not commas)
4. Commit and push your changes

**Example:**
```bash
HARDCODED_TICKERS="AAPL TSLA NVDA AMD GOOGL MSFT"
```

### Schedule
- **Runs every 5 minutes** during US market hours (9:30 AM - 4:00 PM ET)
- **78 scans per day** - Catches unusual activity as it happens
- Scans only your watchlist tickers (much faster than full market scan)
- Can also be triggered manually from GitHub Actions UI
- Manual trigger supports custom ticker input to override hard-coded list

### Usage
**Scheduled Run**: Automatically scans hard-coded tickers at scheduled times

**Manual Trigger**:
- Go to GitHub Actions → "Unusual Options Fast Scanner (Watchlist)"
- Click "Run workflow"
- Optionally provide custom tickers to override the hard-coded list
- Set minimum grade (default: B)

## 🔄 Recent Updates

**December 2025**
- **Signal Quality Improvements**: Major scoring and filtering overhaul
  - Fixed grade inflation (51% S-grade → ~5% target)
  - Added DTE filtering (removes 0-7 day noise)
  - Implemented ticker caps (max 5 signals per ticker)
  - Higher premium thresholds for TSLA/NVDA/SPY ($3M vs $500K)
  - See [Signal Quality Improvements](signal-quality-improvements.md)
- **Discord Alerts Integration**: Real-time notifications for high-conviction plays
  - Automated alerts sent via Discord webhooks
  - Weekly performance reports every Sunday at 6 PM ET
  - Configurable minimum score threshold
  - Rich embeds with signal details, grade, and metrics
  - See [Discord Alerts Setup](#discord-alerts-setup) below
- **Hedge Detection System**: Filter out hedge fund portfolio hedging activity
  - Identify Index/Sector ETF puts, mega-cap protective puts, LEAPS hedges
  - `--exclude-hedges` flag for `insider_plays.py`
  - New `hedge_analyzer.py` script for hedge vs directional breakdown
- **Performance Tracker**: Measure actual signal performance
  - 1-day and 5-day forward return calculations
  - Win rate tracking by grade and option type
  - `performance_tracker.py` script for historical analysis
- **Stricter Insider Play Filters**: Reduced false positives
  - Default strict mode: $2M+ premium, 7-45 DTE, >65% aggressive orders
  - ETF filtering for hedge activity
  - `--relaxed` flag to restore previous behavior

**November 6, 2025**
- **Fast Scanner Workflow**: Added hard-coded ticker watchlist for focused scanning
  - **Runs every 5 minutes** during market hours (78 scans/day)
  - Pre-configured with popular tickers (PLTR, TSLA, SPY, QQQ, HIMS)
  - Easy to customize by editing the workflow file
  - Supports manual override with custom tickers
  - Faster execution and lower API usage than full market scan
- **Universal 0DTE Filtering** - Smarter approach to reducing noise
  - **No longer blocking popular tickers** like TSLA, NVDA, SPY, QQQ
  - Instead: **Filter 0DTE and 1DTE contracts universally** across all tickers
  - Catches legitimate unusual activity on popular stocks
  - Eliminates day-trader noise without throwing away good signals
  - Configurable via `MIN_DTE_ALL_TICKERS` (default: 2 days minimum)
- **Ticker Validation Improvements**
  - Scanner now accepts any ticker, even if not in database
  - Useful for ETFs, newly listed stocks, and tickers pending database sync
  - Reduced logging noise from database lookups
- **Trading Strategy Framework**: Complete systematic approach to signal execution
  - 5-Filter System to reduce 1000+ signals to 10-20 best plays
  - 10-point validation checklist for every trade
  - Position sizing framework using adapted Kelly Criterion
  - Multi-signal correlation strategies with scoring system
  - 3-tier portfolio approach (60% core, 30% opportunistic, 10% spec)
  - Weekly workflow and daily monitoring routines
  - Advanced strategies: straddles, spreads, calendar spreads, sector baskets
  - See [Trading Strategy Framework](trading-strategy-framework.md)
- **Automated Analysis Script**: Python tool implementing 5-Filter System
  - Located at `scripts/analyze_best_plays.py`
  - Automatically filters, ranks, and categorizes signals
  - Provides tier-based recommendations and sector analysis
  - Command: `python analyze_best_plays.py signals.csv`
- **Trading Cheatsheet**: One-page quick reference for active trading
  - Print-friendly format with all essential rules
  - Position sizing matrix, exit rules, commandments
  - Pre-trade checklist and daily monitoring routine
  - See [Trading Cheatsheet](trading-cheatsheet.md)

**November 5, 2025**
- **Signal Analysis Report**: Comprehensive analysis of 1,025 unusual options signals
  - Analyzed Nov 3-5 data with $1.9B total premium flow
  - Identified top plays: AAPL, TSM, AMD with specific strike/expiry recommendations
  - Detailed trading strategies: momentum, high probability, volatility, swing trades
  - Risk management guidelines and position sizing recommendations
  - See [Signal Analysis - November 2025](signal-analysis-nov-2025.md)
- **Row Level Security Fix**: Added RLS policies for frontend access
  - Frontend can now read signals from database
  - Issue: Tables had RLS enabled but no policies configured
  - Fix: Added public read policies for all unusual options tables
  - Run migration: `db/migrations/add_rls_policies_unusual_options.sql`
- **Continuity Tracking Fix**: Fixed signals being marked inactive after 3 hours
  - Signals now only marked inactive when option contract actually expires
  - Previously: Marked inactive if not detected in last 3 hours
  - Now: Marked inactive only when `expiry < CURRENT_DATE`
  - This prevents active signals from disappearing between scans
  - Updated database function `mark_stale_signals_inactive()` and Python code

**November 4, 2025**
- **Price Chart Visualization**: Interactive stock price charts with option detection overlay
- **Unified Timeline View**: Merged chart and signal details into single interactive tab
- **Click-to-Pin Tooltips**: Click detection dots to pin tooltips in place for easy interaction
- **Enhanced Pinned Tooltip UX**: 
  - Polished design with arrow pointer to detection dot
  - Pulsing ring animation on active detection
  - Semi-transparent overlay for focus
  - Smooth fade-in/zoom animations
  - Close via X button, ESC key, or click outside
  - Auto-closes when clicking signal to navigate
- **Flat Signal Display**: Streamlined signal list with sticky date headers
- **Multi-Signal Detection**: Smart handling of grouped options at same timestamp
- **Click-to-Navigate**: Click tooltip signals to jump to detail view in table
- **Robinhood/Perplexity-Style Design**: Clean, minimal charts with modern aesthetic
- **Multi-Timeframe Analysis**: Support for 1D, 1W, 1M, 3M, 1Y, 5Y, MAX ranges
- **Yahoo Finance Integration**: Real-time price data without API keys

**November 3, 2025**
- **GitHub Actions Fix**: Fixed `--no-root` installation issue preventing CLI from running
- **Timezone Fix**: Resolved UTC timestamp mismatch causing false inactive signals
- **Diagnostic Tool**: Added comprehensive diagnostics script for continuity verification
- **Complete Documentation**: New [GitHub Actions Setup Guide](github-actions-setup.md)

**November 2, 2025**
- **Hourly Cron Job System**: Complete automated scanning setup
- **Signal Deduplication**: Prevents duplicate signals on every run
- **Continuity Tracking**: Tracks signal lifecycle (NEW → CONTINUING → INACTIVE)
- **Enhanced Database Schema**: Added signal continuity fields and functions
- **GitHub Actions Workflow**: Automated hourly execution during market hours

**October 30, 2025**
- Added Grouped Ticker View documentation
- Frontend UI enhancement for signal aggregation
- Improved user experience for multi-signal analysis

**October 2025**
- Initial documentation structure created
- System overview and architecture documented
- CLI reference completed

## 🔔 Discord Alerts Setup

### Prerequisites
1. A Discord server where you have permission to create webhooks
2. A channel dedicated to options alerts (recommended)

### Setup Steps

**1. Create Discord Webhook**
```
Server Settings → Integrations → Webhooks → New Webhook
```
- Name it "Options Alerts" or similar
- Select the target channel
- Copy the webhook URL

**2. Configure Local Environment**
```bash
# Add to unusual-options-service/.env or root .env
DISCORD_UOS_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

**3. Configure GitHub Actions (for automated alerts)**
```
Repository Settings → Secrets → Actions → New repository secret
```
- Name: `DISCORD_UOS_WEBHOOK_URL`
- Value: Your webhook URL

### Alert Types

**Real-time Insider Play Alerts**
- Triggered after each scan (every 5 mins during market hours)
- Shows high-conviction plays with score ≥70
- Includes ticker, strike, expiry, premium, grade, and action recommendation

**Weekly Performance Report**
- Sent every Sunday at 6 PM ET
- Summary of signal performance over the past week
- Win rates by grade and option type
- Hedge vs directional breakdown

### Manual Testing
```bash
# Test alerts with signals from last day
poetry run python scripts/discord_alerts.py --insider-plays --days 1 --min-score 60

# Test performance report
poetry run python scripts/discord_alerts.py --performance-report --days 7
```

## 🤝 Contributing to Docs

Found an error or want to improve documentation?
1. Documentation lives in `/docs/unusual-options-service/`
2. Use markdown format
3. Include practical examples
4. Test all code snippets
5. Submit clear, concise explanations

## 📞 Support

- **Issues**: Use GitHub issues for bug reports
- **Questions**: See FAQ sections in each guide
- **Updates**: Check changelog for latest features

---

**Next Steps**: Start with [System Overview](system-overview.md) to understand the core concepts, then move to [Quick Start Tutorial](quick-start.md) to begin scanning.

