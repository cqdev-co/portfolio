# Signal Quality Improvements - December 2025

## Overview

Based on analysis of 20,391 signals over 30 days, several signal quality issues were identified and fixed.

### Latest Update: Conviction-Based Scoring (Dec 12)

Analysis of correct vs wrong signals revealed key predictors:

| Metric | Correct Signals | Wrong Signals | Insight |
|--------|-----------------|---------------|---------|
| **CALL Avg Premium** | $23.3M | $3.3M | **7x higher!** |
| **PUT Avg Premium** | $7.7M | $2.6M | 3x higher |
| **CALL Avg DTE** | 14 days | 26 days | Shorter = more conviction |
| **PUT Avg DTE** | 21 days | 34 days | Shorter = more conviction |

New scoring adjustments implemented:
- **Premium conviction bonus**: +15% for >$10M, +8% for >$5M
- **DTE conviction bonus**: +10% for ≤14 days, +5% for ≤21 days
- **OTM CALL penalty**: -12% for far OTM calls (speculative lottery tickets)
- **Long-dated penalty**: -8% for DTE ≥35 days (more hedge-like)

---

| Issue | Finding | Fix |
|-------|---------|-----|
| Grade Inflation | 51% were S-grade | Stricter scoring thresholds |
| Short-DTE Noise | 35% were 0-7 DTE | Filter short-dated contracts |
| Ticker Domination | TSLA alone = 11% of signals | Cap signals per ticker |
| High-Volume Noise | TSLA/NVDA/SPY generate constant signals | Higher premium thresholds |

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
# Minimum DTE to filter (default: 7)
MIN_DTE_FILTER=7

# Minimum DTE for high 0DTE activity tickers (default: 7)
MIN_DTE_HIGH_0DTE_TICKERS=7

# Minimum DTE for standard tickers (default: 5)
MIN_DTE_STANDARD=5

# Maximum signals per ticker in batch scans (default: 5)
MAX_SIGNALS_PER_TICKER=5

# Minimum premium for normal tickers (default: 500000)
MIN_PREMIUM_FLOW=500000
```

## Expected Impact

### Before (20,391 signals over 30 days):
- 51% S-grade (no discrimination)
- 35% 0-7 DTE (noise)
- TSLA = 11% of all signals
- 55% premium < $1M

### After (expected):
- ~5% S-grade (truly exceptional)
- 0% 0-7 DTE (filtered)
- Max 5 signals per ticker per scan
- Higher premium bar for high-volume tickers

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

