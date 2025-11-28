# Research Workflow - From Signals to Strategy

## Your Current Position

✅ **R&D Framework Setup** - Complete  
✅ **Data Loading** - Working with pagination  
✅ **YFinance Integration** - Implemented  
✅ **Timezone Handling** - Fixed and tested  
✅ **Data Exploration Notebook** - Running successfully  

## Next: Turn Signals Into Alpha

### Immediate Next Steps (Today)

#### 1. Review Your Notebook Results

Look at the performance summary in your current notebook:

```python
# You should see output like:
PERFORMANCE SUMMARY
1-Day Returns:
  Average:  +2.3%
  Win Rate: 58%

5-Day Returns:
  Average:  +4.1%
  Win Rate: 62%

Correlation between Signal Score and 5-Day Return: 0.42
```

**Key Questions:**
- What correlation did you get? (Above 0.3 is good!)
- Which holding period has the best returns?
- What's the win rate for signals > 0.8?

#### 2. Find the Best Scanner

Analyze by source:

```python
# In your notebook, add a cell:
print("\nPerformance by Scanner:")
for source in perf_df['source'].unique():
    source_df = perf_df[(perf_df['source'] == source) & (perf_df['holding_days'] == 5)]
    avg_return = source_df['return_5d'].mean()
    win_rate = (source_df['return_5d'] > 0).mean() * 100
    print(f"{source:20} {avg_return:+.2f}%  ({win_rate:.0f}% win rate)")
```

**Goal:** Identify which scanner produces the most profitable signals.

#### 3. Analyze by Signal Quality

```python
# High vs low scoring signals
high_score = perf_df[perf_df['score'] > 0.8]
low_score = perf_df[perf_df['score'] <= 0.8]

print(f"High Score (>0.8): {high_score['return_5d'].mean():.2f}% avg return")
print(f"Low Score (≤0.8): {low_score['return_5d'].mean():.2f}% avg return")
```

**Goal:** Validate if your scoring system actually predicts performance.

### Short-Term Actions (This Week)

#### Day 1: Explore Current Data

**Focus:** Understand what works
- Complete all cells in `01_data_exploration.ipynb`
- Document your findings (win rates, best scanners, etc.)
- Take screenshots of key charts

**Command:**
```bash
cd rnd
poetry run jupyter notebook notebooks/01_data_exploration.ipynb
```

#### Day 2: Find Confluences

**Focus:** Multi-source validation
- Run confluence analysis
- See if multiple scanners agreeing improves results

**Commands:**
```bash
cd rnd
poetry run python scripts/run_analysis.py --days 30 --find-confluence

# Review results
cat data/results/confluence_report_*.txt
```

**Then open:**
```bash
poetry run jupyter notebook notebooks/02_signal_correlation.ipynb
```

#### Day 3-4: Define Your Strategy

**Focus:** Create clear trading rules

Based on your findings, define:
1. **Entry Rules**
   - Which signals to trade (scanner, score threshold, rank)
   - When to enter (immediate, next day, pullback)

2. **Exit Rules**
   - Holding period (1d, 5d, 10d)
   - Profit target (percentage)
   - Stop loss (percentage)

3. **Position Sizing**
   - How much capital per trade
   - Maximum concurrent positions

**Example Strategy:**
```
Name: High-Confidence Unusual Options
Entry:
  - Source: Unusual Options
  - Score: > 0.85
  - Rank: ELITE or STRONG
  - Entry: Next market open
  
Exit:
  - Hold: 5 days
  - Profit: 12% (or hold to day 5)
  - Stop: -6%
  
Risk:
  - Position size: 10% of capital
  - Max positions: 5 concurrent
```

#### Day 5: Backtest

**Focus:** Validate your strategy

Open:
```bash
poetry run jupyter notebook notebooks/04_backtesting.ipynb
```

Implement and test your strategy with last 60-90 days of data.

### Weekly Review Template

At end of each week, document:

```
Week of [DATE]

Findings:
- [Key insight about signal performance]
- [Scanner comparison results]
- [Optimal holding period]

Strategy Tested:
- [Brief description]
- Win Rate: X%
- Average Return: Y%
- Sharpe Ratio: Z

Next Steps:
- [Adjustment to make]
- [New hypothesis to test]
```

### Month 1 Goals

**Week 1: Validation**
- ✅ Understand which signals work
- ✅ Identify best scanner and parameters
- ✅ Document baseline performance

**Week 2: Strategy Development**
- Define 2-3 candidate strategies
- Test each with historical data
- Select best performer

**Week 3: Refinement**
- Optimize parameters (scores, holding periods, stops)
- Test across different market conditions
- Add risk management rules

**Week 4: Paper Trading**
- Apply strategy to new signals
- Track performance in real-time
- Build confidence before live trading

## Research Questions to Answer

### Signal Quality

**Priority 1:**
- [ ] What's the correlation between signal score and actual return?
- [ ] Do ELITE ranked signals outperform STRONG/MODERATE?
- [ ] What score threshold gives best risk/reward?

**Priority 2:**
- [ ] Which scanner has highest win rate?
- [ ] Are confluences more profitable?
- [ ] Does time of signal detection matter (market hours vs after hours)?

### Timing

**Priority 1:**
- [ ] What's the optimal holding period?
- [ ] Should we enter immediately or wait for pullback?
- [ ] Does entry delay affect returns?

**Priority 2:**
- [ ] Best entry time (market open, close, specific hour)?
- [ ] Exit timing (time-based vs target-based)?

### Risk Management

**Priority 1:**
- [ ] What stop loss percentage maximizes profitability?
- [ ] How many positions can we hold simultaneously?
- [ ] What's the optimal position size?

**Priority 2:**
- [ ] Should we scale in/out of positions?
- [ ] Trailing stops vs fixed stops?
- [ ] Portfolio heat (total risk exposure)?

### Market Context

**Priority 1:**
- [ ] Do signals work in all market conditions?
- [ ] Performance in bull vs bear vs sideways?

**Priority 2:**
- [ ] Does VIX level matter?
- [ ] Sector performance differences?
- [ ] Market cap sweet spot?

## Decision Tree

After analyzing your data, follow this decision tree:

```
Signal Score > 0.8?
├─ YES → High quality signal
│   └─ Confluence (2+ scanners)?
│       ├─ YES → STRONG BUY (Consider larger position)
│       └─ NO → MODERATE BUY
└─ NO → Pass or reduce position size

Holding Period Decision:
├─ 1-Day Returns Good (>3%)? → Day trade strategy
├─ 5-Day Returns Good (>5%)? → Swing trade strategy  
└─ 10-Day Returns Good (>8%)? → Position trade strategy

Scanner Selection:
├─ Unusual Options Best? → Focus 70% here
├─ Volatility Squeeze Best? → Focus 70% here
└─ Balanced? → Split allocation
```

## Success Metrics

Track these to measure progress:

### Performance Metrics
- **Win Rate**: % of profitable trades (Target: >60%)
- **Average Return**: Mean profit per trade (Target: >5% for 5-day holds)
- **Profit Factor**: Gross profit / Gross loss (Target: >1.5)
- **Sharpe Ratio**: Risk-adjusted returns (Target: >1.0)
- **Max Drawdown**: Largest peak-to-trough decline (Target: <20%)

### Process Metrics
- **Signals Analyzed**: Number of historical signals evaluated
- **Strategies Tested**: Different approaches tried
- **Backtests Run**: Validation iterations completed
- **Confluences Found**: Multi-source agreements identified

### Learning Metrics
- **Key Insights**: Major findings documented
- **Patterns Identified**: Repeatable opportunities discovered
- **Mistakes Made**: Lessons learned from failed tests

## Tools Reference

### Scripts

```bash
# Analyze signals with confluences
poetry run python scripts/run_analysis.py --days 30 --find-confluence

# Analyze specific scanner
poetry run python scripts/run_analysis.py --days 60 --scanner unusual_options

# Generate detailed report
poetry run python scripts/generate_report.py --days 90 --output report.txt
```

### Notebooks

```bash
# Data exploration with YFinance
poetry run jupyter notebook notebooks/01_data_exploration.ipynb

# Signal correlation analysis
poetry run jupyter notebook notebooks/02_signal_correlation.ipynb

# Strategy development
poetry run jupyter notebook notebooks/03_strategy_development.ipynb

# Backtesting
poetry run jupyter notebook notebooks/04_backtesting.ipynb
```

### Quick Analysis (CLI)

```bash
# Load data and show summary
cd rnd
poetry run python -c "
from rnd_framework.data.loaders import DataLoader
loader = DataLoader()
signals = loader.load_all_signals(days=30, min_score=0.7)
print(f'Loaded {len(signals)} signals')
"
```

## Common Pitfalls to Avoid

1. **Overfitting**: Don't optimize to perfection on historical data
   - Solution: Test on unseen data, walk-forward validation

2. **Ignoring Costs**: Forgetting about commissions and slippage
   - Solution: Include realistic transaction costs in backtests

3. **Survivorship Bias**: Only analyzing winners
   - Solution: Analyze all signals, including losers

4. **Look-Ahead Bias**: Using future information
   - Solution: Ensure signals use only data available at signal time

5. **Curve Fitting**: Too many parameters
   - Solution: Keep strategies simple, focus on robust patterns

## When to Go Live

Only start live trading when:
- ✅ Strategy has 60%+ win rate in backtest
- ✅ Sharpe ratio > 1.0
- ✅ Tested across 90+ days of data
- ✅ Paper traded successfully for 2+ weeks
- ✅ You understand why the strategy works
- ✅ Clear risk management rules defined
- ✅ Comfortable with maximum drawdown

Start small:
- Allocate only 10-20% of capital initially
- Track performance for 1 month
- Increase allocation if performing well

## Resources

- **Framework Docs**: `docs/rnd/README.md`
- **YFinance Guide**: `docs/rnd/yfinance-integration.md`
- **Timezone Guide**: `docs/rnd/timezone-handling.md`
- **Quick Start**: `rnd/QUICKSTART.md`

## Support

Need help?
1. Check troubleshooting in `docs/rnd/README.md`
2. Review example notebooks for patterns
3. Test with smaller date ranges first

---

**Remember**: The goal is not to find the perfect strategy, but to find a good strategy you can execute consistently with confidence. Let the data guide you! 📊🎯

