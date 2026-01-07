# Strategy Integration: Scanner + No-Trade Regime

## Overview

This document outlines integrating the **Deep ITM Call Debit Spread** scanner
with the **Cash-Preserving No-Trade Regime** detection system.

## Goal

Create a unified workflow:

1. **Check market regime** → Determine if conditions are favorable
2. **Scan tickers** → Only in GO/CAUTION regimes
3. **Adjust criteria** → Stricter in CAUTION, skip in NO_TRADE
4. **Size positions** → Based on regime + confidence

---

## Trading Regimes

| Regime      | Action                    | Spread Criteria      | Position Size |
| ----------- | ------------------------- | -------------------- | ------------- |
| 🟢 GO       | Normal scan               | 70% PoP, 5% cushion  | 100%          |
| 🟡 CAUTION  | Grade A only (score ≥ 80) | 75% PoP, 7% cushion  | 50%           |
| 🔴 NO_TRADE | Skip scan / show warning  | 80% PoP, 10% cushion | 0%            |

---

## Implementation Plan

### Phase 1: Regime Check Command

New command: `bun run regime`

```bash
# Check current trading regime before scanning
bun run regime

# Output:
# 🟢 GO (75% confidence)
#
# METRICS:
#   Chop Index: 32.5
#   Conflict Score: 25%
#   ADX: 28.3 (STRONG)
#   Breadth: 68% (HEALTHY)
#
# → Risk-On environment. Normal position sizing.
```

### Phase 2: Regime-Gated Scanning

Add `--respect-regime` flag to scan commands:

```bash
# Normal scan (ignores regime)
bun run scan --list sp500

# Regime-aware scan (skips if NO_TRADE)
bun run scan --list sp500 --respect-regime

# Output in NO_TRADE regime:
# 🔴 NO_TRADE (88% confidence)
#
# Scan skipped — market conditions unfavorable.
# Reason: Chop Index 68.5 (consolidating)
#
# Run `bun run scan --force` to override.
```

### Phase 3: Regime-Adjusted Decisions

Modify decision engine to incorporate trading regime:

```typescript
// Current: Simple bull/neutral/bear
marketRegime: "bull" | "neutral" | "bear"

// New: Full trading regime from lib/ai-agent
tradingRegime: {
  regime: "GO" | "CAUTION" | "NO_TRADE",
  confidence: number,
  metrics: { chopIndex, conflictScore, adxValue, breadthScore },
  recommendation: string,
}
```

**Decision Logic Changes:**

```typescript
// NO_TRADE regime → All entries become WAIT
if (tradingRegime.regime === 'NO_TRADE') {
  return {
    action: 'wait_for_pullback',
    timeframe: 'this_week',
    reasoning: [`🔴 NO_TRADE: ${tradingRegime.recommendation}`],
  };
}

// CAUTION regime → Only enter on Grade A setups
if (tradingRegime.regime === 'CAUTION') {
  if (stockScore < 80 || confidence.level !== 'very_high') {
    return {
      action: 'wait_for_pullback',
      timeframe: 'this_week',
      reasoning: ['🟡 CAUTION: Only Grade A setups (score ≥ 80)'],
    };
  }
}

// GO regime → Normal decision logic
// ... existing code
```

### Phase 4: Regime-Adjusted Spread Criteria

Create regime-specific spread criteria:

```typescript
const SPREAD_CRITERIA_BY_REGIME = {
  GO: {
    minPoP: 70,
    minCushion: 5,
    maxDebitPct: 80,
    minReturn: 20,
  },
  CAUTION: {
    minPoP: 75,
    minCushion: 7,
    maxDebitPct: 75,
    minReturn: 25,
  },
  NO_TRADE: {
    minPoP: 80,
    minCushion: 10,
    maxDebitPct: 70,
    minReturn: 30,
  },
};
```

### Phase 5: Enhanced Output

Show regime badge at top of all scan output:

```
Stock Opportunity Scanner
────────────────────────────────────────────────────────────
🟡 CAUTION (72%) — Reduce size 50%, Grade A only
   Chop: 52.3 | Conflict: 35% | ADX: 22.1 | Breadth: 58%
────────────────────────────────────────────────────────────

  Top Buy Opportunities - 1/6/2026
┌──────┬────────┬──────────┬────────┬────────────┬─────────────────┐
│ Rank │ Ticker │ Price    │ Score  │ Decision   │ Reason          │
├──────┼────────┼──────────┼────────┼────────────┼─────────────────┤
│ 1    │ NVDA   │ $187.63  │ 85     │ ✅ ENTER   │ Grade A setup   │
│ 2    │ AMD    │ $212.71  │ 72     │ ⏳ WAIT    │ CAUTION regime  │
...
```

---

## File Changes

| File                           | Change                                 |
| ------------------------------ | -------------------------------------- |
| `src/commands/regime.ts`       | New command to check trading regime    |
| `src/commands/scan.ts`         | Add `--respect-regime` flag            |
| `src/engine/decision.ts`       | Import and use `TradingRegimeAnalysis` |
| `src/utils/market-regime.ts`   | Replace with lib/ai-agent integration  |
| `src/commands/scan-spreads.ts` | Use regime-adjusted criteria           |

---

## Usage Workflow

### Daily Workflow (Recommended)

```bash
# 1. Check regime before market open
bun run regime

# 2. If GO or CAUTION, run scan
bun run scan --list sp500 --respect-regime

# 3. For ENTER tickers, find spreads
bun run scan-spreads --from-scan

# 4. Analyze top candidates
bun run analyze NVDA
```

### Weekly Planning

```bash
# Monday morning regime check
bun run regime --weekly

# Output includes:
# - Current regime
# - Transition warnings (improving/deteriorating)
# - Recommended watchlist size
# - Key levels to monitor
```

---

## Benefits

1. **Avoids Forced Trades**: NO_TRADE regime prevents entries in bad conditions
2. **Right-Sized Positions**: Automatic 50% reduction in CAUTION
3. **Stricter Quality**: Higher bars for spreads in uncertain markets
4. **Unified Strategy**: Same regime logic across all tools
5. **Cash Preservation**: Explicit "do nothing" recommendation when appropriate

---

## Integration with Deep ITM Strategy

Deep ITM Call Debit Spreads **require**:

- Strong uptrend (price above MA200)
- High probability the price stays above short strike
- No major volatility events (earnings, Fed)

The No-Trade Regime detects exactly when these conditions are NOT met:

- Choppy market → False breakouts → Spreads get tested
- High VIX → Large swings → Cushion insufficient
- Weak breadth → Rally exhausting → Trend reversal risk
- Signal conflicts → No clear direction → Whipsaw risk

**Result**: The regime system acts as a **pre-filter** that protects the spread strategy from unfavorable conditions.
