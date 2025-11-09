# Penny Stock Scanner - System Overview

## Overview

The Penny Stock Scanner is a professional-grade CLI service that identifies penny stocks ($0.10-$5.00) showing signs of explosive breakout potential using a volume-focused, data-driven strategy.

## Strategy Philosophy

### Why Volume-Focused?

Traditional technical analysis relies heavily on indicators like RSI, MACD, and chart patterns. These work well for large-cap stocks but **fail consistently on penny stocks** due to:
- Erratic price action with low volume days
- Limited trading history creating false signals
- Susceptibility to manipulation

**Our Solution**: Focus on what actually moves penny stocks - **VOLUME**.

Volume is the #1 predictor of penny stock explosions, hence it receives 50% of the total score.

## The "Explosion Setup" Pattern

We're looking for the classic pennying stock setup that precedes 50-200%+ moves:

```
Phase 1: CONSOLIDATION (5-10+ days)
├── Price trades in tight 10-15% range
├── Volume gradually decreases
└── Accumulation phase by smart money

Phase 2: VOLUME SURGE (2-5x normal)
├── Volume explodes 2x, 3x, 5x+ baseline
├── Price breaks above consolidation range
└── Clear breakout signal

Phase 3: EXPLOSION
├── Multiple consecutive green days
├── Higher lows forming (step pattern)
├── Continuation of momentum
└── 50-200%+ potential gains
```

## Scoring System

### Overall Score Calculation

```python
overall_score = (
    volume_analysis * 0.50 +      # THE DOMINANT SIGNAL
    momentum_consolidation * 0.30 + # Critical for timing
    relative_strength * 0.15 +     # Quality filter
    risk_liquidity * 0.05          # Safety check
)
```

### Component Breakdown

#### 1. Volume Analysis (50%)
**Why dominant**: Penny stocks don't move without volume. This is the #1 predictor.

- **Relative Volume Surge (20%)**:
  - 5x+ volume = 1.0 score
  - 3x volume = 0.85 score
  - 2x volume = 0.65 score
  - 1.5x volume = 0.40 score

- **Volume Acceleration (15%)**:
  - Measures 2-day and 5-day volume growth
  - Positive acceleration = buying pressure building
  - Scored on 0-200% growth scale

- **Volume Consistency (10%)**:
  - Multiple high-volume days > single spike
  - Scores proportion of recent days with elevated volume
  - Filters out one-day pump spikes

- **Liquidity Depth (5%)**:
  - Dollar volume must exceed $100k for tradability
  - $1M+ = 1.0 score
  - $500k+ = 0.8 score
  - $200k+ = 0.6 score

#### 2. Price Momentum & Consolidation (30%)
**Why important**: Timing the breakout from consolidation is key.

- **Consolidation Detection (12%)**:
  - Breakout from consolidation = 1.0 score
  - Currently consolidating = 0.7 score
  - Detects 5-10 day ranges <15% width

- **Price Acceleration (10%)**:
  - 20-day price change (must be positive)
  - 0-50% gain scaled to score
  - Confirms upward momentum

- **Higher Lows Pattern (5%)**:
  - Series of higher lows = accumulation
  - Binary: detected = 1.0, not detected = 0.3

- **MA Position (3%)**:
  - Price above EMA20 = 1.0 score
  - Price between EMAs = 0.7 score
  - Confirms trend direction

#### 3. Relative Strength (15%)
**Why matters**: Want stocks showing strength when market is weak.

- **Market Outperformance (8%)**:
  - Stock up while SPY flat/down = relative strength
  - TODO: Requires SPY data integration

- **Sector Leadership (4%)**:
  - Leading sector peers
  - TODO: Requires sector data integration

- **52-Week Position (3%)**:
  - 2x from lows = 1.0 score
  - 50%+ from lows = 0.8 score
  - Breaking resistance = bonus points

#### 4. Risk & Liquidity (5%)
**Why critical**: Ensures tradability and filters pump-and-dumps.

- **Bid-Ask Spread (2%)**:
  - Spread <5% of price for clean entry/exit
  - TODO: Requires bid/ask data

- **Float Analysis (2%)**:
  - Low float (<50M shares) = more volatile but can move fast
  - Scored 0.8 for low float, 0.5 for normal

- **Price Stability (1%)**:
  - Inverse of pump-and-dump risk
  - 50%+ single-day move = HIGH risk
  - Stable = 1.0 score

## Pre-Scan Filters

Before scoring, signals must pass:
- ✅ Price: $0.10 - $5.00
- ✅ Volume: >200,000 shares/day
- ✅ Dollar Volume: >$100,000/day
- ✅ Score: ≥0.60 threshold

## Opportunity Ranking

| Rank | Score Range | Description | Action |
|------|------------|-------------|---------|
| S-Tier | ≥0.90 | Exceptional setup | Strong buy consideration |
| A-Tier | ≥0.80 | Excellent signal | Buy consideration |
| B-Tier | ≥0.70 | Solid opportunity | Watch/accumulate |
| C-Tier | ≥0.60 | Fair signal | Monitor |
| D-Tier | <0.60 | Weak (filtered out) | Ignore |

## Architecture

### System Components

```
penny-stock-scanner/
├── models/              # Data models
│   ├── market_data.py   # OHLCV and indicators
│   ├── analysis.py      # Signals and results
│   └── backtest.py      # Backtesting models
├── services/            # Business logic
│   ├── data_service.py        # YFinance data fetching
│   ├── analysis_service.py    # Core signal detection
│   ├── ticker_service.py      # Database ticker queries
│   └── database_service.py    # Signal storage
├── utils/               # Utilities
│   ├── technical_indicators.py  # Indicator calculations
│   └── helpers.py              # Helper functions
├── config/              # Configuration
│   └── settings.py      # Pydantic settings
└── cli.py              # Command-line interface
```

### Data Flow

```
1. TICKER SELECTION
   └── Query penny_tickers table
       └── Filter: price $0.10-$5.00, active only

2. DATA FETCHING
   └── YFinance API (6 months of daily data)
       └── OHLCV + metadata (sector, industry, float)

3. INDICATOR CALCULATION
   └── Technical indicators
       ├── EMAs (20, 50)
       ├── Volume metrics (SMA, ratio, dollar volume)
       ├── ATR (20-period)
       ├── RSI (14-period, light weight)
       └── 52-week high/low

4. SIGNAL DETECTION
   └── Explosion setup analysis
       ├── Volume analysis (50%)
       ├── Momentum/consolidation (30%)
       ├── Relative strength (15%)
       └── Risk assessment (5%)

5. SCORING & FILTERING
   └── Calculate overall score
       └── Filter: score ≥ 0.60, volume ≥ 200k, $vol ≥ $100k

6. STORAGE & OUTPUT
   └── Store in penny_stock_signals table
       └── Display via CLI with rich formatting
```

### Database Schema

**penny_stock_signals** table stores:
- Overall scores and component scores
- Volume metrics (all volume-related data)
- Momentum metrics (consolidation, breakout, price changes)
- Relative strength metrics (52w position, etc.)
- Risk metrics (volatility, float, pump risk)
- Risk management (stop loss, position size)

**Indexes** for fast querying:
- symbol, scan_date (composite)
- overall_score (DESC)
- opportunity_rank
- is_breakout (filtered index)

## Risk Management

### Stop Loss Calculation
- ATR-based: `stop_loss = price - (ATR * 2.0)`
- Maximum 15% down from entry
- Adaptive based on volatility

### Position Sizing
- Scales with signal quality:
  - S-Tier (≥0.90): 8% of capital
  - A-Tier (≥0.80): 6.8% of capital
  - B-Tier (≥0.70): 5.6% of capital
  - C-Tier (≥0.60): 4% of capital

### Risk Warnings
- **Pump-and-Dump Detection**: Flags extreme single-day moves (>30-50%)
- **Liquidity Checks**: Ensures tradability with dollar volume minimums
- **Float Analysis**: Identifies low float (high risk, high reward)

## Performance Considerations

### Scanning Speed
- **Target**: Scan 2000+ penny stocks in <15 minutes
- **Concurrency**: 10 concurrent API requests (respects rate limits)
- **Batch Processing**: Efficient bulk operations
- **Caching**: YFinance data cached (configurable TTL)

### Data Quality
- **Completeness**: Requires 50+ days of data
- **Recency**: Flags stale data (>3 days old)
- **Validation**: NaN/null checks on all indicators
- **Quality Score**: Each signal has data quality score (0-1)

## Success Metrics

Scan Quality:
- Signal Rate: 1-3% of scanned symbols (20-60 signals per 2000 stocks)
- S/A-Tier Rate: 10-20% of all signals
- Data Retrieval: >90% success rate

Signal Quality:
- Average Score: 0.70-0.80 for identified signals
- Volume Confirmation: 100% of signals have >1.5x volume
- Breakout Rate: 30-50% actively breaking out

## Future Enhancements

### Phase 2 Features
1. **ML Signal Ranking**: Train model on historical performance
2. **Catalyst Detection**: News API integration (earnings, FDA, etc.)
3. **Pattern Recognition**: Chart patterns (cup-and-handle, flags)
4. **Social Sentiment**: Reddit/Twitter mentions integration
5. **Real-time Alerts**: WebSocket-based live monitoring
6. **SPY Integration**: Market outperformance calculations
7. **Sector Data**: Sector leadership scoring

### Backtesting
- Historical signal validation
- Win rate tracking
- Average return analysis
- Optimal parameter tuning

## Limitations

### Strategy Limitations
- **No Catalyst Detection**: Currently no news/earnings analysis
- **No SPY Data**: Market outperformance not yet calculated
- **No Bid/Ask Data**: Spread analysis placeholder
- **Volume Focus**: May miss low-volume accumulation setups

### Technical Limitations
- **Rate Limits**: YFinance API has limits (handled with delays)
- **Data Availability**: Some penny stocks have limited historical data
- **Real-time**: Daily data only (no intraday analysis)
- **Penny Stock Risks**: Inherent manipulation, low liquidity risks

## Best Practices

### For Traders
1. **Paper Trade First**: Test strategy before risking capital
2. **Start Small**: Begin with minimal position sizes
3. **Use Stop Losses**: Always use calculated stop levels
4. **Diversify**: Don't concentrate in one signal
5. **Track Performance**: Monitor your own results

### For Developers
1. **Respect Rate Limits**: API delays are intentional
2. **Validate Data**: Always check data quality scores
3. **Update Regularly**: Keep ticker database fresh
4. **Monitor Logs**: Check for errors and warnings
5. **Test Changes**: Validate scoring changes with historical data

