# CLI vs Frontend Data Parity

**Status**: ✅ FULLY RESOLVED  
**Priority**: Complete  
**Last Updated**: December 28, 2025

## Overview

Both CLI (ai-analyst) and Frontend (portfolio) now use the **exact same** 
data fetching logic from the shared `lib/ai-agent/` library. This ensures:

- Same ticker data for both environments
- Same market regime analysis
- Same options data (IV, spreads, PFV)
- Same technical indicators

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              lib/ai-agent/ (Source of Truth)                    │
│  ✅ fetchTickerData() - ALL ticker data fetching                │
│  ✅ Options data (real IV, spreads from chain)                  │
│  ✅ PFV (psychological fair value, put/call walls)              │
│  ✅ Market regime (VIX, SPY trend, sector rotation)             │
│  ✅ Rich data (options flow, relative strength, earnings hist)  │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────────┐
│   CLI (ai-analyst)       │    │   Frontend (portfolio)           │
│   Uses sharedFetchTicker │    │   Uses fetchTickerData           │
│   + CLI-specific extras  │    │   @lib/ai-agent import           │
│   (ownership, analysis)  │    │                                  │
│   SAME CORE DATA ✅      │    │   SAME CORE DATA ✅              │
└──────────────────────────┘    └──────────────────────────────────┘
```

## ✅ RESOLVED: CLI Data Parity (December 28, 2025)

The CLI (`ai-analyst`) now imports `fetchTickerData` from the shared library
instead of using its own local implementation. This ensures:

- **Same price/RSI/ADX/MAs** between CLI and Frontend
- **Same spread recommendations** using identical algorithms
- **Same IV calculations** from real options data
- **Same PFV** using shared psychological fair value logic
- **Same rich data** (options flow, relative strength, earnings)

CLI-specific additions (not in shared library):
- Ownership data (insider %, institutional %)
- Advanced trade grading (A-F system)
- Detailed support/resistance levels

## Completed Integrations

### ✅ Core Ticker Data

| Feature | Shared Module | Notes |
|---------|---------------|-------|
| Price, Change % | `lib/ai-agent/data/yahoo.ts` | Real-time quote |
| RSI, ADX | `lib/ai-agent/data/yahoo.ts` | Calculated from history |
| Moving Averages | `lib/ai-agent/data/yahoo.ts` | MA20, MA50, MA200 |
| Support/Resistance | `lib/ai-agent/data/yahoo.ts` | From recent highs/lows |
| Analyst Ratings | `lib/ai-agent/data/yahoo.ts` | Bullish %, breakdown |
| Target Prices | `lib/ai-agent/data/yahoo.ts` | Low/mean/high, upside |

### ✅ Options Data (Real, Not Approximated)

| Feature | Shared Module | Notes |
|---------|---------------|-------|
| IV | `lib/ai-agent/options/iv.ts` | From ATM options |
| IV Percentile | `lib/ai-agent/options/iv.ts` | Real percentile |
| Spread Pricing | `lib/ai-agent/options/spreads.ts` | Real bid/ask |
| PoP | `lib/ai-agent/options/spreads.ts` | Calculated from IV+DTE |
| PFV | `lib/ai-agent/pfv/index.ts` | Full psychological analysis |
| Put/Call Walls | `lib/ai-agent/pfv/index.ts` | For spread context |

### ✅ Rich Data (NEW - December 28, 2025)

| Feature | Shared Module | Notes |
|---------|---------------|-------|
| Options Flow | `lib/ai-agent/data/yahoo.ts` | P/C ratio OI & volume |
| Relative Strength | `lib/ai-agent/data/yahoo.ts` | vs SPY (30-day) |
| Short Interest | `lib/ai-agent/data/yahoo.ts` | % float, days to cover |
| Earnings History | `lib/ai-agent/data/yahoo.ts` | Beat streak, surprise % |
| Sector P/E | `lib/ai-agent/data/yahoo.ts` | vs sector average |

### ✅ Market Regime (NEW - December 28, 2025)

| Feature | Shared Module | Notes |
|---------|---------------|-------|
| VIX Analysis | `lib/ai-agent/market/index.ts` | Level, description |
| SPY Trend | `lib/ai-agent/market/index.ts` | Bullish/Bearish/Neutral |
| Sector Rotation | `lib/ai-agent/market/index.ts` | Leading/lagging sectors |
| Trading Recommendation | `lib/ai-agent/market/index.ts` | Based on regime |

## Types Exported

```typescript
// Core data types
type TickerData
type SpreadRecommendation
type IVAnalysis
type TradeGrade
type AnalystRatings
type TargetPrices
type PricePerformance
type SectorContext
type ShortInterest
type OptionsFlow
type RelativeStrength
type EarningsHistory

// Market regime types
type MarketRegime
type MarketRegimeType
type VIXLevel
type VIXData
type SPYTrend
type SectorPerformance
```

## Usage

### CLI

```typescript
import {
  fetchTickerData,
  getMarketRegime,
  formatRegimeForAI,
} from "../../../lib/ai-agent";

const data = await fetchTickerData("NVDA");
const regime = await getMarketRegime();
```

### Frontend

```typescript
import {
  fetchTickerData,
  getMarketRegime,
  formatRegimeForAI,
} from "@lib/ai-agent";

const data = await fetchTickerData("NVDA");
const regime = await getMarketRegime();
```

## Data Flow

```
User asks: "How does NVDA look?"
           │
           ▼
┌─────────────────────────────────────────┐
│  fetchTickerData("NVDA")                │
│  ├── Yahoo Finance quote                │
│  ├── Historical data (RSI, ADX, MAs)    │
│  ├── Options flow (P/C ratio)           │
│  ├── Relative strength vs SPY           │
│  ├── Earnings history (beat streak)     │
│  ├── getIVAnalysis() - real IV          │
│  ├── findSpreadWithAlternatives()       │
│  └── getPsychologicalFairValue()        │
└─────────────────────────────────────────┘
           │
           ▼
     Same TickerData object
     for CLI and Frontend
```

## TOON Format (Token Efficiency)

Both CLI and Frontend benefit from TOON encoding for AI context:

| Metric | TOON | JSON |
|--------|------|------|
| Tokens | **40% fewer** | Baseline |
| Accuracy | **74%** | 70% |
| Best for | Uniform arrays | Nested data |

### TOON Encoders Available

```typescript
import {
  encodeTickerToTOON,       // Single ticker (full details)
  encodeTickerTableToTOON,  // Multiple tickers (most efficient)
  encodeMarketRegimeToTOON, // Market conditions
  encodeScanResultsToTOON,  // Scanner output
} from 'lib/ai-agent';
```

### When to Use TOON

| Use Case | Format | Reason |
|----------|--------|--------|
| Tool results to AI | TOON | Token efficiency |
| Multiple tickers | TOON (tabular) | 50%+ savings |
| Market regime | TOON | Structured data |
| Scan results | TOON | Uniform arrays |
| Human display | JSON/Text | Readability |
| Frontend cards | JSON | Direct rendering |

## Future Considerations

### ✅ Frontend UI Display (December 28, 2025)

The `ticker-data-card.tsx` component now displays all rich data:

| Field | Display |
|-------|---------|
| Options Flow | P/C ratio with bullish/neutral/bearish badge |
| Relative Strength | vs SPY % with trend indicator |
| Sector P/E | vs sector average % |
| PFV | Value, divergence %, bias, confidence |
| Earnings History | Beat streak, last surprise %, avg surprise |

### ✅ AI Thinking Display (December 28, 2025)

The `chat-message.tsx` component now shows AI reasoning:

- **Collapsible thinking panel** with 🧠 icon
- **Streaming support** - shows thinking as it happens
- **Purple gradient** styling to distinguish from responses
- **Scrollable** max-height container for long reasoning chains

### Different Features, Same Data

While CLI and Frontend share the same **data layer**, they have 
different **features**:

| Feature | CLI | Frontend |
|---------|-----|----------|
| Full Scanner | ✅ | Planned |
| Trade History | ✅ | Not planned |
| TOON Context | ✅ | ✅ (now shared) |
| Interactive UI | ❌ | ✅ |
| Data Cards | ✅ Rich | ✅ Rich (now identical) |
| Streaming | Terminal | Web |

### Caching Strategy (TODO)

Consider adding caching for expensive calls:
- Options chains (rate limited)
- PFV calculations (compute intensive)
- Market regime (can be cached 5 min)

## Related Documentation

- `docs/ai-agent/INTEGRATION_PLAN.md` - Full integration roadmap
- `docs/ai-agent/SHARED_LIBRARY.md` - Library usage guide

