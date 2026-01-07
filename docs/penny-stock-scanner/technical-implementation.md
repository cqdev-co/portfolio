# Penny Stock Scanner - Technical Implementation

Developer documentation for the penny stock scanner service.

## Technology Stack

- **Python**: 3.11+
- **CLI Framework**: Typer + Rich (formatting)
- **Data Fetching**: yfinance
- **Database**: Supabase (PostgreSQL)
- **Data Processing**: pandas, numpy
- **Configuration**: Pydantic Settings
- **Logging**: loguru
- **Async**: asyncio

## Project Structure

```
penny-stock-scanner/
├── src/penny_scanner/
│   ├── __init__.py
│   ├── cli.py                    # Command-line interface (Typer)
│   ├── models/
│   │   ├── market_data.py        # OHLCV and indicator models
│   │   ├── analysis.py           # Signal and result models
│   │   └── backtest.py           # Backtesting models
│   ├── services/
│   │   ├── data_service.py       # YFinance data fetching
│   │   ├── analysis_service.py   # Core signal detection logic
│   │   ├── ticker_service.py     # Supabase ticker queries
│   │   └── database_service.py   # Signal storage operations
│   ├── utils/
│   │   ├── technical_indicators.py  # Indicator calculations
│   │   └── helpers.py               # Utility functions
│   ├── config/
│   │   └── settings.py           # Pydantic settings
│   └── core/
│       └── exceptions.py         # Custom exceptions
├── tests/
├── docs/
├── pyproject.toml               # Poetry dependencies
├── env.example                  # Environment template
└── README.md
```

## Key Components

### 1. Models (Pydantic)

**ExplosionSignal**: Core signal model with penny-specific metrics

```python
class ExplosionSignal(BaseModel):
    # Volume metrics (50% weight)
    volume: int
    volume_ratio: float
    volume_spike_factor: float
    volume_acceleration_2d: float
    volume_acceleration_5d: float
    volume_consistency_score: float
    dollar_volume: float

    # Momentum metrics (30% weight)
    is_consolidating: bool
    consolidation_days: Optional[int]
    is_breakout: bool
    price_change_5d: float
    price_change_10d: float
    price_change_20d: float
    higher_lows_detected: bool

    # ... (see models/analysis.py for full definition)
```

### 2. Technical Indicators

**TechnicalIndicatorCalculator**: Calculates all indicators

```python
class TechnicalIndicatorCalculator:
    def calculate_all_indicators(self, market_data):
        # EMAs (20, 50)
        # Volume metrics (SMA, ratio, dollar volume)
        # ATR (20-period)
        # RSI (14-period)
        # MACD (12,26,9)
        # 52-week high/low

    # Penny-specific calculations
    def detect_consolidation(self, ohlcv_data) -> Tuple[bool, int, float]
    def detect_higher_lows(self, ohlcv_data) -> bool
    def calculate_volume_acceleration(self, ohlcv_data) -> dict
    def calculate_volume_consistency(self, ohlcv_data) -> float
```

### 3. Analysis Service

**AnalysisService**: Core signal detection

```python
class AnalysisService:
    async def analyze_symbol(self, market_data) -> Optional[AnalysisResult]:
        # 1. Pre-filter (price, volume)
        # 2. Detect explosion signal
        # 3. Calculate component scores
        # 4. Generate overall score
        # 5. Rank opportunity
        # 6. Calculate risk management

    def _score_volume_analysis(self, metrics) -> float:
        # Volume surge: 20%
        # Volume acceleration: 15%
        # Volume consistency: 10%
        # Liquidity depth: 5%

    def _score_momentum(self, metrics) -> float:
        # Consolidation detection: 12%
        # Price acceleration: 10%
        # Higher lows pattern: 5%
        # MA position: 3%
```

### 4. Database Integration

**DatabaseService**: Signal storage and retrieval

```python
class DatabaseService:
    async def store_signal(self, result, scan_date) -> bool
    async def store_signals_batch(self, results, scan_date) -> int
    async def get_signals_by_date(self, scan_date) -> List[Dict]
    async def get_latest_signals(self, limit, min_score) -> List[Dict]
    async def get_actionable_signals(self, limit) -> List[Dict]
```

## Scoring Algorithm

### Overall Score Calculation

```python
overall_score = (
    volume_score +        # 0.00 - 0.50 (50%)
    momentum_score +      # 0.00 - 0.30 (30%)
    strength_score +      # 0.00 - 0.15 (15%)
    risk_score            # 0.00 - 0.05 (5%)
)
```

### Volume Score (50%)

```python
def _score_volume_analysis(self, metrics):
    score = 0.0

    # Volume surge (20%)
    if volume_ratio >= 5.0:
        surge_score = 1.0
    elif volume_ratio >= 3.0:
        surge_score = 0.85
    elif volume_ratio >= 2.0:
        surge_score = 0.65
    # ...
    score += surge_score * 0.20

    # Volume acceleration (15%)
    accel_score = normalize_score(accel_5d, 0, 200)
    score += accel_score * 0.15

    # Volume consistency (10%)
    score += consistency * 0.10

    # Liquidity depth (5%)
    score += liquidity_score * 0.05

    return score
```

## Database Schema

### penny_stock_signals Table

```sql
CREATE TABLE penny_stock_signals (
    id UUID PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    scan_date DATE NOT NULL,
    close_price DECIMAL(10,4),

    -- Scores
    overall_score DECIMAL(5,4),
    volume_score DECIMAL(5,4),
    momentum_score DECIMAL(5,4),
    relative_strength_score DECIMAL(5,4),
    risk_score DECIMAL(5,4),

    -- Volume metrics
    volume BIGINT,
    volume_ratio DECIMAL(8,2),
    volume_spike_factor DECIMAL(8,2),
    dollar_volume DECIMAL(15,2),

    -- Momentum metrics
    is_consolidating BOOLEAN,
    is_breakout BOOLEAN,
    price_change_20d DECIMAL(8,2),

    -- Indexes
    CONSTRAINT unique_signal_per_day UNIQUE (symbol, scan_date)
);

-- Performance indexes
CREATE INDEX idx_penny_signals_overall_score
    ON penny_stock_signals(overall_score DESC);
CREATE INDEX idx_penny_signals_symbol_date
    ON penny_stock_signals(symbol, scan_date DESC);
```

## Configuration

### Settings (Pydantic)

```python
class Settings(BaseSettings):
    # Penny stock filters
    penny_min_price: float = 0.10
    penny_max_price: float = 5.00
    penny_min_volume: int = 200000
    penny_min_dollar_volume: float = 100000.0

    # Scoring weights (must sum to 1.0)
    weight_volume_surge: float = 0.20
    weight_volume_acceleration: float = 0.15
    weight_volume_consistency: float = 0.10
    weight_liquidity_depth: float = 0.05
    # ... (30% momentum, 15% strength, 5% risk)

    def validate_weights(self) -> bool:
        total = sum([all_weights])
        return abs(total - 1.0) < 0.001
```

## API Integration

### YFinance Data Fetching

```python
async def get_market_data(self, symbol: str, period: str = "6mo"):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period)

    # Convert to OHLCVData objects
    ohlcv_data = [
        OHLCVData(
            timestamp=index.to_pydatetime(),
            open=row['Open'],
            high=row['High'],
            low=row['Low'],
            close=row['Close'],
            volume=int(row['Volume'])
        )
        for index, row in hist.iterrows()
    ]

    return MarketData(symbol=symbol, ohlcv_data=ohlcv_data)
```

### Concurrency & Rate Limiting

```python
async def get_multiple_symbols(self, symbols, period="6mo"):
    results = {}
    batch_size = self.settings.max_concurrent_requests

    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i+batch_size]
        tasks = [self.get_market_data(sym, period) for sym in batch]
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Brief delay between batches
        await asyncio.sleep(0.5)

    return results
```

## Testing

### Unit Tests

```python
# Test indicator calculations
def test_detect_consolidation():
    ohlcv_data = create_consolidation_pattern()
    is_consol, days, range_pct = calculator.detect_consolidation(ohlcv_data)
    assert is_consol == True
    assert days >= 5

# Test scoring
def test_volume_score():
    metrics = {'volume_ratio': 3.0, 'acceleration_5d': 50, ...}
    score = service._score_volume_analysis(metrics)
    assert 0.0 <= score <= 0.50
```

### Integration Tests

```python
async def test_full_analysis_workflow():
    # Fetch data
    market_data = await data_service.get_market_data("AEMD", "6mo")

    # Analyze
    result = await analysis_service.analyze_symbol(market_data)

    # Verify
    assert result is not None
    assert result.overall_score >= 0.0
    assert result.overall_score <= 1.0
```

## Performance Optimization

### Batch Processing

- Process symbols in batches of 10 (configurable)
- Async/await for concurrent API calls
- Rate limiting to respect API limits

### Caching

```python
# YFinance caching (configured TTL)
YFINANCE_CACHE_TTL=3600  # 1 hour

# Database query optimization
# Use indexed columns for filters
# Composite indexes for common queries
```

## Error Handling

### Custom Exceptions

```python
class PennyScannerError(Exception):
    """Base exception"""

class DataServiceError(PennyScannerError):
    """Data fetching errors"""

class AnalysisError(PennyScannerError):
    """Analysis errors"""

class DatabaseError(PennyScannerError):
    """Database operation errors"""
```

### Graceful Degradation

```python
# Continue on individual symbol failures
try:
    result = await analyze_symbol(market_data)
except AnalysisError as e:
    logger.error(f"Analysis failed for {symbol}: {e}")
    continue  # Process next symbol
```

## Deployment

### Production Checklist

1. **Environment Setup**:

   ```bash
   # .env file with production credentials
   NEXT_PUBLIC_SUPABASE_URL=prod_url
   NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=prod_key
   ```

2. **Database Setup**:

   ```bash
   # Run SQL schema
   psql -h your-supabase-host -f db/penny_stock_signals.sql
   ```

3. **Dependencies**:

   ```bash
   poetry install --no-dev  # Production only
   ```

4. **Scheduled Scans**:
   ```bash
   # Cron job for daily scans
   0 7 * * * cd /path/to/scanner && poetry run penny-scanner scan-all --min-score 0.75
   ```

### GitHub Actions

```yaml
name: Daily Penny Stock Scan
on:
  schedule:
    - cron: '0 13 * * 1-5' # Weekdays at 1pm UTC
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install Poetry
        run: pip install poetry
      - name: Install dependencies
        run: poetry install
      - name: Run scan
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: poetry run penny-scanner scan-all --min-score 0.75 --output scan_results.json
```

## Extending the System

### Adding New Indicators

```python
# In technical_indicators.py
def calculate_custom_indicator(self, df):
    df['custom_metric'] = ...
    return df

# In analysis_service.py
def _calculate_custom_metrics(self, market_data):
    custom_value = ...
    return custom_value

def _score_custom(self, metrics):
    score = normalize_score(metrics['custom'], min_val, max_val)
    return score * weight
```

### Adding New Score Components

1. Update `Settings` with new weights
2. Add metrics to `ExplosionSignal` model
3. Implement calculation in `AnalysisService`
4. Update database schema if storing
5. Ensure weights still sum to 1.0

### AI Integration

```python
# Optional AI service for signal classification
class AIService:
    async def analyze_signal(self, result: AnalysisResult):
        prompt = self._build_prompt(result)
        response = await openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        return AIAnalysis(...)
```

## Best Practices

### Code Style

- Follow PEP 8
- Use type hints
- Document public APIs
- Keep functions focused

### Testing

- Unit test all scoring functions
- Integration test full workflows
- Validate against historical data

### Logging

```python
logger.info(f"Analyzing {len(symbols)} symbols")
logger.warning(f"Symbol {symbol} has insufficient data")
logger.error(f"Failed to fetch {symbol}: {error}")
logger.debug(f"Score breakdown: vol={vol_score}, mom={mom_score}")
```

### Error Handling

- Catch specific exceptions
- Log errors with context
- Fail gracefully
- Return None rather than crash

## Maintenance

### Regular Tasks

- Update penny ticker database (weekly)
- Monitor scan performance
- Review and adjust thresholds
- Backtest strategy changes
- Update dependencies

### Monitoring

- Track signal generation rate
- Monitor API rate limits
- Check database size growth
- Review error logs
- Validate scoring accuracy

## Support

For questions or issues:

- Review documentation in `docs/`
- Check error logs
- Verify configuration in `.env`
- Ensure database schema is current
