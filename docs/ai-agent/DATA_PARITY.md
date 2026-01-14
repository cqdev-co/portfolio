# CLI vs Frontend Data Parity

**Status**: ✅ FULLY RESOLVED  
**Priority**: Complete  
**Last Updated**: January 13, 2026 (AgentSession unified API added)

## Overview

Both CLI (ai-analyst) and Frontend (portfolio) now use the **exact same**
data fetching logic from the shared `lib/ai-agent/` library. This ensures:

- Same ticker data for both environments
- Same market regime analysis
- Same options data (IV, spreads, PFV)
- Same technical indicators
- Same calendar context (economic events)
- Same trade scanning and grading logic
- Same session management via AgentSession class

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              lib/ai-agent/ (Source of Truth)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AgentSession (Unified API)                 │   │
│  │  • ContextBuilder - calendar, regime, ticker data       │   │
│  │  • ConversationManager - history, summarization         │   │
│  │  • Tool execution - all 9 tools unified                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ✅ fetchTickerData() - ALL ticker data fetching                │
│  ✅ Options data (real IV, spreads from chain)                  │
│  ✅ PFV (psychological fair value, put/call walls)              │
│  ✅ Market regime (VIX, SPY trend, sector rotation)             │
│  ✅ Calendar context (FOMC, CPI, NFP, GDP, holidays)            │
│  ✅ Scanner & grading (A-F system, risk scoring)                │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────────────┐
│   CLI (ai-analyst)       │    │   Frontend (portfolio)           │
│   Uses AgentSession      │    │   Uses AgentSession              │
│   + CLI-specific extras  │    │   @lib/ai-agent import           │
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

| Feature            | Shared Module                | Notes                   |
| ------------------ | ---------------------------- | ----------------------- |
| Price, Change %    | `lib/ai-agent/data/yahoo.ts` | Real-time quote         |
| RSI, ADX           | `lib/ai-agent/data/yahoo.ts` | Calculated from history |
| Moving Averages    | `lib/ai-agent/data/yahoo.ts` | MA20, MA50, MA200       |
| Support/Resistance | `lib/ai-agent/data/yahoo.ts` | From recent highs/lows  |
| Analyst Ratings    | `lib/ai-agent/data/yahoo.ts` | Bullish %, breakdown    |
| Target Prices      | `lib/ai-agent/data/yahoo.ts` | Low/mean/high, upside   |

### ✅ Options Data (Real, Not Approximated)

| Feature        | Shared Module                     | Notes                       |
| -------------- | --------------------------------- | --------------------------- |
| IV             | `lib/ai-agent/options/iv.ts`      | From ATM options            |
| IV Percentile  | `lib/ai-agent/options/iv.ts`      | Real percentile             |
| Spread Pricing | `lib/ai-agent/options/spreads.ts` | Real bid/ask                |
| PoP            | `lib/ai-agent/options/spreads.ts` | Calculated from IV+DTE      |
| PFV            | `lib/ai-agent/pfv/index.ts`       | Full psychological analysis |
| Put/Call Walls | `lib/ai-agent/pfv/index.ts`       | For spread context          |

### ✅ Rich Data (NEW - December 28, 2025)

| Feature           | Shared Module                | Notes                   |
| ----------------- | ---------------------------- | ----------------------- |
| Options Flow      | `lib/ai-agent/data/yahoo.ts` | P/C ratio OI & volume   |
| Relative Strength | `lib/ai-agent/data/yahoo.ts` | vs SPY (30-day)         |
| Short Interest    | `lib/ai-agent/data/yahoo.ts` | % float, days to cover  |
| Earnings History  | `lib/ai-agent/data/yahoo.ts` | Beat streak, surprise % |
| Sector P/E        | `lib/ai-agent/data/yahoo.ts` | vs sector average       |

### ✅ Market Regime (NEW - December 28, 2025)

| Feature                | Shared Module                  | Notes                   |
| ---------------------- | ------------------------------ | ----------------------- |
| VIX Analysis           | `lib/ai-agent/market/index.ts` | Level, description      |
| SPY Trend              | `lib/ai-agent/market/index.ts` | Bullish/Bearish/Neutral |
| Sector Rotation        | `lib/ai-agent/market/index.ts` | Leading/lagging sectors |
| Trading Recommendation | `lib/ai-agent/market/index.ts` | Based on regime         |

### ✅ Calendar Context (NEW - January 13, 2026)

| Feature         | Shared Module                    | Notes                       |
| --------------- | -------------------------------- | --------------------------- |
| FOMC Meetings   | `lib/ai-agent/calendar/index.ts` | 2024-2026 dates             |
| CPI Reports     | `lib/ai-agent/calendar/index.ts` | Inflation data releases     |
| Jobs Report     | `lib/ai-agent/calendar/index.ts` | NFP employment data         |
| GDP Releases    | `lib/ai-agent/calendar/index.ts` | Quarterly growth data       |
| Market Holidays | `lib/ai-agent/calendar/index.ts` | US market closures          |
| Quad Witching   | `lib/ai-agent/calendar/index.ts` | Options expiration days     |
| Market Status   | `lib/ai-agent/calendar/index.ts` | OPEN/PRE-MARKET/AFTER-HRS   |
| Event Warnings  | `lib/ai-agent/calendar/index.ts` | Upcoming high-impact events |

### ✅ Scanner & Grading (NEW - January 13, 2026)

| Feature       | Shared Module                   | Notes                      |
| ------------- | ------------------------------- | -------------------------- |
| Trade Grading | `lib/ai-agent/scanner/index.ts` | A+ to F grading system     |
| Risk Scoring  | `lib/ai-agent/scanner/index.ts` | 1-10 risk assessment       |
| Scan Lists    | `lib/ai-agent/scanner/index.ts` | Tech, semis, mega-cap, etc |
| Quick Scan    | `lib/ai-agent/scanner/index.ts` | Filtered opportunity scan  |
| Full Scan     | `lib/ai-agent/scanner/index.ts` | Comprehensive scan         |
| TOON Encoding | `lib/ai-agent/scanner/index.ts` | Token-efficient format     |

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

// Calendar types (NEW - January 13, 2026)
type EventType          // FOMC, CPI, NFP, GDP, FED, HOLIDAY, WITCHING
type MarketEvent        // Single event with date, name, impact
type CalendarContext    // Full context with warnings

// Scanner types (NEW - January 13, 2026)
type ScannerTradeGrade  // A+ to F
type GradingCriteria    // Individual criterion result
type TradeGradeResult   // Full grade with breakdown
type RiskFactor         // Individual risk factor
type RiskScore          // Full risk assessment
type ScanResult         // Single scan result
type ScanOptions        // Scan configuration

// Session types (NEW - January 13, 2026)
class AgentSession      // Main unified API class
class ContextBuilder    // Builds market/ticker context
class ConversationManager // History with summarization
type SessionMessage     // Message in history
type SessionConfig      // Session configuration
type ChatResponse       // Response from chat
type MarketContext      // Calendar + regime context
type TickerContext      // Ticker data context
```

## Usage

### Using AgentSession (Recommended)

```typescript
import { AgentSession } from '@lib/ai-agent';

// Initialize session with config
const session = new AgentSession({
  accountSize: 1750,
  useTOON: true,
});
await session.initialize();

// Prepare context for a user message
const { systemPrompt, messages, classification, tickers } =
  await session.prepareContext('How does NVDA look?');

// Execute tools as needed
const result = await session.executeTool({
  name: 'get_ticker_data',
  arguments: { ticker: 'NVDA' },
});

// Add response to history
session.addAssistantMessage('NVDA looks bullish...', toolCalls, toolResults);
```

### Direct API Usage

#### CLI

```typescript
import {
  fetchTickerData,
  getMarketRegime,
  formatRegimeForAI,
} from '../../../lib/ai-agent';

const data = await fetchTickerData('NVDA');
const regime = await getMarketRegime();
```

#### Frontend

```typescript
import {
  fetchTickerData,
  getMarketRegime,
  formatRegimeForAI,
} from '@lib/ai-agent';

const data = await fetchTickerData('NVDA');
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

| Metric   | TOON           | JSON        |
| -------- | -------------- | ----------- |
| Tokens   | **40% fewer**  | Baseline    |
| Accuracy | **74%**        | 70%         |
| Best for | Uniform arrays | Nested data |

### TOON Encoders Available

```typescript
import {
  encodeTickerToTOON, // Single ticker (full details)
  encodeTickerTableToTOON, // Multiple tickers (most efficient)
  encodeMarketRegimeToTOON, // Market conditions
  encodeScanResultsToTOON, // Scanner output
} from 'lib/ai-agent';
```

### When to Use TOON

| Use Case           | Format         | Reason           |
| ------------------ | -------------- | ---------------- |
| Tool results to AI | TOON           | Token efficiency |
| Multiple tickers   | TOON (tabular) | 50%+ savings     |
| Market regime      | TOON           | Structured data  |
| Scan results       | TOON           | Uniform arrays   |
| Human display      | JSON/Text      | Readability      |
| Frontend cards     | JSON           | Direct rendering |

## Future Considerations

### ✅ Frontend UI Display (December 28, 2025)

The `ticker-data-card.tsx` component now displays all rich data:

| Field             | Display                                      |
| ----------------- | -------------------------------------------- |
| Options Flow      | P/C ratio with bullish/neutral/bearish badge |
| Relative Strength | vs SPY % with trend indicator                |
| Sector P/E        | vs sector average %                          |
| PFV               | Value, divergence %, bias, confidence        |
| Earnings History  | Beat streak, last surprise %, avg surprise   |

### ✅ AI Thinking Display (December 28, 2025)

The `chat-message.tsx` component now shows AI reasoning:

- **Collapsible thinking panel** with 🧠 icon
- **Streaming support** - shows thinking as it happens
- **Purple gradient** styling to distinguish from responses
- **Scrollable** max-height container for long reasoning chains

### Different Features, Same Data

While CLI and Frontend share the same **data layer**, they have
different **features**:

| Feature          | CLI      | Frontend                |
| ---------------- | -------- | ----------------------- |
| Full Tools (9)   | ✅       | ✅ (January 2026)       |
| Calendar Context | ✅       | ✅ (January 2026)       |
| Market Regime    | ✅       | ✅ (January 2026)       |
| Scanner Tool     | ✅       | ✅ (January 2026)       |
| Trade History    | ✅       | Not planned             |
| TOON Context     | ✅       | ✅ (now shared)         |
| AgentSession     | Planned  | Planned                 |
| Interactive UI   | ❌       | ✅                      |
| Data Cards       | ✅ Rich  | ✅ Rich (now identical) |
| Streaming        | Terminal | Web                     |

### ✅ P/E Null Handling (January 5, 2026)

Cloudflare Worker v3.3 now properly handles null P/E ratios:

| Scenario            | Old Behavior | New Behavior               |
| ------------------- | ------------ | -------------------------- |
| Loss-making company | `peRatio: 0` | `peRatio: null`            |
| Negative EPS        | `eps: 0`     | `eps: -3.1` (actual value) |
| Beta unavailable    | `beta: 0`    | `beta: null`               |

This allows the frontend to distinguish between:

- "P/E is zero" (mathematically possible but rare)
- "P/E is unavailable" (loss-making company)

### ✅ Enhanced Ticker Data Card (January 5, 2026)

The `ticker-data-card.tsx` component now displays all proxy data:

| New Field      | Display                                   |
| -------------- | ----------------------------------------- |
| Beta           | Color-coded (high/normal/low volatility)  |
| EPS            | Dollar value, red if negative             |
| Forward P/E    | Valuation metric                          |
| Dividend Yield | Green percentage                          |
| 52-Week Range  | Visual progress bar with current position |
| Price Change   | Dollar amount + percentage                |

### ✅ Caching Strategy (January 2026)

Implemented caching via `SessionCache`:

- **Market regime**: 5-minute TTL (stable data)
- **Ticker data**: 1-minute TTL (context builder)
- **Calendar context**: 5-minute TTL (changes daily)
- **Options chains**: Per-request (rate limited)

### ✅ Architecture Verification (January 13, 2026)

All shared modules compile cleanly:

```bash
cd lib/ai-agent && npx tsc --noEmit  # ✅ Exit 0
cd frontend && npx tsc --noEmit       # ✅ Exit 0
```

Type-safe integration across CLI and Frontend.

## Related Documentation

- `docs/ai-agent/INTEGRATION_PLAN.md` - Full integration roadmap
- `docs/ai-agent/SHARED_LIBRARY.md` - Library usage guide
- `docs/lib/SHARED_SERVICES.md` - Calendar, scanner, and service architecture
