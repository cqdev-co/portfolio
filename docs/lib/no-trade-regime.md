# No-Trade Regime Detection

**Cash-Preserving Strategy Implementation**

> "Market conditions are bad → do nothing."

This is a **strategy**, not inactivity. Most retail losses happen when people force trades in bad conditions.

## Quick Test

```bash
# Run the comprehensive test suite
cd /path/to/portfolio
YAHOO_PROXY_URL=https://yahoo-proxy.yourname.workers.dev \
  npx tsx lib/ai-agent/market/test-regime.ts
```

> **Note**: Deploy the updated Cloudflare proxy to support `^VIX` index symbols.

## What's New (v2.2)

- **Fixed CAUTION primaryReason assignment** - Single caution reason now correctly identifies the actual cause (e.g., `WEAK_BREADTH` for narrowing breadth) instead of incorrectly defaulting to `HIGH_VOLATILITY`. The fallback chain now checks: conflict score > chop transitional > weak ADX > narrowing breadth > reversals > elevated VIX > bearish SPY > generic `MULTIPLE_FACTORS`.

## What's New (v2.1)

- **Integrated ADX & Breadth** - ADX and breadth now part of main regime analysis
- **Real ADX Calculation** - Proper +DI/-DI trend strength measurement
- **Market Breadth Analysis** - SPY/RSP/IWM divergence, sector participation
- **Regime Transition Warnings** - Early detection of regime changes
- **GO Reasons** - Strong ADX and healthy breadth can offset caution signals
- **Enhanced Test Suite** - 12 comprehensive tests with live data

## Overview

The No-Trade Regime system detects when market conditions are unfavorable and explicitly recommends staying in cash. It protects your core strategy by detecting:

- **Low trend strength** - Choppy/consolidating markets
- **Signal conflicts** - When bullish and bearish signals cancel out
- **Whipsaw conditions** - False breakouts and reversals
- **High volatility** - VIX spikes indicating market fear

## Trading Regimes

| Regime     | Emoji | Description            | Action                        |
| ---------- | ----- | ---------------------- | ----------------------------- |
| `GO`       | 🟢    | Favorable conditions   | Normal position sizing        |
| `CAUTION`  | 🟡    | Mixed signals          | Reduce size 50%, Grade A only |
| `NO_TRADE` | 🔴    | Unfavorable conditions | Preserve cash                 |

## Usage

### Basic Usage

```typescript
import { analyzeTradingRegime } from '@lib/ai-agent/market';

const analysis = await analyzeTradingRegime();

if (analysis.regime === 'NO_TRADE') {
  console.log('No high-confidence setups available');
  console.log(analysis.recommendation);
}
```

### With Price History (for Chop Index)

```typescript
import { analyzeTradingRegime, type PriceHistory } from '@lib/ai-agent/market';

const priceHistory: PriceHistory = {
  highs: [...],   // 20+ daily highs
  lows: [...],    // 20+ daily lows
  closes: [...],  // 20+ daily closes
};

const analysis = await analyzeTradingRegime(priceHistory);
console.log(`Chop Index: ${analysis.metrics.chopIndex}`);
```

### With Additional Signal Inputs

```typescript
const analysis = await analyzeTradingRegime(priceHistory, {
  rsi: 35,
  adx: 18,
  pcRatio: 0.85,
  daysToEarnings: 45,
});
```

## Detection Rules

### NO_TRADE Triggers (Any of these)

```
┌─────────────────────────────────────────────────────┐
│ 1. LOW TREND STRENGTH                               │
│    - ADX < 20 (weak/no trend)                       │
│    - Chop Index > 61.8 (consolidating)              │
│    - Price oscillating within 2% range              │
├─────────────────────────────────────────────────────┤
│ 2. HIGH CHOP / WHIPSAW CONDITIONS                   │
│    - 3+ direction reversals in 5 days               │
│    - ATR expanding while price flat                 │
├─────────────────────────────────────────────────────┤
│ 3. CONFLICTING SIGNALS (Bull + Bear cancel out)     │
│    - RSI oversold BUT below MA200                   │
│    - VIX calm BUT SPY downtrend                     │
│    - Bullish flow BUT earnings imminent             │
│    - Conflict score > 60%                           │
├─────────────────────────────────────────────────────┤
│ 4. HIGH VOLATILITY                                  │
│    - VIX > 30 (HIGH level)                          │
│    - VIX > 40 (EXTREME level)                       │
├─────────────────────────────────────────────────────┤
│ 5. WEAK MARKET BREADTH (NEW in v2.1)                │
│    - Breadth score < 45% (WEAK)                     │
│    - Breadth diverging from price (DIVERGENT)       │
│    - Narrow leadership (SPY >> RSP)                 │
└─────────────────────────────────────────────────────┘
```

### CAUTION Triggers (Yellow Light)

```
┌─────────────────────────────────────────────────────┐
│ 1. TRANSITIONAL CHOP INDEX                          │
│    - Chop Index 38.2-61.8 (market transitioning)    │
│    → primaryReason: LOW_TREND_STRENGTH              │
├─────────────────────────────────────────────────────┤
│ 2. MODERATE SIGNAL CONFLICT                         │
│    - Conflict score 40-60%                          │
│    → primaryReason: SIGNAL_CONFLICT                 │
├─────────────────────────────────────────────────────┤
│ 3. ELEVATED VIX                                     │
│    - VIX 20-30 (ELEVATED level)                     │
│    → primaryReason: HIGH_VOLATILITY                 │
├─────────────────────────────────────────────────────┤
│ 4. DIRECTION REVERSALS                              │
│    - 3+ direction reversals in 5 days               │
│    → primaryReason: WHIPSAW                         │
├─────────────────────────────────────────────────────┤
│ 5. BEARISH SPY TREND                                │
│    - SPY bearish AND below MA200                    │
│    → primaryReason: SIGNAL_CONFLICT                 │
├─────────────────────────────────────────────────────┤
│ 6. WEAK ADX                                         │
│    - ADX < 20 or WEAK strength                      │
│    → primaryReason: LOW_TREND_STRENGTH              │
├─────────────────────────────────────────────────────┤
│ 7. NARROWING BREADTH                                │
│    - Breadth score 45-65% (NARROWING)               │
│    → primaryReason: WEAK_BREADTH                    │
└─────────────────────────────────────────────────────┘
```

**Regime offset rules:**
- 1 caution reason + 2 go reasons → upgraded to **GO**
- 1 caution reason + <2 go reasons → stays **CAUTION**
- 2+ caution reasons → **CAUTION** (primaryReason = MULTIPLE_FACTORS if >2)

### GO Boosters (Can Offset Caution Signals)

Strong ADX and healthy breadth can upgrade CAUTION to GO:

```
┌─────────────────────────────────────────────────────┐
│ GO BOOSTER: Strong trend + broad participation      │
├─────────────────────────────────────────────────────┤
│ • ADX ≥ 25 (STRONG or VERY_STRONG)                  │
│ • Market breadth ≥ 60% (HEALTHY)                    │
│ • Both present = can offset 1 caution signal        │
└─────────────────────────────────────────────────────┘
```

## Chop Index

The Chop Index determines if the market is trending or consolidating.

**Formula:**

```
100 * LOG10(SUM(ATR, n) / (Highest High - Lowest Low)) / LOG10(n)
```

**Interpretation:**
| Value | Level | Meaning |
|-------|-------|---------|
| < 38.2 | TRENDING | Strong trend - favorable for trading |
| 38.2-61.8 | TRANSITIONAL | Market transitioning - wait |
| > 61.8 | CHOPPY | Consolidating - avoid trading |

The thresholds (38.2 and 61.8) are derived from Fibonacci ratios.

## Signal Conflict Detection

Signals are weighted and compared to detect conflicts:

| Signal       | Weight | Bullish         | Bearish           |
| ------------ | ------ | --------------- | ----------------- |
| VIX          | 18%    | CALM            | ELEVATED/HIGH     |
| SPY Trend    | 18%    | BULLISH         | BEARISH           |
| SPY MA200    | 12%    | Above           | Below             |
| ADX          | 12%    | > 25            | < 20              |
| RSI          | 10%    | < 30 (oversold) | > 70 (overbought) |
| Options Flow | 10%    | P/C < 0.7       | P/C > 1.0         |
| Sector       | 8%     | LEADING         | LAGGING           |
| Earnings     | 7%     | > 30 days       | < 14 days         |
| Chop         | 5%     | < 38.2          | > 61.8            |

**Conflict Score:**

- 0-40%: Low conflict (clear direction)
- 40-60%: Moderate conflict (caution)
- 60-100%: High conflict (avoid trading)

## Output Examples

### GO Regime

```
🟢 GO (75% confidence)

METRICS:
  Chop Index: 32.5
  Conflict Score: 25%
  Trend Strength: STRONG
  VIX: 15 (CALM)
  SPY: BULLISH

→ Risk-On environment. Normal position sizing.
  Look for pullbacks to support for entries.
```

### CAUTION Regime

```
🟡 CAUTION (89% confidence)

METRICS:
  Chop Index: 47.9
  Conflict Score: 0%
  Trend Strength: MODERATE
  ADX: 10.8 (WEAK)
  Breadth: 75% (HEALTHY)

FACTORS:
  • Chop Index 47.9 - transitional
  • ADX 10.8 - no clear trend, range-bound
  • Market breadth 75% - strong participation, broad rally

→ Proceed with caution. Reduce position sizes by 50%.
  Only take Grade A setups. Use tighter stops and lower
  profit targets.
```

### NO_TRADE Regime

```
🔴 NO_TRADE (88% confidence)

METRICS:
  Chop Index: 68.5
  Conflict Score: 72%
  Trend Strength: WEAK
  ADX: 12.5 (WEAK)
  Breadth: 38% (WEAK)

FACTORS:
  • Chop Index 68.5 - consolidating market
  • Signal conflict 72% - 3 major conflicts
  • ADX 12.5 - no clear trend, range-bound
  • Market breadth 38% (WEAK) - weak participation

→ No high-confidence setups available.
  Market is consolidating - wait for breakout/breakdown
  confirmation before entering new positions.
```

## AI Agent Integration

The `get_trading_regime` tool is available for the AI agent:

```typescript
// Tool definition
{
  name: "get_trading_regime",
  description: "Analyze current market conditions...",
  parameters: {
    ticker: "Optional ticker for additional context"
  }
}
```

The agent should call this tool BEFORE suggesting trades to verify conditions are favorable.

## File Structure

```
lib/ai-agent/market/
├── index.ts              # Main exports + regime detection
├── chop-index.ts         # Chop Index + ATR + ADX calculations
├── signal-conflicts.ts   # Weighted signal scoring
├── market-breadth.ts     # Market breadth indicators (NEW)
├── no-trade-regime.ts    # Main no-trade logic + transitions
└── test-regime.ts        # Comprehensive test suite
```

## API Reference

### `analyzeTradingRegime(priceHistory?, additionalInputs?)`

Main analysis function. Now automatically includes ADX and breadth analysis.

**Parameters:**

- `priceHistory` (optional): Historical price data for chop/ADX calculation
- `additionalInputs` (optional): Additional signal inputs (RSI, etc.)

**Returns:** `TradingRegimeAnalysis` including:

- `regime`: GO | CAUTION | NO_TRADE
- `adx`: Real ADX analysis (if price history provided)
- `breadth`: Market breadth analysis (auto-fetched via proxy)
- `metrics`: Includes `adxValue`, `adxTrend`, `breadthScore`, `breadthSignal`

### `getChopAnalysis(highs, lows, closes, period?)`

Calculate Chop Index.

**Parameters:**

- `highs`: Array of high prices
- `lows`: Array of low prices
- `closes`: Array of close prices
- `period`: Lookback period (default: 14)

**Returns:** `ChopAnalysis | null`

### `analyzeSignalConflicts(inputs)`

Analyze signal conflicts.

**Parameters:**

- `inputs`: `SignalInputs` object with market signals

**Returns:** `ConflictAnalysis`

### Formatters

- `formatRegimeBadge(analysis)`: Compact badge (e.g., "🟢 GO (75%)")
- `formatTradingRegimeForAI(analysis)`: Full context for AI
- `formatWeeklySummary(analysis)`: Weekly summary format

---

## New Features (v2.0)

### Real ADX Calculation

ADX (Average Directional Index) now calculated from actual price data:

```typescript
import { getADXAnalysis } from '@lib/ai-agent/market';

const adx = getADXAnalysis(highs, lows, closes, 14);
// {
//   adx: 25.3,
//   plusDI: 28.5,
//   minusDI: 18.2,
//   strength: 'STRONG',
//   direction: 'BULLISH',
//   rising: true,
//   description: 'Strong bullish trend in progress (strengthening)'
// }
```

**ADX Interpretation:**
| ADX Value | Strength | Meaning |
|-----------|----------|---------|
| < 20 | WEAK | No clear trend (range-bound) |
| 20-25 | MODERATE | Emerging trend |
| 25-50 | STRONG | Strong trend |
| 50-75 | VERY_STRONG | Very strong trend |
| > 75 | Extreme | Often precedes reversal |

**DI Interpretation:**

- `+DI > -DI`: Bullish pressure
- `-DI > +DI`: Bearish pressure
- DI lines close together: No clear direction

### Market Breadth Analysis

Estimates market breadth from proxy ETFs (SPY, RSP, IWM):

```typescript
import { fetchBreadthViaProxy } from '@lib/ai-agent/market';

const breadth = await fetchBreadthViaProxy(proxyUrl);
// {
//   score: 75,
//   level: 'HEALTHY',
//   supportsTrend: true,
//   metrics: {
//     pctAboveMA50: 68,
//     pctAboveMA200: 55,
//   },
//   warnings: [],
//   summary: 'Broad market participation - healthy breadth supports trend'
// }
```

**Breadth Levels:**
| Level | Score | Meaning |
|-------|-------|---------|
| HEALTHY | 65+ | Broad participation, trend supported |
| NARROWING | 45-65 | Fewer stocks participating |
| WEAK | < 45 | Majority not participating |
| DIVERGENT | - | Breadth diverging from price action |

**Key Signals:**

- RSP outperforming SPY = Healthy breadth (equal-weight > cap-weight)
- SPY outperforming RSP = Narrow leadership (mega-caps only)
- IWM outperforming = Risk-on, small caps leading
- IWM underperforming = Risk-off, flight to quality

### Regime Transition Warnings

Predicts regime changes before they happen:

```typescript
import { detectRegimeTransition } from '@lib/ai-agent/market';

const transition = detectRegimeTransition(
  currentAnalysis,
  previousMetrics,
  adxAnalysis,
  breadthScore
);
// {
//   currentRegime: 'CAUTION',
//   likelyNextRegime: 'NO_TRADE',
//   transitionProbability: 65,
//   direction: 'DETERIORATING',
//   timeHorizon: 'NEAR_TERM',
//   warningSignals: [
//     'Chop Index 58.2 approaching choppy zone (61.8)',
//     'VIX spiked above 25 - volatility regime change'
//   ],
//   advice: '⚠️ Conditions deteriorating. Prepare for NO_TRADE regime.'
// }
```

**Transition Detection Triggers:**

| Signal         | Deteriorating             | Improving               |
| -------------- | ------------------------- | ----------------------- |
| Chop Index     | → 61.8 (choppy)           | → 38.2 (trending)       |
| Conflict Score | Rising rapidly (+15%)     | Dropping rapidly (-15%) |
| VIX            | Crossing above 25         | Dropping below 20       |
| ADX            | Falling (trend weakening) | Rising (trend forming)  |
| Breadth        | Diverging from price      | Confirming price        |

**Time Horizons:**

- **NEAR_TERM**: Transition likely in 1-2 days (probability > 60%)
- **SHORT_TERM**: Transition possible in 3-7 days (probability 30-60%)

### Sector Breadth

Get individual sector health:

```typescript
import { fetchSectorBreadthViaProxy } from '@lib/ai-agent/market';

const sectors = await fetchSectorBreadthViaProxy(proxyUrl);
// [
//   { ticker: 'XLK', name: 'Technology', aboveMA50: true, changePct: 1.2, trend: 'UP' },
//   { ticker: 'XLE', name: 'Energy', aboveMA50: false, changePct: -2.1, trend: 'DOWN' },
//   ...
// ]
```

---

## Example: Full Analysis Flow

```typescript
import {
  analyzeTradingRegime,
  getADXAnalysis,
  fetchBreadthViaProxy,
  detectRegimeTransition,
  formatTransitionWarning,
} from '@lib/ai-agent/market';

// 1. Get regime analysis with price history
const analysis = await analyzeTradingRegime(priceHistory);

// 2. Get real ADX
const adx = getADXAnalysis(highs, lows, closes);

// 3. Get market breadth
const breadth = await fetchBreadthViaProxy(proxyUrl);

// 4. Check for regime transitions
const transition = detectRegimeTransition(
  analysis,
  previousSnapshot,
  adx,
  breadth?.score
);

// 5. Output
console.log(`Regime: ${analysis.regime}`);
console.log(`ADX: ${adx?.adx} (${adx?.strength})`);
console.log(`Breadth: ${breadth?.score} (${breadth?.level})`);
console.log(formatTransitionWarning(transition));
```
