# Volatility Squeeze Scanner User Guide

## Getting Started

The Volatility Squeeze Scanner is a professional trading tool designed to identify high-probability breakout opportunities in the stock market. This guide will help you understand how to use the system effectively.

## Understanding the Scanner Interface

### Main Dashboard

The scanner dashboard displays real-time volatility squeeze signals with the following key sections:

#### 1. Performance Metrics (Top Section)
```
Live Performance Tracking
┌─────────────────┬─────────────────┬─────────────────┐
│   Win Rate      │   Avg Return    │  Total Signals  │
│     68%         │     +2.1%       │      147        │
└─────────────────┴─────────────────┴─────────────────┘
```

- **Win Rate**: Percentage of profitable trades from historical signals
- **Avg Return**: Mean return per completed trade
- **Total Signals**: Number of signals tracked in the system

#### 2. Market Conditions
- **Current Status**: Shows if conditions favor the volatility squeeze strategy
- **Market Stats**: Total signals, actionable opportunities, bullish/bearish breakdown

#### 3. Signals Table
Interactive table showing all current opportunities with:
- **Symbol**: Stock ticker (clickable for detailed analysis)
- **Price**: Current price with 20-day performance
- **Score**: Signal strength (0-100%)
- **Rank**: Opportunity quality (S, A, B, C tiers)
- **Recommendation**: Trading action (STRONG_BUY, BUY, WATCH, etc.)

## Signal Quality Ranking

### Opportunity Tiers
- **🏆 S-Tier**: Exceptional opportunities (Score ≥ 90%)
  - Extremely tight squeeze conditions
  - High volume confirmation
  - Strong trend alignment
  - Recommended position size: 3-5%

- **🥇 A-Tier**: Excellent signals (Score ≥ 80%)
  - Very tight squeeze with good confirmation
  - Above-average volume
  - Clear trend direction
  - Recommended position size: 2-3%

- **🥈 B-Tier**: Good opportunities (Score ≥ 70%)
  - Solid squeeze conditions
  - Adequate volume support
  - Moderate trend strength
  - Recommended position size: 1-2%

- **🥉 C-Tier**: Fair signals (Score ≥ 60%)
  - Basic squeeze detected
  - Limited confirmation factors
  - Suitable for experienced traders
  - Recommended position size: 0.5-1%

### Recommendations
- **STRONG_BUY**: High-conviction long position
- **BUY**: Standard long position
- **WATCH**: Monitor for entry opportunity
- **HOLD**: Maintain existing position
- **SELL/STRONG_SELL**: Short opportunity (advanced traders)

## Using the Signal Detail Sidebar

Click any signal row to open the detailed analysis sidebar:

### Price & Performance Section
- **Current Price**: Real-time stock price
- **vs 20D High/Low**: Performance relative to recent range
- **Day Range**: Today's trading range

### Signal Analysis Section
- **Overall Score**: Comprehensive signal strength
- **Signal Strength**: Core squeeze intensity
- **Technical Score**: Supporting technical indicators
- **Signal Quality**: Qualitative assessment (Exceptional, Excellent, etc.)

### Volatility Squeeze Section
- **Squeeze Status**: Current compression level
- **BB Width Percentile**: How tight the squeeze is (lower = tighter)
- **Is Squeeze**: Boolean confirmation of squeeze condition
- **Is Expansion**: Whether the squeeze is breaking out

### Risk Management Section
- **Stop Loss**: Calculated stop loss level
- **Stop Distance**: Percentage distance to stop
- **Position Size**: Recommended portfolio allocation

## Trading Strategies

### Day Trading Approach
**Best for**: Active traders with time to monitor positions

1. **Focus on S-Tier and A-Tier signals**
2. **Entry**: Enter on squeeze confirmation with volume
3. **Stop Loss**: Use tight stops (1-2 ATR below entry)
4. **Target**: Look for 1-3% moves within 1-5 days
5. **Position Size**: 2-5% of portfolio per trade

**Example Day Trading Workflow**:
```
1. Scan for S-Tier signals in morning
2. Wait for volume confirmation (>1.5x average)
3. Enter position on breakout
4. Set stop loss at calculated level
5. Take profits at 2-3% or end of day
```

### Swing Trading Approach
**Best for**: Part-time traders with longer time horizons

1. **Consider A-Tier and B-Tier signals**
2. **Entry**: Enter on initial squeeze detection
3. **Stop Loss**: Use wider stops (2-3 ATR)
4. **Target**: Look for 3-8% moves over 5-20 days
5. **Position Size**: 1-3% of portfolio per trade

**Example Swing Trading Workflow**:
```
1. Review signals weekly
2. Build watchlist of B-Tier and above
3. Enter positions gradually
4. Hold through squeeze expansion
5. Exit on trend exhaustion or stop loss
```

### Portfolio Integration
**Best for**: Long-term investors seeking tactical opportunities

1. **Focus on high-quality signals only (A-Tier+)**
2. **Integration**: Use as overlay on existing portfolio
3. **Sizing**: Limit to 10-20% of total portfolio
4. **Timeframe**: Hold until technical picture changes

## Risk Management Guidelines

### Position Sizing Rules
- **Never risk more than 1-2% per trade**
- **Total squeeze positions should not exceed 20% of portfolio**
- **Reduce size in high-volatility environments**
- **Increase size for exceptional (S-Tier) opportunities**

### Stop Loss Management
```python
# Automatic stop loss calculation
def calculate_stop_loss(entry_price, atr, signal_strength):
    base_multiplier = 1.5
    
    # Tighter stops for higher quality signals
    if signal_strength > 0.8:
        multiplier = 1.2
    elif signal_strength < 0.4:
        multiplier = 2.0
    else:
        multiplier = base_multiplier
    
    stop_distance = atr * multiplier
    return entry_price - stop_distance  # For long positions
```

### Risk Monitoring
- **Track win rate**: Aim for >60% profitable trades
- **Monitor drawdown**: Alert if portfolio drops >5%
- **Review performance**: Weekly analysis of closed positions
- **Adjust sizing**: Reduce after losing streaks

## Market Conditions & Timing

### Optimal Conditions for Strategy
- **Low VIX Environment**: VIX < 25 typically favorable
- **Stable Market Trends**: Avoid during extreme volatility
- **Sector Rotation Periods**: Often produces good signals
- **Earnings Season**: Use caution around earnings dates

### When to Avoid
- **High VIX (>30)**: Increased false breakout risk
- **Major News Events**: Fundamental factors may override technicals
- **Market Crashes**: Focus on capital preservation
- **Low Volume Periods**: Holidays and summer months

## Performance Tracking

### Key Metrics to Monitor
1. **Win Rate**: Percentage of profitable trades
2. **Average Return**: Mean profit per trade
3. **Profit Factor**: Gross profit ÷ Gross loss
4. **Sharpe Ratio**: Risk-adjusted returns
5. **Maximum Drawdown**: Worst losing streak

### Performance Dashboard Features
Access detailed analytics at `/volatility-squeeze-scanner/performance`:

- **Historical Performance**: Complete trade history
- **Signal Leaderboard**: Best performing symbols
- **Backtest Results**: Strategy validation data
- **Risk Metrics**: Drawdown analysis and risk statistics

## Common Mistakes to Avoid

### 1. Overtrading
- **Problem**: Taking too many low-quality signals
- **Solution**: Focus on A-Tier and above signals only

### 2. Ignoring Stop Losses
- **Problem**: Holding losing positions too long
- **Solution**: Always use calculated stop levels

### 3. Poor Position Sizing
- **Problem**: Risking too much per trade
- **Solution**: Never risk more than 1-2% per position

### 4. Chasing Breakouts
- **Problem**: Entering after significant moves
- **Solution**: Enter on squeeze confirmation, not expansion

### 5. Neglecting Market Context
- **Problem**: Trading against major trends
- **Solution**: Consider broader market conditions

## Advanced Features

### Real-time Updates
The system provides live updates during market hours:
- New signals appear automatically
- Price updates every few seconds
- Performance metrics update in real-time

### Filtering & Search
- **Symbol Search**: Find specific stocks
- **Score Filtering**: Show only high-quality signals
- **Sector Filtering**: Focus on specific industries
- **Date Range**: Historical signal analysis

### Mobile Optimization
The scanner is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- All major browsers

## Getting Help

### Documentation
- **System Overview**: Complete technical documentation
- **API Reference**: For developers and advanced users
- **Performance Analysis**: Detailed strategy validation

### Best Practices
1. **Start Small**: Begin with paper trading or small positions
2. **Keep Records**: Track your own performance separately
3. **Stay Disciplined**: Follow the system rules consistently
4. **Continuous Learning**: Review and adapt your approach
5. **Risk First**: Always prioritize capital preservation

### Support Resources
- **Performance Dashboard**: Real-time strategy metrics
- **Historical Data**: Access to all past signals
- **Backtesting Tools**: Validate strategy modifications
- **Educational Content**: Ongoing strategy insights

Remember: The volatility squeeze strategy is a tool to identify opportunities, but successful trading requires discipline, risk management, and continuous learning. Always trade within your risk tolerance and consider consulting with a financial advisor for personalized advice.
