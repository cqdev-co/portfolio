# Screen-Ticker Scanner Improvements

> **Status**: v2.5.0 improvements implemented (2026-01-07)
>
> - ✅ RSI Sweet Spot Scoring (35-50 ideal range)
> - ✅ Pullback-in-Uptrend Detection Signal
> - ✅ Market Regime-Aware Scanning
> - ✅ Debug Indicators Flag
> - ✅ Strategy Config Loading

---

## Analysis: Why Only 1 Result from 503 S&P 500 Tickers?

The scan found **NOW (ServiceNow)** with score 70, flagged as **WAIT** because
it's below MA200. This is actually correct behavior—the scanner is properly
enforcing the strategy config's hard requirement.

### Current Scanner Behavior

The scanner awards points for **oversold/distressed conditions**:

- RSI < 30 (oversold): Full points
- RSI 30-40 (approaching oversold): Partial points
- RSI 40-50 (neutral-bearish): 3 points
- Near 52-week lows: 8 points
- Near support levels: 10 points

### The Gap: Bull Market Reality

In a **bull market**, most quality stocks are:

- ✅ Above MA200 (uptrending)
- ❌ RSI 55-70 (neutral to extended, NOT oversold)
- ❌ Far from support (not pulled back)
- ❌ Mid-to-upper 52-week range

**The scanner rewards "beat down" stocks, but the strategy wants
"pullbacks in uptrends".**

---

## Recommended Improvements

### 1. RSI Sweet Spot Scoring (Priority: HIGH)

Currently RSI only scores for oversold. Per `strategy.config.yaml`:

- RSI ideal range: **35-50**
- RSI acceptable: **30-55**

```typescript
// Current: Only rewards oversold
if (currentRSI < 30)
  points = 10; // Strongly oversold
else if (currentRSI < 40)
  points = 6; // Approaching oversold
else if (currentRSI < 50) points = 3; // Neutral-bearish

// Proposed: Reward ideal entry zone
if (currentRSI >= 35 && currentRSI <= 50) {
  points = 8; // "RSI Sweet Spot" - ideal entry
} else if (currentRSI >= 30 && currentRSI <= 55) {
  points = 5; // "RSI Acceptable Range"
} else if (currentRSI < 30) {
  points = 6; // "RSI Oversold" - may be falling knife
}
```

### 2. Pullback-in-Uptrend Signal (Priority: HIGH)

Create a new signal specifically for the CDS strategy entry:

```typescript
function checkPullbackInUptrend(
  currentPrice: number,
  closes: number[],
  ma50: number,
  ma200: number
): Signal | null {
  // Requirements:
  // 1. Price above MA200 (long-term uptrend)
  // 2. Price within 3% of MA50 (pulled back to support)
  // 3. MA50 > MA200 (healthy trend structure)

  const aboveMA200 = currentPrice > ma200;
  const nearMA50 = Math.abs(currentPrice - ma50) / currentPrice < 0.03;
  const healthyStructure = ma50 > ma200;

  if (aboveMA200 && nearMA50 && healthyStructure) {
    return {
      name: 'Pullback to MA50 Support',
      category: 'technical',
      points: 12, // High value - this is THE entry setup
      description: `Uptrend intact, pulled back to MA50 support`,
    };
  }

  // Also check pullback to MA20 in strong trends
  // ...
}
```

### 3. Distance-from-High Signal (Priority: MEDIUM)

Award points for stocks that have pulled back but aren't broken:

```typescript
function checkPullbackFromHigh(
  currentPrice: number,
  high20: number,
  ma200: number
): Signal | null {
  const pullbackPct = (high20 - currentPrice) / high20;
  const aboveMA200 = currentPrice > ma200;

  // 5-15% pullback from recent high, but still above MA200
  if (aboveMA200 && pullbackPct >= 0.05 && pullbackPct <= 0.15) {
    return {
      name: 'Healthy Pullback',
      category: 'technical',
      points: 8,
      description: `${(pullbackPct * 100).toFixed(0)}% pullback, trend intact`,
    };
  }
}
```

### 4. Load Strategy Config (Priority: MEDIUM)

Read thresholds from `strategy.config.yaml` for consistency:

```typescript
// src/config/strategy.ts
import { parse } from 'yaml';
import { readFileSync } from 'fs';

export function loadStrategyConfig() {
  const configPath = join(process.cwd(), '..', 'strategy.config.yaml');
  const content = readFileSync(configPath, 'utf-8');
  return parse(content);
}

// Usage in thresholds.ts
const strategy = loadStrategyConfig();
export const entryThresholds = {
  rsiMin: strategy.entry.momentum.rsi_min, // 30
  rsiMax: strategy.entry.momentum.rsi_max, // 55
  rsiIdealMin: strategy.entry.momentum.rsi_ideal_min, // 35
  rsiIdealMax: strategy.entry.momentum.rsi_ideal_max, // 50
  minCushion: strategy.entry.cushion.minimum_pct, // 7
  // ...
};
```

### 5. Entry Setup Composite Signal (Priority: HIGH)

Award significant points when ALL ideal conditions align:

```typescript
function checkIdealEntrySetup(
  price: number,
  ma50: number,
  ma200: number,
  rsi: number,
  support1: number
): Signal | null {
  const checks = {
    aboveMA200: price > ma200,
    aboveMA50: price > ma50,
    rsiIdeal: rsi >= 35 && rsi <= 50,
    nearSupport: support1 && (price - support1) / price < 0.05,
    cushionOK: support1 && (price - support1) / price >= 0.03,
  };

  const passed = Object.values(checks).filter(Boolean).length;

  if (passed >= 4) {
    return {
      name: 'CDS Entry Setup',
      category: 'technical',
      points: 15, // Major signal
      description: `${passed}/5 ideal entry conditions met`,
    };
  }
}
```

---

## Implementation Priority

| Improvement          | Impact | Effort | Priority |
| -------------------- | ------ | ------ | -------- |
| RSI Sweet Spot       | HIGH   | LOW    | 🔴 P0    |
| Pullback-in-Uptrend  | HIGH   | MEDIUM | 🔴 P0    |
| Entry Setup Signal   | HIGH   | MEDIUM | 🟡 P1    |
| Strategy Config Load | MEDIUM | LOW    | 🟡 P1    |
| Distance-from-High   | MEDIUM | LOW    | 🟢 P2    |

---

## Expected Impact

After implementing these changes, the scanner should:

1. **Find more opportunities** - Award points for "pullback in uptrend"
   rather than only "beaten down"

2. **Better alignment with strategy** - RSI 35-50 gets rewarded, not just <40

3. **Higher quality signals** - The "CDS Entry Setup" signal specifically
   identifies ideal deep ITM spread entries

4. **Fewer false positives** - Current oversold signals can catch
   falling knives; pullback detection is safer

---

## Market Regime Awareness (v2.5.0)

The scanner now automatically adjusts behavior based on SPY market regime.

### Regime Detection

Based on SPY analysis:

- **Bull**: SPY above MA200, golden cross active, positive momentum
- **Neutral**: SPY near MA200, mixed signals
- **Bear**: SPY below MA200, death cross, negative momentum

### Regime-Specific Adjustments

| Setting              | Bull | Neutral | Bear |
| -------------------- | ---- | ------- | ---- |
| Min Score            | 65   | 70      | 80   |
| RSI Max              | 60   | 55      | 50   |
| Position Size        | 100% | 75%     | 50%  |
| Max Positions        | 6    | 4       | 2    |
| Require MA50         | No   | Yes     | Yes  |
| Require Golden Cross | No   | No      | Yes  |

### No-Trade Conditions

The scanner will refuse to run (with override option) when:

- SPY is 10%+ below MA200
- VIX is above 35
- 5+ consecutive down days in SPY

### Usage

```bash
# Normal scan (auto-detects regime)
bun run scan --list sp500

# Override regime detection
bun run scan --list sp500 --ignore-regime --min-score 65
```

---

## Debug Indicators Flag (v2.5.0)

Use `--debug-indicators` to see detailed technical data for each stock.

### Usage

```bash
bun run scan --list sp500 --min-score 60 --debug-indicators
```

### Output Example

```
  ┌─ NVDA DEBUG INDICATORS ───────────────────────
  │ Price:     $190.07
  │ MA50:      $186.85 (↑ above)
  │ MA200:     $161.19 (↑ above)
  │ RSI(14):   44.2
  │ Pullback:  8.3% from 20d high
  │
  │ SCORES:
  │   Technical:   21/50
  │   Fundamental: 30/30
  │   Analyst:     15/20
  │   TOTAL:       66/100
  │
  │ SIGNALS (12):
  │   [+10] RSI Entry Zone
  │   [+10] Near Support
  │   [ +8] High Upside Potential
  │   [ +7] Forward P/E Attractive
  │   ... and 8 more
  └────────────────────────────────────────────────
```

This helps troubleshoot:

- Why a stock scored higher/lower than expected
- Which signals contributed to the score
- Whether RSI/MA data is being calculated correctly

---

## Quick Win: Adjust RSI Scoring

The fastest improvement with highest impact. In `signals/technical.ts`:

```typescript
// Replace the current checkRSI function
function checkRSI(closes: number[]): Signal | null {
  // ... calculate RSI ...

  // NEW: Reward ideal entry zone (per strategy.config.yaml)
  if (currentRSI >= 35 && currentRSI <= 50) {
    return {
      name: 'RSI Entry Zone',
      category: 'technical',
      points: 8,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (ideal entry range)`,
      value: currentRSI,
    };
  }

  // Approaching oversold - good but watch for falling knife
  if (currentRSI >= 30 && currentRSI < 35) {
    return {
      name: 'RSI Approaching Oversold',
      category: 'technical',
      points: 6,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (approaching oversold)`,
      value: currentRSI,
    };
  }

  // Oversold - might be falling knife, lower score
  if (currentRSI < 30) {
    return {
      name: 'RSI Oversold',
      category: 'technical',
      points: 5,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (oversold - verify trend)`,
      value: currentRSI,
    };
  }

  // Extended but not overbought - acceptable
  if (currentRSI > 50 && currentRSI <= 55) {
    return {
      name: 'RSI Neutral',
      category: 'technical',
      points: 2,
      description: `RSI(14) = ${currentRSI.toFixed(1)} (slightly extended)`,
      value: currentRSI,
    };
  }

  return null; // >55 = too extended for entry
}
```

---

## Testing the Improvements

After implementing, re-run:

```bash
cd screen-ticker
bun run scan --list sp500 --min-score 65
```

### v2.5.0 Test Results (2026-01-07)

| Metric              | Before (v2.4) | After (v2.5) | Change  |
| ------------------- | ------------- | ------------ | ------- |
| Opportunities Found | 1             | **24**       | +2,300% |
| ENTER Signals       | 0             | **4**        | 🆕      |
| WAIT Signals        | 1             | **19**       | +1,800% |
| PASS Signals        | 0             | 1            | -       |

**ENTER Opportunities Identified:**

| Ticker   | Price     | Score | Checks | Signals                           |
| -------- | --------- | ----- | ------ | --------------------------------- |
| **BLK**  | $1,088.70 | 68    | 5/6    | Above MAs, RSI Entry Zone         |
| **CDNS** | $324.33   | 68    | 5/6    | Near Support, Strong Fundamentals |
| **NVDA** | $190.07   | 66    | 5/6    | Near Support, High Upside         |
| **OMC**  | $77.73    | 65    | 5/6    | Value Signals, RSI Entry Zone     |

The improvements successfully identify pullback opportunities while still
properly filtering on the MA200 trend requirement (many WAIT signals are
below MA200).

---

## v2.5.0 Implementation Details

### Changes to `signals/technical.ts`

#### 1. RSI Scoring Restructured

**Before:**

```typescript
// Only rewarded oversold conditions
if (currentRSI < 30)
  points = 10; // Oversold
else if (currentRSI < 40)
  points = 6; // Approaching oversold
else if (currentRSI < 50) points = 3; // Neutral
// >50 = no points
```

**After:**

```typescript
// Rewards ideal entry zone per strategy.config.yaml
if (rsi >= 35 && rsi <= 50)
  points = 10; // "RSI Entry Zone" - ideal
else if (rsi >= 30 && rsi < 35)
  points = 7; // Approaching oversold
else if (rsi < 30)
  points = 5; // Oversold (falling knife risk)
else if (rsi > 50 && rsi <= 55)
  points = 4; // Acceptable
else if (rsi > 55 && rsi < 70) points = 1; // Extended
// >70 = no points (overbought)
```

#### 2. New Pullback Detection Signal

Added `checkPullbackInUptrend()` which generates three signals:

| Signal           | Points | Conditions                                         |
| ---------------- | ------ | -------------------------------------------------- |
| Pullback to MA50 | 12     | Price within 3% of MA50, above MA200, MA50 > MA200 |
| Pullback to MA20 | 8      | Price within 2% of MA20, MA20 > MA50 > MA200       |
| Healthy Pullback | 7      | 5-15% down from 20-day high, still above MA200     |

#### 3. Signal Group Cap

Added `pullback` group to `SIGNAL_GROUP_CAPS` with 15-point max to prevent
the three pullback signals from stacking excessively.

### Why These Changes Help

1. **Bull market stocks now score higher** - Stocks with RSI 35-50 get 10
   points instead of 3. This is the ideal entry zone.

2. **Pullbacks are rewarded** - A stock at MA50 support in an uptrend gets
   12 points. This is exactly what we want for CDS entries.

3. **Falling knives penalized** - RSI < 30 now gets only 5 points (was 10).
   Very oversold stocks may be breaking down.

4. **Extended stocks still tracked** - RSI 50-55 gets 4 points, 55-70 gets
   1 point. Not ideal but can still appear in scans.
