# Odyssey Trading Dashboard

## Overview

Odyssey is a modern, modular trading dashboard built for busy professionals who need to quickly assess market conditions and trading opportunities. Designed for a 60-second glance during work breaks, it surfaces the top actionable opportunities without requiring constant monitoring.

## Key Features

- **HPF-ICS Checklist**: 6-condition systematic strategy checklist with GO/NO_GO signals
- **Quick Glance Hero**: Top 5 prioritized opportunities with one-line actionable signals
- **Unusual Options Integration**: Auto-includes tickers with high-conviction unusual activity
- **Pinned Plans**: Save strategy rules for reference (entry/exit rules visible anytime)
- **Condensed Market Pulse**: SPY, QQQ, and VIX at a glance with sentiment guidance
- **Smart Refresh**: Data loads on page visit + manual refresh (no wasteful auto-polling)
- **Dual Spread Strategies**: Both credit spreads and debit spreads detection
- **Priority Scoring**: Opportunities ranked by confidence (60%), risk/reward (25%), and time sensitivity (15%)

## Quick Glance Design

The dashboard is optimized for checking during work breaks:

```
┌─────────────────────────────────────────┐
│ HPF-ICS Checklist              [GO]     │
│ ✓ Uptrend Confirmed     Price > 50 SMA  │
│ ✓ Momentum Positive     Price > 20 EMA  │
│ ✓ IV Rank Sufficient    VIX: 18.5       │
│ ✓ No Major Events       Clear 7 days    │
│ ✓ Triple Witching Clear > 3 days        │
│ ✓ Position Allocation   2/8 open        │
├─────────────────────────────────────────┤
│ Top Actions (Quick Glance Hero)         │
│ 1. Sell SPY $450/$445 Put @ $1.20  ACT  │
│ 2. Buy QQQ $380/$390 Call @ $2.50  HIGH │
├─────────────────────────────────────────┤
│ Market Pulse: [Sentiment] SPY QQQ VIX   │
└─────────────────────────────────────────┘
```

## HPF-ICS Strategy (High-Probability Filtered Index Credit Spread)

A systematic bull put spread strategy on index options (SPX/SPY) with strict entry filters.

### 6-Condition Checklist (ALL must pass)

| # | Condition | Rule | Data |
|---|-----------|------|------|
| 1 | Uptrend Confirmed | SPX > 50 SMA AND SPX > 200 SMA | Daily OHLC |
| 2 | Momentum Positive | SPX > 20 EMA | Daily OHLC |
| 3 | IV Rank Sufficient | VIX ≥ 15 (proxy for IV Percentile ≥ 45) | VIX |
| 4 | No Major Events | Check FOMC, CPI, Jobs, Triple Witching | Calendar |
| 5 | Triple Witching Clear | Not within 3 days of expiration Friday | Date |
| 6 | Allocation OK | Open positions < 50% of max (6-8 spreads) | Portfolio |

### Entry Rules

- **Direction**: Bull put spreads ONLY (never naked or bear calls)
- **DTE**: 38-52 days (target 45)
- **Short Delta**: 16-25Δ (never below 15 or above 30)
- **Spread Width**: $10 or $15
- **Min Credit**: ≥33% of spread width
- **Position Size**: Risk 1.5-3.0% per trade
- **Entry Time**: 10:00 AM - 2:00 PM ET

### Exit Rules (Mechanical)

| Rule | Trigger | Action |
|------|---------|--------|
| A | Profit ≥ 50% | Close immediately |
| B | 21 DTE remaining | Close immediately |
| C | Loss ≥ 2× credit | Stop loss - close |
| D | Delta reaches 40Δ | Delta defense - close |
| E | VIX > 35 | Panic - close all |

### Checklist Result

- **GO**: All 6 conditions pass → Safe to enter new spread
- **CAUTION**: Technical conditions pass, non-critical fail → Reduced size
- **NO_GO**: Critical conditions fail → Stay flat

## Unusual Options Integration

Odyssey automatically pulls tickers from the unusual options scanner to enhance opportunity detection:

### How It Works

1. Fetches unique tickers from `unusual_options_signals` table in Supabase
2. Filters for recent signals (last 7 days) with grade S, A, or B
3. Only includes active signals with score ≥ 60
4. Combines with your manual watchlist (deduped)
5. Scans all combined tickers for spread opportunities

### Settings Panel Display

The Settings dialog shows both sources:

- **Manual Watchlist**: Your custom tickers (editable)
- **Unusual Options Activity**: Auto-detected tickers with grade badges
  - Grade S = Emerald border
  - Grade A = Blue border
  - Includes sentiment indicator (↑ bullish, ↓ bearish)

### Benefits

- Captures momentum plays you might miss
- Leverages existing unusual options scanner data
- No manual effort to track unusual activity
- Combined with manual watchlist for comprehensive coverage

## Pinned Plans

Pin the HPF-ICS strategy to keep rules visible:

1. Click the **Pin** icon on the checklist card
2. Entry and exit rules remain visible for reference
3. Unpin anytime by clicking again

This ensures you never forget the plan when taking a quick glance.

## Architecture

### Frontend-Only Design

Odyssey is implemented as a frontend-only Next.js application:

1. **API Routes** (`/api/odyssey/*`): Proxy layer for yahoo-finance2
2. **Strategy Engine**: Modular framework for opportunity detection
3. **Custom Hooks**: React hooks for data fetching and state
4. **Components**: Feature-organized UI components

### Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **UI Library**: ShadCN/UI components built on Radix UI
- **Styling**: TailwindCSS
- **Data Source**: yahoo-finance2

## Project Structure

```
frontend/src/
├── app/
│   ├── api/odyssey/          # API routes for data fetching
│   └── odyssey/              # Main dashboard page
├── components/odyssey/
│   ├── QuickGlanceHero.tsx   # Top actions hero
│   ├── StrategyChecklist.tsx # HPF-ICS checklist
│   ├── market-overview/      # Market overview components
│   ├── opportunities/        # Opportunity display
│   └── config/               # Configuration components
└── lib/odyssey/
    ├── strategies/
    │   ├── BaseStrategy.ts
    │   ├── CreditSpreadStrategy.ts
    │   ├── DebitSpreadStrategy.ts
    │   ├── HPFIndexCreditSpreadStrategy.ts  # HPF-ICS
    │   └── StrategyEngine.ts
    ├── hooks/
    │   ├── useMarketData.ts
    │   ├── useOpportunities.ts
    │   ├── useHPFChecklist.ts         # HPF checklist hook
    │   ├── usePinnedPlans.ts          # Pinned plans hook
    │   └── useUnusualOptionsTickers.ts # Unusual options integration
    └── utils/
```

## Strategies

### HPF-ICS (Primary)

High-probability filtered bull put spreads on SPX:
- 6-condition checklist
- 45 DTE target, 16-25Δ
- Mechanical entry/exit rules

### Credit Spread Strategy

General credit spread opportunities:
- Bull Put Spreads (bullish)
- Bear Call Spreads (bearish)
- Parameters: 7-45 DTE, 2.0 min R:R

### Debit Spread Strategy

Directional debit spread opportunities:
- Bull Call Spreads (bullish)
- Bear Put Spreads (bearish)
- Parameters: 14-60 DTE, 1.5 min R:R

## Quick Start

1. Navigate to `/odyssey`
2. **Check HPF-ICS Checklist** - Is it GO, CAUTION, or NO_GO?
3. Review top 5 opportunities in Quick Glance Hero
4. Check Market Pulse for sentiment guidance
5. Click "Refresh" to update data manually
6. Pin the strategy to keep rules visible

## Weekly Routine (HPF-ICS)

| Day | Actions |
|-----|---------|
| Sunday | Check economic calendar, mark no-trade days |
| Monday | Run checklist. If GO → place 1-2 bull put spreads |
| Tue-Thu | Monitor for 50% profit or 2× stop |
| Friday | Close any spread ≤21 DTE after weekend |

## Data Sources

Odyssey uses yahoo-finance2 for:

- Real-time and historical price data
- Options chain data with Greeks
- Volume and change statistics

**Note**: Yahoo Finance has rate limits. For production, consider Polygon.io or Alpaca.

## Expected Performance (HPF-ICS Backtest 2015-2025)

- **Win Rate**: 86-92%
- **Avg Days Held**: 18-25
- **Return on Risk**: ~38-45% per trade
- **CAGR**: 18-35%
- **Max Drawdown**: 12-22% (with tail hedge ≤15%)
- **Sharpe**: 1.8-2.8

## Future Enhancements

- [x] HPF-ICS systematic strategy
- [x] Pinned plans feature
- [ ] Economic calendar API integration
- [ ] Position tracking / portfolio state
- [ ] Technical indicator strategies
- [ ] Alert/notification system
- [ ] Historical performance tracking
- [ ] Mobile-responsive improvements

## Related Documentation

- [Strategy Guide](./strategy-guide.md) - How to create custom strategies
- [Data Sources](./data-sources.md) - Data integration details
- [User Guide](./user-guide.md) - How to use the dashboard
