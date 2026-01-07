# Hedge Detection Analysis: Data Weaknesses & Improvements

## Executive Summary

After 1 month of data collection, we've identified that **hedge fund hedging
activity** is generating false positives in the unusual options scanner. This
document analyzes the current data model's limitations for distinguishing
hedging from directional bets, and proposes improvements.

---

## Current Data Model Assessment

### What We Capture ✅

| Field                  | Description          | Useful for Hedging? |
| ---------------------- | -------------------- | ------------------- |
| `ticker`               | Underlying symbol    | ✅ Yes              |
| `option_type`          | call/put             | ✅ Yes              |
| `strike`               | Strike price         | ✅ Yes              |
| `expiry`               | Expiration date      | ✅ Yes              |
| `premium_flow`         | Total premium spent  | ⚠️ Partially        |
| `current_volume`       | Today's volume       | ⚠️ Partially        |
| `current_oi`           | Open interest        | ⚠️ Partially        |
| `moneyness`            | ITM/ATM/OTM          | ✅ Yes              |
| `days_to_expiry`       | DTE                  | ✅ Yes              |
| `is_likely_spread`     | Spread detection     | ✅ Yes              |
| `spread_confidence`    | Spread probability   | ✅ Yes              |
| `aggressive_order_pct` | Execution urgency    | ⚠️ Partially        |
| `put_call_ratio`       | P/C for entire chain | ⚠️ Partially        |

### Critical Missing Data ❌

#### 1. **Order Side (Buy vs. Sell)**

- **Problem**: We don't know if premium_flow represents BUYING or SELLING
- **Impact**: A protective put (BUY) looks identical to a covered put (SELL)
- **Example**:
  - `$5M PUT premium` → Could be bullish (selling puts) or bearish (buying
    puts)
  - Current system assumes all flow is buying

#### 2. **Cross-Signal Correlation**

- **Problem**: Each signal is stored independently
- **Impact**: Cannot correlate paired call/put activity on same ticker
- **Example**:
  - Signal A: AAPL $185 Call, $3M premium, 10:15 AM
  - Signal B: AAPL $175 Put, $3M premium, 10:17 AM
  - These are likely a collar, but stored as 2 independent bullish/bearish
    signals

#### 3. **Net Delta Exposure**

- **Problem**: No Greeks tracking (delta, gamma, vega, theta)
- **Impact**: Cannot calculate net directional exposure
- **Example**:
  - Buy 1000 ATM calls (delta +500)
  - Buy 500 OTM puts (delta -200)
  - Net = +300 delta (bullish), but system sees 2 separate signals

#### 4. **Time Window Grouping**

- **Problem**: Signals detected minutes apart aren't grouped
- **Impact**: Spread legs traded separately aren't correlated
- **Example**:
  - Leg 1 executed at 10:00:05
  - Leg 2 executed at 10:00:47
  - Current spread detector may miss this

#### 5. **Historical Position Context**

- **Problem**: No tracking of prior positions on same ticker
- **Impact**: Can't identify roll patterns or position adjustments
- **Example**:
  - Week 1: Buy AAPL $180 Calls (bullish bet)
  - Week 2: Buy AAPL $175 Puts (hedging existing calls)
  - System sees Week 2 as new bearish signal

#### 6. **IV Skew Data**

- **Problem**: Only track contract IV, not relative skew
- **Impact**: Can't detect protective put buying patterns
- **Example**:
  - Protective puts typically have higher IV than calls
  - If OTM put IV >> ATM call IV, likely hedging activity

#### 7. **Institutional vs. Retail Pattern Detection**

- **Problem**: No order size distribution analysis
- **Impact**: Can't distinguish MM inventory vs. directional bets
- **Example**:
  - Retail: Many small orders scattered across strikes
  - Institutional: Few large orders in specific strikes

---

## Common Hedging Patterns We Should Detect

### 1. Protective Puts

**Pattern**: Long stock + Buy OTM puts

**Indicators**:

- OTM put buying (5-15% below current price)
- Large premium in 30-90 DTE range
- Often near quarterly roll dates
- Frequently in mega-caps (AAPL, MSFT, NVDA)

**Current Detection**: ❌ FAILS - Looks like bearish bet

### 2. Collars

**Pattern**: Long stock + Sell OTM call + Buy OTM put

**Indicators**:

- Paired call SELLING and put BUYING
- Similar premium (often zero-cost collar)
- Same expiry, different strikes
- Call strike > put strike > current price

**Current Detection**: ⚠️ PARTIAL - Spread detector may catch if legs are
simultaneous

### 3. Covered Calls

**Pattern**: Long stock + Sell OTM calls

**Indicators**:

- OTM call SELLING (not buying)
- 2-8% above current price
- Monthly expiry (income generation)
- Consistent pattern over time

**Current Detection**: ❌ FAILS - System sees call premium flow as bullish

### 4. Index Hedges

**Pattern**: Portfolio-wide protection via index options

**Indicators**:

- Large SPY/QQQ/IWM put activity
- Far-dated (60-180 DTE)
- Occurs during high VIX or market stress
- Often coincides with equity long positions

**Current Detection**: ❌ FAILS - Looks like bearish index bet

### 5. Sector Hedges

**Pattern**: XL\* ETF puts to hedge sector exposure

**Indicators**:

- Large activity in XLF, XLE, XLK, etc.
- Correlated with single-name exposure in same sector
- Often quarterly timing

**Current Detection**: ❌ FAILS - No sector correlation analysis

---

## Proposed Data Model Enhancements

### Phase 1: New Fields (Minimal Impact)

Add to `UnusualOptionsSignal`:

```python
# Hedge Detection Fields
likely_hedge: bool = False
hedge_confidence: float = 0.0  # 0.0 - 1.0
hedge_type: Optional[str] = None  # PROTECTIVE_PUT, COLLAR,
                                  # COVERED_CALL, INDEX_HEDGE, etc.
hedge_indicators: List[str] = []  # List of indicators that
                                  # triggered hedge classification

# Cross-Signal Correlation
correlated_signal_ids: List[str] = []  # IDs of related signals
correlation_type: Optional[str] = None  # PAIRED, SPREAD, ROLL, etc.
time_window_group_id: Optional[str] = None  # Group signals
                                            # within same time window

# Order Side Inference (best effort)
inferred_side: Optional[str] = None  # BUY, SELL, MIXED
side_confidence: float = 0.0  # How confident we are in side inference

# Delta Exposure (if Greeks available)
contract_delta: Optional[float] = None
notional_delta_exposure: Optional[float] = None
  # contract_delta * volume * 100

# Sector Context
sector: Optional[str] = None  # Technology, Financials, etc.
is_sector_etf: bool = False
related_sector_activity: bool = False
```

### Phase 2: Cross-Signal Analysis (New Table)

```sql
CREATE TABLE signal_correlations (
    correlation_id UUID PRIMARY KEY,
    signal_id_1 UUID REFERENCES unusual_options_signals(signal_id),
    signal_id_2 UUID REFERENCES unusual_options_signals(signal_id),
    correlation_type TEXT,  -- SPREAD, COLLAR, PAIRED, ROLL
    confidence NUMERIC(4,3),
    time_diff_seconds INTEGER,
    premium_ratio NUMERIC(6,4),
    strike_relationship TEXT,  -- ABOVE, BELOW, BRACKETING
    detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 3: Hedge Analysis View

```sql
CREATE VIEW hedge_activity_summary AS
SELECT
    ticker,
    DATE(detection_timestamp) as date,
    SUM(CASE WHEN option_type = 'put' THEN premium_flow ELSE 0 END)
      as total_put_premium,
    SUM(CASE WHEN option_type = 'call' THEN premium_flow ELSE 0 END)
      as total_call_premium,
    SUM(CASE WHEN option_type = 'put' THEN premium_flow ELSE 0 END) /
    NULLIF(SUM(CASE WHEN option_type = 'call' THEN premium_flow ELSE 0 END), 0)
      as put_call_premium_ratio,
    COUNT(DISTINCT CASE WHEN option_type = 'put' THEN option_symbol END)
      as distinct_put_strikes,
    COUNT(DISTINCT CASE WHEN option_type = 'call' THEN option_symbol END)
      as distinct_call_strikes,
    AVG(days_to_expiry) as avg_dte,
    SUM(CASE WHEN moneyness = 'OTM' AND option_type = 'put'
        THEN premium_flow ELSE 0 END) as otm_put_premium
FROM unusual_options_signals
WHERE is_active = TRUE
GROUP BY ticker, DATE(detection_timestamp);
```

---

## Hedge Detection Heuristics

### Heuristic 1: Protective Put Pattern

```python
def is_protective_put(signal) -> tuple[bool, float]:
    """
    Detect protective put buying pattern.

    Returns: (is_hedge, confidence)
    """
    indicators = []

    # Must be a put
    if signal.option_type != 'put':
        return False, 0.0

    # OTM put (5-20% below current price)
    if signal.moneyness == 'OTM':
        otm_pct = (signal.underlying_price - signal.strike) / \
                   signal.underlying_price
        if 0.05 <= otm_pct <= 0.20:
            indicators.append("OTM_PUT_RANGE")

    # Medium-dated (30-120 DTE) - typical for hedging
    if 30 <= signal.days_to_expiry <= 120:
        indicators.append("HEDGE_DTE_RANGE")

    # Large premium (institutional size)
    if signal.premium_flow >= 1_000_000:
        indicators.append("INSTITUTIONAL_SIZE")

    # Mega-cap or index (common hedge targets)
    if signal.ticker in MEGA_CAPS or signal.ticker in INDEX_ETFS:
        indicators.append("HEDGE_TARGET_TICKER")

    # Low aggression suggests patient execution (hedging, not panic)
    if signal.aggressive_order_pct and signal.aggressive_order_pct < 0.5:
        indicators.append("PATIENT_EXECUTION")

    confidence = len(indicators) / 5.0
    is_hedge = len(indicators) >= 3

    return is_hedge, confidence, indicators
```

### Heuristic 2: Collar Detection

```python
def detect_collar(call_signal, put_signal) -> tuple[bool, float]:
    """
    Detect collar structure from paired signals.
    """
    indicators = []

    # Same ticker
    if call_signal.ticker != put_signal.ticker:
        return False, 0.0

    # Same expiry
    if call_signal.expiry == put_signal.expiry:
        indicators.append("SAME_EXPIRY")

    # Call strike > Put strike (typical collar)
    if call_signal.strike > put_signal.strike:
        indicators.append("STRIKE_RELATIONSHIP")

    # Similar premium (often zero-cost collar)
    premium_ratio = call_signal.premium_flow / put_signal.premium_flow
    if 0.7 <= premium_ratio <= 1.3:
        indicators.append("BALANCED_PREMIUM")

    # Close detection time (< 5 minutes)
    time_diff = abs(
        (call_signal.detection_timestamp -
         put_signal.detection_timestamp).total_seconds()
    )
    if time_diff < 300:
        indicators.append("SAME_TIME_WINDOW")

    confidence = len(indicators) / 4.0
    is_collar = len(indicators) >= 3

    return is_collar, confidence, indicators
```

### Heuristic 3: Index Hedge Detection

```python
INDEX_ETFS = {'SPY', 'QQQ', 'IWM', 'DIA', 'VXX', 'UVXY'}

def is_index_hedge(signal) -> tuple[bool, float]:
    """Detect index-level hedging activity."""
    indicators = []

    if signal.ticker not in INDEX_ETFS:
        return False, 0.0

    # Put option
    if signal.option_type == 'put':
        indicators.append("INDEX_PUT")

    # Far-dated (60+ DTE)
    if signal.days_to_expiry >= 60:
        indicators.append("FAR_DATED")

    # Large size
    if signal.premium_flow >= 5_000_000:
        indicators.append("LARGE_PREMIUM")

    # OTM (disaster protection)
    if signal.moneyness == 'OTM':
        indicators.append("OTM_PROTECTION")

    confidence = len(indicators) / 4.0
    is_hedge = len(indicators) >= 3

    return is_hedge, confidence, indicators
```

---

## Implementation Roadmap

### Immediate (This Week)

1. ✅ Add `likely_hedge`, `hedge_confidence`, `hedge_type`,
   `hedge_indicators` fields
2. ✅ Create `scripts/hedge_analyzer.py` for post-hoc analysis
3. ✅ Add `--exclude-hedges` flag to `insider_plays.py`

### Short-term (2-4 Weeks)

4. Add time-window grouping for same-ticker signals
5. Implement collar/spread detection across signal pairs
6. Add sector tagging to signals

### Medium-term (1-3 Months)

7. Add order-side inference using bid/ask analysis
8. Implement Greeks tracking if data provider supports it
9. Create hedge analysis dashboard view

### Long-term (3-6 Months)

10. Machine learning model for hedge classification
11. Historical pattern analysis for roll detection
12. Real-time hedge vs. directional alert separation

---

## Conclusion

The current data model captures the **raw activity** well but lacks the
**context** needed to distinguish hedging from directional bets. The key
missing pieces are:

1. **Order side** (buy vs. sell)
2. **Cross-signal correlation** (paired trades)
3. **Delta/Greeks** (net exposure)
4. **Time-window grouping** (related activity)

By implementing the proposed enhancements, we can:

- Reduce false positives by 40-60% (estimated)
- Create separate "Hedge Activity" and "Directional Bets" views
- Provide better institutional positioning insights

**Recommended First Step**: Add hedge detection heuristics as a
post-processing step that tags existing signals without requiring
schema changes.
