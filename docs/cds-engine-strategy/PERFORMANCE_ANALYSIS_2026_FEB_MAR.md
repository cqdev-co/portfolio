# CDS Engine Performance Analysis

**Period:** February 13 – March 5, 2026 (3 weeks)
**Generated:** March 5, 2026
**Current Market Regime:** NO_TRADE (95% confidence)

---

## Executive Summary

Over the last 3 weeks, the CDS Engine generated **206 signals** across **15 trading days**, all graded **A** (score 80+). The engine shows consistent daily output averaging ~14 signals/day with steadily improving average scores (89.0 → 92.6 across the 3 weeks). However, signal accuracy sits at **49.1% all-time** (27 hits / 28 misses on resolved signals), and the current market environment is firmly in **NO_TRADE** territory with elevated VIX (23.8), weak breadth (30%), and no clear trend.

**Key takeaway:** The engine is generating high-quality signals by score, but the target price calculations appear miscalibrated — upside potential averages only 0.3% while targets require 6-19% moves. Spread viability remains low at 2.9%. The market is currently hostile for new entries.

---

## Signal Generation Summary

| Metric              | Value        |
| ------------------- | ------------ |
| Total Signals       | 206          |
| Trading Days Active | 15           |
| Avg Signals/Day     | 13.7         |
| Grade Distribution  | 100% Grade A |
| Regime Distribution | 100% Unknown |
| Avg Signal Score    | 91.2         |
| Score Range         | 84 – 99      |

### Weekly Breakdown

| Week | Period       | Signals | Avg Score | Max | Min |
| ---- | ------------ | ------- | --------- | --- | --- |
| 1    | Feb 13–19    | 68      | 89.0      | 96  | 84  |
| 2    | Feb 20–26    | 67      | 91.9      | 99  | 87  |
| 3    | Feb 27–Mar 5 | 71      | 92.6      | 98  | 88  |

**Trend:** Scores improved week-over-week (+2.9 from Week 1 to Week 2, +0.7 from Week 2 to Week 3), and the minimum score floor rose from 84 to 88.

### Score Distribution

| Range  | Count | %     |
| ------ | ----- | ----- |
| 95–100 | 38    | 18.4% |
| 90–94  | 95    | 46.1% |
| 85–89  | 72    | 35.0% |
| 80–84  | 1     | 0.5%  |

---

## Signal Accuracy

### All-Time (Grade A, Regime Unknown)

| Metric             | Value     |
| ------------------ | --------- |
| Total Signals      | 380       |
| Resolved           | 55        |
| Target Hits        | 27        |
| Target Misses      | 28        |
| Still Pending      | 325       |
| Hit Rate           | **49.1%** |
| Avg Days to Target | 11.8 days |

### Last 3 Weeks Outcomes

Of the 206 signals generated in this period:

| Status        | Count | %     |
| ------------- | ----- | ----- |
| Pending       | 202   | 98.1% |
| Target Hit    | 4     | 1.9%  |
| Target Missed | 0     | 0.0%  |

Most signals are still within their evaluation window and haven't resolved yet.

### Target Hits (Last 3 Weeks)

| Ticker | Date   | Score | Entry   | Target  | Upside | Spread |
| ------ | ------ | ----- | ------- | ------- | ------ | ------ |
| CSCO   | Feb 13 | 91    | $77.12  | $87.86  | +13.9% | No     |
| INCY   | Feb 17 | 85    | $100.91 | $107.05 | +6.1%  | No     |
| FSLR   | Feb 18 | 90    | $235.55 | $280.20 | +19.0% | No     |
| INCY   | Feb 19 | 87    | $100.67 | $107.09 | +6.4%  | No     |

---

## Top Signals by Score

| Ticker | Date   | Score | Price   | Target  | Key Signals                                           |
| ------ | ------ | ----- | ------- | ------- | ----------------------------------------------------- |
| GOOGL  | Feb 24 | 99    | $311.08 | $376.86 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |
| GOOGL  | Feb 23 | 99    | $310.76 | $376.86 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |
| NVDA   | Feb 26 | 99    | $185.79 | $256.25 | RSI Entry Zone, Pullback to MA50, Pullback to MA20    |
| GOOGL  | Feb 25 | 99    | $311.13 | $376.86 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |
| CPAY   | Mar 5  | 98    | $323.35 | $384.71 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |
| GOOGL  | Mar 5  | 98    | $299.61 | $376.86 | RSI Entry Zone, Healthy Pullback, Golden Cross Active |
| NVDA   | Feb 27 | 98    | $179.17 | $262.51 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |
| NVDA   | Mar 2  | 98    | $183.02 | $263.82 | RSI Entry Zone, Pullback to MA50, Healthy Pullback    |

---

## Most Frequent Tickers

| Ticker | Signals | Notes                             |
| ------ | ------- | --------------------------------- |
| GOOGL  | 14      | Appeared nearly every scan day    |
| AVGO   | 12      | Consistent high-score presence    |
| ANET   | 12      | Consistent high-score presence    |
| SCHW   | 11      | Financial sector representative   |
| GOOG   | 11      | Alphabet Class C shares           |
| DAL    | 10      | Airlines — multiple target misses |
| NVDA   | 9       | Highest individual scores (98–99) |
| IDXX   | 7       | Healthcare diagnostics            |
| LLY    | 7       | Pharma heavyweight                |
| CRH    | 7       | Materials sector                  |

---

## Spread Viability Analysis

Only **6 of 206 signals (2.9%)** had viable deep ITM call debit spreads.

| Ticker | Date   | Score | Strikes | Debit | Return | Cushion | PoP |
| ------ | ------ | ----- | ------- | ----- | ------ | ------- | --- |
| NVDA   | Feb 17 | 96    | 160/165 | $3.85 | 29.9%  | 9.2%    | 72% |
| GOOGL  | Feb 19 | 92    | 285/290 | $4.00 | 25.0%  | 5.2%    | 70% |
| NFLX   | Feb 20 | 89    | 70/75   | $4.00 | 25.0%  | 5.8%    | 70% |
| NVDA   | Feb 27 | 98    | 160/170 | $7.75 | 29.0%  | 7.5%    | 73% |
| NVDA   | Mar 2  | 98    | 165/170 | $4.00 | 25.0%  | 7.7%    | 70% |
| NVDA   | Mar 4  | 94    | 165/170 | $3.95 | 26.6%  | 7.4%    | 70% |

- **Average Spread Return:** 26.7%
- **Best:** NVDA Feb 17 (29.9% return, 9.2% cushion)
- **NVDA dominates** with 4 of 6 viable spreads

---

## Current Market Regime

| Metric              | Value       | Status             |
| ------------------- | ----------- | ------------------ |
| Regime              | NO_TRADE    | 95% confidence     |
| VIX                 | 23.8        | ELEVATED           |
| ADX                 | 17.3        | WEAK               |
| Market Breadth      | 30%         | WEAK               |
| Chop Index          | 61.9        | Consolidating      |
| Trend Strength      | WEAK        | No clear direction |
| SPY                 | NEUTRAL     | Range-bound        |
| Direction Reversals | 4 in 5 days | Choppy             |

**Assessment:** This is a hostile environment for directional options strategies. The engine correctly recommends 0% position sizing and no new entries.

---

## Issues Identified

### 1. Upside Potential Miscalculation

- Average upside potential reported as **0.3%** across all 206 signals
- Yet target prices imply moves of 6–39% needed
- This field appears to be calculating incorrectly or using a different denominator

### 2. All Signals Grade A

- Every single signal is Grade A (score 80+)
- No grade differentiation means the grading system isn't discriminating enough
- Consider raising thresholds or adding more granular scoring tiers

### 3. Regime Always "Unknown"

- 100% of signals have regime = "unknown" in the database
- The regime command works correctly (returning NO_TRADE), but it's not being stored with signals
- Signals should be tagged with the market regime at time of generation for better performance tracking

### 4. Low Spread Viability

- Only 2.9% of signals have viable spreads
- The engine's primary purpose is finding CDS opportunities, but it's functioning more as a stock screener
- Spread criteria may need relaxation or the scanner needs to target more liquid options chains

### 5. No Completed Trades

- Zero trades recorded via the `trade` command
- Performance tracking relies entirely on signal outcome automation
- Manual trade entry should be encouraged for actual P&L tracking

---

## Recommendations

1. ~~**Fix regime tagging**~~ — **FIXED in v3.0.0**: regime is now always fetched, even in CI/CD summary mode
2. ~~**Upside potential bug**~~ — **VERIFIED**: stored correctly as decimal ratio (e.g., 0.26 = 26%). Initial analysis had a display bug.
3. ~~**Raise Grade A threshold**~~ — **FIXED in v3.0.0**: A=92+, B=85+, C=78+, D<78 (was A=80+)
4. **Expand spread scanning** — the 2.9% viable rate is too low; consider widening strike ranges or including more expiration cycles
5. **Record actual trades** — use `bun run trade` to track real entries/exits for true P&L measurement
6. **Pause new signals** — the NO_TRADE regime with 95% confidence means capital preservation should be the priority
7. ~~**Run signal-outcomes more frequently**~~ — **FIXED in v3.0.0**: now runs daily after last scan (3:30 PM ET), min age lowered to 3 days

## Changes Implemented (v3.0.0)

See [IMPROVEMENTS.md](IMPROVEMENTS.md) for full changelog.
