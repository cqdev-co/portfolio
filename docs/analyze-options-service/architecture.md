# Analyze Options Service - Architecture

**Last Updated:** November 5, 2025  
**Version:** 1.0.0  
**Status:** Planning & Initial Development

---

## 🎯 Purpose

The Analyze Options Service transforms unusual options signals into actionable trades by:
1. Analyzing risk/reward profiles of detected signals
2. Comparing vertical spreads vs naked options strategies
3. Calculating optimal position sizes
4. Ranking opportunities by expected value and probability
5. Providing ready-to-execute trade recommendations

---

## 🏗 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Analyze Options Service                         │
│                                                                       │
│  Input: Unusual Options Signals (from unusual-options-service)       │
│  Output: Ranked Trade Recommendations with Position Sizing           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼────────┐         ┌────────▼───────┐
            │  Signal Fetcher │         │ Market Data    │
            │  (Supabase)     │         │ Provider       │
            └───────┬────────┘         └────────┬───────┘
                    │                           │
                    └─────────────┬─────────────┘
                                  │
                          ┌───────▼────────┐
                          │  Signal        │
                          │  Enrichment    │
                          └───────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
          ┌─────────▼─────────┐       ┌────────▼────────┐
          │  Vertical Spread  │       │  Naked Options  │
          │  Analyzer         │       │  Analyzer       │
          └─────────┬─────────┘       └────────┬────────┘
                    │                           │
                    └─────────────┬─────────────┘
                                  │
                          ┌───────▼────────┐
                          │  Strategy      │
                          │  Comparison    │
                          └───────┬────────┘
                                  │
                          ┌───────▼────────┐
                          │  Position      │
                          │  Sizing        │
                          └───────┬────────┘
                                  │
                          ┌───────▼────────┐
                          │  Trade         │
                          │  Recommender   │
                          └───────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼────────┐         ┌────────▼───────┐
            │  Rich CLI      │         │  JSON Export   │
            │  Dashboard     │         │  / API         │
            └────────────────┘         └────────────────┘
```

---

## 📦 Module Breakdown

### 1. Signal Fetcher (`src/analyze_options/fetcher.py`)

**Responsibility:** Retrieve and filter unusual options signals

**Key Functions:**
```python
async def fetch_signals(
    min_grade: str = 'A',
    lookback_days: int = 7,
    min_premium_flow: float = 100000,
    min_dte: int = 7,
    max_dte: int = 60
) -> List[UnusualOptionsSignal]
```

**Filters Applied:**
- Grade threshold (S/A/B only)
- Time window (last N days)
- Premium flow minimum (institutional-sized)
- DTE range (avoid 0DTE noise, focus near-term)
- Active signals only (not expired)
- Liquidity requirements (volume, OI, bid-ask spread)

**Data Source:**
- Supabase `unusual_options_signals` table
- Reuses connection from unusual-options-service

---

### 2. Market Data Provider (`src/analyze_options/data/market_data.py`)

**Responsibility:** Fetch current option chain and pricing data

**Key Functions:**
```python
async def get_option_chain(
    ticker: str,
    expiry: date
) -> OptionChain

async def get_current_price(ticker: str) -> float

async def get_technical_indicators(
    ticker: str
) -> TechnicalIndicators  # RSI, MA, momentum

async def get_implied_volatility(
    ticker: str,
    strike: float,
    expiry: date,
    option_type: str
) -> float
```

**Data Source:**
- **yfinance** (primary and only source - free, reliable)

**Performance Optimization:**
- Only fetch data for tickers with signals in database
- Batch fetch tickers to minimize API calls
- Cache data for 15 minutes

**Caching Strategy:**
- Option chains: 15-minute TTL
- Current prices: 5-minute TTL
- Technical indicators: 15-minute TTL

---

### 3. Vertical Spread Analyzer (`src/analyze_options/analyzers/vertical_spread.py`)

**Responsibility:** Calculate optimal vertical spread configurations

**Analysis Pipeline:**
```
1. Identify spread type (bull call or bear put)
   ↓
2. Select optimal strikes
   ↓
3. Calculate costs and payoffs
   ↓
4. Compute break-even points
   ↓
5. Estimate probability of profit
   ↓
6. Calculate expected value
   ↓
7. Aggregate Greeks
   ↓
8. Generate quality score
```

**Strike Selection Algorithm:**

For **Bull Call Spreads** (bullish signals):
```python
# Long Strike: ATM or slightly OTM
long_strike = next_strike_above(current_price)

# Short Strike: 5-10% OTM to maximize credit
target_price = current_price * 1.05  # 5% move target
short_strike = nearest_strike(target_price)

# Validate strike width
strike_width = short_strike - long_strike
if strike_width < min_width or strike_width > max_width:
    adjust_strikes()
```

For **Bear Put Spreads** (bearish signals):
```python
# Long Strike: ATM or slightly ITM
long_strike = next_strike_below(current_price)

# Short Strike: 5-10% OTM (below)
target_price = current_price * 0.95
short_strike = nearest_strike(target_price)
```

**Cost Calculation:**
```python
net_debit = long_option_premium - short_option_premium
max_profit = strike_width - net_debit
max_loss = net_debit
risk_reward_ratio = max_profit / max_loss
```

**Probability of Profit:**
```python
# Method 1: Delta-based approximation
prob_profit_long = abs(long_option_delta)
prob_profit_short = abs(short_option_delta)
prob_profit_spread = prob_profit_long - prob_profit_short

# Method 2: Black-Scholes probability
prob_itm = black_scholes_probability(
    current_price=current_price,
    strike=breakeven_price,
    time_to_expiry=dte / 365,
    volatility=implied_volatility,
    risk_free_rate=0.05
)
```

---

### 4. Naked Options Analyzer (`src/analyze_options/analyzers/naked_options.py`)

**Responsibility:** Evaluate naked call/put risk and reward

**Analysis Pipeline:**
```
1. Identify optimal strike (delta sweet spot)
   ↓
2. Calculate premium cost
   ↓
3. Compute break-even
   ↓
4. Estimate probability of various outcomes
   ↓
5. Calculate Greeks exposure
   ↓
6. Assess capital requirements
   ↓
7. Generate risk warnings
   ↓
8. Produce quality score
```

**Strike Selection for Naked Options:**
```python
# Sweet spot: Delta 0.30-0.50
# Higher delta = higher prob, higher cost
# Lower delta = lower prob, cheaper, more leverage

def select_optimal_strike(
    option_chain: OptionChain,
    target_delta: float = 0.40
) -> float:
    """
    Find strike closest to target delta
    Target 0.40 = 40% probability of profit
    Balance of probability and leverage
    """
    candidates = [
        opt for opt in option_chain
        if 0.30 <= abs(opt.delta) <= 0.50
    ]
    return min(candidates, key=lambda x: abs(x.delta - target_delta))
```

**Probability Analysis:**
```python
# Multiple probability thresholds
prob_profit = abs(option.delta)  # Any profit
prob_50pct_gain = prob_reach_price(target=breakeven * 1.25)
prob_100pct_gain = prob_reach_price(target=breakeven * 1.50)
prob_200pct_gain = prob_reach_price(target=breakeven * 2.00)
```

**Theta Decay Assessment:**
```python
daily_theta = option.theta
days_until_50pct_decay = premium / (2 * abs(daily_theta))

# Warning if theta decay too aggressive
if dte < 14 or days_until_50pct_decay < 5:
    warnings.append("HIGH_THETA_DECAY")
```

---

### 5. Strategy Comparison Engine (`src/analyze_options/analyzers/strategy_comparison.py`)

**Responsibility:** Compare vertical spread vs naked option for each signal

**Comparison Metrics:**

| Metric | Vertical Spread | Naked Option |
|--------|-----------------|--------------|
| **Cost** | Lower (net debit) | Higher (full premium) |
| **Max Profit** | Defined (strike width - debit) | Unlimited (calls) / Large (puts) |
| **Max Loss** | Defined (net debit) | 100% (premium) |
| **Risk/Reward** | 1:2 to 1:4 typical | 1:2 to 1:10+ |
| **Prob Profit** | Higher (45-60%) | Lower (30-45%) |
| **Capital Efficiency** | Better (smaller debit) | Worse (full premium) |
| **Theta Decay** | Moderate (spread offsets) | High (full decay) |

**Decision Logic:**
```python
def recommend_strategy(
    spread: VerticalSpreadAnalysis,
    naked: NakedOptionsAnalysis,
    signal: UnusualOptionsSignal,
    risk_tolerance: str = "conservative"
) -> str:
    """
    Comprehensive decision tree for strategy selection
    """
    
    # Safety checks (both strategies)
    if spread.probability_of_profit < 0.30:
        return "SKIP"  # Too risky regardless
    
    # Cost comparison
    cost_ratio = naked.premium_cost / spread.net_debit
    
    # Expected value comparison
    spread_ev = (
        spread.probability_of_profit * spread.max_profit -
        (1 - spread.probability_of_profit) * spread.max_loss
    )
    
    naked_ev = (
        naked.probability_of_profit * naked.expected_profit -
        (1 - naked.probability_of_profit) * naked.max_loss
    )
    
    ev_ratio = naked_ev / spread_ev if spread_ev > 0 else 0
    
    # Risk tolerance logic
    if risk_tolerance == "conservative":
        # Prefer spreads unless naked is significantly better
        if ev_ratio > 2.0 and naked.premium_cost < 500:
            return "NAKED_CALL"
        return "VERTICAL_SPREAD"
    
    elif risk_tolerance == "moderate":
        # Balance expected value and cost
        if ev_ratio > 1.5:
            return "NAKED_CALL"
        elif spread.risk_reward_ratio > 2.5:
            return "VERTICAL_SPREAD"
        else:
            return "NAKED_CALL"
    
    else:  # aggressive
        # Prefer unlimited upside
        if naked.premium_cost < 1000:
            return "NAKED_CALL"
        return "VERTICAL_SPREAD"
```

---

### 6. Position Sizing Calculator (`src/analyze_options/analyzers/position_sizing.py`)

**Responsibility:** Calculate optimal position size based on risk parameters

**Methods:**

#### **1. Fixed Risk Percentage (Primary Method)**

Most straightforward and safest approach:

```python
def calculate_fixed_risk_position(
    account_size: float,
    max_risk_pct: float,  # 1-2%
    strategy_max_loss: float,  # Per contract
    signal_grade: str
) -> int:
    """
    Calculate contracts based on fixed risk percentage
    
    Rule: Never risk more than 1-2% per trade
    Adjust by signal grade:
    - S grade: 2.0%
    - A grade: 1.5%
    - B grade: 1.0%
    """
    
    # Adjust risk by signal quality
    grade_multipliers = {'S': 1.0, 'A': 0.75, 'B': 0.5}
    adjusted_risk_pct = max_risk_pct * grade_multipliers.get(signal_grade, 0.5)
    
    max_risk_dollars = account_size * (adjusted_risk_pct / 100)
    contracts = int(max_risk_dollars / strategy_max_loss)
    
    return max(1, contracts)  # At least 1 contract
```

#### **2. Kelly Criterion (Advanced Method)**

For experienced traders with historical data:

```python
def calculate_kelly_position(
    account_size: float,
    win_rate: float,
    avg_win: float,
    avg_loss: float,
    kelly_fraction: float = 0.5  # Use half-Kelly for safety
) -> float:
    """
    Kelly Criterion: Optimal fraction of capital to risk
    
    Formula: f = (p * b - q) / b
    Where:
    - p = win rate
    - q = loss rate (1 - p)
    - b = win/loss ratio
    
    We use half-Kelly to avoid over-leveraging
    """
    
    win_loss_ratio = avg_win / avg_loss
    kelly_pct = (win_rate * win_loss_ratio - (1 - win_rate)) / win_loss_ratio
    
    # Apply fractional Kelly for safety
    adjusted_kelly = kelly_pct * kelly_fraction
    
    # Cap at 5% regardless of Kelly output
    position_pct = max(0.01, min(adjusted_kelly, 0.05))
    
    position_size = account_size * position_pct
    
    return position_size
```

#### **3. Greeks-Based Portfolio Management**

Manage aggregate portfolio exposure:

```python
def calculate_greeks_adjusted_position(
    account_size: float,
    new_position_delta: float,
    new_position_theta: float,
    current_portfolio_delta: float,
    current_portfolio_theta: float,
    max_portfolio_delta_pct: float = 0.25  # Max 25% directional exposure
) -> int:
    """
    Adjust position size to maintain portfolio Greeks within limits
    """
    
    # Check delta exposure
    available_delta = (account_size * max_portfolio_delta_pct) - abs(current_portfolio_delta)
    
    if available_delta <= 0:
        return 0  # Portfolio already at delta limit
    
    # Calculate max contracts based on delta
    max_contracts_delta = int(available_delta / abs(new_position_delta))
    
    # Check theta exposure (max $500/day theta decay for $100k account)
    max_theta = account_size * 0.005
    available_theta = max_theta - abs(current_portfolio_theta)
    max_contracts_theta = int(available_theta / abs(new_position_theta))
    
    # Return smaller of the two
    return min(max_contracts_delta, max_contracts_theta)
```

**Portfolio Rules:**
- Max 5 positions simultaneously
- Max 20% of account in options
- Max portfolio delta: ±25% of account
- Max daily theta: 0.5% of account

---

### 7. Technical Analysis Filter (`src/analyze_options/analyzers/technical_filter.py`)

**Purpose:** Filter out bad setups using technical indicators (RSI, MA, momentum)

**Safety Checks:**
```python
def should_skip_signal(
    signal: EnrichedSignal,
    technical_data: TechnicalIndicators
) -> tuple[bool, Optional[str]]:
    """
    Filter out signals with poor technical setup
    Returns: (should_skip, reason)
    """
    
    # RSI checks - avoid overbought/oversold
    if signal.sentiment == "BULLISH" and technical_data.rsi > 70:
        return True, "RSI overbought (>70) - avoid buying calls"
    
    if signal.sentiment == "BEARISH" and technical_data.rsi < 30:
        return True, "RSI oversold (<30) - avoid buying puts"
    
    # Moving average trend checks
    if signal.sentiment == "BULLISH":
        if technical_data.price < technical_data.ma_50:
            return True, "Price below 50-day MA - bearish trend"
        if technical_data.ma_50 < technical_data.ma_200:
            return True, "Death cross pattern - long-term bearish"
    
    if signal.sentiment == "BEARISH":
        if technical_data.price > technical_data.ma_50:
            return True, "Price above 50-day MA - bullish trend"
        if technical_data.ma_50 > technical_data.ma_200:
            return True, "Golden cross pattern - long-term bullish"
    
    # Momentum check
    if abs(technical_data.momentum_5d) < 0.01:
        return True, "No momentum - sideways price action"
    
    # Volume check
    if technical_data.volume_ratio < 0.5:
        return True, "Low volume - poor liquidity"
    
    return False, None
```

**Indicators Tracked:**
- **RSI (14-day)**: Overbought (>70) / Oversold (<30) detection
- **MA (50-day, 200-day)**: Trend direction and strength
- **Momentum (5-day)**: Recent price velocity
- **Volume Ratio**: Current vs average volume

**Filter Priority:**
1. Technical filter runs BEFORE strategy analysis
2. Bad setups are excluded immediately
3. Saves compute time by not analyzing doomed trades
4. Only high-conviction opportunities proceed

---

### 8. Trade Recommender (`src/analyze_options/recommender.py`)

**Responsibility:** Rank opportunities and generate actionable recommendations

**Scoring System (0-100):**

```python
def calculate_opportunity_score(
    signal: UnusualOptionsSignal,
    analysis: Union[VerticalSpreadAnalysis, NakedOptionsAnalysis],
    comparison: StrategyComparison
) -> float:
    """
    Composite scoring: 0-100
    Higher score = better opportunity
    """
    
    # 1. Signal Grade Score (25%)
    grade_scores = {'S': 100, 'A': 85, 'B': 70, 'C': 50, 'D': 30, 'F': 0}
    grade_score = grade_scores.get(signal.grade, 0)
    
    # 2. Expected Value Score (25%)
    # Normalize expected value to 0-100 scale
    ev = analysis.expected_value
    ev_score = min(100, max(0, (ev / 100) * 100))  # $100 EV = 100 points
    
    # 3. Probability of Profit Score (20%)
    # 30% prob = 60 pts, 50% prob = 100 pts
    pop_score = min(100, (analysis.probability_of_profit / 0.50) * 100)
    
    # 4. Risk/Reward Ratio Score (15%)
    # 2:1 = 75 pts, 3:1 = 100 pts
    rr_score = min(100, (analysis.risk_reward_ratio / 3.0) * 100)
    
    # 5. Liquidity Score (10%)
    # Tight bid-ask spread + high OI
    liquidity_score = calculate_liquidity_score(signal)
    
    # 6. Catalyst Proximity Bonus (5%)
    catalyst_score = 0
    if signal.days_to_earnings:
        if 5 <= signal.days_to_earnings <= 21:
            catalyst_score = 100  # Sweet spot before earnings
        elif 1 <= signal.days_to_earnings <= 4:
            catalyst_score = 50  # Too close (risky)
        else:
            catalyst_score = 20  # Far from catalyst
    
    # Weighted composite
    composite_score = (
        grade_score * 0.25 +
        ev_score * 0.25 +
        pop_score * 0.20 +
        rr_score * 0.15 +
        liquidity_score * 0.10 +
        catalyst_score * 0.05
    )
    
    return round(composite_score, 1)
```

**Ranking & Filtering:**
```python
def rank_opportunities(
    analyses: List[StrategyComparison],
    max_recommendations: int = 5,
    min_score: float = 70.0
) -> List[TradeRecommendation]:
    """
    Rank and filter to top opportunities
    """
    
    # Calculate scores
    scored_opportunities = [
        (analysis, calculate_opportunity_score(analysis))
        for analysis in analyses
    ]
    
    # Filter by minimum score
    filtered = [
        (analysis, score) 
        for analysis, score in scored_opportunities 
        if score >= min_score
    ]
    
    # Sort by score descending
    sorted_opportunities = sorted(
        filtered, 
        key=lambda x: x[1], 
        reverse=True
    )
    
    # Return top N
    return [
        create_recommendation(analysis, score)
        for analysis, score in sorted_opportunities[:max_recommendations]
    ]
```

**Recommendation Output:**
```python
@dataclass
class TradeRecommendation:
    # Identity
    rank: int  # 1-5
    score: float  # 0-100
    recommendation_type: str  # "STRONG_BUY" | "BUY" | "CONSIDER"
    
    # Signal Context
    ticker: str
    signal_id: str
    signal_grade: str
    sentiment: str  # BULLISH/BEARISH
    
    # Strategy Details
    strategy: str  # "VERTICAL_SPREAD" | "NAKED_CALL" | "NAKED_PUT"
    long_strike: float
    short_strike: Optional[float]  # None for naked options
    expiry: date
    option_type: str  # "call" | "put"
    days_to_expiry: int
    
    # Cost & Payoff
    net_cost: float  # Per contract
    total_cost: float  # For recommended position size
    max_profit: float  # Per contract
    max_loss: float  # Per contract
    risk_reward_ratio: float
    break_even_price: float
    break_even_move_pct: float
    
    # Probability
    probability_of_profit: float
    expected_value: float  # Per contract
    
    # Position Sizing
    recommended_contracts: int
    position_pct: float  # % of account
    max_risk_dollars: float
    max_profit_dollars: float
    
    # Greeks (aggregate)
    delta: float
    theta: float
    vega: float
    
    # Reasoning
    why_buy: List[str]  # Bullet points
    considerations: List[str]  # Cautions/warnings
    alternative_strategy: Optional[str]  # If applicable
    
    # Actionable Details
    execution_notes: str
    stop_loss: Optional[float]
    profit_target: Optional[float]
```

---

## 🔄 Data Flow

### Complete Pipeline

```
1. User initiates scan
   ↓
   
2. Fetch signals from Supabase
   - Filter by grade (A+)
   - Filter by date range
   - Filter by DTE (7-60 days)
   ↓
   
3. Enrich signals with current market data
   - Current underlying price
   - Option chain data
   - Implied volatility
   ↓
   
4. For each signal:
   a. Analyze vertical spread strategy
   b. Analyze naked option strategy
   c. Compare strategies
   d. Calculate position size
   e. Generate score
   ↓
   
5. Rank all opportunities
   - Sort by score
   - Filter by minimum threshold
   - Select top 5
   ↓
   
6. Generate recommendations
   - Detailed analysis
   - Ready-to-execute details
   - Risk warnings
   ↓
   
7. Display to user
   - Rich CLI dashboard
   - Export to JSON (optional)
   ↓
   
8. User selects trade
   - Review details
   - Execute (manual or via broker API)
   - Track performance
```

---

## 🗄 Data Models

### Core Models

**EnrichedSignal**
```python
@dataclass
class EnrichedSignal:
    """Signal with current market data"""
    
    # From unusual_options_signals table
    signal: UnusualOptionsSignal
    
    # Fresh market data
    current_price: float
    current_iv: float
    option_chain: OptionChain
    
    # Calculated
    days_to_expiry: int  # Recalculated
    time_to_expiry: float  # Years
    moneyness_fresh: str  # Updated ITM/ATM/OTM
```

**VerticalSpreadAnalysis**
```python
@dataclass
class VerticalSpreadAnalysis:
    strategy_type: str  # "BULL_CALL_SPREAD" | "BEAR_PUT_SPREAD"
    long_strike: float
    short_strike: float
    strike_width: float
    net_debit: float
    max_profit: float
    max_loss: float
    risk_reward_ratio: float
    breakeven_price: float
    breakeven_move_pct: float
    probability_of_profit: float
    expected_value: float
    delta: float
    theta: float
    vega: float
    quality_score: float
```

**NakedOptionsAnalysis**
```python
@dataclass
class NakedOptionsAnalysis:
    strategy_type: str  # "NAKED_CALL" | "NAKED_PUT"
    strike: float
    premium_cost: float
    max_profit: float  # Unlimited or cap
    max_loss: float  # = premium
    breakeven_price: float
    breakeven_move_pct: float
    probability_of_profit: float
    probability_of_50pct_gain: float
    probability_of_100pct_gain: float
    expected_value: float
    delta: float
    theta: float
    vega: float
    implied_volatility: float
    quality_score: float
    risk_warnings: List[str]
```

---

## 🛠 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Language** | Python 3.11+ | Modern, type-safe Python |
| **Framework** | Click/Typer | CLI interface |
| **Data Models** | Pydantic v2 | Validation, serialization |
| **UI** | Rich | Beautiful CLI output |
| **Database** | Supabase (PostgreSQL) | Signal storage |
| **Market Data** | Polygon.io / yfinance | Real-time option data |
| **Math** | NumPy, SciPy | Calculations, Black-Scholes |
| **Data** | pandas | Data manipulation |
| **Testing** | pytest, pytest-asyncio | Unit/integration tests |
| **Packaging** | Poetry | Dependency management |
| **Logging** | loguru | Structured logging |

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Week 1)
- ✅ Architecture design
- ✅ Documentation
- Project setup (pyproject.toml)
- Signal fetcher module
- Data models (Pydantic)
- Supabase client

### Phase 2: Core Analyzers (Week 2)
- Vertical spread analyzer
- Naked options analyzer
- Greeks calculator
- Black-Scholes pricer
- Probability calculator

### Phase 3: Comparison & Ranking (Week 3)
- Strategy comparison engine
- Position sizing calculator
- Trade recommender
- Scoring system

### Phase 4: CLI & Integration (Week 4)
- Rich CLI dashboard
- Command routing
- Output formatting
- Integration testing

### Phase 5: Enhancement (Future)
- Web dashboard
- Broker API integration
- Performance tracking
- Machine learning enhancements

---

## 🔐 Security & Configuration

**Environment Variables:**
```bash
# Supabase (reuse from unusual-options-service)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Market Data
POLYGON_API_KEY=your_polygon_key  # Preferred
YFINANCE_FALLBACK=true  # Use yfinance if Polygon fails

# Account Configuration
DEFAULT_ACCOUNT_SIZE=10000  # For position sizing
DEFAULT_RISK_PCT=1.5  # 1.5% risk per trade
RISK_TOLERANCE=conservative  # conservative | moderate | aggressive

# Analysis Parameters
MIN_SIGNAL_GRADE=A
DEFAULT_LOOKBACK_DAYS=7
MIN_PREMIUM_FLOW=100000
MIN_DTE=7
MAX_DTE=60
```

---

## 📊 Performance & Monitoring

**Key Metrics to Track:**
- Signal conversion rate (signals → recommendations)
- Win rate by strategy type
- Average return per trade
- Position sizing accuracy
- Execution latency (scan to recommendation)

**Logging:**
- All decisions logged with reasoning
- Performance data fed back to unusual-options-service
- Error handling and alerts

---

## 🧪 Testing Strategy

1. **Unit Tests**: Each module in isolation
2. **Integration Tests**: Full pipeline with mock data
3. **Backtesting**: Historical signals → retrospective recommendations
4. **Paper Trading**: Forward testing without capital

---

## 🔗 Integration Points

### Unusual Options Service
- **Input**: Pull signals from `unusual_options_signals` table
- **Output**: Feed performance data back to `signal_performance` table

### Volatility Squeeze Scanner
- **Cross-reference**: Combine squeeze + unusual options signals
- **Enhanced conviction**: Both technical & flow alignment

### RDS Ticker Analysis
- **Social sentiment**: Use Reddit sentiment as filter
- **High conviction**: Social + options flow convergence

---

## 📚 References

- **Options Theory**: Black-Scholes model, Greeks
- **Risk Management**: Kelly Criterion, position sizing
- **Strategy Guides**: Vertical spreads, naked options
- **Probability**: Delta-based probability approximations

---

**Status:** Architecture complete, ready for implementation 🚀

