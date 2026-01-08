# Penny Stock Scanner Performance Analysis - January 2026

## 📊 Executive Summary

Analysis of 1,000 signals and 673 closed trades over Dec 2025 - Jan 2026 reveals:

| Metric                 | Dec 2025 | Jan 2026 | Change    |
| ---------------------- | -------- | -------- | --------- |
| **Win Rate**           | 41.3%    | 47.5%    | ✅ +6.2%  |
| **Avg Return**         | -1.31%   | +1.01%   | ✅ +2.32% |
| **Stop Loss Hits**     | 15.5%    | 8.2%     | ✅ -7.3%  |
| **Breakout Detection** | 37.8%    | 59.8%    | ✅ +22%   |

**Overall Assessment**: Significant improvements from December fixes, but major issues
remain with the scoring algorithm producing inverted results.

---

## 🚨 Critical Issues Discovered

### 1. **CRITICAL: Score Inversion Problem**

Higher scores perform WORSE than lower scores:

| Score Range   | Trades | Win Rate  | Avg Return    |
| ------------- | ------ | --------- | ------------- |
| 0.90+         | 2      | 100.0%    | +8.89%        |
| **0.80-0.89** | 43     | **44.2%** | **-1.72%**    |
| **0.70-0.79** | 243    | **35.4%** | **-2.04%**    |
| **0.60-0.69** | 458    | **56.1%** | **+3.12%** ✅ |

**Root Cause**: The algorithm rewards signals that have ALREADY moved significantly,
essentially buying "after the party started." Higher scores = chasing.

**Evidence**:

- Winners have avg entry score: **0.677**
- Losers have avg entry score: **0.694**

### 2. **Volume Sweet Spot is Narrower Than Configured**

Current settings reward 2-5x volume equally, but data shows:

| Volume Range | Trades | Win Rate  | Avg Return    |
| ------------ | ------ | --------- | ------------- |
| 1-2x         | 5      | 20.0%     | -0.13%        |
| **2-3x**     | 100    | **69.0%** | **+3.53%** ✅ |
| 3-5x         | 122    | 47.5%     | +2.74%        |
| 5-10x        | 454    | 49.1%     | +1.61%        |

**Conclusion**: 2-3x volume is the true sweet spot, not 2-5x.

### 3. **Hold Time Problem - Short Holds Lose**

| Hold Time    | Trades | Win Rate   | Avg Return     |
| ------------ | ------ | ---------- | -------------- |
| **1 day**    | 538    | **43.7%**  | **-0.14%** ⚠️  |
| 2-3 days     | 154    | 56.5%      | -1.38%         |
| **4-7 days** | 51     | **76.5%**  | **+20.69%** ✅ |
| **8+ days**  | 3      | **100.0%** | **+36.77%** ✅ |

Current avg hold: **1.6 days** - exactly the worst zone!

**Root Cause**: Signals close when the signal "ends" (day 1-2), but the move often
continues for 4-7 days after the initial breakout.

### 4. **BUY Recommendation Still Broken**

| Recommendation | Trades  | Win Rate  | Avg Return    |
| -------------- | ------- | --------- | ------------- |
| STRONG_BUY     | 16      | 62.5%     | +3.10% ✅     |
| WATCH          | 220     | 57.7%     | +2.21% ✅     |
| HOLD           | 337     | 49.3%     | +2.67%        |
| **BUY**        | **130** | **27.7%** | **-4.65%** ❌ |

BUY is the **worst performing** recommendation despite December fixes.

---

## 📈 What's Working Well

### 1. Stop Loss Improvement

- Stop loss hits down from 60% → 8.2% ✅
- Wider stops (25% max) working for penny stock volatility

### 2. Breakout Detection

- 59.8% of signals are breakouts (up from 5.2%) ✅
- Multiple breakout scenarios working

### 3. Tier Distribution

- S-Tier: 5.7%
- A-Tier: 15.0%
- B-Tier: 53.7%
- C-Tier: 21.5%
- D-Tier: 4.1%

### 4. Signal Continuity

- 40% continuing signals, 60% new
- Max 16 days active tracking working

---

## 🔧 Proposed Improvements

### Fix 1: Add "Late Entry" Penalty

**Problem**: High scores are buying AFTER the move.

**Solution**: Penalize signals where price already moved significantly:

```python
# Penalize if already up 15%+ in last 5 days
if price_change_5d > 15:
    score *= 0.8  # 20% penalty - already moved

# Penalize if already up 30%+ in last 10 days
if price_change_10d > 30:
    score *= 0.7  # 30% penalty - late to party

# Bonus for catching move early (flat or slightly up)
if -5 < price_change_5d < 10:
    score *= 1.1  # 10% bonus - early entry
```

### Fix 2: Narrow Volume Sweet Spot

**Problem**: 2-5x treated equally, but 2-3x is optimal.

**Solution**: Update volume scoring:

```python
# Sweet spot is now 2-3x (not 2-5x)
if 2.0 <= volume_ratio <= 3.0:
    surge_score = 1.0  # Optimal zone
elif 3.0 < volume_ratio <= 5.0:
    surge_score = 0.85  # Good but not optimal
elif volume_ratio > 5.0:
    surge_score = 0.70  # Higher risk
```

**Settings changes**:

```python
volume_sweet_spot_min: float = 2.0
volume_sweet_spot_max: float = 3.0  # Changed from 5.0
```

### Fix 3: Implement Minimum Hold Period

**Problem**: Closing signals on day 1-2 when 4-7 days is optimal.

**Solution**: Don't close performance tracking until minimum hold met:

```python
MIN_HOLD_DAYS = 3

# In close_ended_signals:
if days_held < MIN_HOLD_DAYS:
    # Don't close yet - keep tracking
    # Only close if stop loss hit OR signal reverses
    if not stop_hit and not signal_reversed:
        continue
```

**Alternative**: Add trailing stop that activates after 3 days:

```python
# Day 1-3: Use fixed stop (25% max)
# Day 4+: Use trailing stop (lock in gains)
if days_held >= 3 and current_return > 5:
    trailing_stop = max_price_reached * 0.90
```

### Fix 4: Fix BUY Recommendation

**Problem**: BUY has 27.7% WR, -4.65% return.

**Solution Option A - Make BUY Stricter**:

```python
# Current BUY criteria: score ≥0.72 + breakout + outperforming + 2x volume
# NEW: Also require volume in 2-3x sweet spot AND no late entry penalty
elif (
    score >= 0.72
    and signal.is_breakout
    and outperforming_market
    and 2.0 <= signal.volume_spike_factor <= 3.0
    and price_change_5d < 15  # Not late entry
    and not extreme_volume
    and not high_risk
):
    return "BUY"
```

**Solution Option B - Remove BUY entirely**:

```python
# Simplify to just: STRONG_BUY, WATCH, HOLD
# BUY criteria rolls into WATCH
```

### Fix 5: Adjust Tier Thresholds Based on Actual Performance

Since lower scores perform better, consider:

| Tier | Current Threshold | Proposed | Rationale                     |
| ---- | ----------------- | -------- | ----------------------------- |
| S    | 0.82              | 0.78     | Lower to include more winners |
| A    | 0.72              | 0.68     | Sweet spot for performance    |
| B    | 0.62              | 0.58     | Capture 0.60-0.69 winners     |
| C    | 0.55              | 0.52     | More inclusive                |

---

## 📊 Performance Targets After Fixes

| Metric         | Current  | Target  | Notes                  |
| -------------- | -------- | ------- | ---------------------- |
| Win Rate       | 47.5%    | 55%+    | Via late entry penalty |
| Avg Return     | +1.01%   | +5%+    | Via longer holds       |
| BUY WR         | 27.7%    | 55%+    | Via stricter criteria  |
| Avg Hold       | 1.6 days | 4+ days | Via min hold period    |
| 0.70+ Score WR | ~38%     | 50%+    | Via late entry penalty |

---

## 🎯 Implementation Priority

1. **HIGH**: Fix late entry penalty (biggest impact on score inversion)
2. **HIGH**: Implement minimum hold period (4-7 days is 76.5% WR!)
3. **MEDIUM**: Narrow volume sweet spot to 2-3x
4. **MEDIUM**: Fix or remove BUY recommendation
5. **LOW**: Adjust tier thresholds

---

## 📅 Top Performers This Month

| Symbol | Signals | Avg Score | Notes             |
| ------ | ------- | --------- | ----------------- |
| TROO   | 9       | 0.824     | Consistent S-Tier |
| SIDU   | 9       | 0.757     | A-Tier performer  |
| SOPA   | 10      | 0.739     | Strong volume     |
| SLS    | 7       | 0.744     | Multi-day runner  |
| SOL    | 19      | 0.711     | Most frequent     |

---

## 🚨 Top Losers to Investigate

| Symbol | Return | Entry → Exit    | Issue             |
| ------ | ------ | --------------- | ----------------- |
| VMAR   | -69.3% | Dec 16 → Dec 19 | Pump-and-dump     |
| DAIC   | -59.7% | Dec 26 → Dec 29 | 4 trades all lost |

**DAIC Pattern**: Multiple signals, all losses. This stock should be blacklisted or
flagged for additional scrutiny.

---

## 📝 Files to Modify

1. `src/penny_scanner/services/analysis_service.py`
   - Add late entry penalty
   - Update volume sweet spot logic
   - Fix BUY criteria

2. `src/penny_scanner/config/settings.py`
   - `volume_sweet_spot_max`: 5.0 → 3.0
   - Add `late_entry_penalty_threshold`: 15.0
   - Add `min_hold_days`: 3

3. `src/penny_scanner/services/performance_tracking_service.py`
   - Implement minimum hold period
   - Don't close signals before MIN_HOLD_DAYS

4. `db/penny_stock_signals.sql`
   - Consider adding `late_entry_penalty` column for tracking

---

## 🆕 Additional Improvements (Jan 7, 2026 - Part 2)

Based on deeper data analysis, the following improvements were added:

### 1. Consecutive Green Days Adjustment

| Green Days | Win Rate  | Avg Return | Action         |
| ---------- | --------- | ---------- | -------------- |
| **1 day**  | **64.8%** | +3.64%     | ✅ +8% bonus   |
| 0 days     | 42.2%     | +0.98%     | ⚠️ -5% penalty |
| 2-3 days   | 43.0%     | +0.03%     | Neutral        |
| 4+ days    | 41.9%     | -2.54%     | ⚠️ -8% penalty |

**Rationale**: 1 green day = momentum just starting. 4+ days = late entry.

### 2. 52-Week Position Adjustment

| Position            | Win Rate  | Avg Return | Action         |
| ------------------- | --------- | ---------- | -------------- |
| **25-50% from low** | **55.1%** | **+5.90%** | ✅ +6% bonus   |
| <25% from low       | 45.3%     | -3.78%     | ⚠️ -8% penalty |
| 50-100% from low    | 45.1%     | +2.25%     | Neutral        |
| 100%+ from low      | 48.0%     | -0.11%     | Neutral        |

**Rationale**: 25-50% = stock recovering but not overextended. <25% = falling knife.

### 3. Day of Week Adjustment

| Day           | Win Rate  | Action                  |
| ------------- | --------- | ----------------------- |
| **Friday**    | **57.4%** | ✅ +5% bonus            |
| Thursday      | 52.7%     | Neutral                 |
| Monday        | 51.8%     | Neutral                 |
| Tuesday       | 41.1%     | Neutral (high variance) |
| **Wednesday** | **44.7%** | ⚠️ -5% penalty          |

**Rationale**: Friday entries have weekend catalyst potential.

### 4. China Risk Reassessment

**Previous**: China was flagged as "moderate risk"

**New Data**:
| Country | Win Rate | Avg Return |
|---------|----------|------------|
| **China** | **61.2%** | **+15.98%** |
| United States | 50.7% | +0.75% |

**Action**: Removed China from moderate risk list. Surprisingly best performer!

### 5. Best Combination Patterns Found

| Combination                | Win Rate  | Avg Return |
| -------------------------- | --------- | ---------- |
| Breakout + $1-2 + 2-3x Vol | **70.2%** | +4.44%     |
| 1 Green Day + Breakout     | **67.7%** | +4.21%     |
| 25-50% from Low + Breakout | 57.0%     | **+6.21%** |

---

## 📝 Files Modified (Part 2)

1. `src/penny_scanner/config/settings.py`
   - Added green day bonus/penalty settings
   - Added 52-week position settings
   - Added day of week settings
   - Removed China from moderate risk

2. `src/penny_scanner/services/analysis_service.py`
   - Added `_apply_green_day_adjustment()` method
   - Added `_apply_52w_position_adjustment()` method
   - Added `_apply_day_of_week_adjustment()` method

---

_Analysis Date: January 7, 2026_
_Data Period: December 2, 2025 - January 7, 2026_
_Signals Analyzed: 1,000_
_Closed Trades: 673_
