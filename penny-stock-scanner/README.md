# Penny Stock Scanner

Professional-grade penny stock scanner for identifying explosive breakout opportunities under $5.

## ⚠️ Recent Updates

### January 28, 2026 - Critical Performance Alert

**Last 2 weeks performance is concerning (Jan 14-28, 2026):**

| Metric          | Value  | Target | Status |
| --------------- | ------ | ------ | ------ |
| Win Rate        | 40.1%  | >50%   | ❌     |
| Avg Return      | -3.48% | >0%    | ❌     |
| Stop Loss Rate  | 29.5%  | <10%   | ❌     |
| A-Tier Win Rate | 21.0%  | >50%   | ❌     |
| C-Tier Win Rate | 70.8%  | -      | ✅     |

**Critical Issues Identified:**

1. **MRNO Wipeout (Jan 27)**: Single stock had 10 positions across tiers, ALL hit -25% stop loss
2. **Score Inversion Persists**: C-Tier (70.8% WR) outperforming A-Tier (21.0% WR)
3. **No Profit Targets Hit**: 0% hit rate on 10/20/30% targets

**Fixes Implemented (Jan 28, 2026):**

- ✅ **Position concentration limit**: `max_positions_per_symbol: 3` (prevents single-stock wipeouts like MRNO)
- ✅ **Softened extreme volume penalty**: 0.88 → 0.92 (reduced overcorrection)
- ✅ **Trailing stop system**: Activates after +5% gain, trails 10% below high watermark

See: [`../docs/penny-stock-scanner/weekly-analysis-jan-28-2026.md`](../docs/penny-stock-scanner/weekly-analysis-jan-28-2026.md)

### January 13, 2026 - Score Inversion Root Cause Fix

**Critical fixes based on weekly analysis showing S-Tier at 11.8% WR:**

- ✅ **52-week HIGH penalty (NEW)**: S-Tier avg 98% from low - now penalizes >75% from low
- ✅ **Extreme volume penalty (NEW)**: 5x+ volume = 46.1% WR vs 2-3x = 72.5% WR
- ✅ **Stronger late entry thresholds**: Lowered from 15%/30% to 10%/20%
- ✅ **Increased late entry penalties**: 0.85→0.75 (moderate), 0.70→0.60 (severe)

**Root Cause Identified**: S-Tier signals were buying stocks that already ran 25%+ and were at 52-week highs!

### January 2026 - Score Inversion Fix & Data-Driven Improvements

**Major fixes based on 1,000 signals and 673 closed trades analysis:**

- ✅ **Late entry penalty**: Penalizes signals where price already moved significantly
- ✅ **Volume sweet spot narrowed**: 2-3x optimal (was 2-5x), 69% WR vs 47.5%
- ✅ **Minimum hold period**: 3 days minimum before closing (4-7 day holds = 76.5% WR!)
- ✅ **BUY criteria fixed**: Was 27.7% WR, now requires sweet spot volume + no late entry

**Additional Data-Driven Improvements:**

- ✅ **1 Green Day bonus**: 64.8% WR (best) vs 0 days (42.2%) or 4+ days (41.9%)
- ✅ **52-Week position filter**: 25-50% from low = 55.1% WR, +5.90% (optimal zone)
- ✅ **Day of week adjustment**: Friday +5% bonus (57.4% WR), Wednesday -5% penalty (44.7%)
- ✅ **China risk reassessed**: Removed from risk list - actually 61.2% WR, +15.98%!
- ✅ **Rate limiting**: Proper Yahoo Finance rate limiting with exponential backoff

**⚡ Scan Performance Optimization:**

- ✅ **Batch downloads**: `yf.download()` fetches 50 symbols at once (was 1-by-1)
- ✅ **Parallel analysis**: 20 signals analyzed concurrently
- ✅ **Deferred metadata**: `ticker.info` only for high-scoring signals
- ✅ **Scan time reduced**: 40+ minutes → **~5-10 minutes** (75-85% faster!)

**🎨 Frontend Improvements:**

- ✅ **Performance dashboard**: 30-day win rate, avg return, profit targets, stop loss rate
- ✅ **Functional filters**: Filter by rank, recommendation, volume sweet spot, breakouts
- ✅ **Signal quality indicators**: Visual cues for optimal entry conditions

**🔔 Enhanced Discord Alerts:**

- ✅ **Signal quality indicators**: Volume sweet spot, green days, 52-week position
- ✅ **Late entry warnings**: Alerts when price already moved 15%+
- ✅ **Market context**: SPY outperformance, 52-week range
- ✅ **Weekly performance summaries**: Automated weekly reports with insights

**See**: [`../docs/penny-stock-scanner/performance-analysis-jan-2026.md`](../docs/penny-stock-scanner/performance-analysis-jan-2026.md) for full analysis.

### December 2025 - Performance Improvements

**Major fixes based on real performance data (248 signals, 65 closed trades):**

- ✅ **Stop loss widened**: 15% → 25% max (60% were hitting stops)
- ✅ **Breakout detection improved**: Multiple scenarios now qualify (was only 5.2%)
- ✅ **Score inflation fixed**: Removed partial credit for unimplemented features
- ✅ **Tier thresholds adjusted**: Better signal discrimination
- ✅ **Weekend/holiday bug fixed**: Signal continuity now works across weekends
- ✅ **Recommendation logic improved**: No longer all "BUY"

**New Features:**

- 🔔 **Discord Alerts**: Automatic notifications for S/A-Tier signals
- 📊 **SPY Comparison**: Market outperformance now actually calculated
- 🎯 **Profit Target Tracking**: Track 10%, 20%, 30% targets with dynamic levels

**See**: [`../docs/penny-stock-scanner/performance-improvements-dec-2025.md`](../docs/penny-stock-scanner/performance-improvements-dec-2025.md) for full details.

### November 2025 - Initial Fixes

**Fixed Critical Issues:**

- ✅ Timezone-aware datetime handling (no more crash errors)
- ✅ Supabase pagination (now fetches all 1715 symbols)
- ✅ Signal continuity tracking integrated
- ✅ Improved filtering recommendations for better signal detection

## 🚀 Features

- **Volume-Driven Analysis**: 50% weight on volume signals - the #1 predictor of penny stock moves
- **Consolidation Detection**: Identify accumulation phases before breakouts
- **Relative Strength**: Find stocks outperforming the market
- **Risk Management**: Strict liquidity filters and pump-and-dump detection
- **Signal Continuity**: Track signals across days (NEW, CONTINUING, ENDED)
- **CLI Interface**: Powerful command-line tools for analysis
- **Database Integration**: Store and track signals in Supabase

## 📋 Requirements

- Python 3.11+
- Poetry package manager
- Supabase account (for signal storage)
- Optional: OpenAI/Anthropic API keys for AI analysis

## 🛠️ Quick Start

### 1. Installation

```bash
# Navigate to scanner directory
cd penny-stock-scanner

# Install dependencies
poetry install

# Environment configuration
# Note: .env file should be in repository root (one level up)
# Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### 2. Database Setup

**IMPORTANT**: Create the signals table in Supabase:

1. Go to your Supabase project → SQL Editor
2. Copy contents of `/db/penny_stock_signals.sql` from repository root
3. Run the SQL to create table, indexes, and views

Without this table, signals will be detected but not stored.

### 3. Run Your First Scan

```bash
# Quick test scan (100 symbols, ~2 minutes)
poetry run penny-scanner scan-all --min-score 0.50 --max-symbols 100

# Expected: ~4 signals found (4% signal rate)
```

### 4. Automated Scans (Optional)

The scanner includes a **GitHub Actions workflow** for automated scanning:

- **Schedule**: Every 30 minutes during market hours (9:30 AM - 4:00 PM ET)
- **File**: `.github/workflows/penny-scanner.yml`
- **Requirements**: Supabase secrets configured in GitHub repository

**To enable:**

1. Ensure Supabase secrets are set in GitHub → Settings → Secrets
2. The workflow will run automatically on schedule
3. Manual trigger available via Actions tab

**Alternative: Daily Scans**

Since penny stocks are less time-sensitive than intraday patterns, you may prefer daily scans:

```yaml
# Modify .github/workflows/penny-scanner.yml schedule to:
schedule:
  - cron: '30 13 * * 1-5' # Once daily at market open
  - cron: '0 20 * * 1-5' # Once daily at market close
```

## 📖 Usage

### Analyze Single Stock

```bash
# Analyze specific symbol
poetry run penny-scanner analyze AEMD

# With custom score threshold
poetry run penny-scanner analyze NUAI --min-score 0.60
```

### Batch Analysis

```bash
# Multiple symbols
poetry run penny-scanner batch AEMD NUAI SNDL --min-score 0.60

# Export results
poetry run penny-scanner batch AEMD NUAI --output results.json
```

### Scan All Penny Stocks

```bash
# Quick discovery scan (recommended for testing)
poetry run penny-scanner scan-all --min-score 0.50 --max-symbols 500

# Quality signals only
poetry run penny-scanner scan-all --min-score 0.70

# Full scan (all 1715 symbols, ~15-20 minutes)
poetry run penny-scanner scan-all --min-score 0.50
```

**Recommended Settings:**

- **Discovery mode**: `--min-score 0.50` (more signals, ~4% hit rate)
- **Quality mode**: `--min-score 0.70` (fewer, higher-quality signals)
- **Testing**: `--max-symbols 100` (quick validation)

### Query Historical Signals

```bash
# Recent signals
poetry run penny-scanner query --days 7 --min-score 0.60

# By opportunity rank
poetry run penny-scanner query --rank A --days 3

# Export to JSON
poetry run penny-scanner query --days 1 --output today.json
```

### List Available Tickers

```bash
# Show all penny stocks
poetry run penny-scanner list-tickers

# Filter by exchange
poetry run penny-scanner list-tickers --exchange NASDAQ

# Filter by sector
poetry run penny-scanner list-tickers --sector Technology
```

## 🔬 Strategy

### The "Explosion Setup" Pattern

The scanner identifies penny stocks showing:

1. ✅ Consolidation in tight range (5-10+ days)
2. ✅ Volume surge (2-5x) with price breakout
3. ✅ Higher lows forming (accumulation)
4. ✅ Outperforming market
5. ✅ Multiple consecutive green days

### Scoring System

**Volume Analysis (50%)**: The dominant signal

- Relative volume surge (20%)
- Volume acceleration (15%)
- Volume consistency (10%)
- Liquidity depth (5%)

**Price Momentum (30%)**

- Consolidation detection (12%)
- Price acceleration (10%)
- Higher lows pattern (5%)
- Moving average position (3%)

**Relative Strength (15%)**

- Market outperformance (8%)
- Sector leadership (4%)
- 52-week position (3%)

**Risk & Liquidity (5%)**

- Bid-ask spread (2%)
- Float analysis (2%)
- Price stability (1%)

## 📊 Opportunity Ranks

- **S-Tier** (≥0.90): Exceptional setup - strong volume, clean consolidation breakout
- **A-Tier** (≥0.80): Excellent - high volume surge, good momentum
- **B-Tier** (≥0.70): Solid - decent volume, positive momentum
- **C-Tier** (≥0.60): Fair - minimal requirements met
- **D-Tier** (<0.60): Weak - filtered out by default

## ⚙️ Configuration

### Environment Variables

Key settings in `.env` (repository root):

```env
# Database (required)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Volume filters
PENNY_MIN_VOLUME=200000          # Daily volume minimum
PENNY_MIN_DOLLAR_VOLUME=100000   # Dollar volume minimum

# Score thresholds
MIN_SCORE_THRESHOLD=0.55         # Default minimum score

# Discord Alerts (optional)
DISCORD_PENNY_WEBHOOK_URL=your_webhook_url  # Webhook for penny stock alerts
# discord_alerts_enabled defaults to true
# discord_min_rank defaults to "A" (S, A, B, C, D)
```

### Adjusting Filters

If you're finding too few signals:

```env
# More lenient settings for discovery
PENNY_MIN_VOLUME=50000
PENNY_MIN_DOLLAR_VOLUME=25000
MIN_SCORE_THRESHOLD=0.50
```

See `docs/penny-stock-scanner/bug-fixes-nov-2025.md` for more tuning guidance.

## 🏗️ Architecture

```
penny-stock-scanner/
├── src/penny_scanner/
│   ├── models/           # Pydantic data models
│   ├── services/         # Business logic & analysis
│   ├── utils/            # Technical indicators
│   ├── config/           # Settings & configuration
│   └── cli.py            # Typer CLI interface
├── tests/                # Unit & integration tests
└── docs/                 # Documentation
```

## 📚 Documentation

See the `docs/penny-stock-scanner/` directory:

- **README.md**: Overview and introduction
- **system-overview.md**: Architecture and design
- **user-guide.md**: Complete CLI reference
- **technical-implementation.md**: Developer guide
- **bug-fixes-nov-2025.md**: Recent fixes and testing

## 🐛 Troubleshooting

### "Table penny_stock_signals not found"

- **Solution**: Run the SQL schema from `db/penny_stock_signals.sql` in Supabase

### "No signals found"

- **Solution**: Lower the `--min-score` threshold (try 0.50)
- **Solution**: Adjust volume filters in `.env` to more lenient values

### "Timezone datetime errors"

- **Solution**: Fixed in November 2025 update - pull latest changes

### "Only fetching 1000 symbols"

- **Solution**: Fixed in November 2025 update - pagination now works correctly

## ⚠️ Disclaimer

This tool is for educational and research purposes. Trading penny stocks involves significant risk. Always do your own research and never invest more than you can afford to lose.

## 📄 License

This project is proprietary software. All rights reserved.
