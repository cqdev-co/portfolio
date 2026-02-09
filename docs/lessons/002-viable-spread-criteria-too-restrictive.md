# Lesson 002: Viable Spread Criteria Too Restrictive — Zero Trades

**Date:** February 2026  
**Ticker:** ALL (systemic issue)  
**Strategy:** Deep ITM Bull Call Spread scanner  
**Outcome:** Zero actionable trades surfaced since launch

## What Happened

The CDS Engine Strategy's spread scanner (`scan-spreads`) never recommended a single actionable trade. Every ticker that passed the stock screening stage (score ≥70) was rejected at the "viable spread" filtering step.

After a deep code audit, the root cause was a **structural contradiction** between two entry criteria:

1. **Minimum cushion of 7%** — required the breakeven to be well below the current price
2. **Maximum debit ratio of 80%** — capped how much you could pay relative to spread width

These two requirements are inherently at tension for deep ITM call spreads.

## The Math

For a stock trading at $100 with a $5-wide spread:

### Scenario A: Closer to ATM (good debit ratio, bad cushion)

| Metric       | Value                 |
| ------------ | --------------------- |
| Long strike  | $95 (5% ITM)          |
| Short strike | $100                  |
| Market debit | ~$3.50 (70% of width) |
| Breakeven    | $95 + $3.50 = $98.50  |
| **Cushion**  | **1.5%** — FAILS ≥7%  |

### Scenario B: Deep ITM (good cushion, bad debit ratio)

| Metric          | Value                  |
| --------------- | ---------------------- |
| Long strike     | $88 (12% ITM)          |
| Short strike    | $93                    |
| Long ask        | $12.50                 |
| Short bid       | $7.20                  |
| Market debit    | $12.50 - $7.20 = $5.30 |
| **Debit ratio** | **106%** — FAILS ≤80%  |

The bid-ask spread on each leg (typically $0.30-$0.80 for liquid names) inflates the market debit calculation. For deep ITM options where both legs have substantial intrinsic value, the natural ask/bid debit often exceeds the spread width itself.

### The sweet spot that doesn't exist

For both criteria to pass simultaneously, you'd need:

- Long strike ~8-10% ITM (for cushion)
- Market debit ≤80% of width (for profit potential)

But at 8-10% ITM, the bid-ask spread on liquid options pushes market debit to 85-100%+ of width. There's no viable zone.

## The Bug

Beyond the threshold tension, there was a code-level bug in `scan-spreads.ts`:

```typescript
// BEFORE: Hard reject when market debit exceeds max ratio
if (marketRatio > CRITERIA.maxDebitRatio) {
  rejectionStats.debitTooHigh++;
  continue; // Never tries mid-market!
}
```

The scanner calculated debit using the worst-case market price (long ask - short bid) but never tried mid-market pricing when that exceeded the limit. In practice, deep ITM spreads are routinely fillable at mid-market with limit orders — brokers often fill between bid and ask.

## Three Fixes Applied (v2.9.0)

### 1. Mid-market debit fallback (code fix)

When market debit exceeds the max ratio, the scanner now falls back to mid-market pricing before rejecting:

```typescript
// AFTER: Try mid-market when market debit is too high
if (marketRatio > CRITERIA.maxDebitRatio && midDebit > 0) {
  const midRatio = midDebit / width;
  if (midRatio >= minDebitRatio && midRatio <= maxDebitRatio) {
    debit = midDebit; // Use mid-market — fillable with limit order
  }
}
```

### 2. Raised max debit ratio: 80% → 85%

Deep ITM spreads naturally have higher debit ratios. 85% still provides 15% return on risk at the ceiling, which meets the minimum R/R requirement. The old 80% cap was calibrated for ATM/near-the-money spreads, not deep ITM.

### 3. Lowered minimum cushion: 7% → 5%

5% cushion on a $100 stock means a $5 buffer before breakeven. This is still meaningful downside protection for a 21-45 DTE trade. The preferred cushion (8%) and excellent cushion (12%) tiers still incentivize deeper setups when available.

## Expected Impact

| Metric                 | Before | After                                             |
| ---------------------- | ------ | ------------------------------------------------- |
| Viable trades per scan | 0      | 2-5 (estimated)                                   |
| Max debit ratio        | 80%    | 85%                                               |
| Min cushion            | 7%     | 5%                                                |
| Mid-market fallback    | No     | Yes                                               |
| Risk increase          | —      | Marginal (5% less cushion, 5% more debit allowed) |

## Why These Changes Are Safe

- **5% cushion** still means the stock must drop 5% below current price before you lose money. For quality stocks (score ≥70), that's a significant move in 21-45 days.
- **85% debit ratio** still provides 15%+ return on risk (`($5 - $4.25) / $4.25 = 17.6%`).
- **Mid-market pricing** is how real traders actually fill spreads. Limit orders at mid are standard practice.
- All other safety checks remain: PoP ≥60%, open interest ≥50, DTE 21-45, stock score ≥70.

## Config Changes

```yaml
# strategy.config.yaml
entry:
  cushion:
    minimum_pct: 5.0 # Was 7.0
    preferred_pct: 8.0 # Was 10.0
    excellent_pct: 12.0 # Was 15.0
  spread:
    max_debit_ratio_pct: 85 # Was 80
```

---

_This lesson cost $0 in direct losses but untold opportunity cost from a scanner that never surfaced a trade. The fix is conservative — if it still produces too few results, the next step would be to extend DTE range to 60 days for more cushion._
