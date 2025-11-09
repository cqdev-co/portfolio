# Penny Stock Scanner - User Guide

Complete guide to using the penny stock scanner CLI.

## Installation

### Prerequisites
- Python 3.11 or higher
- Poetry package manager
- Supabase account (for signal storage)

### Setup Steps

```bash
# Navigate to the service directory
cd penny-stock-scanner

# Install dependencies with Poetry
poetry install

# Copy environment template
cp env.example .env

# Edit .env file with your credentials
nano .env  # or your preferred editor
```

### Environment Configuration

Required variables in `.env`:
```bash
# Supabase (for ticker database and signal storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: AI analysis
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## CLI Commands

### 1. Analyze Single Symbol

Analyze a specific penny stock for explosion setup signals.

```bash
penny-scanner analyze AEMD
```

**Output**:
```
✅ Ticker service ready (2000 penny stocks)
✅ Database service ready for signal storage
Fetching data for AEMD... ━━━━━━━━━━━━━━━━━━━━━━━━

╭────── Explosion Setup Analysis ──────╮
│ Symbol: AEMD                         │
│ Price: $1.25                         │
│ Overall Score: 0.812/1.0             │
│ Opportunity Rank: A-Tier             │
│ Recommendation: BUY                  │
│                                      │
│ Volume Analysis (50%): 0.420         │
│   - Volume Ratio: 3.2x              │
│   - Volume Spike: 3.0x              │
│   - Dollar Volume: $850,000         │
│                                      │
│ Price Momentum (30%): 0.245          │
│   - Consolidating: Yes              │
│   - Breakout: Yes                   │
│   - Price Change (20d): 15.2%       │
│   - Higher Lows: Yes                │
│                                      │
│ Risk Management:                     │
│   - Stop Loss: $1.08                │
│   - Position Size: 6.8%             │
╰──────────────────────────────────────╯
```

**Save to file**:
```bash
penny-scanner analyze AEMD --output aemd_analysis.json
```

### 2. Batch Analysis

Analyze multiple symbols at once.

```bash
penny-scanner batch AEMD,NUAI,TSLA,AAPL --min-score 0.60
```

**Options**:
- `--min-score`: Minimum score threshold (default: 0.60)
- `--output`: Save results to JSON file
- `--no-store`: Skip database storage

**Example with options**:
```bash
penny-scanner batch AEMD,NUAI,MNMD,SAVA \
  --min-score 0.70 \
  --output batch_results.json \
  --store
```

**Output**:
```
🔥 Penny Stock Explosion Setups (Score ≥ 0.70)
┏━━━━━━━━┳━━━━━━┳━━━━━━━┳━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━━┳━━━━━━━━━┓
┃ Symbol ┃ Rank ┃ Score ┃ Price  ┃ Vol Ratio┃ Breakout ┃ Trend   ┃
┡━━━━━━━━╇━━━━━━╇━━━━━━━╇━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━━╇━━━━━━━━━┩
│ AEMD   │ 🥇 A │ 0.812 │ $1.25  │ 3.2x     │ ✅       │ Bullish │
│ NUAI   │ 🥈 B │ 0.745 │ $2.10  │ 2.5x     │ ⏳       │ Bullish │
│ MNMD   │ 🥉 C │ 0.652 │ $0.85  │ 2.1x     │ ✅       │ Neutral │
└────────┴──────┴───────┴────────┴──────────┴──────────┴─────────┘

💾 Stored 3 signals in database
✅ Results saved to batch_results.json
```

### 3. Scan All Penny Stocks

Scan the entire penny stock database for explosion setups.

```bash
penny-scanner scan-all --min-score 0.70
```

**Options**:
- `--min-score`: Minimum score threshold (default: 0.70)
- `--max-symbols`: Limit number of symbols scanned
- `--output`: Save results to JSON file
- `--no-store`: Skip database storage

**Full example**:
```bash
penny-scanner scan-all \
  --min-score 0.75 \
  --max-symbols 500 \
  --output full_scan_results.json \
  --store
```

**Output**:
```
📊 Fetching penny stock symbols...
✅ Ticker service ready (2000 penny stocks)
🔍 Scanning 2000 penny stocks

📈 Fetching market data...
✅ Retrieved data for 1842/2000 symbols

🔬 Analyzing for explosion setups...
Analyzing... ━━━━━━━━━━━━━━━━━━━━━━ 100% 0:05:23

💾 Stored 45 signals

🎯 Found 45 explosion setups (min score: 0.70)

🔥 Penny Stock Explosion Setups
┏━━━━━━━━┳━━━━━━━━┳━━━━━━━┳━━━━━━━━┳━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━┓
┃ Symbol ┃ Rank   ┃ Score ┃ Price  ┃ Vol Spike ┃ Setup          ┃ Trend   ┃
┡━━━━━━━━╇━━━━━━━━╇━━━━━━━╇━━━━━━━━╇━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━┩
│ GOOGL  │ 🏆 S   │ 0.925 │ $3.45  │ 5.2x      │ 📦 Consol 🚀 Br│ Bullish │
│ AEMD   │ 🥇 A   │ 0.852 │ $1.25  │ 3.2x      │ 📦 Consol 📈 HLs│ Bullish │
│ NUAI   │ 🥇 A   │ 0.815 │ $2.10  │ 4.1x      │ 🚀 Break 📈 HLs│ Bullish │
│ MNMD   │ 🥈 B   │ 0.745 │ $0.85  │ 2.8x      │ 📦 Consol      │ Neutral │
│ ...    │ ...    │ ...   │ ...    │ ...       │ ...            │ ...     │
└────────┴────────┴───────┴────────┴───────────┴────────────────┴─────────┘

... and 20 more signals

📊 Scan Summary:
   Symbols scanned: 2000
   Data retrieved: 1842
   Signals found: 45
   Signal rate: 2.4%

💾 Results saved to full_scan_results.json
```

**Setup Status Indicators**:
- 📦 **Consol**: Currently consolidating
- 🚀 **Break**: Breaking out of consolidation
- 📈 **HLs**: Higher lows detected (accumulation)

### 4. Query Stored Signals

Query previously stored signals from the database.

```bash
# Get latest signals
penny-scanner query --limit 50

# Filter by minimum score
penny-scanner query --min-score 0.80 --limit 25

# Filter by recommendation
penny-scanner query --recommendation BUY --limit 20

# Get signals for a specific date
penny-scanner query --date 2024-11-09 --limit 100
```

**Output**:
```
📊 Latest 50 signals

📊 Stored Penny Stock Signals
┏━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━┳━━━━━━┳━━━━━━━━━━━━━━━━┓
┃ Symbol ┃ Date       ┃ Score ┃ Rank ┃ Recommendation ┃
┡━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━╇━━━━━━╇━━━━━━━━━━━━━━━━┩
│ AEMD   │ 2024-11-09 │ 0.852 │ A    │ BUY            │
│ NUAI   │ 2024-11-09 │ 0.815 │ A    │ BUY            │
│ MNMD   │ 2024-11-09 │ 0.745 │ B    │ WATCH          │
└────────┴────────────┴───────┴──────┴────────────────┘

Found 50 signals
```

### 5. Version & System Check

Check version and validate system configuration.

```bash
penny-scanner version
```

**Output**:
```
Penny Stock Scanner
Version: 0.1.0
Strategy: Volume-focused explosion setup detection
✅ Settings loaded successfully
✅ Scoring weights validated (sum = 1.0)
✅ Database configured
```

## Understanding the Output

### Score Components

Every signal shows its component scores:

```
Overall Score: 0.812/1.0
├── Volume Analysis (50%): 0.420
│   └── Dominant signal - volume surge detection
├── Price Momentum (30%): 0.245
│   └── Consolidation and breakout timing
├── Relative Strength (15%): 0.122
│   └── Performance vs market/sector
└── Risk & Liquidity (5%): 0.025
    └── Tradability and safety checks
```

### Opportunity Ranks

| Rank | Emoji | Score | Interpretation |
|------|-------|-------|----------------|
| S-Tier | 🏆 | ≥0.90 | Exceptional - Highest conviction |
| A-Tier | 🥇 | ≥0.80 | Excellent - Strong buy signal |
| B-Tier | 🥈 | ≥0.70 | Solid - Good opportunity |
| C-Tier | 🥉 | ≥0.60 | Fair - Watch list |

### Recommendations

- **STRONG_BUY**: Score ≥0.85 + breakout confirmed
- **BUY**: Score ≥0.70
- **WATCH**: Score ≥0.60
- **HOLD**: Below threshold

## Common Use Cases

### Daily Morning Scan
```bash
# Quick scan to find today's opportunities
penny-scanner scan-all \
  --min-score 0.75 \
  --output morning_scan_$(date +%Y%m%d).json
```

### Watch List Analysis
```bash
# Check specific stocks you're tracking
penny-scanner batch AEMD,NUAI,MNMD,SAVA \
  --min-score 0.60 \
  --output watchlist.json
```

### High-Quality Signals Only
```bash
# Only S-Tier and A-Tier setups
penny-scanner scan-all --min-score 0.80 --max-symbols 1000
```

### Quick Symbol Check
```bash
# Quick analysis of a single symbol
penny-scanner analyze AEMD
```

### Review Yesterday's Signals
```bash
# Check signals from a specific date
penny-scanner query --date 2024-11-08 --min-score 0.70
```

## Tips for Effective Usage

### 1. Start with High Thresholds
- Begin with `--min-score 0.75` or higher
- Focus on S-Tier and A-Tier signals
- Lower threshold as you gain experience

### 2. Regular Scanning
- Run daily scans before market open
- Store results with date-stamped filenames
- Track which signals perform best

### 3. Combine with Research
- Scanner identifies setups, not guarantees
- Research company fundamentals
- Check news and catalysts manually
- Verify volume and price action

### 4. Position Sizing
- Use recommended position sizes from output
- Never exceed 8% of capital per position
- Adjust based on your risk tolerance

### 5. Risk Management
- Always use the calculated stop loss
- Set stops immediately after entry
- Don't hold through stop loss hoping for recovery

## Troubleshooting

### No Signals Found

**Problem**: Scan returns 0 signals

**Solutions**:
```bash
# Lower the score threshold
penny-scanner scan-all --min-score 0.60

# Check if ticker service is working
penny-scanner version

# Ensure database has penny tickers
# Run the fetch-penny-tickers workflow if needed
```

### Slow Scanning

**Problem**: Scanning takes too long

**Solutions**:
```bash
# Limit number of symbols
penny-scanner scan-all --max-symbols 500

# Scan smaller batches
penny-scanner batch SYMBOL1,SYMBOL2,SYMBOL3

# Check your internet connection
# YFinance API calls can be slow
```

### Database Errors

**Problem**: Signals not storing in database

**Solutions**:
1. Check `.env` file has correct Supabase credentials
2. Verify `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is set
3. Ensure `penny_stock_signals` table exists in Supabase
4. Run the SQL schema: `db/penny_stock_signals.sql`

### Invalid Symbols

**Problem**: "No data available for SYMBOL"

**Solutions**:
- Verify symbol is correct (check Yahoo Finance)
- Ensure symbol is a penny stock ($0.10-$5.00)
- Some symbols may not have sufficient historical data
- Check if symbol is actively trading

## Advanced Usage

### Programmatic Access

You can import and use the services programmatically:

```python
import asyncio
from penny_scanner.config.settings import get_settings
from penny_scanner.services.data_service import DataService
from penny_scanner.services.analysis_service import AnalysisService

async def analyze_symbol(symbol: str):
    settings = get_settings()
    data_service = DataService(settings)
    analysis_service = AnalysisService(settings)
    
    # Fetch data
    market_data = await data_service.get_market_data(symbol, "6mo")
    
    # Analyze
    result = await analysis_service.analyze_symbol(market_data)
    
    if result:
        print(f"{symbol}: {result.overall_score:.3f}")
        return result
    return None

# Run
asyncio.run(analyze_symbol("AEMD"))
```

### Custom Filters

Modify `settings.py` to adjust filters:
```python
# Adjust price range
penny_min_price=0.50  # Only $0.50-$5.00
penny_max_price=3.00  # Only up to $3.00

# Increase volume requirement
penny_min_volume=500000  # 500k shares minimum

# Stricter dollar volume
penny_min_dollar_volume=250000  # $250k minimum
```

### Export Formats

```bash
# JSON output (default)
penny-scanner scan-all --output results.json

# Can be processed with jq
cat results.json | jq '.[] | select(.overall_score > 0.85)'

# Or imported into other tools
python process_results.py results.json
```

## Next Steps

- Review [System Overview](system-overview.md) for strategy details
- Check [Technical Implementation](technical-implementation.md) for developer docs
- Start with paper trading to validate signals
- Track performance and refine your criteria
- Join the community for strategy discussions

