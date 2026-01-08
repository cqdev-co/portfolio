# Penny Stock Scanner Documentation

Professional-grade scanner for identifying penny stocks before they explode.

## 📑 Documentation Index

- **[System Overview](system-overview.md)** - Architecture, strategy, and technical details
- **[User Guide](user-guide.md)** - Complete CLI usage guide with examples
- **[Technical Implementation](technical-implementation.md)** - Developer documentation
- **[Frontend Integration](frontend-integration.md)** - Web interface and real-time dashboard

## 🎯 Quick Start

```bash
# Install dependencies
cd penny-stock-scanner
poetry install

# Setup environment
cp env.example .env
# Edit .env with your API keys

# Analyze a single stock
penny-scanner analyze AEMD

# Scan all penny stocks
penny-scanner scan-all --min-score 0.70 --output results.json
```

## 🔑 Key Features

### Volume-Driven Analysis (50% Weight)

- **Relative Volume Surge**: 2x, 3x, 5x+ vs baseline
- **Volume Acceleration**: Multi-day growth trends
- **Volume Consistency**: Multiple high-volume days
- **Liquidity Depth**: Dollar volume >$100k

### Price Momentum & Consolidation (30% Weight)

- **Consolidation Detection**: Tight trading range (5-10 days)
- **Breakout Identification**: Volume-confirmed breakouts
- **Price Acceleration**: Multi-period momentum
- **Higher Lows Pattern**: Accumulation detection

### Relative Strength (15% Weight)

- **Market Outperformance**: Stock vs SPY
- **Sector Leadership**: Relative to peers
- **52-Week Position**: Distance from highs/lows

### Risk & Liquidity (5% Weight)

- **Bid-Ask Spread**: <5% for clean entry/exit
- **Float Analysis**: Low float (<50M shares) identification
- **Price Stability**: Pump-and-dump detection

## 🏆 Opportunity Ranks

- **S-Tier** (≥0.82): Exceptional - strong volume, clean consolidation breakout
- **A-Tier** (≥0.72): Excellent - high volume surge, good momentum
- **B-Tier** (≥0.62): Solid - decent volume, positive momentum (best actual win rate!)
- **C-Tier** (≥0.55): Fair - minimal requirements met

> **Note (Jan 2026)**: Due to late entry penalty, B-Tier signals often outperform higher tiers
> because they catch moves earlier. See [performance analysis](performance-analysis-jan-2026.md).

## 📊 The "Explosion Setup" Pattern

The ideal penny stock signal we're looking for:

1. ✅ **Consolidation**: Stock trades in tight 10-15% range for 5-10+ days
2. ✅ **Volume Dries Up**: Accumulation phase with decreasing volume
3. ✅ **Volume Surge**: 2-5x normal volume with price breakout
4. ✅ **Higher Lows**: Series of higher lows forming (accumulation)
5. ✅ **Market Outperformance**: Stock up while market flat/down
6. ✅ **Consecutive Green Days**: Multiple up days in a row

## 🚀 Strategy Advantages

### Why Volume-Focused?

- **Volume is King**: Penny stocks don't move without volume - 50% weight reflects this reality
- **Consolidation + Breakout**: The classic "coiling spring" setup that leads to 50-200%+ moves
- **Avoid False Signals**: Traditional indicators (RSI, MACD) are unreliable on penny stocks

### Key Differences from Traditional Analysis

- ❌ **Avoid**: Heavy reliance on RSI/MACD (unreliable on pennies)
- ❌ **Avoid**: Traditional chart patterns (pennies don't respect them consistently)
- ✅ **Focus**: Volume as primary signal (50% vs typical 20-30%)
- ✅ **Focus**: Consolidation + breakout patterns (proven setup)
- ✅ **Focus**: Strict liquidity filters (avoid traps)

## 📚 Additional Resources

- **Database Schema**: `db/penny_stock_signals.sql`
- **Frontend Dashboard**: `/penny-stock-scanner` - View signals in real-time web interface
- **API Examples**: See user guide for programmatic usage
- **Backtesting**: Coming soon - validate strategy performance
- **AI Integration**: Optional AI analysis for signal classification

### Performance Analysis & Improvements

- **[Performance Analysis (Jan 2026)](performance-analysis-jan-2026.md)**: Latest analysis - score inversion fix, late entry penalty, minimum hold period
- **[Performance Improvements (Dec 2025)](performance-improvements-dec-2025.md)**: Stop loss widening, breakout detection, tier adjustments

## ⚠️ Risk Disclaimer

This tool is for educational and research purposes. Trading penny stocks involves significant risk of loss. Always:

- Do your own research
- Never invest more than you can afford to lose
- Use proper risk management (stop losses, position sizing)
- Be aware of pump-and-dump schemes
- Understand that past performance doesn't guarantee future results

## 🤝 Support

For issues, questions, or feature requests:

- Check the documentation in `docs/penny-stock-scanner/`
- Review the README in the service directory
- Ensure your `.env` file is properly configured

## 📄 License

Proprietary software. All rights reserved.
