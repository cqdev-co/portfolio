# YFinance Integration Guide

## Overview

The R&D Framework integrates YFinance to enrich signal data with real market performance. This allows you to validate whether your signals actually translate to profitable trades.

## Why YFinance?

1. **Free and Reliable**: No API keys required, handles historical data well
2. **Comprehensive Data**: OHLCV, splits, dividends, fundamentals
3. **Easy to Use**: Simple Python API, well-documented
4. **Real-Time Updates**: Access to recent market data

## Core Concepts

### Signal-to-Market Pipeline

```
Scanner Signal → Load from Supabase → Enrich with YFinance → Analyze Performance
```

1. **Scanner detects opportunity** (e.g., unusual options activity)
2. **Signal stored in database** with timestamp and metadata
3. **Framework loads signal** through unified data model
4. **YFinance fetches price data** for the signal period
5. **Calculate actual returns** to validate signal quality

## Usage Patterns

### Pattern 1: Single Symbol Analysis

Analyze how one symbol performed after a signal:

```python
import yfinance as yf
from datetime import timedelta

# Load signal
signal = signals[0]

# Fetch historical data
ticker = yf.Ticker(signal.symbol)
start_date = signal.scan_date - timedelta(days=5)
end_date = signal.scan_date + timedelta(days=10)
hist = ticker.history(start=start_date, end=end_date)

# Calculate performance
entry_price = hist.loc[signal.scan_date, 'Close']
prices_after = hist[hist.index > signal.scan_date]

# Track returns over time
for i, (date, row) in enumerate(prices_after.iterrows(), 1):
    return_pct = ((row['Close'] - entry_price) / entry_price) * 100
    print(f"Day {i}: {return_pct:+.2f}%")
```

### Pattern 2: Batch Analysis

Analyze multiple signals efficiently:

```python
import yfinance as yf
import pandas as pd

def analyze_signals(signals, holding_days=[1, 5, 10]):
    """Analyze performance for multiple signals."""
    results = []
    
    # Group by symbol to minimize API calls
    signals_by_symbol = {}
    for signal in signals:
        if signal.symbol not in signals_by_symbol:
            signals_by_symbol[signal.symbol] = []
        signals_by_symbol[signal.symbol].append(signal)
    
    # Process each symbol
    for symbol, symbol_signals in signals_by_symbol.items():
        # Get date range
        min_date = min(s.scan_date for s in symbol_signals) - timedelta(days=5)
        max_date = max(s.scan_date for s in symbol_signals) + timedelta(days=15)
        
        # Fetch data once
        ticker = yf.Ticker(symbol)
        hist = ticker.history(start=min_date, end=max_date)
        
        # Analyze each signal
        for signal in symbol_signals:
            try:
                entry_date = hist.index[hist.index >= signal.scan_date].min()
                entry_price = hist.loc[entry_date, 'Close']
                
                signal_result = {
                    'symbol': symbol,
                    'signal_date': signal.scan_date,
                    'entry_price': entry_price,
                    'score': signal.overall_score,
                }
                
                # Calculate returns at multiple horizons
                for days in holding_days:
                    exit_date = entry_date + timedelta(days=days)
                    future_prices = hist[hist.index >= exit_date]
                    
                    if len(future_prices) > 0:
                        exit_price = future_prices.iloc[0]['Close']
                        return_pct = ((exit_price - entry_price) / entry_price) * 100
                        signal_result[f'return_{days}d'] = return_pct
                
                results.append(signal_result)
                
            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")
    
    return pd.DataFrame(results)

# Use it
results_df = analyze_signals(all_signals)
print(f"\nAverage 5-day return: {results_df['return_5d'].mean():.2f}%")
print(f"Win rate: {(results_df['return_5d'] > 0).mean() * 100:.1f}%")
```

### Pattern 3: Real-Time Correlation

Correlate signal scores with actual performance:

```python
import numpy as np
from scipy import stats

# Analyze signals
results_df = analyze_signals(signals)

# Calculate correlation
correlation, p_value = stats.pearsonr(
    results_df['score'],
    results_df['return_5d']
)

print(f"Correlation: {correlation:.3f}")
print(f"P-value: {p_value:.4f}")

if p_value < 0.05:
    if correlation > 0:
        print("✓ Higher scores predict better returns!")
    else:
        print("✗ Higher scores predict worse returns (inverse relationship)")
else:
    print("⚠ No significant correlation found")
```

### Pattern 4: Multi-Timeframe Analysis

Compare performance across different holding periods:

```python
import matplotlib.pyplot as plt

# Analyze at multiple timeframes
holding_periods = [1, 2, 3, 5, 7, 10, 15, 20]
results_df = analyze_signals(signals, holding_days=holding_periods)

# Calculate statistics by holding period
timeframe_stats = {}
for days in holding_periods:
    col = f'return_{days}d'
    if col in results_df.columns:
        timeframe_stats[days] = {
            'mean': results_df[col].mean(),
            'median': results_df[col].median(),
            'win_rate': (results_df[col] > 0).mean() * 100,
            'max': results_df[col].max(),
        }

# Visualize
fig, axes = plt.subplots(2, 2, figsize=(15, 10))

# Mean returns
days = list(timeframe_stats.keys())
means = [timeframe_stats[d]['mean'] for d in days]
axes[0, 0].plot(days, means, marker='o', linewidth=2)
axes[0, 0].axhline(y=0, color='red', linestyle='--', alpha=0.5)
axes[0, 0].set_xlabel('Holding Days')
axes[0, 0].set_ylabel('Mean Return (%)')
axes[0, 0].set_title('Average Returns by Holding Period')
axes[0, 0].grid(True, alpha=0.3)

# Win rates
win_rates = [timeframe_stats[d]['win_rate'] for d in days]
axes[0, 1].plot(days, win_rates, marker='s', linewidth=2, color='green')
axes[0, 1].axhline(y=50, color='red', linestyle='--', alpha=0.5)
axes[0, 1].set_xlabel('Holding Days')
axes[0, 1].set_ylabel('Win Rate (%)')
axes[0, 1].set_title('Win Rate by Holding Period')
axes[0, 1].grid(True, alpha=0.3)

# Max returns
max_returns = [timeframe_stats[d]['max'] for d in days]
axes[1, 0].bar(days, max_returns, color='blue', alpha=0.6)
axes[1, 0].set_xlabel('Holding Days')
axes[1, 0].set_ylabel('Max Return (%)')
axes[1, 0].set_title('Best Trade by Holding Period')
axes[1, 0].grid(True, alpha=0.3)

# Distribution for 5-day returns
axes[1, 1].hist(results_df['return_5d'], bins=30, edgecolor='black', alpha=0.7)
axes[1, 1].axvline(x=0, color='red', linestyle='--', alpha=0.5)
axes[1, 1].set_xlabel('5-Day Return (%)')
axes[1, 1].set_ylabel('Frequency')
axes[1, 1].set_title('Distribution of 5-Day Returns')
axes[1, 1].grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
```

## Advanced Features

### 1. Technical Indicators

Add technical indicators to your analysis:

```python
import yfinance as yf
import pandas as pd

def add_technical_indicators(hist):
    """Calculate common technical indicators."""
    # Moving averages
    hist['SMA_20'] = hist['Close'].rolling(window=20).mean()
    hist['SMA_50'] = hist['Close'].rolling(window=50).mean()
    
    # RSI
    delta = hist['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    hist['RSI'] = 100 - (100 / (1 + rs))
    
    # Volume analysis
    hist['Volume_SMA'] = hist['Volume'].rolling(window=20).mean()
    hist['Volume_Ratio'] = hist['Volume'] / hist['Volume_SMA']
    
    return hist

# Use it
ticker = yf.Ticker(signal.symbol)
hist = ticker.history(period="3mo")
hist = add_technical_indicators(hist)

# Check indicators at signal time
signal_indicators = hist.loc[signal.scan_date]
print(f"RSI: {signal_indicators['RSI']:.1f}")
print(f"Volume Ratio: {signal_indicators['Volume_Ratio']:.2f}x")
```

### 2. Market Context

Compare signal performance to market:

```python
def analyze_with_market_context(signals, benchmark='SPY'):
    """Analyze signals relative to market performance."""
    # Fetch benchmark data
    spy = yf.Ticker(benchmark)
    spy_hist = spy.history(period="3mo")
    
    results = []
    for signal in signals:
        ticker = yf.Ticker(signal.symbol)
        hist = ticker.history(
            start=signal.scan_date,
            end=signal.scan_date + timedelta(days=5)
        )
        
        if len(hist) < 2:
            continue
        
        # Calculate signal return
        signal_return = (
            (hist['Close'].iloc[-1] - hist['Close'].iloc[0])
            / hist['Close'].iloc[0]
        ) * 100
        
        # Calculate market return for same period
        market_data = spy_hist[
            (spy_hist.index >= hist.index[0]) &
            (spy_hist.index <= hist.index[-1])
        ]
        
        if len(market_data) < 2:
            continue
        
        market_return = (
            (market_data['Close'].iloc[-1] - market_data['Close'].iloc[0])
            / market_data['Close'].iloc[0]
        ) * 100
        
        # Calculate alpha (excess return)
        alpha = signal_return - market_return
        
        results.append({
            'symbol': signal.symbol,
            'signal_return': signal_return,
            'market_return': market_return,
            'alpha': alpha,
            'score': signal.overall_score
        })
    
    df = pd.DataFrame(results)
    
    print("\nMarket-Adjusted Performance:")
    print(f"Average Signal Return: {df['signal_return'].mean():+.2f}%")
    print(f"Average Market Return: {df['market_return'].mean():+.2f}%")
    print(f"Average Alpha: {df['alpha'].mean():+.2f}%")
    print(f"Alpha > 0: {(df['alpha'] > 0).mean() * 100:.1f}%")
    
    return df
```

### 3. Risk-Adjusted Returns

Calculate Sharpe ratio for signals:

```python
def calculate_sharpe_ratio(returns, risk_free_rate=0.04):
    """Calculate Sharpe ratio for a series of returns."""
    # Annualize returns (assuming daily)
    mean_return = returns.mean() * 252
    std_return = returns.std() * np.sqrt(252)
    
    # Calculate Sharpe
    sharpe = (mean_return - risk_free_rate) / std_return
    
    return sharpe

# Use it
results_df = analyze_signals(signals, holding_days=[5])
daily_returns = results_df['return_5d'] / 5  # Convert to daily
sharpe = calculate_sharpe_ratio(daily_returns)

print(f"Sharpe Ratio: {sharpe:.2f}")
if sharpe > 1.0:
    print("✓ Good risk-adjusted returns")
elif sharpe > 0.5:
    print("⚠ Acceptable risk-adjusted returns")
else:
    print("✗ Poor risk-adjusted returns")
```

## Best Practices

### 1. Rate Limiting

YFinance has informal rate limits. Be respectful:

```python
import time

for symbol in symbols:
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="1mo")
    # Process data...
    time.sleep(0.5)  # Small delay between requests
```

### 2. Error Handling

Always handle potential errors:

```python
def safe_fetch(symbol, start_date, end_date):
    """Fetch data with error handling."""
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(start=start_date, end=end_date)
        
        if hist.empty:
            print(f"⚠ {symbol}: No data available")
            return None
        
        return hist
        
    except Exception as e:
        print(f"✗ {symbol}: {type(e).__name__} - {e}")
        return None
```

### 3. Caching

Cache YFinance data to avoid repeated API calls:

```python
import pickle
from pathlib import Path

def get_cached_data(symbol, start_date, end_date, cache_dir='data/yfinance_cache'):
    """Get data from cache or fetch if not available."""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(exist_ok=True)
    
    # Create cache key
    cache_key = f"{symbol}_{start_date}_{end_date}.pkl"
    cache_file = cache_dir / cache_key
    
    # Check cache
    if cache_file.exists():
        with open(cache_file, 'rb') as f:
            return pickle.load(f)
    
    # Fetch and cache
    ticker = yf.Ticker(symbol)
    hist = ticker.history(start=start_date, end=end_date)
    
    with open(cache_file, 'wb') as f:
        pickle.dump(hist, f)
    
    return hist
```

## Troubleshooting

### Issue: No data returned

**Cause**: Symbol might be delisted, date range invalid, or temporary API issue

**Solution**:
```python
ticker = yf.Ticker("YOUR_SYMBOL")
hist = ticker.history(period="1mo")

if hist.empty:
    # Try alternate period
    hist = ticker.history(period="max")
    
if hist.empty:
    print(f"Symbol might be delisted: {ticker.info.get('longName', 'Unknown')}")
```

### Issue: Mismatched dates

**Cause**: Markets are closed on weekends/holidays

**Solution**:
```python
# Don't use exact date matching
entry_date = hist.index[hist.index >= signal.scan_date].min()  # Next available

# Not this:
entry_price = hist.loc[signal.scan_date, 'Close']  # May not exist
```

### Issue: Slow performance

**Cause**: Fetching data for many symbols

**Solution**:
```python
# Batch by symbol
signals_by_symbol = {}
for signal in signals:
    if signal.symbol not in signals_by_symbol:
        signals_by_symbol[signal.symbol] = []
    signals_by_symbol[signal.symbol].append(signal)

# Process in parallel
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {
        executor.submit(process_symbol, symbol, sigs): symbol
        for symbol, sigs in signals_by_symbol.items()
    }
```

## Examples in Notebooks

See these notebooks for complete examples:

1. **`01_data_exploration.ipynb`**: Basic YFinance integration
2. **`02_signal_correlation.ipynb`**: Multi-source signal validation
3. **`04_backtesting.ipynb`**: Full backtesting with YFinance

## Next Steps

1. Start with the data exploration notebook
2. Analyze your top signals with YFinance
3. Calculate correlations between scores and returns
4. Build strategies based on validated patterns

