# Quick Start Guide - Unusual Options Scanner

This guide will help you get the scanner up and running in under 10 minutes.

## Prerequisites

- Python 3.11 or higher
- Poetry (Python package manager)
- Supabase account (free tier is fine)
- Market data API (YFinance free tier works to start)

## Installation

### 1. Navigate to Project Directory

```bash
cd unusual-options-service
```

### 2. Install Dependencies

```bash
# Install Poetry if you don't have it
curl -sSL https://install.python-poetry.org | python3 -

# Install project dependencies
poetry install
```

### 3. Set Up Environment Variables

```bash
# Copy the example environment file
cp env.example .env

# Edit with your credentials
nano .env  # or use your preferred editor
```

**Required Configuration**:

```bash
# Minimum required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
DATA_PROVIDER=yfinance
```

### 4. Set Up Database

1. Log into your Supabase dashboard
2. Go to SQL Editor
3. Copy the contents of `db/unusual_options_schema.sql`
4. Paste and execute in Supabase SQL Editor

### 5. Initialize the Scanner

```bash
# Run initialization
poetry run unusual-options init

# Check status
poetry run unusual-options status
```

You should see:

```
✓ Supabase: Connected
✓ Data Provider: yfinance
✓ System configured and ready
```

## Your First Scan

### Scan a Single Ticker

```bash
poetry run unusual-options scan AAPL
```

Expected output:

```
Scanning AAPL...

Unusual Options Activity
┌────────┬───────┬──────────────────────┬────────┬───────────┬──────────┬───────────┐
│ Ticker │ Grade │ Contract             │ Volume │ OI Change │ Premium  │ Sentiment │
├────────┼───────┼──────────────────────┼────────┼───────────┼──────────┼───────────┤
│ AAPL   │   A   │ AAPL250117C00180000 │  8,542 │    +25.3% │ $680,450 │ 🟢 BULLISH│
└────────┴───────┴──────────────────────┴────────┴───────────┴──────────┴───────────┘
```

### Scan Multiple Tickers

```bash
poetry run unusual-options scan AAPL MSFT TSLA NVDA
```

### Filter by Grade

```bash
# Only show high-grade signals
poetry run unusual-options scan AAPL MSFT --min-grade A
```

### Continuous Monitoring

```bash
# Scan every 5 minutes
poetry run unusual-options scan AAPL --watch --interval 300
```

Press `Ctrl+C` to stop.

## View Historical Signals

### List Recent Signals

```bash
# Last 7 days
poetry run unusual-options signals --days 7

# Last 30 days, grade B or better
poetry run unusual-options signals --days 30 --min-grade B
```

## Understanding the Output

### Signal Table Columns

| Column        | Meaning                                               |
| ------------- | ----------------------------------------------------- |
| **Ticker**    | Stock symbol                                          |
| **Grade**     | S/A/B/C/D/F quality rating                            |
| **Contract**  | Option contract symbol                                |
| **Volume**    | Current day's volume                                  |
| **OI Change** | % change in open interest                             |
| **Premium**   | Total premium flow (dollars)                          |
| **Sentiment** | Directional bias (🟢 Bullish, 🔴 Bearish, ⚪ Neutral) |

### Grade Meanings

- **S** (≥90%): Exceptional - highest conviction signals
- **A** (80-89%): High conviction - strong signals
- **B** (70-79%): Good - worth investigating
- **C** (60-69%): Watch list - needs confirmation
- **D** (50-59%): Low conviction - caution
- **F** (<50%): Avoid - likely false positive

## Common Use Cases

### Use Case 1: Morning Premarket Scan

```bash
# Scan major tech stocks before market open
poetry run unusual-options scan AAPL MSFT GOOGL META NVDA AMD --min-grade B
```

### Use Case 2: Watchlist Monitoring

Create a watchlist file `watchlist.txt`:

```
AAPL
MSFT
GOOGL
TSLA
NVDA
```

Then run:

```bash
# TODO: Watchlist functionality coming soon
# poetry run unusual-options scan --watchlist watchlist.txt --watch
```

### Use Case 3: Research Signal History

```bash
# See all recent signals for AAPL
poetry run unusual-options signals --days 30 | grep AAPL
```

## Configuration Tips

### Adjust Detection Sensitivity

Edit `.env` to tune detection thresholds:

```bash
# More conservative (fewer signals, higher quality)
VOLUME_MULTIPLIER_THRESHOLD=5.0
MIN_PREMIUM_FLOW=500000
OI_CHANGE_THRESHOLD=0.30

# More aggressive (more signals, more noise)
VOLUME_MULTIPLIER_THRESHOLD=2.0
MIN_PREMIUM_FLOW=50000
OI_CHANGE_THRESHOLD=0.15
```

### Enable Alerts

```bash
# In .env
ALERT_ENABLED=true
ALERT_MIN_GRADE=A
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook
```

## Troubleshooting

### "No .env file found"

```bash
# Create from template
cp env.example .env
# Then edit with your credentials
```

### "Supabase: Not configured"

Check that your `.env` has:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
```

### "No unusual activity detected"

This is normal! Most tickers don't have unusual activity most days. Try:

- Scanning more tickers
- Lowering detection thresholds
- Scanning during market hours (9:30 AM - 4:00 PM ET)

### Module Import Errors

```bash
# Reinstall dependencies
poetry install --no-cache
```

## Next Steps

### 1. Learn the Concepts

Read [Understanding Unusual Activity](understanding-unusual-activity.md) to learn what makes activity "unusual" and how to interpret signals.

### 2. Understand Grading

Review [Signal Grading](signal-grading.md) to see how the scoring system works.

### 3. Develop a Trading Plan

See [Signal Interpretation](signal-interpretation.md) for guidance on:

- When to act on signals
- Position sizing based on grade
- Risk management strategies

### 4. Track Performance

Use the backtest command to see historical performance:

```bash
poetry run unusual-options backtest --start 2024-01-01 --end 2024-12-31
```

### 5. Automate Your Workflow

Create a shell script for your morning routine:

```bash
#!/bin/bash
# morning_scan.sh

echo "Running morning unusual options scan..."

poetry run unusual-options scan \
  AAPL MSFT GOOGL META AMZN TSLA NVDA AMD \
  --min-grade B \
  --output results/morning_scan_$(date +%Y%m%d).json

echo "Scan complete! Check results/"
```

Make it executable and run daily:

```bash
chmod +x morning_scan.sh
./morning_scan.sh
```

## Getting Help

### Check System Status

```bash
poetry run unusual-options status
```

### View CLI Help

```bash
# General help
poetry run unusual-options --help

# Command-specific help
poetry run unusual-options scan --help
```

### Common Commands Reference

```bash
# Scan single ticker
unusual-options scan AAPL

# Scan multiple tickers
unusual-options scan AAPL MSFT TSLA

# Continuous monitoring
unusual-options scan AAPL --watch --interval 300

# List recent signals
unusual-options signals --days 7

# Check system status
unusual-options status

# Run backtest
unusual-options backtest --start 2024-01-01 --end 2024-12-31
```

## Important Disclaimers

⚠️ **This tool is for research and education only**

- Not financial advice
- Past unusual activity ≠ future profits
- Always do your own analysis
- Use proper risk management
- Never risk more than you can afford to lose

---

**You're all set!** Start scanning and remember to combine signals with your own analysis and risk management.

For deeper understanding, continue to:

- [Understanding Unusual Activity](understanding-unusual-activity.md)
- [System Overview](system-overview.md)
- [Signal Interpretation](signal-interpretation.md)
