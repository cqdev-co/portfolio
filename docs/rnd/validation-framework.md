# Validation Framework - Testing Strategies Properly

## The Problem with Simple Backtesting

When you see results like "80% win rate on Friday signals," your skepticism is **100% correct**!

### Why Results Can Be Misleading

1. **Overfitting**: Finding patterns that only exist in your specific data
2. **Bull Market Bias**: Last 30 days might all be up days
3. **Small Sample Size**: 370 Friday signals isn't enough for confidence
4. **Data Snooping**: Looking at same data you're testing on
5. **Incomplete Data**: Recent signals don't have full forward returns yet

## Proper Validation Methods

### 1. Walk-Forward Testing

**What**: Train on past data, test on future (unseen) data, roll forward

**How**:
```
Week 1-2 (Train) → Week 3 (Test)
Week 2-3 (Train) → Week 4 (Test)
Week 3-4 (Train) → Week 5 (Test)
```

**Why**: If patterns are real, they persist. If noise, they disappear.

**Run it**:
```bash
cd rnd
poetry run python scripts/walk_forward_validation.py \
    --days 30 \
    --strategy friday_top_symbols
```

**Interpret results**:
- Win rate varies <20% across periods → **Consistent edge**
- Win rate varies >30% across periods → **Probably noise**

---

### 2. Out-of-Sample Testing

**What**: Hold back 25% of data, never look at it until final test

**How**:
```python
# Split data chronologically
train_data = signals[:int(len(signals) * 0.75)]
test_data = signals[int(len(signals) * 0.75):]

# Build strategy ONLY on train_data
# Test ONCE on test_data (never touch it before!)
```

**Why**: Tests if you overfit to your training data

---

### 3. Market Regime Testing

**What**: Separate bull/bear/sideways days, test in each

**How**:
```python
import yfinance as yf

spy = yf.Ticker("SPY")
hist = spy.history(period="3mo")

# Classify each day
hist['regime'] = 'sideways'
hist.loc[hist['Close'].pct_change() > 0.01, 'regime'] = 'bull'
hist.loc[hist['Close'].pct_change() < -0.01, 'regime'] = 'bear'

# Test strategy in each regime
for regime in ['bull', 'bear', 'sideways']:
    regime_signals = signals[signals.date.isin(hist[hist.regime == regime].index)]
    # Calculate performance...
```

**Why**: Strategy must work in ALL market conditions, not just recent ones

---

### 4. Monte Carlo Simulation

**What**: Randomize trade order 10,000 times, see if results hold

**How**:
```python
import numpy as np

returns = [trade.return for trade in trades]

# Run 10,000 simulations
simulated_returns = []
for i in range(10000):
    random_order = np.random.permutation(returns)
    sim_return = np.mean(random_order)
    simulated_returns.append(sim_return)

# Compare actual to simulations
actual_return = np.mean(returns)
p_value = (np.array(simulated_returns) >= actual_return).mean()

if p_value < 0.05:
    print("Results are statistically significant!")
else:
    print("Results could be luck")
```

**Why**: Tests if your results are better than random

---

### 5. Minimum Sample Size Requirements

For statistical confidence, you need:

```python
import scipy.stats as stats

def required_sample_size(expected_win_rate, confidence=0.95, margin=0.05):
    """Calculate required trades for confidence."""
    z = stats.norm.ppf((1 + confidence) / 2)
    p = expected_win_rate
    n = (z**2 * p * (1-p)) / (margin**2)
    return int(np.ceil(n))

# For 80% win rate with 95% confidence:
print(required_sample_size(0.80))  # ~246 trades needed

# For 60% win rate:
print(required_sample_size(0.60))  # ~369 trades needed
```

**Current data**: ~370 Friday signals (barely enough for 60% win rate, not enough for 80%)

---

## Your Data Reality Check

### What We Actually Have

```
Total Signals: 6,261
Complete 5-day data: 4,592 (73.3%)
Incomplete data: 1,669 (26.7%)

Time period: 12 days only
Friday signals with complete data: ~370
Market condition: Mostly sideways (SPY -1.67%)
```

### What This Means

**Good News**:
- ✓ Not pure bull market (SPY was down)
- ✓ Decent sample size (~370 Friday trades)
- ✓ Patterns are interesting and worth exploring

**Reality Check**:
- ⚠️ Only 12 days of data (need 60-90+ days)
- ⚠️ 26% of data incomplete (recent signals)
- ⚠️ Not tested across multiple market regimes
- ⚠️ No walk-forward validation yet

---

## Conservative Approach

### Phase 1: More Data Collection (Weeks 1-4)
```
Goal: Get 60+ days of signals
Action: Just run scanner, collect data
Don't trade: Not ready yet
```

### Phase 2: Validation (Weeks 5-6)
```
Goal: Test if patterns persist
Action: Run walk-forward validation
Tools: Use walk_forward_validation.py script
```

### Phase 3: Paper Trading (Weeks 7-8)
```
Goal: Test on truly unseen data
Action: Apply strategy to NEW signals
Track: Win rate, returns, consistency
```

### Phase 4: Live Trading (Week 9+)
```
Goal: Real money, small positions
Action: Trade only if paper trading successful
Start: 1-2 positions, 5% of capital
Scale: Gradually if working
```

---

## Red Flags to Watch For

### 🚨 Walk-Forward Results Deteriorate
```
Week 1: 75% win rate
Week 2: 45% win rate  ← RED FLAG
Week 3: 40% win rate  ← Pattern breaking down
```
→ Strategy was overfit, doesn't generalize

### 🚨 Paper Trading Fails
```
Backtest: 80% win rate
Paper trade: 45% win rate  ← RED FLAG
```
→ You were data snooping or overfit

### 🚨 Win Rate Varies Wildly
```
Good weeks: 90% win rate
Bad weeks: 30% win rate
```
→ Not a consistent edge, probably luck

### 🚨 Only Works in One Market Condition
```
Bull days: 80% win rate
Bear days: 35% win rate  ← RED FLAG
```
→ Not a robust strategy

---

## What "Good" Validation Looks Like

### Consistent Performance
```
Week 1: 65% win rate
Week 2: 62% win rate
Week 3: 68% win rate
Week 4: 61% win rate

Mean: 64% ± 3%  ← Consistent!
```

### Works Across Regimes
```
Bull days: 68% win rate
Bear days: 62% win rate
Sideways: 64% win rate

All above 60%  ← Robust!
```

### Persists Out-of-Sample
```
Training: 65% win rate
Testing: 62% win rate  ← Close!
```

### Statistically Significant
```
Monte Carlo: p < 0.05
Sample size: >385 trades
Win rate: >60%
```

---

## Current Status Assessment

### Your Unusual Options Scanner

**Patterns Found** (require validation):
- Friday: 80.9% win rate (suspicious)
- Top symbols: 100% win rate (very suspicious)
- 5-day hold: 63.6% win rate (plausible)

**Data Quality**:
- Sample size: Borderline (370 Friday trades)
- Time period: Too short (12 days)
- Market regime: Single condition tested

**Confidence Level**: 🟡 **LOW-MEDIUM**
- Patterns are interesting
- Need more data to confirm
- Could be noise or overfitting

**Recommendation**: 
1. ✅ Continue collecting data
2. ✅ Run walk-forward tests when you have 60+ days
3. ❌ Don't trade yet based on these patterns
4. ✅ Paper trade when validated

---

## Tools for Validation

### Walk-Forward Testing
```bash
poetry run python scripts/walk_forward_validation.py \
    --days 60 \
    --strategy friday_top_symbols
```

### Market Regime Analysis
```python
from rnd_framework.analysis.patterns import PatternRecognizer

recognizer = PatternRecognizer()
regimes = recognizer.detect_market_regimes(signals, market_data)
```

### Monte Carlo Simulation
```python
from rnd_framework.backtesting.monte_carlo import MonteCarloSimulator

simulator = MonteCarloSimulator()
results = simulator.run(trades, iterations=10000)
print(f"P-value: {results.p_value}")
```

---

## The Scientific Approach

1. **Hypothesis**: "Friday signals on top symbols have 75%+ win rate"

2. **Test**: Collect data, analyze, find patterns

3. **Validate**: Walk-forward, out-of-sample, regime testing

4. **Verify**: Paper trade on truly unseen data

5. **Deploy**: If all tests pass, trade with small capital

6. **Monitor**: Track performance, stop if degrades

**Don't skip steps!** Each one eliminates a different type of error.

---

## Bottom Line

**Your skepticism is EXACTLY RIGHT!**

The patterns we found are interesting but:
- ❌ Not validated yet
- ❌ Too little data
- ❌ Could be overfitting
- ❌ Need walk-forward testing

**Proper process**:
1. Collect 60-90 days of data
2. Run walk-forward validation
3. Paper trade 2 weeks
4. Then consider live trading

**Don't rush!** Better to validate thoroughly than lose money on false patterns.

The R&D framework gave us **hypotheses to test**, not **strategies to trade**.

---

*Generated: November 16, 2025*  
*Status: Data collection phase*  
*Next milestone: 60 days of data for validation*

