# Odyssey User Guide

## Getting Started

Welcome to Odyssey, your trading opportunity detection dashboard. This guide will help you understand and use all features effectively.

## Accessing the Dashboard

Navigate to `/odyssey` in your portfolio website to access the dashboard.

## Dashboard Layout

The dashboard is organized into four main sections:

1. **Market Overview**: Real-time market conditions
2. **Configuration**: Strategy settings and watchlist
3. **Active Opportunities**: Detected trading opportunities
4. **Detailed Analysis**: In-depth opportunity information

## Market Overview Section

### Major Indices

Four cards display the major US market indices:

- **SPY**: S&P 500 ETF (Large Cap)
- **QQQ**: Nasdaq 100 ETF (Tech-Heavy)
- **DIA**: Dow Jones ETF (Blue Chips)
- **IWM**: Russell 2000 ETF (Small Cap)

**What to Look For**:
- Green (positive) or red (negative) performance
- Volume relative to average
- Correlation between indices

### VIX Indicator

The volatility index shows market fear and uncertainty:

- **Very Low** (< 12): Extremely calm market
- **Low** (12-20): Normal conditions
- **Elevated** (20-30): Increased uncertainty
- **High** (30-40): Significant stress
- **Extreme** (> 40): Panic levels

**Trading Implications**:
- Low VIX: Better for credit spreads (sell premium)
- High VIX: Better for debit spreads (buy cheap options)

### Sector Performance

Heatmap showing all 11 S&P sectors:

- **Green**: Outperforming sectors
- **Red**: Underperforming sectors

**Use Cases**:
- Identify sector rotation
- Find relative strength opportunities
- Understand market breadth

## Configuration Section

### Strategy Settings

Click **Advanced** to access detailed configuration:

#### Credit Spread Strategy

- **Enabled**: Toggle strategy on/off
- **DTE Range**: Days to expiration (7-45 default)
- **Min R:R Ratio**: Minimum risk/reward (2:1 default)
- **Min Confidence**: Filter threshold (60% default)
- **Max Results**: Opportunities to display (20 default)
- **IV Percentile**: Optional IV rank filters

**Tuning Tips**:
- Higher R:R = Fewer, safer opportunities
- Lower confidence = More opportunities (less selective)
- Narrower DTE range = Focus on sweet spot (21-30 days)

### Watchlist Management

Add symbols you want to analyze:

1. Type symbol in input field
2. Press Enter or click Plus button
3. Remove symbols by clicking X badge

**Recommended Symbols**:
- **Liquid ETFs**: SPY, QQQ, IWM, DIA
- **Large Cap Stocks**: AAPL, MSFT, GOOGL, AMZN
- **Sector ETFs**: XLK, XLF, XLE, XLV

**Avoid**:
- Low liquidity stocks
- Penny stocks
- Wide bid-ask spreads

### Refresh Settings

- **Auto-refresh**: Enabled by default
- **Interval**: 5 minutes (configurable)
- **Manual Refresh**: Click refresh button anytime

## Active Opportunities Section

### Opportunity Tabs

- **All**: View all detected opportunities
- **Credit Spreads**: Filter for credit spread opportunities only

### Opportunity Cards

Each card displays:

- **Symbol**: Ticker being traded
- **Confidence Badge**: Strategy confidence (color-coded)
- **Direction**: Bull Put or Bear Call
- **Title**: Quick description
- **Max Profit**: Premium collected
- **Max Risk**: Spread width minus premium
- **R:R Ratio**: Risk/reward ratio
- **DTE**: Days until expiration

### Card Actions

- **More Details**: Expand to see full position details
- **View Analysis**: Open detailed modal with trade checklist

## Detailed Analysis Modal

Click **View Analysis** on any opportunity to see:

### Key Metrics

- Max Profit (green)
- Max Risk (red)
- Risk/Reward Ratio
- Days to Expiration

### Position Details

- **Direction**: Bull Put or Bear Call
- **Short Strike**: Price and premium
- **Long Strike**: Price and premium
- **Spread Width**: Distance between strikes
- **Net Premium**: Total credit collected
- **Break Even**: Price at which trade breaks even
- **Expiration Date**: Option expiration
- **Probability of Profit**: Estimated POP

### Trade Checklist

Before entering any trade, verify:

1. ✓ Current market price is appropriate
2. ✓ Options have sufficient liquidity
3. ✓ Bid-ask spread is reasonable
4. ✓ No upcoming events (earnings, dividends)
5. ✓ Position size fits risk tolerance
6. ✓ Profit target and stop loss are defined
7. ✓ Trade thesis is documented

## Understanding Credit Spreads

### Bull Put Spread

**When to Use**: Neutral to bullish outlook

**Structure**:
- Sell higher strike put
- Buy lower strike put
- Collect net premium

**Profit**: Keep premium if stock stays above short strike

**Risk**: Spread width minus premium if stock drops below long strike

### Bear Call Spread

**When to Use**: Neutral to bearish outlook

**Structure**:
- Sell lower strike call
- Buy higher strike call
- Collect net premium

**Profit**: Keep premium if stock stays below short strike

**Risk**: Spread width minus premium if stock rises above long strike

## Risk Management

### Position Sizing

**Rule of Thumb**: Risk no more than 1-2% of account per trade

Example:
- $10,000 account
- 1% risk = $100 max risk per trade
- If max risk is $50 per contract, use 2 contracts max

### When to Exit

**Take Profit**:
- At 50% of max profit (common strategy)
- At 75% of max profit (more conservative)

**Stop Loss**:
- If loss reaches 2x max profit
- If technical support/resistance is breached
- At 21 DTE if not profitable

**Early Assignment Risk**:
- Monitor ITM options closely
- Consider closing before expiration
- Be aware of dividend dates

## Best Practices

### 1. Start Small

- Begin with 1-2 contracts
- Master the strategy before scaling
- Track all trades in a journal

### 2. Use Liquid Symbols

- SPY, QQQ typically have tightest spreads
- Avoid symbols with < 1000 daily option volume
- Check bid-ask spread before entry

### 3. Manage Continuously

- Don't "set and forget"
- Adjust based on market conditions
- Take profits early when available

### 4. Diversify

- Don't put all capital in one strategy
- Spread across multiple symbols
- Vary expiration dates

### 5. Respect the Market

- Don't force trades in bad conditions
- Skip when VIX is rapidly changing
- Reduce size during earnings season

## Troubleshooting

### No Opportunities Detected

**Possible Causes**:
- Parameters too restrictive
- Watchlist symbols not suitable
- Market conditions not favorable

**Solutions**:
- Lower R:R threshold
- Reduce confidence requirement
- Add more symbols to watchlist
- Check if market is moving significantly

### Low Confidence Scores

**What It Means**: Strategy sees risk or unfavorable conditions

**Should You Trade?**:
- 80+ = High confidence, proceed
- 60-79 = Moderate, verify manually
- < 60 = Low confidence, skip or reduce size

### Data Not Updating

**Solutions**:
1. Click manual refresh button
2. Check internet connection
3. Verify browser console for errors
4. Clear browser cache

## Keyboard Shortcuts

- `Ctrl/Cmd + R`: Refresh data
- `Esc`: Close modal dialogs

## Mobile Usage

The dashboard is responsive but optimized for desktop:

- Full functionality on tablets (landscape mode)
- Limited on phones (viewing only recommended)

## Getting Help

For questions or issues:

1. Review this user guide
2. Check the strategy guide for advanced topics
3. Refer to data sources documentation for API issues

## Disclaimer

**Important**: This dashboard is for educational and informational purposes only. It does not constitute financial advice. Always:

- Do your own research
- Understand the risks
- Consider your financial situation
- Consult a financial advisor if needed
- Paper trade before using real money

Trading options involves substantial risk and is not suitable for all investors.

## Next Steps

1. Familiarize yourself with the dashboard layout
2. Configure your watchlist with preferred symbols
3. Adjust strategy parameters to your risk tolerance
4. Paper trade detected opportunities
5. Keep a trade journal
6. Review and improve your process

Happy trading! 📈

