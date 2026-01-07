# Penny Stock Scanner Performance Improvements - December 2025

## 📊 Performance Analysis Summary

Analysis of 248 signals over Nov 9 - Dec 12, 2025 revealed significant issues:

| Metric             | Before Fix | Target   |
| ------------------ | ---------- | -------- |
| Win Rate           | 20%        | 40%+     |
| Avg Return         | -8.28%     | +5%+     |
| Stop Loss Hits     | 60%        | <30%     |
| Avg Hold Time      | 1 day      | 3-5 days |
| Breakout Detection | 5.2%       | 20%+     |

## 🔧 Issues Identified & Fixed

### 1. Stop Loss Too Tight (15% max)

**Problem**: 60% of trades hit stop loss immediately. Penny stocks routinely swing 15-20% intraday.

**Fix**:

- Increased ATR multiplier from 2.0x to 2.5x
- Widened max stop loss from 15% to 25%
- Added minimum stop of 10% for risk control

```python
# Before
max_stop = signal.close_price * 0.85  # 15% max loss

# After
max_stop_price = signal.close_price * 0.75  # 25% max loss
min_stop_price = signal.close_price * 0.90  # 10% min protection
```

### 2. Breakout Detection Too Restrictive

**Problem**: Only 5.2% of signals marked as breakouts. Required ALL of:

- Consolidation (only 6.5% qualified)
- Price up today
- 1.5x volume

**Fix**: Multiple breakout scenarios now qualify:

1. **Classic**: Consolidation + price up + 2x volume
2. **Volume Explosion**: 3x+ volume with price up (even without consolidation)
3. **Momentum**: 5%+ price move with 2x+ volume

### 3. Consolidation Range Too Tight

**Problem**: 15% price range over 10 days was too restrictive for volatile penny stocks.

**Fix**: Increased to 20% range to better capture penny stock patterns.

### 4. Inflated Scores from Unimplemented Features

**Problem**: ~6% of score came from "partial credit" for features not implemented:

- Market outperformance (8% weight × 50% credit = 4%)
- Sector leadership (4% weight × 50% credit = 2%)
- Bid-ask spread (2% weight × 50% credit = 1%)

**Fix**: Set unimplemented features to 0 credit until properly implemented.

### 5. All Signals Were "BUY"

**Problem**: 100% of 248 signals had same "BUY" recommendation.

**Fix**: More nuanced recommendation logic:

- **STRONG_BUY**: Score ≥0.75 + breakout + 3x volume + low risk
- **BUY**: Score ≥0.68 + (breakout OR 2.5x volume OR higher lows) + low risk
- **WATCH**: Score ≥0.60 + low risk
- **HOLD**: Below threshold or high risk

### 6. Tier Thresholds Not Discriminating

**Problem**: 94% B-Tier, 6% A-Tier, 0% S-Tier, 0% C-Tier

**Fix**: Adjusted thresholds after removing inflated scores:

- S-Tier: 0.82 (down from 0.90)
- A-Tier: 0.72 (down from 0.80)
- B-Tier: 0.62 (down from 0.70)
- C-Tier: 0.55 (down from 0.60)

### 7. Weekend/Holiday Continuity Bug

**Problem**: Signal continuity compared to "yesterday" which didn't account for weekends/holidays. All Monday signals appeared as "NEW".

**Fix**: Added `get_previous_trading_day()` function that:

- Skips Saturday/Sunday
- Skips US market holidays (2024-2026 calendar)
- Properly tracks signal continuity across weekends

## 📈 Expected Improvements

After these fixes, we expect:

1. **Better breakout detection**: 20%+ of signals should show breakout patterns
2. **Fewer stop loss hits**: Wider stops should reduce from 60% to <30%
3. **Better tier distribution**: More S/A-Tier signals, better C/D-Tier filtering
4. **Longer signal duration**: Average hold time should increase to 3-5 days
5. **Improved win rate**: Target 40%+ win rate on closed trades

## 🔍 Monitoring Recommendations

Run the analysis script regularly to track improvements:

```bash
cd penny-stock-scanner
poetry run python scripts/analyze_performance.py
```

Key metrics to watch:

- Win rate by tier (S/A should outperform B/C)
- Stop loss hit rate (target <30%)
- Breakout detection rate (target 20%+)
- Recommendation distribution (should have variety, not all "BUY")

## 📅 Additional Features Added (Dec 2025)

### 1. Discord Alerts ✅

- New `discord_service.py` for sending formatted alerts
- Automatic alerts for S/A-Tier signals during scans
- Rich embeds with signal details, scores, and setup indicators
- Daily summary and performance report capabilities

### 2. SPY Market Comparison ✅

- New `market_comparison_service.py` for relative strength calculation
- Compares penny stock performance to S&P 500 (SPY)
- Calculates 5-day and 20-day market outperformance
- Now properly scores market outperformance (was giving free partial credit)

### 3. Profit Target Tracking ✅

- New `profit_target_checker.py` service
- Tracks multiple profit targets: 10%, 20%, 30%
- Dynamic targets based on signal quality (S-Tier gets more ambitious targets)
- Records max price reached during trade
- New database schema: `db/penny_signal_performance.sql`

### 4. Configuration Additions

New environment variables:

- `DISCORD_PENNY_WEBHOOK_URL` - Webhook for penny stock alerts
- `discord_alerts_enabled` - Enable/disable alerts
- `discord_min_rank` - Minimum rank to trigger alert (default: A)

**GitHub Actions Setup:**
Add the `DISCORD_PENNY_WEBHOOK_URL` secret to your repository:

1. Go to GitHub → Repository → Settings → Secrets and variables → Actions
2. Add new secret: `DISCORD_PENNY_WEBHOOK_URL`
3. Value: Your Discord webhook URL (e.g., `https://discord.com/api/webhooks/...`)

## ✅ Post-Fix Test Results (Dec 14, 2025)

Full scan of 1,605 symbols with updated algorithm:

| Metric                 | Old Algorithm | New Algorithm | Change                   |
| ---------------------- | ------------- | ------------- | ------------------------ |
| **S-Tier Signals**     | 0 (0%)        | 6 (12.2%)     | ✅ Now working!          |
| **A-Tier Signals**     | 15 (6%)       | 15 (30.6%)    | ✅ 5x better             |
| **B-Tier Signals**     | 233 (94%)     | ~28 (57%)     | ✅ Better distribution   |
| **Breakouts Detected** | 5.2%          | ~70%+ 🚀      | ✅ Dramatically improved |
| **Signal Rate**        | ~7%           | 3.1%          | ✅ More selective        |
| **Total Signals**      | 248           | 49            | ✅ Higher quality        |

### Top S-Tier Signals Found

| Symbol | Score | Vol Spike | Setup                        | Status |
| ------ | ----- | --------- | ---------------------------- | ------ |
| CLYM   | 0.909 | 5.0x      | 🚀 Breakout + 📈 Higher Lows | Day 2  |
| NCEW   | 0.903 | 5.0x      | 🚀 Breakout + 📈 Higher Lows | Day 2  |
| NCI    | 0.871 | 5.0x      | 🚀 Breakout                  | Day 2  |
| CRON   | 0.833 | 5.0x      | 🚀 Breakout                  | Day 2  |
| YCBD   | 0.831 | 5.0x      | 🚀 Breakout                  | Day 2  |
| IMCC   | 0.824 | 5.0x      | 🚀 Breakout                  | Day 2  |

### Key Observations

- **Weekend continuity working**: Signals correctly show "Day 2" for stocks that were detected Friday
- **SPY comparison active**: Market outperformance now properly calculated
- **Breakout detection fixed**: Majority of signals show 🚀 breakout indicator
- **Volume signals working**: Most S/A-Tier have 5.0x+ volume spikes

---

## 📊 Week 1 Performance Review (Dec 14-19, 2025)

### Results vs Targets

| Metric             | Before (Nov) | Week 1 (Dec) | Target | Status      |
| ------------------ | ------------ | ------------ | ------ | ----------- |
| Win Rate           | 20%          | **41.3%**    | 40%+   | ✅ Met!     |
| Avg Return         | -8.28%       | **-1.31%**   | +5%    | 🔄 Improved |
| Stop Loss Hits     | 60%          | **15.5%**    | <30%   | ✅ Met!     |
| Breakout Detection | 5.2%         | **37.8%**    | 20%+   | ✅ Met!     |

### Deep Analysis Findings

**By Volume Ratio:**
| Volume | Win Rate | Avg Return | Analysis |
|--------|----------|------------|----------|
| 1-2x | 33.3% | -3.58% | Too low |
| **2-5x** | **50%+** | **+1.9%** | ✅ SWEET SPOT |
| 5-10x | 50.0% | -0.59% | Okay |
| **10x+** | **34.1%** | **-3.16%** | 🚨 PUMP & DUMP |

**By Pattern:**
| Pattern | Win Rate | Avg Return |
|---------|----------|------------|
| **Breakout Only** | **48.7%** | **+1.23%** |
| Neither | 20.4% | -6.97% |

**By Country:**
| Country | Win Rate | Avg Return |
|---------|----------|------------|
| United States | 45.2% | -0.34% |
| China/HK | 47.1% | -3.24% |
| **Israel** | **0%** | -2.81% |
| **Malaysia** | **18.2%** | -4.54% |
| **Greece** | **12.5%** | -1.91% |

**By Recommendation (ISSUE FOUND!):**
| Recommendation | Win Rate | Avg Return |
|----------------|----------|------------|
| **STRONG_BUY** | **61.5%** | **+4.15%** |
| **BUY** | **25.5%** | **-5.93%** 🚨 |
| WATCH | 41.0% | +2.14% |
| HOLD | 50.4% | +0.35% |

**Market Outperformance (STRONGEST SIGNAL!):**
| Condition | Win Rate | Avg Return |
|-----------|----------|------------|
| **Outperforming SPY** | **63.6%** | **+4.56%** |
| Underperforming | 36.0% | -2.73% |

---

## 🔧 Week 1 Improvements Implemented (Dec 19, 2025)

### 1. Country Risk Filter 🌍

**Problem**: Stocks from certain countries showed 0-18% win rates.

**Fix**:

- Added country detection via yfinance
- High-risk countries demote signal by 1 tier
- Countries flagged: Israel, Malaysia, Greece, Australia, Cayman Islands, British Virgin Islands
- Moderate risk (flagged): China, Hong Kong

```python
if is_high_risk_country:
    opportunity_rank = demote_rank(opportunity_rank)
```

### 2. Volume Ceiling (Anti-Pump-and-Dump) 📉

**Problem**: 10x+ volume showed 34% WR, -3.16% returns (likely pump-and-dumps).

**Fix**:

- Volume sweet spot: 2-5x (full credit)
- 5-10x: Slight penalty (80% credit)
- **10x+: Major penalty (50% credit)**

```python
if volume_ratio >= 10.0:
    surge_score = 0.50  # Penalize extreme volume
elif 2.0 <= volume_ratio <= 5.0:
    surge_score = 1.0   # Optimal zone
```

### 3. Fixed BUY Recommendation 🛠️

**Problem**: BUY had 25.5% WR vs STRONG_BUY 61.5% - criteria too loose.

**Fix**: Now requires BOTH:

- Breakout confirmation (48.7% WR vs 20.4%)
- Market outperformance (63.6% WR vs 36%)

| Rec        | New Criteria                                       |
| ---------- | -------------------------------------------------- |
| STRONG_BUY | Score ≥0.80 + breakout + outperforming + 3x volume |
| BUY        | Score ≥0.72 + breakout + outperforming + 2x volume |
| WATCH      | Breakout OR outperforming                          |
| HOLD       | Neither or high risk                               |

### 4. Increased Market Outperformance Weight 📈

**Problem**: Only 8% weight despite being strongest predictor (63.6% vs 36% WR).

**Fix**: Increased from 8% to **15%** of total score.

### 5. Breakout Required for B/C Tier 🚀

**Problem**: Non-breakout signals had 20.4% WR, -6.97% returns.

**Fix**: B/C tier signals without breakout are demoted to next tier.

```python
if not is_breakout and rank in (B_TIER, C_TIER):
    rank = demote_rank(rank)
```

### 6. Pump-and-Dump Warning Flag ⚠️

**Problem**: Extreme volume + high score + risky characteristics = P&D trap.

**Fix**: Added `pump_dump_warning` flag when:

- Volume ≥ 10x AND
- Score ≥ 0.75 AND
- (High-risk country OR price < $0.50)

---

## 📅 Future Improvements

1. **Backtest improvements** - Validate changes on historical data
2. **Sector ETF comparison** - Add sector-relative strength (XLF, XLK, etc.)

## 📝 Files Modified/Added

**Modified (Dec 14):**

- `src/penny_scanner/services/analysis_service.py` - Stop loss, breakout, scoring fixes, SPY integration
- `src/penny_scanner/services/signal_continuity_service.py` - Weekend/holiday bug fix
- `src/penny_scanner/config/settings.py` - Threshold adjustments, Discord config
- `src/penny_scanner/cli.py` - Discord alert integration

**Modified (Dec 19 - Week 1 Improvements):**

- `src/penny_scanner/services/analysis_service.py` - Country detection, volume ceiling, BUY fix, breakout requirements
- `src/penny_scanner/config/settings.py` - Market outperformance weight (8%→15%), high-risk countries, volume ceiling
- `src/penny_scanner/models/analysis.py` - Added country, is_high_risk_country, pump_dump_warning fields
- `src/penny_scanner/services/database_service.py` - Store new country/warning fields
- `frontend/src/lib/types/penny-stock.ts` - Added new TypeScript types
- `frontend/src/app/penny-stock-scanner/page.tsx` - Display warnings in table and sidebar
- `db/penny_stock_signals.sql` - Added country, is_high_risk_country, pump_dump_warning columns

**Added:**

- `src/penny_scanner/services/discord_service.py` - Discord notification service
- `src/penny_scanner/services/market_comparison_service.py` - SPY comparison service
- `src/penny_scanner/services/profit_target_checker.py` - Profit target tracking
- `db/penny_signal_performance.sql` - Performance tracking schema
- `scripts/analyze_performance.py` - Performance analysis script
- `scripts/deep_analysis.py` - Deep dive analysis by factor
- `scripts/price_analysis.py` - Price range analysis

## ⚠️ Breaking Changes

None - all changes are backwards compatible. Existing signals in database remain valid.

**Database Migration Required:**
Run `db/penny_signal_performance.sql` in Supabase to create the performance tracking table with new profit target columns.
