# R&D Framework Documentation

## Overview

The R&D (Research & Development) Framework is a comprehensive system for researching trading strategies using data from multiple signal-generating services combined with real-time market data from YFinance.

## Purpose

This framework enables deep-scale research to:
- **Discover profitable patterns** across different signal types
- **Validate strategies** with historical market data
- **Correlate signals** with actual price movements
- **Backtest systematically** across multiple market conditions
- **Generate alpha** through data-driven insights

## Data Sources

### 1. Signal Generators (Supabase)
- **Unusual Options Scanner**: Identifies unusual options activity
- **Penny Stock Scanner**: Finds penny stock opportunities  
- **Volatility Squeeze Scanner**: Detects volatility squeeze setups

### 2. Market Data (YFinance)
- **Price History**: OHLCV data for signal validation
- **Technical Indicators**: Volume, moving averages, etc.
- **Performance Tracking**: Actual returns after signal detection

## Key Features

### Unified Data Model
All signals are converted to a common `UnifiedSignal` format for:
- **Cross-scanner analysis**: Compare signals from different sources
- **Standardized scoring**: Consistent metrics across all signals
- **Easy filtering**: Query by score, rank, symbol, or date range

### YFinance Integration
Enriches signal data with:
- **Historical prices**: See what happened after each signal
- **Performance metrics**: Calculate actual returns (1d, 5d, 10d)
- **Correlation analysis**: Link signal scores to market performance
- **Validation**: Verify if high-scoring signals actually perform better

### Multi-Source Data Loading
Supports loading from:
- **Supabase (Primary)**: Live database with automatic pagination
- **Local Files**: CSV/JSON exports for offline analysis
- **Direct API**: Real-time data from YFinance

### Analysis Capabilities

#### Signal Correlation
- Find signals that occurred on the same symbol
- Identify multi-source confluences (2+ scanners agree)
- Calculate correlation coefficients between sources
- Discover leading/lagging indicators

#### Statistical Analysis
- Performance metrics (Sharpe, Sortino, win rates)
- Monte Carlo simulations
- Risk-adjusted returns
- Distribution analysis

#### Pattern Recognition
- Market regime detection (bull/bear/sideways)
- Signal clustering and timing patterns
- Volume/price pattern correlation
- Seasonality and time-based patterns

### Backtesting Engine
Event-driven backtesting with:
- **Realistic assumptions**: Slippage, commissions, liquidity
- **Position sizing**: Risk-based allocation
- **Stop losses**: ATR-based or percentage-based
- **Performance tracking**: Full trade journal and metrics

### Interactive Research
- **Jupyter Notebooks**: Exploratory data analysis
- **Production Scripts**: Automated batch processing
- **CLI Tools**: Quick analysis from terminal
- **Visualizations**: Interactive charts with Plotly

## Architecture

```
rnd/
├── src/rnd_framework/         # Core framework
│   ├── data/                  # Data models & loaders
│   │   ├── models.py         # UnifiedSignal model
│   │   ├── connectors.py     # Supabase connector with pagination
│   │   └── loaders.py        # Multi-source data loader
│   ├── analysis/              # Analysis modules
│   │   ├── correlation.py    # Signal correlation analysis
│   │   ├── statistics.py     # Statistical metrics
│   │   └── patterns.py       # Pattern recognition
│   ├── backtesting/           # Backtesting engine
│   │   ├── engine.py         # Core backtest engine
│   │   ├── metrics.py        # Performance metrics
│   │   └── strategies.py     # Example strategies
│   ├── strategies/            # Trading strategies
│   │   ├── base.py           # Base strategy class
│   │   └── multi_signal.py   # Multi-source strategies
│   ├── visualization/         # Charts & reports
│   │   ├── charts.py         # Plotly visualizations
│   │   └── reports.py        # Text reports
│   ├── config.py             # Settings & environment
│   └── cli.py                # Command-line interface
├── notebooks/                 # Interactive research
│   ├── 01_data_exploration.ipynb      # YFinance integration
│   ├── 02_signal_correlation.ipynb    # Multi-source analysis
│   ├── 03_strategy_development.ipynb  # Strategy building
│   └── 04_backtesting.ipynb          # Backtest execution
├── scripts/                   # Production scripts
│   ├── run_analysis.py       # Batch signal analysis
│   ├── backtest_strategy.py  # Strategy backtesting
│   └── generate_report.py    # Report generation
├── data/                      # Data storage
│   ├── raw/                  # Raw exports
│   └── results/              # Analysis results
└── docs/                      # Documentation
    └── README.md             # This file
```

## Quick Start

### 1. Installation

```bash
cd rnd
poetry install
```

### 2. Configuration

The framework automatically finds your root `.env` file. Required variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Verify Setup

```bash
poetry run python -c "from rnd_framework.config import settings; \
print(f'Supabase: {\"OK\" if settings.supabase_url else \"MISSING\"}')"
```

### 4. Run First Analysis

```bash
# Analyze last 30 days with YFinance data
poetry run python scripts/run_analysis.py --days 30 --find-confluence

# View results
cat data/results/signal_summary_*.txt
cat data/results/confluence_report_*.txt
```

### 5. Interactive Exploration

```bash
# Launch Jupyter notebook with YFinance integration
poetry run jupyter notebook notebooks/01_data_exploration.ipynb
```

## Usage Examples

### Load Signals with Market Data

```python
from rnd_framework.data.loaders import DataLoader
import yfinance as yf

# Load signals
loader = DataLoader()
signals = loader.load_all_signals(days=30, min_score=0.7)

# Get top symbol
top_symbol = signals[0].symbol

# Fetch market data
ticker = yf.Ticker(top_symbol)
hist = ticker.history(period="1mo")

# Analyze performance
entry_price = hist.loc[signals[0].scan_date, 'Close']
current_price = hist['Close'].iloc[-1]
return_pct = ((current_price - entry_price) / entry_price) * 100

print(f"{top_symbol}: {return_pct:.2f}% return")
```

### Find Multi-Source Confluences

```python
from rnd_framework.analysis.correlation import CorrelationAnalyzer

analyzer = CorrelationAnalyzer()
confluences = analyzer.find_confluences(
    signals,
    time_window_hours=24,
    min_sources=2
)

for conf in confluences:
    print(f"{conf['symbol']}: {conf['source_count']} sources agree")
    print(f"  Combined score: {conf['avg_score']:.2f}")
```

### Backtest a Strategy

```python
from rnd_framework.backtesting.engine import BacktestEngine
from rnd_framework.backtesting.strategies import SimpleScoreStrategy

engine = BacktestEngine(
    initial_capital=10000,
    commission=0.001,
    slippage=0.0005
)

strategy = SimpleScoreStrategy(min_score=0.8, max_positions=5)
results = engine.run(strategy, signals)

print(f"Total Return: {results.total_return:.2f}%")
print(f"Sharpe Ratio: {results.sharpe_ratio:.2f}")
print(f"Win Rate: {results.win_rate:.2f}%")
```

## Research Workflow

### Phase 1: Data Exploration
**Goal**: Understand signal distribution and quality

**Tools**:
- `notebooks/01_data_exploration.ipynb` - YFinance integration
- `scripts/run_analysis.py` - Batch processing

**Questions to Answer**:
- How many signals per day/week?
- Which scanner produces highest-scoring signals?
- What's the correlation between signal score and actual returns?
- Which symbols appear most frequently?

### Phase 2: Signal Correlation
**Goal**: Find multi-source confluences

**Tools**:
- `notebooks/02_signal_correlation.ipynb` - Confluence analysis
- `CorrelationAnalyzer` class

**Questions to Answer**:
- Do signals from different scanners correlate?
- Are multi-source signals more profitable?
- Which source combinations work best?
- What's the optimal time window for confluences?

### Phase 3: Strategy Development
**Goal**: Create and test trading strategies

**Tools**:
- `notebooks/03_strategy_development.ipynb` - Strategy building
- `BaseStrategy` class for custom strategies

**Questions to Answer**:
- What entry/exit criteria work best?
- How should positions be sized?
- What stop-loss levels are optimal?
- How many concurrent positions to hold?

### Phase 4: Backtesting
**Goal**: Validate strategies with historical data

**Tools**:
- `notebooks/04_backtesting.ipynb` - Interactive backtesting
- `scripts/backtest_strategy.py` - Production backtesting

**Metrics to Track**:
- Total return and CAGR
- Sharpe and Sortino ratios
- Maximum drawdown
- Win rate and profit factor
- Risk-adjusted returns

## Configuration

### Environment Variables

```env
# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Data Paths (Optional)
DATA_DIR=data/
RESULTS_DIR=data/results/

# Backtesting (Optional)
INITIAL_CAPITAL=10000
COMMISSION_RATE=0.001
SLIPPAGE_RATE=0.0005
```

### Settings Object

```python
from rnd_framework.config import settings

# Access settings
print(settings.supabase_url)
print(settings.initial_capital)

# Override in code
settings.initial_capital = 25000
```

## Data Models

### UnifiedSignal

The core data model representing a signal from any scanner:

```python
@dataclass
class UnifiedSignal:
    # Identification
    signal_id: str
    symbol: str
    scan_date: datetime
    source: SignalSource  # unusual_options, penny_stocks, volatility_squeeze
    
    # Scoring
    overall_score: float  # 0.0 to 1.0
    opportunity_rank: OpportunityRank  # ELITE, STRONG, MODERATE, WEAK
    
    # Market Context
    price: Optional[float]
    volume: Optional[int]
    market_cap: Optional[float]
    
    # Signal-Specific Data
    raw_data: Dict[str, Any]
    
    # Metadata
    status: SignalStatus
    risk_level: RiskLevel
```

## Best Practices

### Data Loading
1. **Use pagination**: The framework handles this automatically
2. **Filter early**: Apply `min_score` to reduce memory usage
3. **Cache results**: Save loaded signals for repeated analysis

### Analysis
1. **Start broad**: Load 30-90 days of data initially
2. **Narrow focus**: Filter to specific symbols/scores after exploration
3. **Validate findings**: Always check with YFinance market data

### Backtesting
1. **Be realistic**: Include commissions and slippage
2. **Test multiple periods**: Bull, bear, and sideways markets
3. **Walk-forward**: Use rolling windows, not just in-sample
4. **Track all trades**: Keep detailed logs for review

### Performance
1. **Batch operations**: Process multiple symbols at once
2. **Limit lookback**: Don't load years of data unnecessarily
3. **Use generators**: For large datasets, stream data

## Troubleshooting

### Supabase Connection Issues

```python
# Test connection
from rnd_framework.data.connectors import SupabaseConnector

connector = SupabaseConnector()
if connector.client:
    print("✓ Connected")
else:
    print("✗ Check .env file")
```

### Missing Data

```python
# Check what data is available
from rnd_framework.data.loaders import DataLoader

loader = DataLoader()
stats = loader.get_data_stats(days=30)
print(f"Unusual Options: {stats['unusual_options']} signals")
print(f"Penny Stocks: {stats['penny_stocks']} signals")
print(f"Volatility Squeeze: {stats['volatility_squeeze']} signals")
```

### YFinance Errors

```python
import yfinance as yf

# Test a known good symbol
ticker = yf.Ticker("AAPL")
hist = ticker.history(period="5d")
if hist.empty:
    print("✗ YFinance not working")
else:
    print(f"✓ Got {len(hist)} days")
```

## Next Steps

1. **Run the notebooks**: Start with `01_data_exploration.ipynb`
2. **Analyze your signals**: Look for patterns with YFinance data
3. **Build strategies**: Use confluence analysis and backtesting
4. **Iterate**: Refine based on results

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review example notebooks for usage patterns
3. Examine the test files for additional examples

## Contributing

When adding new features:
1. Maintain the unified data model
2. Add tests for new functionality
3. Update documentation
4. Follow existing code patterns

