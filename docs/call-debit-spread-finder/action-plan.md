# Action Plan: Making the Right Trades

## Key Issues from Test Results

Looking at your 3 opportunities:
- **EB**: 68.3 score, 38% POP, 12.5:1 R:R → **CONSIDER**
- **RPT**: 66.8 score, 40% POP, 49:1 R:R → **CONSIDER**  
- **ASLE**: 54.0 score, 61% POP, 7.4:1 R:R → **SKIP**

### Critical Problems:

1. **Unrealistic R:R Ratios**: 12:1, 49:1, 7.4:1 are suspicious
   - Real Call Debit Spreads typically have 1.5:1 to 3:1 R:R
   - These suggest spreads are too wide or premiums are mispriced
   - **Action**: Fix strike selection to target realistic R:R

2. **Low Probability of Profit**: Only 1 of 3 above 50%
   - Need minimum POP threshold of 50%+
   - **Action**: Add POP filter and improve probability calculation

3. **No High-Confidence Trades**: All MODERATE or LOW
   - Need better filtering to find GOLDEN opportunities
   - **Action**: Integrate historical performance data

## Immediate Actions to Make Better Trades

### 1. Add Quality Filters (Do This First)

**Problem**: Low-quality opportunities are being shown
**Solution**: Add minimum thresholds

```python
# In CLI scan command, add filters:
- Minimum POP: 50%
- Minimum R:R: 1.5:1
- Maximum R:R: 3.0:1 (realistic upper bound)
- Minimum composite score: 70 for CONSIDER, 80 for BUY
```

### 2. Fix Strike Selection Logic

**Problem**: Spreads are too wide, creating unrealistic R:R
**Solution**: Better strike selection algorithm

```python
# Target realistic R:R (1.5:1 to 3:1)
# Adjust strike width based on:
#   - Current price (wider for higher prices)
#   - IV rank (wider in low IV)
#   - DTE (tighter for shorter DTE)
#   - Liquidity (prefer high OI strikes)
```

### 3. Integrate Historical Performance

**Problem**: No validation that similar signals have worked before
**Solution**: Query performance table

```python
# For each ticker, check:
#   - Historical win rate for same grade/sentiment
#   - Average forward returns (5d, 30d)
#   - Boost score if win rate >60%
#   - Skip if win rate <40%
```

### 4. Add Position Sizing

**Problem**: No guidance on how much to risk
**Solution**: Calculate position size

```python
# For each opportunity:
#   - Calculate max risk (1-2% of account)
#   - Recommend number of contracts
#   - Show total cost and max loss
#   - Warn if position too large
```

### 5. Improve Probability Calculation

**Problem**: POP may be inaccurate
**Solution**: Use better methods

```python
# Current: Simple Black-Scholes approximation
# Improved:
#   - Use actual option chain deltas
#   - Factor in historical vs implied volatility
#   - Account for earnings/catalysts
#   - Consider skew and term structure
```

## Decision Framework: When to Trade

### ✅ TRADE When:
1. **Composite Score ≥ 80** (HIGH or GOLDEN confidence)
2. **POP ≥ 55%** (better than coin flip)
3. **R:R between 1.5:1 and 3:1** (realistic)
4. **Historical win rate >60%** (if available)
5. **Technical setup is bullish** (RSI 40-60, above MAs)
6. **IV rank <50** (not overpaying)
7. **Signal grade A or S** (high quality)
8. **No major warnings** (earnings, low liquidity, etc.)

### ❌ SKIP When:
1. **Composite Score < 70**
2. **POP < 50%**
3. **R:R > 3:1** (too good to be true)
4. **Historical win rate <40%** (if available)
5. **RSI >70 or <30** (overbought/oversold)
6. **IV rank >70** (overpaying)
7. **Signal grade C or below**
8. **Multiple warnings** (high risk)

### ⚠️ CONSIDER When:
- Score 70-79
- POP 50-54%
- Some positive factors but not all
- Requires extra research and conviction

## Implementation Checklist

### Phase 1: Quick Wins (This Week)
- [ ] Add minimum POP filter (50%)
- [ ] Add R:R validation (1.5:1 to 3:1)
- [ ] Fix strike selection to target realistic R:R
- [ ] Add minimum score threshold (70)
- [ ] Improve probability calculation

### Phase 2: Historical Integration (Next Week)
- [ ] Query `unusual_options_signal_performance` table
- [ ] Calculate historical win rates per ticker/grade
- [ ] Factor historical performance into scoring
- [ ] Add historical data to opportunity display

### Phase 3: Risk Management (Week 3)
- [ ] Add position sizing calculator
- [ ] Calculate optimal contracts based on risk
- [ ] Add portfolio correlation checks
- [ ] Show max risk per position

### Phase 4: Enhanced Features (Month 2)
- [ ] Entry timing recommendations
- [ ] Exit strategy generation
- [ ] Backtesting framework
- [ ] Performance tracking

## Testing Your Improvements

### Before Trading:
1. **Paper Trade First**: Track 10-20 recommendations
2. **Measure Win Rate**: Should be >55% for HIGH confidence
3. **Check R:R**: Should be realistic (1.5:1 to 3:1)
4. **Validate POP**: Actual win rate should match predicted POP ±10%

### Key Metrics to Track:
- **Win Rate**: % of profitable trades
- **Average Return**: Average % gain per trade
- **Risk/Reward**: Actual R:R achieved
- **Max Drawdown**: Largest losing streak
- **Sharpe Ratio**: Risk-adjusted returns

## Red Flags to Watch For

1. **Unrealistic R:R**: If R:R > 3:1, something is wrong
2. **Low POP**: If POP < 50%, odds are against you
3. **No Historical Data**: First time seeing this ticker/pattern
4. **High IV Rank**: Paying too much for volatility
5. **Poor Technical Setup**: RSI extreme, bearish trend
6. **Low Liquidity**: Wide bid-ask spreads, low OI
7. **Earnings Soon**: High volatility risk
8. **Multiple Warnings**: Too many risk factors

## Next Steps

1. **Review the improvements document** (`improvements.md`)
2. **Implement Phase 1 fixes** (quality filters, strike selection)
3. **Test with paper trading** before real money
4. **Track performance** and adjust thresholds
5. **Iterate** based on results

Remember: **Not every signal is a trade**. It's better to skip 10 opportunities and find 1 great one than to trade 10 mediocre ones.

