# PCS Engine Strategy

**Put Credit Spread (PCS) Trading Engine** — a CLI-based strategy engine for finding optimal OTM put credit spread opportunities.

## Overview

The PCS Engine sells out-of-the-money (OTM) put credit spreads on quality stocks with strong support levels and elevated implied volatility. It profits from theta decay and the stock staying above the short strike.

### Strategy Summary

| Attribute        | Value                          |
| ---------------- | ------------------------------ |
| Strategy Type    | Vertical Put Credit Spread     |
| Sentiment        | Bullish / Neutral              |
| Profit Mechanism | Time decay (theta)             |
| Max Profit       | Credit received                |
| Max Loss         | Spread width - credit received |
| Ideal IV         | HIGH (elevated = more premium) |
| Short Delta      | 0.20-0.35 (OTM)                |
| Target DTE       | 30-45 days                     |
| Target PoP       | 65-85%                         |

### CDS vs PCS: Key Differences

| Factor         | CDS (Call Debit Spread)          | PCS (Put Credit Spread)           |
| -------------- | -------------------------------- | --------------------------------- |
| Direction      | Bullish directional              | Bullish / Neutral                 |
| Cash Flow      | Pay debit upfront                | Receive credit upfront            |
| IV Preference  | LOW IV (cheaper to buy)          | HIGH IV (more premium to sell)    |
| Strike Target  | Deep ITM calls (delta 0.70-0.85) | OTM puts (delta 0.20-0.35)        |
| RSI Sweet Spot | 35-50 (pullback)                 | 40-55 (neutral/slightly bullish)  |
| Profit If      | Stock rises above breakeven      | Stock stays above short strike    |
| Support Usage  | Below breakeven                  | Short strike placed below support |
| Max Loss       | Debit paid                       | Width - credit                    |

## Getting Started

### Prerequisites

- Bun runtime (v1.0+)
- `YAHOO_PROXY_URL` environment variable (optional, recommended for rate limiting)
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (optional, for DB persistence)

### Quick Start

From the monorepo root:

```bash
# Scan mega-cap stocks for PCS candidates
bun run pcs:scan

# Find viable put credit spreads
bun run pcs:spreads

# Full analysis (screen + spread scan)
bun run pcs:scan-all

# Market regime check
bun run pcs:regime

# Daily briefing
bun run pcs:briefing
```

Or from the PCS engine directory:

```bash
cd pcs-engine-strategy

# Stock screening
bun run scan --list mega --min-score 65

# Spread scanning
bun run scan-spreads --list growth

# Custom tickers
bun run scan-spreads --tickers AAPL,MSFT,NVDA

# Record a trade entry
bun run trade entry --ticker AAPL --short-strike 220 --long-strike 215 --expiration 2026-03-20 --credit 1.25

# Record a trade exit
bun run trade exit --trade-id <uuid> --debit 0.50 --reason "50% profit target"

# Performance analytics
bun run performance
```

## Commands

### `scan`

Screens stocks using technical, fundamental, analyst, and IV signals.

```bash
bun run scan [options]

Options:
  --list <name>        Ticker list: mega, growth, value, sp500 (default: mega)
  --tickers <symbols>  Comma-separated ticker symbols
  --top <n>            Limit to top N tickers
  --min-score <n>      Minimum score threshold (default: 65)
  --dry-run            Do not save to database
  -v, --verbose        Verbose output
```

### `scan-spreads`

Finds viable OTM put credit spreads based on criteria from `strategy.config.yaml`.

```bash
bun run scan-spreads [options]

Options:
  --list <name>        Ticker list: mega, growth, value, etf, sp500
  --tickers <symbols>  Comma-separated ticker symbols
  --dte <days>         Target DTE
  --pop <pct>          Minimum PoP percentage
  --relaxed            Relax criteria for more results
  -v, --verbose        Verbose output
```

### `scan-all`

Combined stock screening and spread analysis.

### `regime`

Analyzes SPY, QQQ, IWM to determine market regime (bull/neutral/bear) and outputs PCS-specific strategy adjustments.

### `briefing`

Quick daily overview of market conditions, VIX assessment, and PCS opportunities.

### `trade entry` / `trade exit`

Records trade entries and exits to the `pcs_signal_outcomes` table in Supabase.

### `performance`

Displays win rate, average return, total P&L, and other analytics from closed trades.

## Scoring System

The PCS scoring system evaluates stocks across 4 dimensions (max 100 points):

| Category    | Max Points | Description                              |
| ----------- | ---------- | ---------------------------------------- |
| Technical   | 40         | RSI zone, MA position, golden cross, etc |
| Fundamental | 25         | PEG, FCF yield, EV/EBITDA, margins       |
| Analyst     | 15         | Price targets, consensus, EPS revisions  |
| IV Analysis | 20         | IV Rank, ATM IV level (NEW for PCS)      |

### IV Analysis Signal (New)

The IV analysis signal is unique to PCS and doesn't exist in CDS:

- **IV Rank >= 50**: +12 pts (excellent premium for selling)
- **IV Rank >= 30**: +8 pts (decent premium)
- **IV Rank >= 15**: +3 pts (low premium, consider waiting)
- **IV Rank < 15**: 0 pts (insufficient for PCS)
- **IV Rank > 80**: Warning (extreme IV may signal danger)

### Spread Quality Score

When evaluating specific put credit spreads, a separate quality score (0-100) is calculated:

| Factor         | Max Points | Ideal Value                |
| -------------- | ---------- | -------------------------- |
| Credit Ratio   | 20         | 30-35% of width            |
| Distance OTM   | 20         | 7-12% below current price  |
| IV Rank        | 15         | >= 50 percentile           |
| Support Buffer | 15         | Support above short strike |
| DTE            | 10         | 30-45 days                 |
| Short Delta    | 10         | 0.25-0.30                  |
| Earnings Risk  | 10         | No earnings in period      |

## Exit Rules

PCS exit strategy is different from CDS because theta is your friend:

1. **Take profit at 50%** of credit received (standard target)
2. **Set trailing stop at 75%** of credit if reached
3. **Forced exit at 7 DTE** (gamma risk, but less urgent than CDS)
4. **Stop loss**: Close if loss = 2x credit received
5. **Support breach**: Close immediately if stock breaks below support
6. **Rolling**: If short strike is tested, consider rolling down and out

## Configuration

All PCS strategy parameters are in `strategy.config.yaml` under the `pcs_*` sections:

- `pcs_strategy` — Strategy name and version
- `pcs_entry` — Entry criteria (trend, momentum, IV, cushion, earnings, spread)
- `pcs_exit` — Exit rules (profit taking, stop loss, time-based, pin risk, rolling)
- `pcs_spread_params` — DTE, width, strike selection parameters
- `pcs_position_sizing` — Position sizing limits
- `pcs_market_regime` — Regime-specific adjustments

### Bear Market Warning

The PCS engine automatically disables new entries in bear markets (min_score set to 999). Selling puts in a bear market is extremely risky because:

- Puts go ITM as the market falls
- Max loss is realized more frequently
- IV expansion means bigger losses even before expiration

## Database Schema

The PCS engine uses separate tables from CDS:

| Table                    | Description                     |
| ------------------------ | ------------------------------- |
| `pcs_signals`            | Scan results and scores         |
| `pcs_signal_outcomes`    | Trade entry/exit tracking       |
| `pcs_signal_performance` | View joining signals + outcomes |

Migration: `db/migrations/create_pcs_signal_tables.sql`

## Architecture

The PCS engine imports shared infrastructure from `@portfolio/providers`:

- **Ticker lists** — Shared `TICKER_LISTS` (mega, growth, etf, value) imported from `@portfolio/providers`
- **Signal functions** — Fundamental signals (PEG, FCF, P/E, EV/EBITDA), analyst signals (upside, consensus, revisions), and technical helpers (Golden Cross, Volume Surge, OBV, MACD, signal group caps) are all shared with CDS
- **Market data** — Yahoo Finance proxy, ticker management, type conversions

### Shared vs Strategy-Specific Code

| Module              | Shared (from `@portfolio/providers`)                                   | PCS-Specific                                                                              |
| ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Technical**       | Golden Cross, Volume Surge, OBV, MACD, signal group caps               | RSI zones (40-55), MA position (MA50 primary), ADX (moderate preferred), BB (middle zone) |
| **Fundamental**     | PEG, FCF Yield, Forward P/E, EV/EBITDA, Profit Margins, Revenue Growth | Lower score cap (25 vs CDS 30), PCS-specific weights                                      |
| **Analyst**         | Price target upside, Recommendation trend, Earnings revisions          | Lower score cap (15 vs CDS 20), PCS-specific weights                                      |
| **IV Analysis**     | —                                                                      | Entirely PCS-specific (IV Rank, IV scoring)                                               |
| **Decision Engine** | —                                                                      | PCS-specific (credit ratio, PoP, distance OTM)                                            |

```
pcs-engine-strategy/
├── src/
│   ├── index.ts              # CLI entry (Commander.js)
│   ├── commands/
│   │   ├── scan.ts           # Stock screening (uses shared TICKER_LISTS)
│   │   ├── scan-spreads.ts   # Put spread scanner (uses shared TICKER_LISTS)
│   │   ├── scan-all.ts       # Integrated scan (uses shared TICKER_LISTS)
│   │   ├── regime.ts         # Market regime analysis
│   │   ├── briefing.ts       # Daily briefing
│   │   ├── trade.ts          # Trade entry/exit recording
│   │   └── performance.ts    # Performance analytics
│   ├── config/
│   │   ├── strategy.ts       # YAML config loader (PCS sections)
│   │   └── thresholds.ts     # PCS-specific defaults
│   ├── engine/
│   │   ├── decision.ts       # PCS entry decision engine
│   │   └── screener.ts       # Stock screening logic
│   ├── signals/
│   │   ├── technical.ts      # PCS RSI/MA/ADX/BB + shared helpers
│   │   ├── fundamental.ts    # Shared checks + PCS weights/cap
│   │   ├── analyst.ts        # Shared checks + PCS weights/cap
│   │   └── iv-analysis.ts    # PCS-only: IV Rank/Percentile analysis
│   ├── storage/
│   │   └── supabase.ts       # PCS-specific DB operations
│   ├── types/
│   │   ├── index.ts          # PCS types + re-exports
│   │   └── decision.ts       # Decision engine types
│   └── utils/
│       └── logger.ts         # Logging utility
├── package.json
├── tsconfig.json
└── README.md
```

---

**Last Updated**: 2026-02-07
