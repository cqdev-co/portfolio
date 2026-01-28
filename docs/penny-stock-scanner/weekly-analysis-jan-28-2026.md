# Penny Stock Scanner Weekly Analysis - January 28, 2026

## 📊 Executive Summary

Analysis of performance for the past 2 weeks (Jan 14-28, 2026) shows **significant deterioration** in scanner performance, particularly in the most recent week.

| Metric             | Last Week (Jan 21-28) | Previous Week (Jan 14-20) | Change    |
| ------------------ | --------------------- | ------------------------- | --------- |
| **Win Rate**       | 39.8%                 | 47.5%                     | ❌ -7.7%  |
| **Avg Return**     | -6.11%                | -3.48%                    | ❌ -2.63% |
| **Stop Loss Rate** | 29.5%                 | 8.2%                      | ❌ +21.3% |
| **Avg Winner**     | +2.71%                | +3.14%                    | ⚠️ -0.43% |
| **Avg Loser**      | -11.93%               | -7.92%                    | ❌ -4.01% |

**Overall Assessment**: The scanner is performing poorly with a negative expected value. The January 27th MRNO crash was catastrophic, contributing heavily to the week's losses.

---

## 🚨 Critical Issues

### 1. January 27 Catastrophe - MRNO Single-Stock Wipeout

On January 27, 2026, **ALL 12 closed trades hit their stop losses (-25%)**:

| Symbol | Tier   | Entry Price | Exit Price | Return |
| ------ | ------ | ----------- | ---------- | ------ |
| MRNO   | S-Tier | $1.54       | $1.15      | -25.0% |
| MRNO   | S-Tier | $1.54       | $1.15      | -25.0% |
| MRNO   | S-Tier | $1.43       | $1.07      | -25.0% |
| MRNO   | S-Tier | $1.40       | $1.05      | -25.0% |
| MRNO   | A-Tier | $1.34       | $1.01      | -25.0% |
| MRNO   | A-Tier | $1.28       | $0.96      | -25.0% |
| MRNO   | B-Tier | $1.15       | $0.86      | -25.0% |
| MRNO   | B-Tier | $1.14       | $0.85      | -25.0% |
| MRNO   | B-Tier | $1.12       | $0.84      | -25.0% |
| MRNO   | B-Tier | $1.12       | $0.84      | -25.0% |
| CXAI   | B-Tier | $0.36       | $0.27      | -25.0% |
| CXAI   | B-Tier | $0.36       | $0.27      | -25.0% |

**Root Cause**: MRNO generated multiple signals across different tiers (S, A, B) on different entry dates, and ALL positions got wiped out on the same day. This indicates:

1. **Overconcentration risk** - too many signals on the same stock
2. **Pump-and-dump pattern** - stock ran up quickly then crashed
3. **No position limit per symbol** - need max exposure limits

### 2. Score Inversion Still Present

| Rank   | Last Week Trades | Win Rate  | Avg Return |
| ------ | ---------------- | --------- | ---------- |
| S-Tier | 24               | 66.7%     | -1.81%     |
| A-Tier | 62               | **21.0%** | -8.05%     |
| B-Tier | 48               | **25.0%** | -8.92%     |
| C-Tier | 41               | **70.7%** | -1.93%     |
| D-Tier | 1                | 0.0%      | -25.00%    |

**Observation**: C-Tier signals outperform A/B-Tier by a massive margin (70.7% WR vs 21-25% WR). The fixes from January 13 may have overcorrected, or market conditions have changed.

### 3. Stop Loss Rate Tripled

- **Last Week**: 29.5% of trades hit stop loss
- **Previous Week**: ~8-9%
- **Target**: <10%

This spike is mostly attributable to the MRNO crash, but still concerning.

---

## 📈 Last 2 Weeks Performance Summary

### Overall Statistics

| Metric              | Value  |
| ------------------- | ------ |
| Total Closed Trades | 319    |
| Win Rate            | 40.1%  |
| Average Return      | -3.48% |
| Average Winner      | +3.14% |
| Average Loser       | -7.92% |
| Winners             | 128    |
| Losers              | 191    |

### Daily Performance Breakdown

| Date       | Trades | Win Rate | Avg Return | Stop Loss Rate |
| ---------- | ------ | -------- | ---------- | -------------- |
| 2026-01-27 | 12     | 0.0%     | -25.00%    | 100.0%         |
| 2026-01-23 | 121    | 43.8%    | -4.18%     | 21.5%          |
| 2026-01-22 | 34     | 50.0%    | -5.89%     | 38.2%          |
| 2026-01-21 | 9      | 0.0%     | -7.64%     | 11.1%          |
| 2026-01-20 | 7      | 100.0%   | +7.58%     | 0.0%           |
| 2026-01-19 | 25     | 20.0%    | +0.37%     | 0.0%           |
| 2026-01-16 | 95     | 41.1%    | -1.05%     | 3.2%           |
| 2026-01-15 | 13     | 30.8%    | -4.98%     | 38.5%          |
| 2026-01-14 | 3      | 100.0%   | +22.22%    | 0.0%           |

**Best Day**: January 14 (+22.22% avg, but only 3 trades)
**Worst Day**: January 27 (-25.00% avg, 100% stop loss rate)

### Volume Analysis

| Volume Range             | Trades | Win Rate | Avg Return |
| ------------------------ | ------ | -------- | ---------- |
| 2-3x Volume (Sweet Spot) | 191    | 46.6%    | -1.00%     |
| 1-2x Volume              | 35     | 48.6%    | +0.03%     |

The "sweet spot" (2-3x volume) is not performing as well as expected compared to lower volume signals.

---

## 🏆 Top Winners & Losers (Last 2 Weeks)

### Top Winners

| Symbol | Return | Tier   | Entry Date |
| ------ | ------ | ------ | ---------- |
| YYAI   | +22.2% | C-Tier | 2026-01-14 |
| AMPG   | +14.6% | C-Tier | 2026-01-20 |
| AMPG   | +13.7% | C-Tier | 2026-01-20 |
| NEXM   | +6.1%  | S-Tier | 2026-01-23 |
| SUNE   | +6.5%  | C-Tier | 2026-01-23 |

**Pattern**: C-Tier signals dominate the winners list!

### Top Losers

| Symbol | Return | Tier   | Entry Date | Exit Reason |
| ------ | ------ | ------ | ---------- | ----------- |
| MRNO   | -25.0% | S-Tier | 2026-01-27 | STOP_LOSS   |
| MRNO   | -25.0% | A-Tier | 2026-01-27 | STOP_LOSS   |
| MRNO   | -25.0% | B-Tier | 2026-01-27 | STOP_LOSS   |
| CXAI   | -25.0% | B-Tier | 2026-01-27 | STOP_LOSS   |

---

## 📅 Signal Generation (Last 2 Weeks)

| Date       | Signals | S-Tier | A-Tier | Avg Score |
| ---------- | ------- | ------ | ------ | --------- |
| 2026-01-28 | 48      | -      | -      | 0.677     |
| 2026-01-27 | 54      | 4      | 8      | 0.689     |
| 2026-01-26 | 65      | 7      | 10     | 0.687     |
| 2026-01-23 | 79      | 6      | 14     | 0.691     |
| 2026-01-22 | 73      | 6      | 12     | 0.666     |
| 2026-01-21 | 55      | 3      | 9      | 0.670     |
| 2026-01-20 | 66      | 4      | 11     | 0.674     |
| 2026-01-19 | 30      | 2      | 5      | 0.691     |
| 2026-01-16 | 55      | 3      | 9      | 0.669     |
| 2026-01-15 | 41      | 2      | 7      | 0.683     |
| 2026-01-14 | 63      | 4      | 10     | 0.659     |

---

## 🎯 Profit Target Analysis

| Target | Hit Rate |
| ------ | -------- |
| 10%    | 0.0%     |
| 20%    | 0.0%     |
| 30%    | 0.0%     |

**Critical Issue**: NO profit targets were hit in the last 2 weeks. This suggests:

1. Exit timing is wrong (closing too early)
2. Entry quality is poor (buying extended stocks)
3. Market conditions are unfavorable for penny stocks

---

## ✅ What's Working

1. **C-Tier signals**: 70.8% win rate in last 2 weeks vs 23.8% for A-Tier
2. **S-Tier win rate improved**: 50-67% (but still negative returns)
3. **Stop loss system**: Limiting losses to -25% max
4. **Signal continuity tracking**: 43% CONTINUING, 57% NEW

---

## 🔧 Recommended Fixes

### HIGH PRIORITY

1. **Add Maximum Position Per Symbol**
   - Limit to 2-3 active positions per symbol
   - MRNO had 10 positions across different entry dates
   - Would have limited Jan 27 loss from -25% × 10 to -25% × 3

   ```python
   # settings.py
   max_positions_per_symbol: int = 3
   ```

2. **Review Tier Threshold Adjustments**
   - The Jan 13 fixes may have overcorrected
   - C-Tier is now outperforming S/A-Tier
   - Consider reverting extreme volume penalty

3. **Add Sector/Stock Correlation Check**
   - Don't signal multiple related stocks on same day
   - Track sector exposure

### MEDIUM PRIORITY

4. **Improve Exit Timing**
   - 0% profit target hit rate is concerning
   - Consider trailing stops after +5%
   - Hold winners longer

5. **Market Regime Detection**
   - Penny stocks may perform poorly in current market
   - Add risk-off mode when market is volatile

### LOW PRIORITY

6. **Investigate C-Tier Success**
   - Why are C-Tier signals (0.55-0.62 score) outperforming?
   - May indicate scoring algorithm issues

---

## 📊 Current Active Positions

| Tier   | Active Trades |
| ------ | ------------- |
| S-Tier | 41            |
| A-Tier | 153           |
| B-Tier | 532           |
| C-Tier | 241           |
| D-Tier | 33            |
| Total  | 1,000         |

**Warning**: 1,000 active positions is very high. Risk of similar wipeout events.

---

## 📈 Key Metrics to Watch

1. **Stop Loss Rate** - Target: <10% (Currently: 29.5% ❌)
2. **A-Tier Win Rate** - Target: >50% (Currently: 21.0% ❌)
3. **Profit Target Hit Rate** - Target: >20% (Currently: 0.0% ❌)
4. **Positions Per Symbol** - Target: ≤3 (Currently: Unlimited ❌)

---

## 📝 Files to Modify

1. `src/penny_scanner/config/settings.py`
   - Add `max_positions_per_symbol: int = 3`
   - Consider reverting `extreme_volume_penalty`

2. `src/penny_scanner/services/performance_tracking_service.py`
   - Add position limit check before creating new position
   - Skip signal if symbol already has max positions

3. `src/penny_scanner/services/analysis_service.py`
   - Review recent scoring changes
   - May need to tune penalties

---

## ✅ Fixes Implemented (Jan 28, 2026)

Based on this analysis, the following changes were implemented:

### 1. Maximum Positions Per Symbol Limit (NEW)

Prevents single-stock concentration risk like the MRNO wipeout.

```python
# settings.py
max_positions_per_symbol: int = 3  # Max active positions per symbol

# performance_tracking_service.py
# New method: _count_active_positions()
# Checks position count before tracking new signals
# Skips if symbol already has max positions
```

**Impact**: If MRNO limit was 3 instead of unlimited, Jan 27 loss would have been:

- Before: 10 × -25% = catastrophic
- After: 3 × -25% = manageable

### 2. Extreme Volume Penalty Softened

Reduced penalty from 12% to 8% to address potential overcorrection.

```python
# settings.py - Before
extreme_volume_penalty: float = 0.88  # 12% penalty

# settings.py - After
extreme_volume_penalty: float = 0.92  # 8% penalty (softened)
```

**Rationale**: C-Tier (70.8% WR) was outperforming A-Tier (21% WR), suggesting
the January 13 fixes may have been too aggressive.

### 3. Trailing Stop Implementation (NEW)

Helps lock in gains while letting winners run longer.

```python
# settings.py - New settings
trailing_stop_enabled: bool = True
trailing_stop_activation_pct: float = 5.0   # Activate after +5% gain
trailing_stop_distance_pct: float = 10.0    # Trail 10% below high

# stop_loss_checker.py - Updated logic
# - Tracks high watermark during trade
# - Activates trailing stop after gain threshold
# - Exits at trailing stop if price drops from high
# - New exit_reason: "TRAILING_STOP"
```

**Example**:

- Entry: $1.00, Fixed Stop: $0.75 (-25%)
- Price rises to $1.10 → Trailing stop activates at $0.99
- Price rises to $1.30 → Trailing stop moves to $1.17
- Price drops to $1.15 → Trailing stop hit, exit at $1.17 (+17% gain locked)

### Files Modified

1. `src/penny_scanner/config/settings.py`
   - Added `max_positions_per_symbol: int = 3`
   - Softened `extreme_volume_penalty: 0.88 → 0.92`
   - Added `trailing_stop_enabled`, `trailing_stop_activation_pct`, `trailing_stop_distance_pct`

2. `src/penny_scanner/services/performance_tracking_service.py`
   - Added `_count_active_positions()` method
   - Added position limit check in `track_new_signals()`
   - Updated `close_ended_signals()` to handle TRAILING_STOP exit reason
   - Added max_price_reached tracking

3. `src/penny_scanner/services/stop_loss_checker.py`
   - Completely rewritten to support trailing stops
   - Tracks high watermark during trade period
   - Returns new fields: `max_price_reached`, `trailing_stop_activated`
   - New exit_reason: "TRAILING_STOP"

---

_Analysis Date: January 28, 2026_
_Data Period: January 14-28, 2026_
_Closed Trades Analyzed: 319_
_Active Trades: 1,000_
