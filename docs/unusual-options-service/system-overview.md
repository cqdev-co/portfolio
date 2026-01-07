# Unusual Options Activity Scanner - System Overview

## 🎯 Mission

Detect unusual options activity that may indicate informed trading or institutional positioning, providing actionable signals for traders to investigate and potentially profit from.

## 📊 Core Concept

### What Is Unusual Options Activity?

Unusual options activity occurs when options contracts trade at volumes or with characteristics significantly different from their historical norms. This can indicate:

1. **Informed Trading**: Someone with information (legal or potentially illegal) positioning for a move
2. **Institutional Positioning**: Large funds building positions ahead of catalysts
3. **Hedging Activity**: Companies or investors protecting positions
4. **Smart Money Flow**: Experienced traders taking significant positions

### Why It Matters

Studies have shown that unusual options activity can be predictive:

- **Directional Movement**: Heavy call buying often precedes upward moves
- **Event Anticipation**: Large positions may anticipate earnings, FDA approvals, M&A
- **Risk/Reward Asymmetry**: Options provide leverage, so informed traders use them
- **Time Sensitivity**: Options have expiration, suggesting time-bound expectations

### The Edge

While detecting unusual activity is not a guarantee of profits, it provides:

- **Information Asymmetry Clues**: What might smart money know?
- **High-Conviction Ideas**: Filter thousands of stocks to a watchlist of 5-10
- **Risk Management**: Understand where others see opportunity or risk
- **Entry Timing**: Position ahead of potential moves

## 🏗 System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Interface (Click)                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Scanner Orchestrator                        │
│  - Ticker management                                         │
│  - Batch processing                                          │
│  - Result aggregation                                        │
└───────┬──────────────────────────────────────────┬──────────┘
        │                                          │
        ▼                                          ▼
┌──────────────────┐                      ┌──────────────────┐
│  Data Providers  │                      │ Detection Engine │
│  - Polygon.io    │                      │ - Volume anomaly │
│  - Tradier       │◄────────────────────►│ - OI analysis    │
│  - CBOE          │                      │ - Premium flow   │
│  - YFinance      │                      │ - Sweep detect   │
└────────┬─────────┘                      └────────┬─────────┘
         │                                          │
         ▼                                          ▼
┌─────────────────┐                       ┌──────────────────┐
│ Cache Layer     │                       │ Scoring Engine   │
│ - Redis/Local   │                       │ - Multi-factor   │
│ - Rate limiting │                       │ - Grading        │
└─────────────────┘                       │ - Risk scoring   │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │ Storage Layer    │
                                          │ - Supabase       │
                                          │ - Signal history │
                                          │ - Performance    │
                                          └────────┬─────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │ Alert System     │
                                          │ - Discord/Slack  │
                                          │ - Grade filters  │
                                          └──────────────────┘
```

### Component Responsibilities

#### 1. CLI Interface

- User command parsing
- Progress display
- Output formatting (tables, JSON, CSV)
- Configuration management

#### 2. Scanner Orchestrator

- Manages ticker lists and watchlists
- Coordinates batch processing
- Rate limit enforcement across providers
- Error handling and retries

#### 3. Data Providers

- Fetch options chains for tickers
- Get current and historical volume/OI data
- Retrieve time & sales data
- Handle API authentication and pagination

#### 4. Detection Engine

- Calculate volume anomalies (current vs average)
- Identify open interest spikes
- Detect large premium flow
- Find sweep patterns across exchanges
- Compare put/call ratios

#### 5. Scoring Engine

- Multi-factor signal scoring
- Grade assignment (S/A/B/C/D/F)
- Confidence calculation
- Risk assessment

#### 6. Storage Layer

- Persist signals to Supabase
- Track signal performance over time
- Store historical data for backtesting
- Manage user configurations

#### 7. Alert System

- Filter signals by grade thresholds
- Format alert messages
- Dispatch to notification channels
- Track alert history

## 🔍 Detection Methodology

### 1. Volume Anomaly Detection

**Concept**: Compare current options volume to historical average

```python
# Pseudocode
def detect_volume_anomaly(ticker, option_contract):
    current_volume = get_current_volume(option_contract)
    avg_volume_20d = get_average_volume(option_contract, days=20)

    if avg_volume_20d < 100:  # Filter low liquidity
        return None

    volume_ratio = current_volume / avg_volume_20d

    if volume_ratio >= 3.0:  # 3x threshold
        return {
            'type': 'VOLUME_ANOMALY',
            'ratio': volume_ratio,
            'current': current_volume,
            'average': avg_volume_20d,
            'confidence': min(volume_ratio / 10, 1.0)
        }

    return None
```

**Thresholds**:

- **3x**: Moderate signal
- **5x**: Strong signal
- **10x+**: Exceptional signal

### 2. Open Interest Analysis

**Concept**: Track day-over-day and week-over-week OI changes

```python
def detect_oi_spike(ticker, option_contract):
    current_oi = get_current_oi(option_contract)
    previous_oi = get_previous_oi(option_contract, days_ago=1)

    if previous_oi == 0:
        return None  # New listing

    oi_change_pct = (current_oi - previous_oi) / previous_oi

    if oi_change_pct >= 0.20:  # 20% increase
        return {
            'type': 'OI_SPIKE',
            'change_pct': oi_change_pct,
            'current': current_oi,
            'previous': previous_oi,
            'absolute_change': current_oi - previous_oi
        }

    return None
```

**Interpretation**:

- Large OI increase = New positioning
- OI at specific strikes = Potential support/resistance
- OI in ITM options = May exercise/assignment expected

### 3. Premium Flow Tracking

**Concept**: Calculate total premium spent on options contracts

```python
def analyze_premium_flow(ticker, option_contracts, time_window='1d'):
    total_premium_flow = 0
    aggressive_orders = 0

    for contract in option_contracts:
        trades = get_time_and_sales(contract, window=time_window)

        for trade in trades:
            premium = trade.price * trade.size * 100  # Contracts to dollars
            total_premium_flow += premium

            # Check if trade was at ask (aggressive buying)
            if trade.price >= trade.ask:
                aggressive_orders += 1

    aggressive_pct = aggressive_orders / len(trades) if trades else 0

    if total_premium_flow >= 100000 and aggressive_pct >= 0.7:
        return {
            'type': 'LARGE_PREMIUM_FLOW',
            'total_premium': total_premium_flow,
            'aggressive_pct': aggressive_pct,
            'trade_count': len(trades)
        }

    return None
```

**Thresholds**:

- **$100k+**: Moderate positioning
- **$500k+**: Large positioning
- **$1M+**: Institutional-sized

### 4. Sweep Order Detection

**Concept**: Identify when orders hit multiple exchanges simultaneously

```python
def detect_sweep_order(ticker, option_contract, time_window=5):
    """
    Sweep = Single large order split across multiple exchanges
    Indicates urgency and unwillingness to wait for limit fills
    """
    trades = get_time_and_sales_with_exchanges(
        contract,
        window_seconds=time_window
    )

    # Group trades by timestamp (within 1 second)
    trade_groups = group_trades_by_time(trades, tolerance=1.0)

    for group in trade_groups:
        unique_exchanges = set([t.exchange for t in group])
        total_volume = sum([t.size for t in group])

        if len(unique_exchanges) >= 3 and total_volume >= 100:
            return {
                'type': 'SWEEP_ORDER',
                'exchanges_hit': len(unique_exchanges),
                'total_contracts': total_volume,
                'premium': calculate_premium(group),
                'timestamp': group[0].timestamp
            }

    return None
```

**Significance**:

- Sweeps show urgency
- Willing to pay market prices
- Often precedes large moves
- Higher conviction signal

### 5. Put/Call Ratio Analysis

**Concept**: Compare put volume to call volume for directional bias

```python
def analyze_put_call_ratio(ticker, time_window='1d'):
    calls = get_option_chain(ticker, option_type='call')
    puts = get_option_chain(ticker, option_type='put')

    call_volume = sum([c.volume for c in calls])
    put_volume = sum([p.volume for p in puts])

    put_call_ratio = put_volume / call_volume if call_volume > 0 else 0

    # Compare to historical average
    avg_pc_ratio = get_avg_put_call_ratio(ticker, days=30)
    ratio_deviation = abs(put_call_ratio - avg_pc_ratio) / avg_pc_ratio

    if ratio_deviation >= 0.50:  # 50% deviation from norm
        if put_call_ratio < avg_pc_ratio:
            bias = 'BULLISH'  # More calls than usual
        else:
            bias = 'BEARISH'  # More puts than usual

        return {
            'type': 'PC_RATIO_ANOMALY',
            'current_ratio': put_call_ratio,
            'average_ratio': avg_pc_ratio,
            'deviation': ratio_deviation,
            'bias': bias
        }

    return None
```

## 📊 Signal Scoring Algorithm

### Multi-Factor Score Calculation

```python
def calculate_signal_score(detections, ticker_data):
    """
    Weighted scoring across multiple factors
    Returns: float between 0.0 and 1.0
    """

    # Factor 1: Volume Score (30%)
    volume_score = calculate_volume_score(detections.get('VOLUME_ANOMALY'))

    # Factor 2: Premium Flow Score (25%)
    premium_score = calculate_premium_score(detections.get('LARGE_PREMIUM_FLOW'))

    # Factor 3: Open Interest Score (20%)
    oi_score = calculate_oi_score(detections.get('OI_SPIKE'))

    # Factor 4: Historical Performance Score (15%)
    history_score = get_historical_accuracy(ticker_data, detections)

    # Factor 5: Technical Alignment Score (10%)
    technical_score = check_technical_alignment(ticker_data, detections)

    # Weighted combination
    overall_score = (
        volume_score * 0.30 +
        premium_score * 0.25 +
        oi_score * 0.20 +
        history_score * 0.15 +
        technical_score * 0.10
    )

    # Bonus for sweep detection (adds up to 0.15)
    if detections.get('SWEEP_ORDER'):
        overall_score = min(overall_score + 0.15, 1.0)

    return overall_score


def assign_grade(score):
    """Convert numerical score to letter grade"""
    if score >= 0.90:
        return 'S'
    elif score >= 0.80:
        return 'A'
    elif score >= 0.70:
        return 'B'
    elif score >= 0.60:
        return 'C'
    elif score >= 0.50:
        return 'D'
    else:
        return 'F'
```

### Risk Scoring

```python
def calculate_risk_score(ticker, detections, market_data):
    """
    Assess risk factors that might reduce signal quality
    Returns: risk_level ('LOW', 'MEDIUM', 'HIGH', 'EXTREME')
    """

    risk_factors = []

    # 1. Liquidity Risk
    avg_volume = get_avg_daily_volume(ticker, days=20)
    if avg_volume < 1_000_000:
        risk_factors.append({
            'factor': 'LOW_LIQUIDITY',
            'severity': 'HIGH',
            'description': 'Low average volume may cause manipulation'
        })

    # 2. Volatility Risk
    iv_rank = get_implied_volatility_rank(ticker)
    if iv_rank > 80:
        risk_factors.append({
            'factor': 'HIGH_IV',
            'severity': 'MEDIUM',
            'description': 'Elevated IV may reduce signal quality'
        })

    # 3. Event Risk
    days_to_earnings = get_days_to_earnings(ticker)
    if 0 < days_to_earnings < 7:
        risk_factors.append({
            'factor': 'EARNINGS_IMMINENT',
            'severity': 'HIGH',
            'description': 'Near-term earnings add uncertainty'
        })

    # 4. Market Cap Risk
    market_cap = get_market_cap(ticker)
    if market_cap < 1_000_000_000:  # < $1B
        risk_factors.append({
            'factor': 'SMALL_CAP',
            'severity': 'MEDIUM',
            'description': 'Smaller companies have higher manipulation risk'
        })

    # 5. Sentiment Risk
    if detections.get('PC_RATIO_ANOMALY'):
        pc_data = detections['PC_RATIO_ANOMALY']
        if pc_data['deviation'] > 1.0:  # Extreme deviation
            risk_factors.append({
                'factor': 'EXTREME_SENTIMENT',
                'severity': 'MEDIUM',
                'description': 'Extreme sentiment may indicate overreaction'
            })

    # Calculate overall risk level
    high_severity_count = sum(1 for r in risk_factors if r['severity'] == 'HIGH')
    medium_severity_count = sum(1 for r in risk_factors if r['severity'] == 'MEDIUM')

    if high_severity_count >= 2:
        risk_level = 'EXTREME'
    elif high_severity_count >= 1 or medium_severity_count >= 3:
        risk_level = 'HIGH'
    elif medium_severity_count >= 1:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    return {
        'risk_level': risk_level,
        'risk_factors': risk_factors,
        'risk_count': len(risk_factors)
    }
```

## 🔄 Signal Lifecycle

### Signal States

Signals in the system progress through the following lifecycle:

#### 1. **NEW** → Initial Detection

- Signal is detected for the first time
- `is_new_signal = TRUE`
- `is_active = TRUE`
- `detection_count = 1`

#### 2. **CONTINUING** → Re-detection

- Same option contract detected in subsequent scans
- `is_new_signal = FALSE`
- `is_active = TRUE`
- `detection_count` increments
- `last_detected_at` updates

#### 3. **INACTIVE** → Contract Expired

- Option contract has passed expiration date
- `is_active = FALSE`
- `expiry < CURRENT_DATE`
- Signal archived but not shown to frontend

### What Does "Inactive" Mean?

**A signal becomes inactive when the option contract expires**,
making it no longer tradeable. This is the ONLY condition that
marks a signal as inactive.

**Key Points:**

- ✅ Signals stay active until option expiration date
- ✅ Not detecting a signal for hours/days does NOT make it inactive
- ✅ Only frontend shows active signals (non-expired contracts)
- ✅ Inactive signals remain in database for historical analysis

**Example:**

```
Signal: AAPL 185C 2025-01-17
Created: 2025-01-10 (is_active = TRUE)
Re-detected: 2025-01-11, 2025-01-12, 2025-01-15 (still active)
Last scan: 2025-01-16 (not detected, but still active)
Expiration: 2025-01-17 → Signal marked INACTIVE
```

**Important History:**
Prior to November 2025, there was a bug where signals were
incorrectly marked inactive after 3 hours without detection.
This was fixed - signals now ONLY go inactive on contract expiration.

### Continuity Tracking

The system automatically deduplicates signals across scans:

```python
# Continuity Matching Criteria
def is_same_signal(signal_a, signal_b):
    return (
        signal_a.ticker == signal_b.ticker and
        signal_a.option_symbol == signal_b.option_symbol and
        signal_a.strike == signal_b.strike and
        signal_a.expiry == signal_b.expiry and
        signal_a.option_type == signal_b.option_type
    )
```

**Benefits:**

- No duplicate signals cluttering the database
- Track how long unusual activity persists
- Distinguish new opportunities from ongoing ones
- Build complete signal history timeline

## 🔄 Data Flow

### Typical Scan Workflow

1. **Input**: User provides ticker(s) or watchlist
2. **Data Fetch**: Retrieve options chain from provider
3. **Historical Context**: Load 20-day historical volume/OI
4. **Detection**: Run all detection algorithms
5. **Scoring**: Calculate multi-factor score
6. **Grading**: Assign letter grade (S/A/B/C/D/F)
7. **Risk Assessment**: Evaluate risk factors
8. **Storage**: Save signal to Supabase with continuity check
9. **Expiry Management**: Mark expired contracts as inactive
10. **Alert**: Send notification if grade meets threshold
11. **Output**: Display results to user

### Performance Tracking Workflow

1. **Signal Creation**: Store signal with entry price
2. **Monitoring**: Track underlying price over time
3. **Return Calculation**: Measure forward returns (1d, 5d, 30d)
4. **Win/Loss Classification**: Did underlying move as predicted?
5. **Historical Update**: Feed back into historical performance database
6. **Algorithm Adjustment**: Use to improve detection thresholds

## 💾 Data Models

### Signal Data Structure

```python
@dataclass
class UnusualOptionsSignal:
    # Identity
    signal_id: str
    ticker: str
    timestamp: datetime

    # Option Details
    option_symbol: str
    strike: float
    expiry: date
    option_type: str  # 'call' or 'put'

    # Volume Metrics
    current_volume: int
    average_volume: float
    volume_ratio: float

    # Open Interest Metrics
    current_oi: int
    previous_oi: int
    oi_change_pct: float

    # Premium Metrics
    premium_flow: float
    aggressive_order_pct: float

    # Detection Flags
    has_sweep: bool
    has_block_trade: bool
    has_unusual_spread: bool

    # Scoring
    overall_score: float
    grade: str  # S, A, B, C, D, F
    confidence: float

    # Risk Assessment
    risk_level: str  # LOW, MEDIUM, HIGH, EXTREME
    risk_factors: List[str]

    # Market Context
    underlying_price: float
    implied_volatility: float
    days_to_expiry: int
    moneyness: str  # ITM, ATM, OTM

    # Directional Bias
    sentiment: str  # BULLISH, BEARISH, NEUTRAL
    put_call_ratio: float

    # Performance Tracking (filled over time)
    forward_return_1d: Optional[float]
    forward_return_5d: Optional[float]
    forward_return_30d: Optional[float]
    win: Optional[bool]
```

## 🎯 Success Criteria

### What Makes a Good Signal?

1. **Multiple Confirmations**: Several detection types fire simultaneously
2. **Large Premium Flow**: Significant capital deployed (> $500k)
3. **Technical Alignment**: Price action supports the thesis
4. **Low Risk Factors**: Liquid ticker, no immediate catalysts
5. **Historical Accuracy**: Similar signals have worked in the past

### What to Avoid

1. **Single Factor Signals**: Only volume spike, nothing else
2. **Low Liquidity Tickers**: Easily manipulated
3. **Pre-Earnings Noise**: May be hedging, not directional
4. **Extreme IV**: Expensive options reduce edge
5. **Crowded Trades**: If everyone knows, edge is gone

## 📈 Expected Performance

### Realistic Expectations

- **Win Rate**: 50-60% on B+ grade signals
- **Average Winner**: +5-15% on underlying within 5 days
- **Average Loser**: -3-8% on underlying within 5 days
- **False Positives**: ~30-40% of signals will be noise

### Edge Source

The edge comes from:

1. **Speed**: Acting before signal is widely known
2. **Quality Filtering**: Grading system reduces noise
3. **Risk Management**: Position sizing based on grade
4. **Diversification**: Running multiple signals simultaneously

## 🚦 Next Steps

1. **Read** [Detection Algorithms](detection-algorithms.md) for implementation details
2. **Review** [Database Schema](database-schema.md) for storage design
3. **Explore** [CLI Reference](cli-reference.md) for command usage
4. **Study** [Signal Interpretation](signal-interpretation.md) for trading application

---

**Remember**: This system helps you find opportunities, but YOU must do the analysis, risk management, and execution. The scanner is a tool, not a crystal ball.
