# Call Debit Spread Finder - Documentation

## Overview

The Call Debit Spread Finder is a specialized tool designed to identify high-confidence Call Debit Spread opportunities from unusual options signals. It combines technical analysis, fundamental analysis, signal quality metrics, and options-specific factors to rank opportunities.

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                  CLI Interface (Typer)                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌─────────▼──────────┐
│ Signal Fetcher │      │ Market Data        │
│  (Supabase)    │      │  Provider (yfinance)│
└───────┬────────┘      └─────────┬──────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌─────────▼──────────┐
│ Technical      │      │ Fundamental        │
│ Analyzer       │      │ Analyzer           │
└───────┬────────┘      └─────────┬──────────┘
        │                         │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼────────┐      ┌─────────▼──────────┐
│ Options         │      │ Call Debit Spread  │
│ Analyzer        │      │ Calculator         │
└───────┬────────┘      └─────────┬──────────┘
        │                         │
        └────────────┬────────────┘
                     │
            ┌────────▼────────┐
            │ Composite Scorer │
            └──────────────────┘
```

## Scoring Methodology

### Technical Analysis (30% weight)

**Indicators Calculated:**
- RSI (14-day)
- Moving Averages (SMA 20/50/200, EMA 12/26)
- MACD (12/26/9)
- Momentum (5d, 10d, 20d)
- Volume ratio
- Support/Resistance levels
- Trend direction

**Scoring Breakdown:**
- RSI in sweet spot (40-60): 25 points
- Price above key MAs: 20 points
- Positive momentum: 15 points
- Volume confirmation: 15 points
- MACD bullish: 15 points
- Support/resistance alignment: 10 points

### Options Analysis (30% weight)

**Metrics Analyzed:**
- IV Rank (prefer < 50)
- Delta (target 0.30-0.50)
- Probability of Profit
- Risk/Reward Ratio (target > 2:1)
- Time decay impact
- Strike width optimization

**Scoring Breakdown:**
- IV Rank favorable (< 50): 25 points
- Good delta (0.30-0.50): 20 points
- High POP (> 50%): 20 points
- Strong R:R (> 2:1): 20 points
- Reasonable time decay: 10 points
- Strike width optimal: 5 points

### Signal Quality (25% weight)

**Factors Considered:**
- Grade (S/A/B/C/D/F)
- Premium Flow
- Volume Ratio
- Overall Score
- Confidence (if available)
- Detection Flags (sweep, block trade, etc.)
- Risk Level

**Scoring Breakdown:**
- Grade: S=100, A=85, B=70, C=55
- Premium Flow: Normalized 0-100
- Volume Ratio: Normalized 0-100
- Overall Score: Weighted contribution
- Detection Flags: Bonus points
- Risk Level: Penalty for HIGH/EXTREME

### Fundamental Analysis (15% weight)

**Metrics Extracted:**
- P/E Ratio
- Earnings Growth (YoY)
- Revenue Growth (YoY)
- Market Cap
- Profit Margins
- Debt/Equity Ratio
- Earnings Catalyst Proximity

**Scoring Breakdown:**
- P/E ratio reasonable: 20 points
- Earnings growth positive: 20 points
- Market cap appropriate: 15 points
- Revenue growth: 15 points
- Profit margins healthy: 15 points
- Low debt: 10 points
- Earnings catalyst proximity: 5 points

## Call Debit Spread Calculation

### Strike Selection Logic

**Long Strike:**
- Prefer signal strike if reasonable (95%-110% of current price)
- Otherwise: ATM or slightly OTM (5-10% above current)

**Short Strike:**
- Target width based on stock price:
  - < $50: $5 width
  - $50-$100: $7.50 width
  - $100-$200: $10 width
  - > $200: $15 width
- Positioned 5-15% OTM to capture premium

### Spread Metrics

- **Net Debit**: Long premium - Short premium
- **Max Profit**: Strike width - Net debit
- **Max Loss**: Net debit
- **Risk/Reward**: Max profit / Max loss
- **Breakeven**: Long strike + Net debit
- **Probability of Profit**: Calculated using Black-Scholes approximation

## Database Schema Integration

The tool reads from the `unusual_options_signals` table with the following key fields:

- `signal_id`: Unique identifier
- `ticker`: Stock symbol
- `option_type`: 'call' or 'put'
- `sentiment`: 'BULLISH', 'BEARISH', 'NEUTRAL'
- `grade`: 'S', 'A', 'B', 'C', 'D', 'F'
- `overall_score`: 0.0-1.0
- `premium_flow`: Dollar amount
- `volume_ratio`: Current vs average
- `underlying_price`: Current stock price
- `implied_volatility`: IV value
- `iv_rank`: IV rank percentile
- `days_to_expiry`: Days until expiration
- `is_active`: Active signal flag

## Usage Examples

### Basic Scan

```bash
poetry run cds-finder scan
```

### Filtered Scan

```bash
poetry run cds-finder scan \
  --top-n 5 \
  --min-grade A \
  --min-pop 55 \
  --min-rr 2.5 \
  --rsi-min 40 \
  --rsi-max 60
```

### Analyze Specific Ticker

```bash
poetry run cds-finder analyze AAPL --min-grade S
```

## Performance Optimization

### Caching Strategy

- Market data can be cached to reduce API calls
- Option chains cached per ticker/expiry
- Historical data cached per ticker

### Parallel Processing

- Signals can be analyzed in parallel
- Market data fetching can be batched
- Option chain lookups can be parallelized

## Error Handling

The tool handles various error scenarios:

- Missing market data: Uses defaults or skips signal
- Invalid option chains: Logs warning and skips
- Database connection errors: Raises clear error message
- API rate limits: Implements retry logic

## Future Enhancements

Potential improvements:

1. **Caching Layer**: Add Redis or file-based caching
2. **Parallel Processing**: Analyze multiple signals concurrently
3. **Backtesting**: Historical performance analysis
4. **Alert System**: Notifications for golden opportunities
5. **Portfolio Integration**: Track positions and P&L
6. **Machine Learning**: Improve scoring with ML models

## Troubleshooting

### Common Issues

**No signals found:**
- Check Supabase connection
- Verify filters aren't too restrictive
- Ensure signals exist in database

**Missing option chain data:**
- Verify ticker symbol is correct
- Check expiry date is valid
- Ensure market is open for real-time data

**Slow performance:**
- Reduce number of signals analyzed
- Check network connection
- Consider caching market data

## Contributing

This is a personal project. For suggestions or bug reports, please open an issue.

