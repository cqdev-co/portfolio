# Signal Quality Improvements - December 2025

## Overview

Based on analysis of signals over multiple weeks, several improvements were made.

### Latest Update: Direction-Agnostic Scoring (Jan 2026)

**Important change**: We removed PUT/CALL bias from the scoring system.

#### Why Direction-Agnostic?

Market regimes change. Historical win rates from a specific period (e.g., Jan 2026
showing 60% PUT win rate vs 8.6% CALL win rate) are regime-dependent:

- In bearish periods, PUT signals outperform
- In bullish periods, CALL signals outperform
- Hardcoding bias = overfitting to recent conditions

The system now scores signals based on **direction-agnostic quality factors**:

1. **Premium size** - Institutional conviction (larger = higher quality)
2. **Moneyness** - ATM = real conviction, far OTM = lottery tickets
3. **DTE** - 8-21 DTE sweet spot for directional plays
4. **Multi-factor detection** - Multiple signals > single factor

#### Current Filter Settings

```python
MIN_DTE_ALL_TICKERS = 10        # Filter all < 10 DTE
MIN_DTE_HIGH_0DTE_TICKERS = 14  # Filter TSLA/SPY < 14 DTE
EXCLUDE_PUT_SIGNALS = False     # Keep both - market regimes change
FLAG_LIKELY_HEDGES = True       # Flag hedges instead of excluding
MAX_SIGNALS_PER_TICKER = 3      # Prevent single ticker domination
```

**Note**: We treat CALLs and PUTs equally. Use `hedge_analyzer.py` to filter
likely hedging activity, but don't assume one direction is "better" than the
other - that changes with market conditions.

---

### Previous Update: Performance-Based Filtering (Dec 20)

After one week of collecting signals with the new algorithm, we analyzed actual
performance and made further refinements.

#### Performance Analysis Results (Historical - Regime Dependent)

| Segment              | Win Rate  | Avg Return | Note                         |
| -------------------- | --------- | ---------- | ---------------------------- |
| **Mid DTE (11-21d)** | **60.0%** | +0.83%     | Sweet spot - applies to both |
| Short DTE (≤10d)     | 27.3%     | -0.43%     | Filtered (noise)             |
| Hedge patterns       | N/A       | N/A        | Flagged, not directional     |

**Note**: These results were from a specific market period. Don't assume they
apply universally.

#### Key Findings (Direction-Agnostic)

1. **Short DTE (≤10d) = noise** - Filtered out (applies to both calls and puts)
2. **Mid DTE (11-21d) = edge** - Better signal quality
3. **TSLA dominated but underperformed** - Capped to 3 signals
4. **Hedge patterns flagged** - Use hedge_analyzer.py to filter

---

### Previous Updates

#### Conviction-Based Scoring (Dec 12)

| Metric               | Correct Signals | Wrong Signals | Insight                   |
| -------------------- | --------------- | ------------- | ------------------------- |
| **CALL Avg Premium** | $23.3M          | $3.3M         | **7x higher!**            |
| **PUT Avg Premium**  | $7.7M           | $2.6M         | 3x higher                 |
| **CALL Avg DTE**     | 14 days         | 26 days       | Shorter = more conviction |

---

| Issue             | Finding                     | Fix                          |
| ----------------- | --------------------------- | ---------------------------- |
| Grade Inflation   | 51% were S-grade            | Stricter scoring thresholds  |
| Short-DTE Noise   | 35% were 0-7 DTE            | Filter short-dated contracts |
| Ticker Domination | TSLA alone = 11% of signals | Cap signals per ticker       |
| PUT Hedging       | 73% of PUTs are hedges      | Exclude PUT signals          |

## Changes Made

### 1. Scoring Algorithm Overhaul

**Problem**: Previous scoring normalized by weights used, so single-factor signals (premium only) scored as high as multi-factor signals.

**Fix**: Score now uses raw weighted sum and penalizes single-factor signals.

```python
# OLD: Normalized by weights used (inflated scores)
normalized_score = total_score / total_weight

# NEW: Use raw weighted sum (max ~0.35 for single type)
normalized_score = total_score

# NEW: Bonus for multiple detection types
if detection_count >= 4: bonus = 0.25
elif detection_count >= 3: bonus = 0.15
elif detection_count >= 2: bonus = 0.08
else: bonus = 0.0

# NEW: Penalty for single detection type
if detection_count == 1:
    single_type_penalty = 0.10
```

### 2. Grade Thresholds Adjusted

**Old thresholds** (resulted in 51% S-grade):

- S: >= 0.85
- A: >= 0.75
- B: >= 0.65

**New thresholds** (target distribution):

- S: >= 0.55 (~5% of signals - exceptional multi-factor)
- A: >= 0.45 (~10% of signals)
- B: >= 0.35 (~25% of signals)
- C: >= 0.25 (~30% of signals)
- D: >= 0.15 (~20% of signals)
- F: < 0.15 (~10% of signals)

### 3. DTE Filtering

**Problem**: 35% of signals were 0-7 DTE (day trader noise).

**Fix**: Minimum DTE filters at multiple levels:

```python
# In detector.py
self.min_dte = config.get('MIN_DTE_FILTER', 7)  # Skip < 7 DTE

# In orchestrator.py _should_keep_signal()
min_dte = config.get("MIN_DTE_HIGH_0DTE_TICKERS", 7)  # High-volume tickers
min_dte = config.get("MIN_DTE_STANDARD", 5)  # Standard tickers
```

### 4. Ticker Cap

**Problem**: Single tickers dominated signal list (TSLA = 2,312 signals = 11%).

**Fix**: Cap signals per ticker in batch scans:

```python
# In orchestrator.py scan_multiple()
max_per_ticker = config.get("MAX_SIGNALS_PER_TICKER", 5)
capped_signals = self._apply_ticker_cap(all_signals, max_per_ticker)
```

Keeps highest-scoring signals for each ticker.

### 5. High-Volume Ticker Premium Thresholds

**Problem**: High-volume tickers like TSLA/NVDA generate signals constantly due to volume, not conviction.

**Fix**: Tiered premium thresholds:

```python
# High-volume tickers (defined list)
HIGH_VOLUME_TICKERS = {
    'TSLA', 'NVDA', 'META', 'SPY', 'QQQ', 'AMD', 'AAPL', 'AMZN',
    'GOOGL', 'MSFT', 'PLTR', 'AVGO', 'IWM', 'XLF', 'GLD', 'SLV',
    'COIN', 'MSTR', 'HOOD', 'SOFI', 'NIO', 'BABA', 'INTC', 'MU'
}

# Thresholds
PREMIUM_THRESHOLD_HIGH_VOL = 3_000_000   # $3M for high-volume
PREMIUM_THRESHOLD_NORMAL = 500_000       # $500K for normal

# Additional penalty in confidence scoring
ticker_penalty = 0.1 if ticker in HIGH_VOLUME_TICKERS else 0.0
```

## Configuration Options

New/updated config options in `.env`:

```bash
# DTE Filtering (based on performance analysis)
# Short DTE (≤10d) = 27% win rate, Mid DTE (11-21d) = 60% win rate
MIN_DTE_ALL_TICKERS=10           # Minimum DTE for all tickers (default: 10)
MIN_DTE_HIGH_0DTE_TICKERS=14     # Stricter for TSLA, SPY, etc. (default: 14)
MIN_DTE_STANDARD=10              # Standard DTE filter (default: 10)

# Hedge Detection
# Note: Don't exclude all PUTs - in bearish weeks they could be the edge
EXCLUDE_PUT_SIGNALS=false        # Keep both CALLS and PUTS (default: false)
FLAG_LIKELY_HEDGES=true          # Flag hedges for filtering during analysis

# Ticker Caps
MAX_SIGNALS_PER_TICKER=3         # Max signals per ticker (default: 3)

# Premium Thresholds
MIN_PREMIUM_FLOW=500000          # Minimum premium (default: $500K)
```

## Expected Impact

### Before (Week 1 - Original Algorithm):

- 51% S-grade (grade inflation)
- 33% 1-Day Win Rate (below coin flip)
- 73% of signals were hedging activity
- PUT signals acted as inverse indicators

### After (Week 2 - Performance-Based Filters):

- Both CALLS and PUTS captured (market conditions vary)
- Mid DTE (11-21d) focus = better signal quality
- Max 3 signals per ticker
- Hedge detection flags likely hedges for filtering
- Track CALL vs PUT performance separately over time

### Test Results (Dec 20):

```
Total signals found: 6 (down from hundreds)

Grade Distribution:
  S: 0 (0.0%)
  A: 1 (16.7%)
  B: 3 (50.0%)
  C: 2 (33.3%)

All CALLS, all 13-27 DTE (sweet spot)
```

## Validation

Run a test scan to validate the changes:

```bash
cd unusual-options-service

# Test the new scoring on a high-volume ticker
poetry run python -c "
from unusual_options.scanner.orchestrator import ScanOrchestrator
from unusual_options.config import load_config
import asyncio

async def test():
    config = load_config()
    orchestrator = ScanOrchestrator(config)
    signals = await orchestrator.scan_ticker('TSLA')
    print(f'TSLA signals: {len(signals)}')
    for s in signals[:5]:
        print(f'  {s.option_symbol}: Grade {s.grade}, Score {s.overall_score:.3f}')

asyncio.run(test())
"
```

## Files Changed

- `src/unusual_options/scoring/grader.py` - Scoring algorithm
- `src/unusual_options/scanner/detector.py` - Premium thresholds, DTE filter
- `src/unusual_options/scanner/orchestrator.py` - Ticker cap, signal filtering
