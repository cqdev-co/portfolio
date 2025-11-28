# Timezone Handling in R&D Framework

## Overview

Financial data comes from multiple sources with different timezone conventions. Proper timezone handling is critical for accurate signal-to-market correlation.

## The Problem

**Signal Data (Supabase)**: Stored in **EST** (America/New_York)
- Unusual Options Scanner: Detects signals in EST
- Penny Stock Scanner: Stores timestamps in EST  
- Volatility Squeeze Scanner: Scans in EST

**Market Data (YFinance)**: Returns data in **Market Timezone**
- Can be EST, PST, or UTC depending on the exchange
- Index is timezone-aware (pandas DatetimeIndex with tzinfo)
- Different markets have different conventions

**The Issue**: If you don't normalize timezones, you'll:
- Miss signals by comparing different timezones
- Calculate returns from wrong entry points
- Get incorrect correlation between scores and performance

## The Solution

The framework provides timezone utilities in `rnd_framework.utils.timezone`:

### Key Functions

#### 1. `to_est(dt)` - Convert Any Datetime to EST

```python
from rnd_framework.utils.timezone import to_est

# Works with strings
est_dt = to_est("2025-11-16 09:30:00")

# Works with pandas Timestamps
signal_date = pd.to_datetime(signal['scan_date'])
est_date = to_est(signal_date)

# Works with naive or aware datetimes
dt = datetime.now()
est_dt = to_est(dt)
```

#### 2. `normalize_market_data_timezone(df)` - Normalize YFinance Data

```python
from rnd_framework.utils.timezone import normalize_market_data_timezone

# Fetch data from YFinance
ticker = yf.Ticker("AAPL")
hist = ticker.history(period="1mo")

# Normalize to EST (same as signal data)
hist = normalize_market_data_timezone(hist)

# Now hist.index is in EST timezone
print(hist.index[0].tzinfo)  # America/New_York
```

#### 3. `find_closest_market_date()` - Match Signals to Market Dates

```python
from rnd_framework.utils.timezone import find_closest_market_date

# Signal detected on a weekend
signal_date = to_est("2025-11-16 21:30:00")  # Saturday night

# Find next available trading day
entry_date = find_closest_market_date(
    signal_date,
    hist.index,  # YFinance data
    direction='forward'  # Next available date
)

# entry_date will be Monday's market data
```

## Workflow Examples

### Example 1: Basic Signal Analysis

```python
from rnd_framework.data.loaders import DataLoader
from rnd_framework.utils.timezone import to_est, normalize_market_data_timezone
import yfinance as yf

# Load signals (stored in EST)
loader = DataLoader()
signals = loader.load_unusual_options(days=7, min_score=0.8)

# Get top signal
signal = signals[0]
signal_date = to_est(signal.scan_date)

# Fetch market data
ticker = yf.Ticker(signal.symbol)
hist = ticker.history(period="1mo")

# Normalize to EST
hist = normalize_market_data_timezone(hist)

# Now both are in EST - safe to compare!
entry_price = hist.loc[signal_date.date(), 'Close']
current_price = hist['Close'].iloc[-1]

print(f"Signal time (EST): {signal_date}")
print(f"Entry price: ${entry_price:.2f}")
print(f"Return: {((current_price - entry_price) / entry_price) * 100:.2f}%")
```

### Example 2: Handle Weekends/Holidays

```python
from rnd_framework.utils.timezone import find_closest_market_date

# Signal detected after market close on Friday
signal_date = to_est("2025-11-15 17:30:00")  # 5:30 PM EST Friday

# Market data
ticker = yf.Ticker("GOOGL")
hist = ticker.history(period="1mo")
hist = normalize_market_data_timezone(hist)

# Find next available trading day (Monday)
try:
    entry_date = find_closest_market_date(
        signal_date,
        hist.index,
        direction='forward'
    )
    
    entry_price = hist.loc[entry_date, 'Close']
    time_diff = (entry_date - signal_date).total_seconds() / 3600
    
    print(f"Signal: {signal_date}")
    print(f"Entry: {entry_date}")
    print(f"Delay: {time_diff:.1f} hours (weekend)")
    
except ValueError as e:
    print(f"No market data available: {e}")
```

### Example 3: Batch Processing with Timezone Handling

```python
from rnd_framework.utils.timezone import (
    to_est, normalize_market_data_timezone, find_closest_market_date
)

def analyze_signals_with_market_data(signals):
    """Analyze signals with proper timezone handling."""
    results = []
    
    # Group by symbol to minimize API calls
    symbols_dict = {}
    for signal in signals:
        if signal.symbol not in symbols_dict:
            symbols_dict[signal.symbol] = []
        symbols_dict[signal.symbol].append(signal)
    
    # Process each symbol
    for symbol, symbol_signals in symbols_dict.items():
        # Fetch market data once
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo")
        
        if hist.empty:
            continue
        
        # Normalize to EST
        hist = normalize_market_data_timezone(hist)
        
        # Process each signal
        for signal in symbol_signals:
            # Convert signal date to EST
            signal_date = to_est(signal.scan_date)
            
            try:
                # Find closest market date
                entry_date = find_closest_market_date(
                    signal_date,
                    hist.index,
                    direction='forward'
                )
                
                entry_price = hist.loc[entry_date, 'Close']
                
                # Calculate 5-day return
                future_date = entry_date + pd.Timedelta(days=5)
                future_prices = hist[hist.index >= future_date]
                
                if len(future_prices) > 0:
                    exit_price = future_prices.iloc[0]['Close']
                    return_pct = ((exit_price - entry_price) / entry_price) * 100
                    
                    results.append({
                        'symbol': symbol,
                        'signal_date': signal_date,
                        'entry_date': entry_date,
                        'delay_hours': (entry_date - signal_date).total_seconds() / 3600,
                        'score': signal.overall_score,
                        'return': return_pct
                    })
            
            except ValueError:
                continue  # No market data
    
    return pd.DataFrame(results)

# Use it
results_df = analyze_signals_with_market_data(all_signals)

print(f"Analyzed {len(results_df)} signals")
print(f"Average delay: {results_df['delay_hours'].mean():.1f} hours")
print(f"Average return: {results_df['return'].mean():.2f}%")
```

## Utility Functions Reference

### `to_est(dt)`
Converts any datetime to EST timezone.

**Parameters:**
- `dt`: datetime, pd.Timestamp, or string

**Returns:**
- Timezone-aware datetime in EST

**Example:**
```python
est_dt = to_est("2025-11-16 14:30:00")
print(est_dt.tzinfo)  # America/New_York
```

### `normalize_market_data_timezone(df)`
Normalizes YFinance DataFrame index to EST.

**Parameters:**
- `df`: DataFrame with DatetimeIndex from YFinance

**Returns:**
- DataFrame with EST-normalized index

**Example:**
```python
hist = ticker.history(period="1mo")
hist = normalize_market_data_timezone(hist)
```

### `find_closest_market_date(target_date, market_dates, direction='forward')`
Finds closest available market date to a target date.

**Parameters:**
- `target_date`: Target date to match
- `market_dates`: DatetimeIndex from YFinance
- `direction`: 'forward' (next) or 'backward' (previous)

**Returns:**
- Closest available market date

**Raises:**
- `ValueError`: If no suitable date found

**Example:**
```python
# Signal on Saturday, find Monday
entry = find_closest_market_date(signal_date, hist.index, 'forward')
```

### `get_market_date(signal_date)`
Gets the market date (EST) for a signal, normalized to market open.

**Parameters:**
- `signal_date`: Signal timestamp

**Returns:**
- Market date at 9:30 AM EST

**Example:**
```python
market_open = get_market_date(signal.scan_date)
```

### `is_market_hours(dt)`
Checks if datetime is during regular market hours (9:30 AM - 4:00 PM EST, weekdays).

**Parameters:**
- `dt`: Datetime to check

**Returns:**
- `True` if during market hours

**Example:**
```python
if is_market_hours(signal.scan_date):
    print("Signal during market hours")
else:
    print("Signal after hours")
```

## Best Practices

### 1. Always Normalize Early

```python
# Good
hist = ticker.history(period="1mo")
hist = normalize_market_data_timezone(hist)  # Do this immediately
# Now work with hist...

# Bad
hist = ticker.history(period="1mo")
# Work with hist without normalizing...
# Timezone bugs!
```

### 2. Use `find_closest_market_date()` for Matching

```python
# Good - handles weekends/holidays
entry_date = find_closest_market_date(signal_date, hist.index, 'forward')
entry_price = hist.loc[entry_date, 'Close']

# Bad - will fail on weekends
entry_price = hist.loc[signal_date, 'Close']  # KeyError!
```

### 3. Convert Signal Dates Explicitly

```python
# Good - explicit conversion
signal_date = to_est(signal.scan_date)
# Now timezone-aware

# Bad - assume it's already EST
signal_date = signal.scan_date  # Might be naive or wrong timezone
```

### 4. Track Time Differences

```python
# Useful for analysis
entry_date = find_closest_market_date(signal_date, hist.index, 'forward')
delay_hours = (entry_date - signal_date).total_seconds() / 3600

# Signals detected after hours will have longer delays
if delay_hours > 12:
    print(f"Signal was after hours, entered next day")
```

## Troubleshooting

### Issue: "cannot convert the series to <class 'int'>"

**Cause**: Trying to compare timezone-naive and timezone-aware datetimes

**Solution**:
```python
# Convert both to EST
signal_date = to_est(signal.scan_date)
hist = normalize_market_data_timezone(hist)
```

### Issue: KeyError when accessing market data by date

**Cause**: Signal date doesn't exist in market data (weekend/holiday)

**Solution**:
```python
# Don't use exact date
# entry = hist.loc[signal_date, 'Close']  # Will fail

# Use find_closest_market_date
entry_date = find_closest_market_date(signal_date, hist.index, 'forward')
entry = hist.loc[entry_date, 'Close']
```

### Issue: Returns calculated from wrong day

**Cause**: Timezone mismatch caused entry on wrong day

**Solution**:
```python
# Verify timezones match
print(f"Signal timezone: {signal_date.tzinfo}")
print(f"Market timezone: {hist.index[0].tzinfo}")

# Both should be America/New_York (EST)
```

## Summary

**Key Points:**
1. Signals are stored in EST
2. YFinance data needs to be normalized to EST
3. Use `to_est()` for all signal dates
4. Use `normalize_market_data_timezone()` for all YFinance data
5. Use `find_closest_market_date()` for matching signals to market data

**Result**: Accurate signal-to-market correlation with proper timezone handling! 🎯

