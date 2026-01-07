# Ticker Quality Improvements

## Overview

This document outlines recommendations for stricter ticker quality criteria
to improve the quality of tickers stored in Supabase.

## Current vs Proposed Criteria

### Price Thresholds

| Metric    | Current | Proposed  | Rationale                     |
| --------- | ------- | --------- | ----------------------------- |
| Min Price | $0.50   | **$2.00** | Avoid borderline penny stocks |
| Max Price | $10,000 | $10,000   | No change                     |

### Market Cap Requirements

| Metric         | Current | Proposed  | Rationale                      |
| -------------- | ------- | --------- | ------------------------------ |
| Min Market Cap | $25M    | **$100M** | Exclude speculative micro-caps |
| Ideal Range    | None    | $500M+    | Prioritize mid-cap and above   |

### Liquidity Requirements

| Metric                | Current | Proposed      | Rationale               |
| --------------------- | ------- | ------------- | ----------------------- |
| Min Daily Volume      | 10K-25K | **100,000**   | Ensure tradeable        |
| Min Avg Dollar Volume | None    | **$500K/day** | Better liquidity metric |

### Quality Score

| Metric            | Current | Proposed | Rationale                |
| ----------------- | ------- | -------- | ------------------------ |
| Min Quality Score | 45      | **65**   | Higher bar for inclusion |

## New Criteria to Add

### 1. Index Inclusion Bonus

Track membership in major indexes for quality signals:

```python
QUALITY_INDEXES = {
    'sp500': 25,       # S&P 500 - highest quality
    'nasdaq100': 20,   # NASDAQ 100
    'russell1000': 15, # Russell 1000 (large cap)
    'russell2000': 10, # Russell 2000 (small cap but indexed)
    'dow30': 25,       # Dow Jones Industrial Average
}
```

### 2. Fundamental Quality Checks

Add basic fundamental requirements:

```python
FUNDAMENTAL_REQUIREMENTS = {
    'min_revenue': 10_000_000,          # $10M minimum revenue
    'max_pe_ratio': 500,                # Filter extreme valuations
    'min_pe_ratio': -50,                # Allow some losses
    'require_positive_revenue': True,    # Must have revenue
}
```

### 3. Options Eligibility Check

Options-eligible stocks tend to be more established:

```python
def has_options(symbol: str) -> bool:
    """Check if ticker has options available."""
    try:
        ticker = yf.Ticker(symbol)
        options = ticker.options
        return len(options) > 0
    except:
        return False
```

### 4. Institutional Ownership

Filter stocks with institutional backing:

```python
INSTITUTIONAL_REQUIREMENTS = {
    'min_institutional_ownership': 0.10,  # At least 10%
    'min_institutional_holders': 5,       # At least 5 holders
}
```

### 5. Float and Shares Outstanding

Ensure adequate liquidity depth:

```python
FLOAT_REQUIREMENTS = {
    'min_float': 5_000_000,              # 5M shares minimum
    'min_float_percent': 0.20,           # At least 20% float
    'max_short_percent': 0.50,           # Max 50% short interest
}
```

## Enhanced Quality Scoring

### New Scoring Breakdown

```python
def calculate_quality_score(ticker_data: dict) -> float:
    """
    Calculate comprehensive quality score (0-100).

    Score Components:
    - Market Cap:      25 points max
    - Liquidity:       25 points max
    - Fundamentals:    20 points max
    - Index Inclusion: 15 points max
    - Data Quality:    15 points max
    """
    score = 0.0

    # Market Cap (25 pts)
    market_cap = ticker_data.get('market_cap', 0)
    if market_cap >= 10_000_000_000:    # $10B+
        score += 25
    elif market_cap >= 2_000_000_000:   # $2B+
        score += 22
    elif market_cap >= 500_000_000:     # $500M+
        score += 18
    elif market_cap >= 100_000_000:     # $100M+
        score += 12
    else:
        score += 5

    # Liquidity (25 pts)
    avg_volume = ticker_data.get('avg_volume', 0)
    price = ticker_data.get('price', 0)
    dollar_volume = avg_volume * price

    if dollar_volume >= 50_000_000:     # $50M+/day
        score += 25
    elif dollar_volume >= 10_000_000:   # $10M+/day
        score += 22
    elif dollar_volume >= 1_000_000:    # $1M+/day
        score += 18
    elif dollar_volume >= 500_000:      # $500K+/day
        score += 12
    else:
        score += 5

    # Fundamentals (20 pts)
    revenue = ticker_data.get('revenue', 0)
    if revenue >= 1_000_000_000:        # $1B+ revenue
        score += 15
    elif revenue >= 100_000_000:        # $100M+ revenue
        score += 12
    elif revenue >= 10_000_000:         # $10M+ revenue
        score += 8
    else:
        score += 3

    # Profitability bonus
    if ticker_data.get('profitable', False):
        score += 5

    # Index Inclusion (15 pts)
    if ticker_data.get('is_sp500', False):
        score += 15
    elif ticker_data.get('is_nasdaq100', False):
        score += 12
    elif ticker_data.get('is_russell1000', False):
        score += 10
    elif ticker_data.get('is_russell2000', False):
        score += 5

    # Data Quality (15 pts)
    data_completeness = ticker_data.get('data_completeness', 0)
    ohlc_quality = ticker_data.get('ohlc_quality', 0)

    score += data_completeness * 8
    score += ohlc_quality * 7

    return min(score, 100.0)
```

## Recommended Constant Updates

```python
# constants.py - Updated values

# Regular ticker thresholds (STRICTER)
TICKER_MIN_PRICE = 2.00              # Was: 0.50
TICKER_MAX_PRICE = 10_000.0          # Unchanged
TICKER_MIN_MARKET_CAP = 100_000_000  # Was: 25M, Now: 100M
TICKER_MIN_VOLUME = 100_000          # Was: 25K, Now: 100K
TICKER_MIN_DOLLAR_VOLUME = 500_000   # NEW: $500K/day minimum

# Quality thresholds
MIN_QUALITY_SCORE = 65.0             # Was: 45, Now: 65
DEFAULT_MAX_TICKERS = 2000           # Was: 2500, Now: 2000 (higher quality)

# New thresholds
MIN_HISTORY_DAYS = 180               # Was: 90, Now: 180 (6 months)
MIN_DATA_COMPLETENESS = 0.90         # Was: 0.85, Now: 0.90
MAX_GAP_RATIO = 0.05                 # Was: 0.10, Now: 0.05 (5%)
```

## Implementation Checklist

- [x] Update `constants.py` with new thresholds
- [x] Add dollar volume calculation to `efficient_ticker_filter.py`
- [x] Implement index membership checking (S&P 500, NASDAQ-100, Dow 30)
- [x] Add fundamental data fetching (revenue, earnings)
- [x] Add institutional ownership check
- [x] Add options eligibility check
- [x] Update quality scoring algorithm
- [x] Add float/shares outstanding validation
- [x] Update YFinance validator thresholds
- [ ] Add unit tests for new filters
- [ ] Run comparison test: old vs new criteria

## Expected Impact

| Metric              | Before | After (Expected) |
| ------------------- | ------ | ---------------- |
| Total Tickers       | ~3,800 | ~1,500-2,000     |
| Avg Market Cap      | ~$2B   | ~$8B+            |
| Avg Daily Volume    | ~500K  | ~2M+             |
| Pass Rate           | ~65%   | ~40%             |
| Data Quality Issues | ~15%   | ~5%              |

## Phased Rollout

### Phase 1: Quick Wins

- Update price threshold to $2.00
- Update volume threshold to 100K
- Increase min quality score to 60

### Phase 2: Enhanced Filtering

- Add dollar volume calculation
- Add market cap tiering
- Implement index membership bonus

### Phase 3: Fundamental Integration

- Add revenue/earnings checks
- Add institutional ownership
- Add options eligibility

## Advanced Quality Checks (Implemented)

The following advanced quality checks have been implemented in
`utils/advanced_quality_checks.py` and can be enabled with the
`--enable-advanced-checks` flag:

### 1. Options Eligibility (8 pts max)

```python
# Stocks with options are more established and liquid
require_options: True
min_option_expiries: 2  # At least 2 expiration dates
```

### 2. Institutional Ownership (8 pts max)

```python
# Institutional backing signals quality
min_institutional_ownership: 0.10  # At least 10%
min_institutional_holders: 5       # At least 5 holders
```

### 3. Fundamental Requirements (11 pts max)

```python
# Filter out pre-revenue companies
min_revenue: 10_000_000           # $10M minimum
require_positive_revenue: True
# +3 bonus points for profitable companies
```

### 4. Float Validation (6 pts max)

```python
# Ensure adequate liquidity depth
min_float_shares: 5_000_000       # 5M shares minimum
min_float_percent: 0.20           # At least 20% float
max_short_percent: 0.50           # Max 50% short interest
```

### Usage

```bash
# Standard filtering (fast, ~5 min)
python fetch_tickers.py

# With advanced checks (highest quality, ~15-20 min)
python fetch_tickers.py --enable-advanced-checks --verbose
```

### Scoring Impact

Advanced checks add up to **33 bonus points** to quality scores:

- Options: 8 pts (+ 4 partial credit)
- Institutional: 8 pts (+ 4 partial credit)
- Fundamentals: 8 pts + 3 profitability bonus
- Float: 6 pts (+ 3 partial credit)

This significantly improves final ticker quality by filtering for
stocks that have institutional interest, options liquidity,
established revenue, and adequate float.

---

## Trade-offs

### Stricter Criteria Pros:

- Higher quality tickers for analysis
- Better data reliability
- More liquid for actual trading
- Fewer scanner failures

### Stricter Criteria Cons:

- May miss emerging growth stocks
- Excludes legitimate small-caps
- Reduces universe size
- May miss some opportunities

## Recommended Configuration

For a balanced approach optimizing for quality while maintaining coverage:

```python
# Balanced "High Quality" Configuration
TICKER_QUALITY_CONFIG = {
    'min_price': 2.00,
    'max_price': 10_000,
    'min_market_cap': 100_000_000,    # $100M
    'min_volume': 100_000,
    'min_dollar_volume': 500_000,     # $500K/day
    'min_quality_score': 65,
    'min_history_days': 180,
    'min_data_completeness': 0.90,
    'max_tickers': 2000,
    'require_us_exchange': True,
    'prioritize_indexed': True,
}
```
