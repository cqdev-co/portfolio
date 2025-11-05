# Analyze Options Service

**Status:** Planning Phase

## 🎯 Mission

Transform unusual options signals into actionable trades by analyzing risk/reward profiles, identifying optimal strategies (vertical spreads vs naked calls), and providing position sizing recommendations.

## 📊 Core Problem

Your unusual-options-service generates high-quality signals (S/A/B grades), but you need to answer:
1. **Which signals are worth trading?** Not all grade-A signals are equal
2. **What strategy should I use?** Vertical spread (cheaper, defined risk) vs Naked call (unlimited upside, higher cost)
3. **How much should I risk?** Position sizing based on signal quality and account size
4. **When to enter/exit?** Timing and exit criteria
5. **What's the expected profit?** Risk/reward ratios and win probability

## 🏗 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Analyze Options Service                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────┐    ┌──────────────┐    ┌─────────────────┐ │
│  │ Signal Fetcher│───▶│  Analyzers   │───▶│  Recommendations│ │
│  └───────────────┘    └──────────────┘    └─────────────────┘ │
│         │                     │                      │          │
│         │              ┌──────┴──────┐              │          │
│         │              │             │               │          │
│         │     ┌────────▼──────┐ ┌───▼─────────┐    │          │
│         │     │ Spread Analyzer│ │Risk Assessor│    │          │
│         │     └────────────────┘ └─────────────┘    │          │
│         │              │                │            │          │
│         │     ┌────────▼──────┐ ┌───────▼──────┐   │          │
│         │     │ Cost Calculator│ │Position Sizer│   │          │
│         │     └────────────────┘ └──────────────┘   │          │
│         │                                            │          │
│         ▼                                            ▼          │
│  ┌─────────────┐                            ┌────────────────┐ │
│  │   Supabase  │                            │   Rich CLI     │ │
│  │  (Signals)  │                            │   Dashboard    │ │
│  └─────────────┘                            └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Fetch Signals
   ↓ (Grade A+ signals from last N days)
   
2. Signal Filtering
   ↓ (Remove expired, filter by liquidity)
   
3. Strategy Analysis
   ↓ (Vertical spreads vs naked calls for each signal)
   
4. Cost/Benefit Calculation
   ↓ (Premium costs, max profit, breakevens)
   
5. Risk Assessment
   ↓ (Probability of profit, max loss, Greeks)
   
6. Position Sizing
   ↓ (Kelly Criterion, 1-2% account risk rule)
   
7. Ranking & Recommendations
   ↓ (Top 5 trades with actionable details)
   
8. Display Results
   (Rich CLI with tables, charts, insights)
```

## 🔬 Core Modules

### 1. Signal Fetcher (`src/fetcher.py`)

**Purpose:** Pull high-quality signals from unusual-options-service database

**Features:**
- Fetch signals with configurable filters (grade, days, min premium flow)
- Enrich with current market data (updated underlying price, IV)
- Filter by liquidity (only liquid options for tight spreads)
- Exclude expired or too-close-to-expiry options

**Inputs:**
- `min_grade: str` (default: 'A')
- `lookback_days: int` (default: 7)
- `min_premium_flow: float` (default: 100000)
- `min_dte: int` (default: 7, avoid weekly gambling)
- `max_dte: int` (default: 60, focus on near-term catalysts)

**Outputs:**
- `List[EnrichedSignal]` with fresh market data

---

### 2. Vertical Spread Analyzer (`src/analyzers/vertical_spread.py`)

**Purpose:** Calculate optimal vertical spread configurations

**Strategy Types:**
1. **Bull Call Spread** (for bullish signals)
   - Buy lower strike call
   - Sell higher strike call
   - Defined risk, defined max profit
   
2. **Bear Put Spread** (for bearish signals)
   - Buy higher strike put
   - Sell lower strike put
   - Defined risk, defined max profit

**Analysis:**
```python
@dataclass
class VerticalSpreadAnalysis:
    # Strategy Details
    strategy_type: str  # "BULL_CALL_SPREAD" | "BEAR_PUT_SPREAD"
    long_strike: float
    short_strike: float
    strike_width: float
    
    # Cost Analysis
    net_debit: float  # Cost to enter spread
    max_profit: float  # strike_width - net_debit
    max_loss: float  # = net_debit
    risk_reward_ratio: float  # max_profit / max_loss
    
    # Break Even
    breakeven_price: float
    breakeven_move_pct: float  # % move needed from current price
    
    # Probability Analysis
    probability_of_profit: float  # Based on IV and delta
    expected_value: float  # prob_win * max_profit - prob_loss * max_loss
    
    # Greeks (aggregate for the spread)
    delta: float  # Directional exposure
    theta: float  # Time decay (spreads have less theta decay)
    vega: float  # IV sensitivity
    
    # Recommended Action
    quality_score: float  # 0-100, composite scoring
    recommendation: str  # "STRONG BUY" | "BUY" | "PASS"
```

**Strike Selection Strategy:**
- **Long Strike:** ATM or slightly OTM (for calls) / slightly ITM (for puts)
- **Short Strike:** 5-10% OTM to capture premium
- Prefer strikes with high open interest (liquidity)

---

### 3. Naked Call Analyzer (`src/analyzers/naked_call.py`)

**Purpose:** Evaluate naked call (or put) risk/reward

**Analysis:**
```python
@dataclass
class NakedOptionsAnalysis:
    # Strategy Details
    strategy_type: str  # "NAKED_CALL" | "NAKED_PUT"
    strike: float
    option_type: str  # "call" | "put"
    
    # Cost Analysis
    premium_cost: float  # Full premium to buy
    max_profit: float  # Theoretically unlimited (call), capped (put)
    max_loss: float  # = premium_cost (100% loss if expires worthless)
    
    # Break Even
    breakeven_price: float  # strike + premium (calls) or strike - premium (puts)
    breakeven_move_pct: float
    
    # Probability Analysis
    probability_of_profit: float  # Based on delta
    probability_of_50pct_gain: float  # Realistic profit target
    probability_of_100pct_gain: float  # Double your money
    expected_value: float
    
    # Greeks
    delta: float  # ~0.30-0.50 sweet spot
    theta: float  # Time decay per day
    vega: float  # IV sensitivity
    implied_volatility: float
    
    # Risk Assessment
    capital_requirement: float  # Cost per contract
    max_contracts_for_1pct_risk: int  # Position sizing
    
    # Recommendation
    quality_score: float
    recommendation: str
    risk_warning: str  # "High theta decay" or "High premium cost"
```

**Sweet Spot Criteria:**
- Delta: 0.30-0.50 (balance of probability and leverage)
- DTE: 14-45 days (avoid extreme theta decay)
- IV Rank: < 50 (not overpaying for volatility)
- Premium: < 5% of account (never risk too much on one option)

---

### 4. Comparison Engine (`src/analyzers/strategy_comparison.py`)

**Purpose:** Compare vertical spread vs naked call for each signal

**Output:**
```python
@dataclass
class StrategyComparison:
    signal_id: str
    ticker: str
    sentiment: str
    
    # Vertical Spread
    spread_analysis: VerticalSpreadAnalysis
    spread_cost: float
    spread_max_profit: float
    spread_risk_reward: float
    spread_pop: float  # Probability of profit
    
    # Naked Options
    naked_analysis: NakedOptionsAnalysis
    naked_cost: float
    naked_max_profit: str  # "UNLIMITED" or actual value
    naked_risk_reward: float
    naked_pop: float
    
    # Winner
    recommended_strategy: str  # "VERTICAL_SPREAD" | "NAKED_CALL" | "SKIP"
    reason: str  # Why this strategy won
    
    # Cost Efficiency
    cost_savings_pct: float  # How much cheaper is spread vs naked
    leverage_comparison: float  # How many spreads vs naked for same capital
```

**Decision Logic:**
```python
def choose_strategy(spread: VerticalSpreadAnalysis, 
                   naked: NakedOptionsAnalysis,
                   risk_tolerance: str) -> str:
    """
    Conservative (default): Prefer spreads unless naked has 2x+ better EV
    Moderate: Choose based on risk/reward and probability
    Aggressive: Prefer naked calls for unlimited upside
    """
    
    # Safety checks
    if spread.probability_of_profit < 0.30:
        return "SKIP"  # Too risky
    
    if naked.premium_cost > spread.net_debit * 3:
        return "VERTICAL_SPREAD"  # Naked too expensive
    
    if risk_tolerance == "conservative":
        if naked.expected_value > spread.expected_value * 2:
            return "NAKED_CALL"  # Significantly better
        return "VERTICAL_SPREAD"
    
    # More logic for moderate/aggressive...
```

---

### 5. Position Sizer (`src/analyzers/position_sizing.py`)

**Purpose:** Calculate optimal position size

**Methods:**

1. **Fixed Risk Percentage (Primary)**
   - Risk 1-2% of account per trade
   - Adjust by signal grade (S = 2%, A = 1.5%, B = 1%)
   
2. **Kelly Criterion (Advanced)**
   - Optimal fraction = (win_rate * avg_win - loss_rate * avg_loss) / avg_win
   - Use half-Kelly for safety
   
3. **Greeks-Based Sizing**
   - Limit portfolio delta to ±25% of account
   - Manage aggregate theta and vega exposure

**Output:**
```python
@dataclass
class PositionSize:
    # Account Context
    account_size: float
    risk_pct: float  # 1-2%
    max_risk_dollars: float
    
    # Position Details
    contracts: int  # How many contracts to buy
    total_cost: float
    position_pct: float  # % of account
    
    # Risk Metrics
    max_loss: float
    max_profit: float
    risk_reward_ratio: float
    
    # Portfolio Impact
    portfolio_delta: float  # After this trade
    portfolio_theta: float
    
    # Warnings
    warnings: List[str]  # "Position exceeds 5% of account"
```

---

### 6. Trade Recommender (`src/recommender.py`)

**Purpose:** Rank and filter opportunities into actionable plays

**Scoring System (0-100):**
```python
score = (
    signal_grade_score * 0.25 +       # S=100, A=85, B=70
    expected_value_score * 0.25 +     # Normalize EV
    probability_of_profit * 0.20 +    # 30%=60pts, 50%=100pts
    risk_reward_ratio * 0.15 +        # 2:1=75pts, 3:1=100pts
    liquidity_score * 0.10 +          # Tight spreads, high OI
    catalyst_proximity_score * 0.05   # Near earnings = bonus
)
```

**Output:**
- Top 5-10 plays ranked by composite score
- Detailed reasoning for each
- Ready-to-execute details (strikes, expiry, quantities)

---

## 💻 CLI Interface

### Commands

```bash
# 🆕 Analyze ALL signals - Comprehensive overview with buy/skip recommendations
poetry run analyze all --days 7

# 🆕 Ask questions about signals - Get intelligent answers
poetry run analyze ask "Why should I trade AAPL?"
poetry run analyze ask "What are the risks for TSLA?"
poetry run analyze ask "Compare GOOGL vs MSFT"
poetry run analyze ask "What's the best signal?"

# Quick analysis of recent signals (with technical filtering)
poetry run analyze scan --days 7 --min-grade A

# Show ONLY the best opportunities (high conviction only)
poetry run analyze best --top-n 5

# Strategy analysis (compare spreads vs naked options)
poetry run analyze strategies --days 7 --top-n 10

# Show configuration
poetry run analyze info
```

### Example Output

```
🎯 Analyze Options Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Top 5 Opportunities (Last 7 Days, Grade A+)

1. [SCORE: 87] NUAI - Bull Call Spread ⭐ STRONG BUY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Signal: Grade A | Bullish | Premium Flow: $850K
   Current Price: $4.20 | Days to Earnings: 12
   
   🎯 Strategy: Bull Call Spread
   ├─ Buy:  $5 Call @ $0.65  (DTE: 30)
   └─ Sell: $7 Call @ $0.25  (DTE: 30)
   
   💰 Cost Analysis
   Net Debit:       $0.40 per spread ($40/contract)
   Max Profit:      $1.60 per spread ($160/contract)
   Max Loss:        $0.40 per spread ($40/contract)
   Risk/Reward:     1:4 ratio ⚡
   
   📊 Probability
   Break Even:      $5.40 (28.6% above current)
   P(Profit):       45% 🎲
   Expected Value:  +$32 per contract
   
   📦 Position Sizing ($10,000 account, 1.5% risk)
   Recommended:     3 contracts
   Total Cost:      $120
   Max Risk:        $120 (1.2% of account) ✓
   Max Profit:      $480
   
   ✅ Why Buy: High grade signal + affordable + excellent R:R
   ⚠️  Consider: Needs 29% move to break even
   
   [View Details] [Execute Trade] [Skip]

2. [SCORE: 84] TSLA - Naked Call 🔥 BUY
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Signal: Grade S | Bullish | Premium Flow: $2.1M
   Current Price: $238.50 | Days to Earnings: 21
   
   🎯 Strategy: Naked Call
   Buy: $245 Call @ $5.80 (DTE: 28)
   
   💰 Cost Analysis
   Premium:         $580 per contract
   Max Profit:      Unlimited 🚀
   Max Loss:        $580 (100% if expires worthless)
   Break Even:      $250.80 (5.2% above current)
   
   📊 Probability
   Delta:           0.38 (38% chance of profit)
   Theta:           -$8.50 per day 💨
   IV Rank:         42 (moderate)
   
   📦 Position Sizing ($10,000 account, 2% risk)
   Recommended:     1 contract
   Total Cost:      $580 (5.8% of account) ⚠️
   Max Risk:        $580 (full premium)
   Potential:       +200% if moves to $263
   
   ✅ Why Buy: S-grade signal + near earnings catalyst
   ⚠️  Caution: High premium cost, aggressive theta decay
   
   💡 Alternative: Bull call spread ($245/$255) for $3.20
      (45% cheaper, 2:1 R:R, 52% P(Profit))
   
   [View Details] [Execute Trade] [Skip]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📂 Project Structure

```
analyze-options-service/
├── README.md                    # This file
├── pyproject.toml              # Poetry dependencies
├── .env.example                # Environment variables template
│
├── src/
│   └── analyze_options/
│       ├── __init__.py
│       ├── cli.py              # CLI interface
│       ├── config.py           # Configuration
│       ├── fetcher.py          # Signal fetcher
│       ├── recommender.py      # Trade ranker
│       │
│       ├── analyzers/
│       │   ├── __init__.py
│       │   ├── vertical_spread.py   # Spread calculator
│       │   ├── naked_options.py     # Naked options analyzer
│       │   ├── strategy_comparison.py  # Compare strategies
│       │   └── position_sizing.py   # Position sizer
│       │
│       ├── models/
│       │   ├── __init__.py
│       │   ├── signal.py       # EnrichedSignal model
│       │   ├── analysis.py     # Analysis result models
│       │   └── recommendation.py    # Trade recommendation
│       │
│       ├── calculators/
│       │   ├── __init__.py
│       │   ├── greeks.py       # Greeks calculations
│       │   ├── probability.py  # Probability models
│       │   └── pricing.py      # Option pricing (Black-Scholes)
│       │
│       ├── data/
│       │   ├── __init__.py
│       │   ├── market_data.py  # Fetch current option chains
│       │   └── supabase_client.py  # Database access
│       │
│       └── utils/
│           ├── __init__.py
│           ├── logger.py       # Logging
│           └── formatters.py   # CLI output formatting
│
├── scripts/
│   ├── backtest_strategies.py  # Historical strategy testing
│   ├── compare_all.py          # Batch comparison
│   └── generate_report.py      # Portfolio report
│
├── tests/
│   ├── test_analyzers.py
│   ├── test_calculators.py
│   └── test_recommender.py
│
└── data/
    ├── cache/                  # Option chain cache
    └── reports/                # Generated reports
```

---

## 🔧 Technology Stack

**Core:**
- **Python 3.11+**: Modern Python with type hints
- **Poetry**: Dependency management
- **Pydantic**: Data validation and models
- **Rich**: Beautiful CLI interface
- **Click/Typer**: CLI framework

**Data & Analysis:**
- **Supabase**: Signal database (reuse from unusual-options-service)
- **yfinance / Polygon**: Real-time option chain data
- **NumPy**: Numerical calculations
- **pandas**: Data manipulation
- **scipy**: Statistical functions (for Black-Scholes)

**Testing:**
- **pytest**: Unit and integration tests
- **pytest-asyncio**: Async testing

---

## 📝 Dependencies

```toml
[tool.poetry.dependencies]
python = "^3.11"
pydantic = "^2.5.0"
rich = "^13.7.0"
click = "^8.1.7"
supabase = ">=2.7.0,<2.8.0"
httpx = "^0.25.0"
yfinance = "^0.2.32"
pandas = "^2.1.0"
numpy = "^1.26.0"
scipy = "^1.11.0"
python-dotenv = "^1.0.0"
loguru = "^0.7.2"

[tool.poetry.scripts]
analyze = "analyze_options.cli:cli"
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1) ✅ CURRENT
- [x] Project setup and architecture
- [ ] Signal fetcher module
- [ ] Basic data models
- [ ] Supabase connection
- [ ] CLI skeleton

### Phase 2: Core Analyzers (Week 2)
- [ ] Vertical spread analyzer
- [ ] Naked options analyzer
- [ ] Greeks calculator
- [ ] Probability models
- [ ] Black-Scholes pricing

### Phase 3: Comparison & Ranking (Week 3)
- [ ] Strategy comparison engine
- [ ] Position sizing calculator
- [ ] Trade recommender
- [ ] Scoring system
- [ ] CLI output formatting

### Phase 4: Enhancement (Week 4)
- [ ] Portfolio mode
- [ ] Backtesting framework
- [ ] Alert system
- [ ] Web dashboard (optional)
- [ ] Performance tracking

---

## 🏆 NEW: Recommendation Tier System

The service now uses a **four-tier recommendation system** to honestly evaluate every signal:

### Recommendation Tiers

| Tier | Score Range | Description | Action |
|------|-------------|-------------|--------|
| 🚀 **STRONG BUY** | 85-100 | Excellent setup, high conviction | Trade immediately with full position size |
| ✅ **BUY** | 70-84 | Good setup, moderate conviction | Viable trade with standard position |
| ⚠️ **CONSIDER** | 50-69 | Marginal setup, risky | Only trade with extra research & conviction |
| ❌ **SKIP** | 0-49 | Poor setup, don't trade | Wait for better opportunities |

### Honest Skip Recommendations

Every SKIP recommendation includes **detailed reasons** explaining why the signal doesn't meet quality standards:

**Example Skip Reasons:**
- "Premium too expensive (>$500/contract)"
- "Low probability of profit (<40%)"
- "RSI overbought (78), poor entry point"
- "IV rank too high (89), overpaying for volatility"
- "Risk/reward ratio unfavorable (<1.5:1)"
- "Too close to expiry (<14 DTE), theta risk"

This helps you understand **why** a signal should be skipped and what to look for in better setups.

---

## 🆕 NEW: Analyze All Command

The `analyze all` command provides a **comprehensive view of ALL signals** with honest buy/skip recommendations:

```bash
poetry run analyze all --days 7
```

**What it does:**
1. Fetches ALL unusual options signals (B+ grade and above)
2. Analyzes each signal for strategy viability
3. Categorizes into STRONG BUY, BUY, CONSIDER, SKIP tiers
4. Shows detailed skip reasons for rejected signals
5. Provides summary statistics

**Example Output:**
```
╭─────────────────── ALL SIGNALS ANALYSIS ───────────────────╮
│ Analyzed 47 signals from last 7 days                       │
│ 🚀 8 STRONG BUY | ✅ 12 BUY | ⚠️  15 CONSIDER | ❌ 12 SKIP  │
╰─────────────────────────────────────────────────────────────╯

🚀 STRONG BUY - High Conviction (8 signals)
┌────────┬───────┬───────┬─────────────────┬──────┬────────┬─────┐
│ Ticker │ Grade │ Score │ Strategy        │ Cost │ P(Win) │ R:R │
├────────┼───────┼───────┼─────────────────┼──────┼────────┼─────┤
│ NUAI   │   S   │  92   │ Naked Call      │ $65  │  45%   │ 1:6 │
│ GOOGL  │   A   │  87   │ Bull Call Spread│ $250 │  58%   │ 1:3 │
└────────┴───────┴───────┴─────────────────┴──────┴────────┴─────┘

❌ SKIP - Don't Trade (12 signals)
┌────────┬───────┬───────┬──────────────────────────────────────┐
│ Ticker │ Grade │ Score │ Skip Reasons                          │
├────────┼───────┼───────┼──────────────────────────────────────┤
│ XYZ    │   B   │  42   │ IV too high (rank 89), overpaying   │
│ ABC    │   A   │  38   │ RSI overbought (78), poor entry     │
└────────┴───────┴───────┴──────────────────────────────────────┘
```

---

## 🆕 NEW: Q&A System

The `analyze ask` command lets you **ask questions about signals** and get intelligent answers:

```bash
poetry run analyze ask "Why should I trade AAPL?"
poetry run analyze ask "What are the risks for TSLA?"
poetry run analyze ask "Compare GOOGL vs MSFT"
poetry run analyze ask "What's the best signal?"
```

**Supported Question Types:**
- **Why trade X?** - Get detailed analysis of why a signal is (or isn't) worth trading
- **Risks for X?** - Comprehensive risk breakdown including max loss, theta decay, probability
- **Compare X vs Y** - Side-by-side comparison of two signals
- **Best signal?** - Get top 3 opportunities ranked by score

**Example Q&A:**
```
🤔 Signal Q&A
Question: Why should I trade NUAI?

╭─────────── 💡 Answer [Confidence: 90%] ───────────╮
│ ✅ NUAI is worth considering! Here's why:         │
│                                                    │
│ 📊 Signal Quality:                                │
│   • Grade: S                                      │
│   • Score: 92/100 (STRONG BUY)                   │
│   • Premium Flow: $850,000                        │
│                                                    │
│ 🎯 Strategy: Naked Call                          │
│   • Cost: $65/contract                            │
│   • Potential: Unlimited upside                   │
│   • Risk/Reward: 1:6                              │
│   • Probability: 45%                              │
│                                                    │
│ 💡 Why it's good: S-grade + strong score         │
│ ⏰ Catalyst: Earnings in 12 days                 │
╰────────────────────────────────────────────────────╯
```

---

## 🎯 Key Decision Points

### 1. When to Use Vertical Spreads?
**✅ USE SPREADS WHEN:**
- Signal is A/B grade (not S-tier)
- Capital is limited
- Breakeven requires large move (>20%)
- Want defined risk
- Multiple positions in portfolio

**❌ SKIP SPREADS WHEN:**
- S-tier signal with strong catalyst
- Unlimited upside potential needed
- Spread width too narrow (< 2:1 R:R)
- Poor liquidity in short strike

### 2. When to Use Naked Calls?
**✅ USE NAKED WHEN:**
- S-tier signal with near-term catalyst
- High conviction (insider-type play)
- Reasonable premium (< 5% of account)
- Good delta (0.30-0.50)
- Strong directional move expected

**❌ SKIP NAKED WHEN:**
- Premium > $500 per contract (too expensive)
- Extreme theta decay (< 14 DTE)
- IV rank > 70 (overpaying for volatility)
- No clear catalyst

### 3. Position Sizing Rules
- **Never risk > 2% per trade** (even S-tier signals)
- **Never allocate > 20% to options** (rest in shares/cash)
- **Max 5 positions simultaneously** (diversification)
- **Higher grade = bigger position**: S=2%, A=1.5%, B=1%

---

## 📊 Expected Outcomes

**Signal Conversion Rate:**
- Input: ~50 A+ signals per week
- After filtering: ~15 high-quality opportunities
- Top 5 recommendations for execution
- Expected: 2-3 trades per week

**Win Rate Targets:**
- Vertical Spreads: 60-70% win rate (defined risk helps)
- Naked Calls: 40-50% win rate (but bigger wins)

**Return Targets:**
- Vertical Spreads: 30-50% per trade (defined max)
- Naked Calls: 50-200% per trade (unlimited upside)

**Risk Management:**
- Max drawdown: 10% of account
- Position correlation: Monitor portfolio delta
- Time decay: Manage aggregate theta exposure

---

## 🧪 Testing Strategy

1. **Unit Tests**: Each analyzer in isolation
2. **Integration Tests**: Full pipeline with mock data
3. **Backtesting**: Historical signals → retrospective analysis
4. **Paper Trading**: Track recommendations vs actual outcomes

---

## 📚 Future Enhancements

**Phase 5: Advanced Features**
- Iron Condors / Butterflies for neutral signals
- Earnings play specialist (straddles/strangles)
- Portfolio hedging recommendations
- Real-time P&L tracking
- Machine learning for win rate prediction

**Phase 6: Automation**
- Auto-execute trades via broker API (Interactive Brokers, TD Ameritrade)
- Automated exit management
- Dynamic position adjustments
- Risk monitoring and alerts

---

## 🤝 Integration with Existing Services

**unusual-options-service:**
- Pull signals directly from Supabase
- Reuse signal grading and scoring
- Feed performance data back to improve signal quality

**volatility-squeeze-scanner:**
- Cross-reference with squeeze signals
- Combine fundamental (unusual options) + technical (squeeze) signals
- Enhanced conviction when both signal

**rds-ticker-analysis:**
- Reddit sentiment as additional filter
- High social volume + unusual options = strong play

---

## ⚠️ Disclaimers

- **Not Financial Advice**: This tool is for educational purposes
- **Risk Warning**: Options trading involves substantial risk
- **No Guarantees**: Past performance doesn't predict future results
- **Start Small**: Test with paper trading first
- **Know Your Risk**: Never trade with money you can't afford to lose

---

## 📖 Learning Resources

- **Options Basics**: Understanding Greeks, IV, moneyness
- **Vertical Spreads**: Max profit/loss calculation
- **Position Sizing**: Kelly Criterion explained
- **Risk Management**: Portfolio construction principles

---

**Next Steps:**
1. Review and approve this plan
2. Set up project structure
3. Implement signal fetcher
4. Build first analyzer (vertical spreads)
5. Test with real signals from your unusual-options-service

Ready to build this? 🚀
