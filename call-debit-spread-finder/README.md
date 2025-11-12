# Call Debit Spread Finder

A fast, efficient Python CLI service that identifies golden Call Debit Spread opportunities from unusual options signals stored in Supabase. Uses comprehensive multi-factor analysis (Technical, Fundamental, Signal Quality, Options Metrics) to rank and recommend high-confidence setups.

## Features

- **Multi-Factor Analysis**: Combines technical, fundamental, signal quality, and options-specific metrics
- **Composite Scoring**: Weighted ranking system to identify golden opportunities
- **Fast & Efficient**: Optimized for quick analysis of multiple signals
- **Rich CLI Output**: Beautiful tables and detailed opportunity cards
- **Comprehensive Filtering**: Filter by grade, POP, R:R, RSI, and more

## Installation

### Prerequisites

- Python 3.11+
- Poetry for dependency management
- Supabase account with `unusual_options_signals` table
- Repository root `.env` file with Supabase credentials

### Setup

```bash
# Navigate to service directory
cd call-debit-spread-finder

# Install dependencies
poetry install

# Configure environment variables in repository root .env
# SUPABASE_URL=your_supabase_url
# SUPABASE_KEY=your_supabase_key
```

## Quick Start

### Scan for Opportunities

```bash
# Find top 10 opportunities
poetry run cds-finder scan --top-n 10

# Filter by minimum grade
poetry run cds-finder scan --min-grade A --top-n 5

# Filter by probability of profit and risk/reward
poetry run cds-finder scan --min-pop 50 --min-rr 2.0

# Filter by RSI range
poetry run cds-finder scan --rsi-min 40 --rsi-max 60
```

### Analyze Specific Ticker

```bash
# Analyze a specific ticker
poetry run cds-finder analyze AAPL

# With custom filters
poetry run cds-finder analyze TSLA --min-grade S --days-back 3
```

## Scoring System

### Composite Score Components

The composite score combines four factors with weighted importance:

- **Technical Setup (30%)**: RSI, moving averages, momentum, volume, MACD
- **Options Metrics (30%)**: IV rank, delta, probability of profit, risk/reward ratio
- **Signal Quality (25%)**: Grade, premium flow, volume ratio, detection flags
- **Fundamentals (15%)**: P/E ratio, earnings growth, market cap, profit margins

### Confidence Levels

- 🚀 **GOLDEN (90-100)**: Exceptional setup, high conviction
- ✅ **HIGH (75-89)**: Strong setup, good risk/reward
- ⚠️ **MODERATE (60-74)**: Decent setup, requires confirmation
- ❌ **LOW (< 60)**: Skip, not worth trading

## Configuration

### Environment Variables

Set these in your repository root `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Optional: Default Configuration
DEFAULT_MIN_GRADE=A
DEFAULT_DAYS_BACK=7
DEFAULT_MIN_DTE=14
DEFAULT_MAX_DTE=60
```

### CLI Options

```bash
# Scan command options
cds-finder scan \
  --top-n 10              # Number of top opportunities
  --min-grade A           # Minimum signal grade
  --days-back 7           # Days to look back
  --min-pop 50            # Minimum probability of profit (%)
  --min-rr 2.0            # Minimum risk/reward ratio
  --rsi-min 40            # Minimum RSI
  --rsi-max 60            # Maximum RSI
  --ticker AAPL           # Filter by ticker
```

## Architecture

### Core Components

1. **Signal Fetcher**: Fetches bullish call signals from Supabase
2. **Technical Analyzer**: Calculates RSI, MAs, MACD, momentum, volume
3. **Fundamental Analyzer**: Extracts P/E, earnings growth, market cap
4. **Options Analyzer**: Calculates IV rank, delta, POP, R:R
5. **Call Debit Spread Calculator**: Finds optimal strike selection
6. **Composite Scorer**: Combines all factors into final score

### Data Flow

```
1. Fetch Signals (Supabase)
   ↓
2. Technical Analysis (yfinance)
   ↓
3. Fundamental Analysis (yfinance)
   ↓
4. Options Analysis (yfinance option chains)
   ↓
5. Composite Scoring
   ↓
6. Ranking & Filtering
   ↓
7. Display Results
```

## Example Output

```
🎯 Call Debit Spread Finder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary Statistics
┌─────────────────────────────────────────────────────┐
│ Total Opportunities: 8                             │
│ 🚀 Golden: 2 | ✅ High: 4 | ⚠️ Moderate: 2         │
│                                                     │
│ Average Composite Score: 78.5                      │
│ Average Probability of Profit: 52.3%               │
│ Average Risk/Reward Ratio: 2.45:1                  │
└─────────────────────────────────────────────────────┘

Call Debit Spread Opportunities
┌──────┬────────┬───────┬───────┬────────────┬──────┬──────┬───────────┬────────────┬──────────────┐
│ Rank │ Ticker │ Grade │ Score │ Confidence │ POP  │ R:R  │ Net Debit │ Max Profit │ Recommendation│
├──────┼────────┼───────┼───────┼────────────┼──────┼──────┼───────────┼────────────┼──────────────┤
│  1   │  AAPL  │   S   │ 92.5  │ 🚀 GOLDEN  │ 58%  │ 3.2:1│   $250    │    $800    │  STRONG BUY  │
│  2   │  TSLA  │   A   │ 87.3  │ ✅ HIGH    │ 55%  │ 2.8:1│   $180    │    $504    │     BUY      │
└──────┴────────┴───────┴───────┴────────────┴──────┴──────┴───────────┴────────────┴──────────────┘
```

## Performance

- Signal fetch: < 2 seconds
- Market data fetch (per ticker): < 1 second
- Analysis (per signal): < 0.5 seconds
- Total runtime (50 signals): < 30 seconds

## Requirements

- Python 3.11+
- Supabase database with `unusual_options_signals` table
- Internet connection for yfinance data

## Dependencies

- `typer`: CLI framework
- `rich`: Beautiful terminal output
- `supabase`: Database client
- `yfinance`: Market data
- `pandas`, `numpy`, `scipy`: Data analysis
- `loguru`: Logging

## License

Proprietary - Personal use only

