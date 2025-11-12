# Call Debit Spread Finder - Improvement Plan

## Current Issues Identified

Based on test results showing 3 opportunities with scores 54-68:

### 1. **Low Probability of Profit**
- **Problem**: POPs are 38%, 40%, 61% - only one above 50%
- **Impact**: Low confidence in trade success
- **Root Cause**: 
  - Strike selection may be too aggressive (spreads too wide)
  - Breakeven too far from current price
  - Probability calculation may need refinement

### 2. **Unrealistic Risk/Reward Ratios**
- **Problem**: R:R ratios are 12:1, 49:1, 7.4:1 - extremely high
- **Impact**: These ratios suggest spreads are too wide or premiums too low
- **Root Cause**:
  - Strike width selection logic may be creating unrealistic spreads
  - Need to validate against actual market conditions
  - Typical Call Debit Spreads should have R:R of 1.5:1 to 3:1

### 3. **No High-Confidence Opportunities**
- **Problem**: 0 GOLDEN, 0 HIGH confidence opportunities
- **Impact**: All recommendations are "CONSIDER" or "SKIP"
- **Root Cause**:
  - Scoring thresholds may be too strict
  - Missing key factors (historical performance, entry timing)
  - Need better filtering criteria

## Recommended Improvements

### Phase 1: Strike Selection & Validation (Critical)

#### 1.1 Improve Strike Selection Logic
```python
# Current: Fixed width based on price
# Improved: Dynamic width based on:
#   - IV rank (wider spreads in low IV)
#   - DTE (tighter spreads for shorter DTE)
#   - Liquidity (prefer strikes with high OI)
#   - Target realistic R:R (1.5:1 to 3:1)
```

**Implementation:**
- Add liquidity check (minimum OI threshold)
- Validate R:R ratio is realistic (1.5:1 to 3:1)
- Adjust strike width based on IV rank
- Prefer strikes with tight bid-ask spreads

#### 1.2 Validate Spread Quality
```python
# Add validation checks:
#   - Net debit should be 20-50% of strike width
#   - Breakeven should be achievable (within 1-2 ATR)
#   - Both strikes should have reasonable liquidity
#   - R:R ratio should be realistic
```

### Phase 2: Historical Performance Integration (High Priority)

#### 2.1 Add Historical Win Rate
- Query `unusual_options_signal_performance` table
- Calculate win rate for similar signals (same ticker, grade, sentiment)
- Boost score for tickers with >60% historical win rate
- Penalize tickers with <40% historical win rate

#### 2.2 Signal Quality Validation
- Check if similar signals have performed well historically
- Use forward returns (1d, 5d, 30d) from performance table
- Factor historical performance into composite score

### Phase 3: Enhanced Filtering & Scoring (High Priority)

#### 3.1 Minimum Quality Thresholds
```python
# Add hard filters:
MIN_POP = 50.0  # Minimum probability of profit
MIN_RR = 1.5    # Minimum risk/reward ratio
MAX_RR = 3.0    # Maximum realistic R:R
MIN_SCORE = 70  # Minimum composite score for consideration
```

#### 3.2 Better Probability Calculation
- Use actual option chain data for more accurate POP
- Factor in historical volatility vs implied volatility
- Consider skew and term structure
- Account for earnings events and catalysts

#### 3.3 Enhanced Scoring Weights
```python
# Current weights:
# Technical: 30%, Options: 30%, Signal Quality: 25%, Fundamentals: 15%

# Improved weights (for Call Debit Spreads):
# Historical Performance: 20% (NEW)
# Options Metrics: 25% (reduced from 30%)
# Technical Setup: 25% (reduced from 30%)
# Signal Quality: 20% (reduced from 25%)
# Fundamentals: 10% (reduced from 15%)
```

### Phase 4: Position Sizing & Risk Management (Medium Priority)

#### 4.1 Position Sizing Calculator
- Calculate optimal position size based on:
  - Account size
  - Risk per trade (1-2% default)
  - Signal confidence level
  - Portfolio correlation
- Recommend number of contracts
- Calculate max risk per position

#### 4.2 Risk Management
- Check portfolio correlation (avoid over-concentration)
- Calculate aggregate delta exposure
- Monitor aggregate theta decay
- Set stop-loss levels based on ATR

### Phase 5: Entry/Exit Timing (Medium Priority)

#### 5.1 Entry Timing Recommendations
- Best entry times (avoid low liquidity periods)
- Wait for confirmation signals
- Scale-in strategies for high conviction plays
- Avoid entering before major events (earnings, FOMC)

#### 5.2 Exit Strategy
- Profit targets (50% at 1:1 R:R, 100% at max profit)
- Stop-loss levels (50% of max loss)
- Time-based exits (close 7 days before expiry)
- Trailing stops for winning positions

### Phase 6: Additional Enhancements (Low Priority)

#### 6.1 Portfolio Correlation
- Check correlation with existing positions
- Avoid over-concentration in sectors
- Diversification scoring

#### 6.2 Backtesting Framework
- Historical performance analysis
- Win rate by signal grade
- Average returns by confidence level
- Risk-adjusted returns (Sharpe ratio)

#### 6.3 Alert System
- Notifications for GOLDEN opportunities
- Daily summary of new opportunities
- Performance tracking alerts

## Implementation Priority

### Immediate (Week 1)
1. ✅ Fix strike selection logic (realistic R:R ratios)
2. ✅ Add minimum quality filters (POP, R:R, score)
3. ✅ Improve probability calculation accuracy

### Short-term (Week 2-3)
4. ✅ Integrate historical performance data
5. ✅ Add position sizing calculator
6. ✅ Enhanced scoring with historical data

### Medium-term (Month 2)
7. ✅ Entry/exit timing recommendations
8. ✅ Portfolio correlation checks
9. ✅ Backtesting framework

### Long-term (Month 3+)
10. ✅ Alert system
11. ✅ Performance tracking dashboard
12. ✅ Machine learning enhancements

## Success Metrics

### Quality Metrics
- **Target**: 20-30% of opportunities should be HIGH or GOLDEN confidence
- **Target**: Average POP should be >55% for recommended trades
- **Target**: R:R ratios should be realistic (1.5:1 to 3:1)
- **Target**: Historical win rate >60% for HIGH confidence trades

### Performance Metrics
- **Target**: Win rate >55% for executed trades
- **Target**: Average return >30% per winning trade
- **Target**: Max drawdown <10% of account
- **Target**: Sharpe ratio >1.5

## Code Changes Required

### 1. Enhanced Strike Selection (`strategies/call_debit_spread.py`)
- Add liquidity validation
- Implement dynamic strike width
- Validate realistic R:R ratios
- Better breakeven calculation

### 2. Historical Performance Integration (`analyzers/historical.py` - NEW)
- Query performance table
- Calculate win rates
- Factor into scoring

### 3. Enhanced Filtering (`analyzers/composite.py`)
- Add minimum thresholds
- Better probability calculation
- Improved scoring weights

### 4. Position Sizing (`analyzers/position_sizing.py` - NEW)
- Calculate optimal position size
- Risk management checks
- Portfolio correlation

### 5. Entry/Exit Timing (`analyzers/timing.py` - NEW)
- Entry timing recommendations
- Exit strategy generation
- Profit target calculation

## Testing Strategy

1. **Backtest on Historical Data**
   - Test strike selection logic on past signals
   - Validate R:R ratios are realistic
   - Check POP accuracy

2. **Paper Trading**
   - Track recommendations vs actual outcomes
   - Measure win rate
   - Calculate returns

3. **A/B Testing**
   - Compare old vs new scoring
   - Measure improvement in signal quality
   - Validate threshold adjustments

