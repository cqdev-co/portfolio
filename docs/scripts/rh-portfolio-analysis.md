# Robinhood Portfolio Analysis Script

CLI tool for analyzing Robinhood CSV exports to evaluate Deep ITM Call Debit Spread strategy performance.

## Overview

This script parses Robinhood trade history exports and provides comprehensive analytics on spread trading performance including:

- **Spread Identification**: Automatically matches BTO/STO pairs into spreads
- **P&L Tracking**: Calculates realized gains/losses for closed positions
- **Win Rate Analysis**: Tracks win/loss ratios and profit factor
- **Risk Metrics**: Analyzes risk/reward ratios and capital deployment
- **Per-Ticker Breakdown**: Shows which tickers are profitable
- **Actionable Insights**: Generates warnings and recommendations

## Installation

The script uses standard library plus pandas (optional for enhanced analysis):

```bash
# From project root
source venv/bin/activate  # if using venv
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
# Text report (default)
python scripts/rh_portfolio_analysis.py path/to/robinhood-export.csv

# JSON output for programmatic use
python scripts/rh_portfolio_analysis.py data.csv --output json

# Verbose mode (show individual trades)
python scripts/rh_portfolio_analysis.py data.csv --verbose
```

### Example Output

```
============================================================
   ROBINHOOD PORTFOLIO ANALYSIS
============================================================

💰 P&L SUMMARY
----------------------------------------
  ✅ VERIFIABLE P&L:   +$62.20
     (Spreads opened & closed in this period + income)

  VERIFIABLE BREAKDOWN:
    Spread P&L:        +$59.30
    Other Income:      +$2.90

  ⚠️  INCOMPLETE DATA (cost basis unknown):
    Prior Spread Exits: +$280.90 (proceeds only)
    Stock Cash Flow:    +$679.88 (not true P&L)

  📱 Check Robinhood app for accurate total P&L.

📊 SPREAD TRADING SUMMARY
----------------------------------------
  Total Spreads:     12
  Closed:            7
  Open Positions:    5
  Winners:           4
  Losers:            3
  Win Rate:          57.1%

💵 SPREAD P&L (Closed Positions)
----------------------------------------
  Net P&L:           +$59.30
  Total Gains:       +$167.60
  Total Losses:      -$108.30
  Profit Factor:     1.55
  Avg Winner:        +$41.90
  Avg Loser:         -$36.10

⚖️ RISK METRICS
----------------------------------------
  Avg Debit Paid:    $297.80
  Avg Spread Width:  $4
  Avg Days Held:     10.3
  Capital at Risk:   $1541.25
  Risk/Reward:       2.9:1
  Required Win Rate: 74%

📈 PERFORMANCE BY TICKER
----------------------------------------
  NVDA   | 1 trades |   +$107.90 | WR: 100%
  MSFT   | 1 trades |    +$36.90 | WR: 100%
  AMZN   | 1 trades |    +$19.90 | WR: 100%
  HOOD   | 2 trades |     -$0.20 | WR: 50%
  CRWD   | 2 trades |   -$105.20 | WR: 0%

🔓 OPEN POSITIONS
----------------------------------------
  HOOD   $111.0/$112.0 (exp 1/9/2026) | Debit: $68.05
  AVGO   $315.0/$320.0 (exp 1/23/2026) | Debit: $373.05
  TSLA   $410.0/$415.0 (exp 1/30/2026) | Debit: $395.05
  AMD    $195.0/$200.0 (exp 1/30/2026) | Debit: $370.05
  MSFT   $455.0/$460.0 (exp 1/30/2026) | Debit: $335.05

📋 PRIOR PERIOD SPREAD CLOSES
----------------------------------------
  (Opened before this data - showing exit proceeds only)
  2025-12-03 | CHYM   $15.0/$17.5 | Exit: +$239.95
  2025-12-08 | BULL   $8.0/$8.5 | Exit: +$40.95

⚠️ WARNINGS
----------------------------------------
  ⚠️ Win rate (57.1%) is below break-even threshold (~74%)
  ⚠️ CRWD is underperforming: -$105.20 across 2 trades
```

## P&L Calculation Limitations

The Robinhood CSV export has a **critical limitation**: it only contains transaction history, not cost basis for positions opened before the export period.

### What We CAN Calculate Accurately

- **Spread P&L**: For spreads opened AND closed within the export period
- **Other Income**: Interest, dividends, stock lending

### What We CANNOT Calculate Accurately

- **Prior Period Spreads**: Spreads closed in this period but opened earlier (missing entry cost)
- **Stock Trades**: Sales of stocks bought before this period (missing cost basis)

### Example

If you opened a CHYM spread in November and closed it in December:

- The CSV only shows the December CLOSE (+$239.95 exit proceeds)
- We don't know the November OPEN cost (maybe $200?)
- True P&L might be +$39.95, but we can only show "+$239.95 (proceeds only)"

**For accurate total P&L, always check the Robinhood app.**

## How It Works

### 1. CSV Parsing

The script handles Robinhood's CSV format including:

- Multi-line descriptions (CUSIP info)
- Various transaction codes (BTO, STO, BTC, STC, etc.)
- Currency parsing (handles `$`, `,`, `()` for negatives)

### 2. Spread Matching

Options trades are matched into spreads by:

1. Grouping by ticker + expiration + option type
2. Finding same-day BTO/STO pairs (entries)
3. Finding same-day BTC/STC pairs (exits)
4. Matching entries to exits by strike prices

### 3. Metrics Calculation

| Metric            | Formula                                      |
| ----------------- | -------------------------------------------- |
| Win Rate          | Winners / Total Closed × 100                 |
| Profit Factor     | Total Gains / Abs(Total Losses)              |
| Risk/Reward       | Avg Debit / (Spread Width × 100 - Avg Debit) |
| Required Win Rate | R/R Ratio / (1 + R/R Ratio) × 100            |

## Transaction Codes

| Code   | Description                     |
| ------ | ------------------------------- |
| BTO    | Buy to Open (long position)     |
| STO    | Sell to Open (short position)   |
| BTC    | Buy to Close (close short)      |
| STC    | Sell to Close (close long)      |
| INT    | Interest payment                |
| CDIV   | Cash dividend                   |
| GDBP   | Gold deposit boost payment      |
| SLIP   | Stock lending income payment    |
| FUTSWP | Futures/event contract transfer |

## Output Formats

### Text (Default)

Human-readable report with sections for summary, P&L, risk metrics, per-ticker breakdown, and recommendations.

### JSON (`--output json`)

Structured JSON for integration with other tools:

```json
{
  "summary": {
    "total_spreads": 11,
    "closed_spreads": 7,
    "win_rate": 57.1
  },
  "pnl": {
    "total": 56.20,
    "profit_factor": 1.50
  },
  "by_ticker": {
    "NVDA": {"trades": 1, "total_pnl": 107.90}
  },
  "warnings": [...],
  "insights": [...]
}
```

## Strategy Insights

The script is optimized for analyzing **Deep ITM Call Debit Spreads**:

### What the Strategy Involves

- Buy a deep in-the-money call (lower strike)
- Sell a call at a higher strike
- Creates a debit spread with high delta

### Key Metrics to Watch

1. **Win Rate vs Required Win Rate**
   - Deep ITM spreads have inverted risk/reward
   - Typical 2.5-3:1 risk/reward requires 70-75% win rate

2. **Profit Factor > 1.0**
   - Ensures total gains exceed total losses
   - Target: 1.5+ for healthy strategy

3. **Per-Ticker Performance**
   - Identify which stocks work well with the strategy
   - Avoid repeat losers (high-IV stocks often problematic)

4. **Days Held**
   - Short holds may indicate poor timing or panic exits
   - Target: Hold until 50-70% of max profit reached

## Entry Signal Analysis

Based on empirical analysis of winning vs losing trades (Jan 2026):

### Winning Trade Characteristics (AMD, AVGO pattern)

| Signal                 | What It Means                              |
| ---------------------- | ------------------------------------------ |
| RSI 25-45              | Oversold or recovering - good entry zone   |
| Buffer to support > 7% | Adequate cushion before spread loses value |
| Bounce confirmed       | Price formed higher low after pullback     |
| Analyst bullish > 75%  | Strong institutional support               |
| Earnings > 30 days     | Clear of binary event risk                 |

### Losing Trade Red Flags (TSLA pattern)

| Red Flag                  | Why It's Dangerous           |
| ------------------------- | ---------------------------- |
| RSI neutral (50+) falling | Catching a falling knife     |
| Buffer to support < 5%    | No room for price movement   |
| No bounce confirmation    | Still in decline phase       |
| Analyst bullish < 50%     | Bearish sentiment = headwind |
| Earnings within window    | Binary risk during position  |

### Entry Checklist

Before opening a Deep ITM Call Spread:

```
TREND CHECK:
□ Stock has bounced from recent low (not falling to it)
□ Higher low formed (bounce confirmation)
□ Entry is AFTER bounce confirmation

TECHNICAL CHECK:
□ RSI between 25-45 (oversold/recovering)
□ Buffer to 20-day low > 7%
□ Price above or recovering toward 50DMA

FUNDAMENTAL CHECK:
□ Analyst bullish % > 65%
□ No earnings within 14 days of expiration
□ ATM IV < 50% (cheaper options)

OPTIONS CHECK:
□ Put/Call ratio < 0.8 (bullish flow)
□ Spread debit < 80% of width
□ Minimum 5% cushion at entry
```

### Using Entry Grade Calculator

The `lib/utils/ts/entry-grade` module calculates entry signals from proxy data:

```typescript
import { analyzeTechnicals } from '@lib/utils/ts/entry-grade';

// Fetch raw data from proxy
const data = await fetch(`${YAHOO_PROXY_URL}/ticker/NVDA`).then((r) =>
  r.json()
);

// Calculate technicals in lib/
const analysis = analyzeTechnicals(
  data.chart.quotes.map((q) => q.close),
  data.chart.quotes.map((q) => q.high),
  data.chart.quotes.map((q) => q.low),
  {
    price: data.quote.price,
    ma50: data.quote.fiftyDayAverage,
    ma200: data.quote.twoHundredDayAverage,
  },
  {
    bullishPct: data.analysts?.bullishPct,
    daysToEarnings: data.earnings?.daysUntil,
    atmIV: data.options?.atmIV,
    pcRatio: data.options?.pcRatioVol,
  }
);

// Result:
// {
//   rsi14: 59.3,
//   trend: 'sideways',
//   supportLevel: 170.31,
//   bufferToSupport: 9.8,
//   entryGrade: { score: 72, recommendation: 'BUY', signals: [...] }
// }
```

Use `entryGrade.recommendation`:

- `STRONG_BUY` (75+): Ideal entry conditions
- `BUY` (60-74): Good entry, minor concerns
- `HOLD` (45-59): Wait for better setup
- `AVOID` (< 45): Too many red flags

## Troubleshooting

### "No spreads found"

- Ensure CSV contains option trades (BTO/STO pairs)
- Check that trades are formatted correctly in CSV

### Parsing errors

- Verify CSV is a Robinhood export (specific format)
- Check for corrupted rows or special characters

### Missing trades

- Multi-leg orders on different days won't match
- Single-leg option trades are ignored

## Integration

### With AI Analyst

```bash
# Export from Robinhood, analyze, then import to AI Analyst
python scripts/rh_portfolio_analysis.py export.csv --output json > analysis.json

# AI Analyst can then reference this data
cd ai-analyst && bun run import ~/Downloads/robinhood-export.csv
```

### With Frontend Dashboard

The JSON output can be consumed by the frontend for visualization:

```typescript
// Example: Fetch analysis results
const analysis = await fetch('/api/portfolio-analysis').then((r) => r.json());

// Display win rate, P&L charts, etc.
```

---

## Spread Quantitative Analysis System

A persistent data system for tracking trades over time and running
statistical analysis as sample size grows.

### Why This Exists

With n=7 trades, no statistical conclusions are valid. This system:

- **Accumulates data** over time as more trades close
- **Tracks progress** toward n=30 (minimum for significance)
- **Auto-calculates** correlations, regressions, significance tests
- **Updates analysis** as confidence intervals tighten

### Quick Start

```bash
# Import trades from Robinhood CSV
python scripts/spread_quant_analysis.py import pf.csv

# View accumulated trades
python scripts/spread_quant_analysis.py show

# Run quantitative analysis
python scripts/spread_quant_analysis.py analyze

# Export to CSV for external tools
python scripts/spread_quant_analysis.py export trades.csv
```

### Commands

| Command                  | Description                                 |
| ------------------------ | ------------------------------------------- |
| `import <csv>`           | Parse CSV and add trades to database        |
| `show`                   | Display all tracked trades                  |
| `analyze`                | Run full statistical analysis               |
| `open`                   | Analyze open positions with recommendations |
| `coverage`               | Show data coverage for all 45 factors       |
| `fetch [--ticker]`       | Pull data from Yahoo proxy                  |
| `template <file>`        | Export CSV template for manual entry        |
| `export <file>`          | Export to CSV for R/Python analysis         |
| `update <ticker> <date>` | Manually set entry conditions               |
| `batch-update <csv>`     | Bulk update entry conditions                |

### Data Storage

Trades are stored in `data/spread_trades.json`:

```json
{
  "trades": [
    {
      "id": "NVDA_12/2/2025_165.0",
      "ticker": "NVDA",
      "entry_date": "12/2/2025",
      "exit_date": "12/26/2025",
      "pnl": 107.9,
      "return_pct": 29.72,
      "entry_rsi": 38.5,
      "entry_analyst_pct": 94,
      "entry_iv": 17,
      "days_held": 24
    }
  ]
}
```

### Comprehensive Factor List (45 Factors)

The system tracks these factors for correlation analysis:

| Category         | Factors                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| **Position**     | Price, 52w High/Low, % from ATH, % from 50DMA, % from 200DMA               |
| **Fundamentals** | P/E, Forward P/E, EPS, Market Cap, Beta, Dividend Yield                    |
| **Technicals**   | RSI (14 & 5), MACD Histogram, ADX, ATR %, BB Position, Volume Ratio        |
| **Trend**        | 5d/10d/20d Returns, Buffer %, Support/Resistance, MA Alignment, Higher Low |
| **Sentiment**    | Analyst %, Analyst Count, Short Ratio, Short % Float, Put/Call Ratio       |
| **Volatility**   | IV, IV Rank, HV20, IV/HV Ratio                                             |
| **Timing**       | Day of Week, Days to Earnings, Days to Expiry, Days Held                   |

### Data Entry Methods

```bash
# 1. Auto-fetch from Yahoo proxy (when available)
YAHOO_PROXY_URL=https://... python spread_quant_analysis.py fetch

# 2. Export template, fill in Excel/Sheets, re-import
python spread_quant_analysis.py template data/template.csv
# ... edit template.csv ...
python spread_quant_analysis.py batch-update data/template.csv

# 3. Manual single-trade update
python spread_quant_analysis.py update NVDA 12/2/2025 \
  --rsi 38.5 --analyst 94 --iv 17 --beta 1.8 --pe 45 \
  --trend_5d 2.3 --pct_from_high 15 --days_to_earnings 30
```

### Analysis Output

```
======================================================================
   SPREAD QUANTITATIVE ANALYSIS
======================================================================

   Sample Size: n = 7
   Required for significance: n ≥ 29 (to detect r ≥ 0.5)
   Progress: 24% of required sample size

----------------------------------------------------------------------
   RETURN STATISTICS
----------------------------------------------------------------------
   Mean Return:      +2.58%
   Std Deviation:    14.74%
   Win Rate:         57.1% (95% CI: [25.0%, 84.2%])
   Sharpe Ratio:     0.175
   Sortino Ratio:    0.192
   Profit Factor:    1.55

----------------------------------------------------------------------
   CORRELATION ANALYSIS
----------------------------------------------------------------------
   Factor          n     r          R²         p-value    Sig?
   -------------------------------------------------------
   Days Held       7     +0.8024    0.6439    0.0000    YES*
   Analyst %       7     +0.7496    0.5620    0.0003    YES*
   IV %            7     -0.6376    0.4065    0.0297    YES*

----------------------------------------------------------------------
   REGRESSION MODEL
----------------------------------------------------------------------
   Return = -34.1 + 0.400×Analyst + -0.133×IV + 1.189×Days

   R² = 0.8370 (83.7% variance explained)
   Adjusted R² = 0.6740
```

### Statistical Methods

| Metric       | Method                                 |
| ------------ | -------------------------------------- |
| Correlation  | Pearson r with t-test p-values         |
| Significance | α = 0.05 (two-tailed)                  |
| Regression   | OLS with F-test for model significance |
| Win Rate CI  | Wilson score interval                  |
| Sample Size  | Power analysis for r = 0.5, β = 0.80   |

### Interpretation Guide

**When n < 30:**

- All findings are _directional_, not conclusive
- Wide confidence intervals expected
- Focus on accumulating data

**When n ≥ 30:**

- Correlations with p < 0.05 are statistically significant
- Regression coefficients become reliable
- Entry criteria can be validated/refined

### Entry Criteria (Current, n=7)

Based on closed trade analysis:

```
100% WIN RATE FACTORS:
┌───────────────────┬────────────────────────────────────────┐
│ Analyst ≥ 80%     │ 3/3 winners, +14.9% avg return         │
│ IV ≤ 50%          │ 2/2 winners, +19.7% avg return         │
│ Hold ≥ 7 days     │ 5/5 positive trajectory                │
└───────────────────┴────────────────────────────────────────┘

0-25% WIN RATE FACTORS:
┌───────────────────┬────────────────────────────────────────┐
│ Analyst < 80%     │ 1/4 winners, -6.7% avg return          │
│ IV > 50%          │ 2/5 winners, -4.3% avg return          │
│ Hold < 7 days     │ 0/2 winners, -13.2% avg return         │
└───────────────────┴────────────────────────────────────────┘

NOT PREDICTIVE:
? RSI 30-50              (r = -0.21, p > 0.05)
? Buffer to support      (r = -0.04, p > 0.05)
```

### Regression Model

Predict expected return before entering:

```
Return = -34.1 + 0.40×Analyst - 0.13×IV + 1.19×Days

Example: NVDA with 94% analyst, 17% IV, 14-day hold
         -34.1 + (0.40×94) + (-0.13×17) + (1.19×14) = +17.9%
```

R² = 0.84 (explains 84% of return variance)

### Ticker Blacklist

Based on historical performance:

| Ticker | Trades | Win Rate | Total P&L | Status          |
| ------ | ------ | -------- | --------- | --------------- |
| CRWD   | 2      | 0%       | -$105.20  | **BLACKLISTED** |

### Roadmap

As data accumulates:

| n   | Milestone                          |
| --- | ---------------------------------- |
| 15  | Preliminary decile analysis        |
| 30  | Statistical significance threshold |
| 50  | Reliable regression model          |
| 100 | ML feature importance analysis     |

---

## Future Enhancements

- [x] Persistent trade database with quantitative analysis
- [x] Correlation analysis with significance testing
- [x] Multivariate regression model
- [ ] Historical comparison (week-over-week, month-over-month)
- [ ] Integration with real-time position data
- [ ] ML-based entry timing (when n > 100)
- [ ] Auto-fetch from Yahoo proxy on import
- [ ] Portfolio heat maps and correlation analysis
- [ ] Rolling window analysis (trailing 30 trades)

---

**Last Updated**: 2026-01-03
**Author**: Portfolio Analysis Team
