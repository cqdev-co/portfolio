# Penny Tickers System

## Overview

The penny tickers system automatically fetches and maintains a curated list of penny stocks (stocks trading below $5) in the Supabase database. This system runs weekly via GitHub Actions and stores penny stock tickers in the `penny_tickers` table.

## Table of Contents

- [What Are Penny Stocks?](#what-are-penny-stocks)
- [Database Schema](#database-schema)
- [Data Sources](#data-sources)
- [Quality Filters](#quality-filters)
- [Automation](#automation)
- [Usage](#usage)
- [Maintenance](#maintenance)

## What Are Penny Stocks?

Penny stocks are stocks that trade at relatively low prices (typically below $5 per share) and generally have smaller market capitalizations. They are characterized by:

- **Price Range**: $0.10 - $5.00 per share
- **Market Cap**: $5M - $300M (micro to small cap)
- **Volume**: Generally lower than large-cap stocks
- **Risk Profile**: Higher volatility and risk
- **Growth Potential**: Can offer significant upside for risk-tolerant investors

## Database Schema

### Table: `penny_tickers`

The `penny_tickers` table stores validated penny stock information:

```sql
CREATE TABLE IF NOT EXISTS penny_tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    exchange VARCHAR(50),
    country VARCHAR(50),
    currency VARCHAR(10),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap BIGINT,
    is_active BOOLEAN DEFAULT true,
    ticker_type VARCHAR(20) DEFAULT 'stock',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_fetched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Key Fields

- **symbol**: Unique ticker symbol (e.g., "XYZ")
- **name**: Company name
- **exchange**: Trading exchange (NASDAQ, NYSE, OTC, etc.)
- **market_cap**: Market capitalization in USD
- **is_active**: Whether the ticker is currently active
- **last_fetched**: Timestamp of last data update

#### Indexes

- `idx_tickers_symbol`: Fast symbol lookup
- `idx_tickers_exchange`: Filter by exchange
- `idx_tickers_sector`: Group by sector
- `idx_tickers_is_active`: Filter active/inactive

## Data Sources

### Primary Sources

1. **Financial Modeling Prep (FMP)**
   - Real-time penny stock screening API
   - Filters by price, market cap, and volume
   - Most comprehensive penny stock data

2. **Alpha Vantage**
   - Complete US stock listings
   - Filtered locally for penny stock criteria
   - Fallback for missing tickers

3. **Yahoo Finance (Validation)**
   - Data quality validation
   - Price and volume verification
   - Historical data availability checks

## Quality Filters

### Price Filters

- **Minimum**: $0.10 (avoid sub-penny stocks)
- **Maximum**: $5.00 (traditional penny stock definition)
- **Sweet Spot**: $0.50 - $2.00 (highest quality scores)

### Market Cap Filters

- **Minimum**: $5M (avoid nano-caps)
- **Maximum**: $300M (small cap threshold)
- **Preferred**: $50M - $300M (better liquidity)

### Volume Filters

- **Minimum**: 10,000 shares/day (basic liquidity)
- **Good**: 100,000+ shares/day
- **Excellent**: 500,000+ shares/day

### Data Quality Filters

- **Minimum History**: 60 days of trading data
- **Data Completeness**: 75%+ (allow some gaps)
- **Recency**: Data within last 7 days
- **OHLC Quality**: 80%+ valid candles

### Excluded Instruments

- CFDs (Contracts for Difference)
- Warrants, rights, units
- Preferred shares
- ETFs and ETNs
- Bonds and debentures
- Leveraged/inverse products

## Automation

### GitHub Actions Workflow

**File**: `.github/workflows/fetch-penny-tickers.yml`

#### Schedule

- Runs weekly on Mondays at 7 AM UTC
- Staggered from regular tickers (Sundays at 6 AM UTC)
- Can be triggered manually via workflow dispatch

#### Manual Trigger Options

```bash
# Via GitHub UI: Actions → Weekly Penny Stock Tickers Update → Run workflow

# Parameters:
- dry_run: Test without writing to database
- verbose: Enable detailed logging
- max_tickers: Limit number of tickers (default: 2000)
```

#### Workflow Steps

1. Checkout repository
2. Set up Python 3.11
3. Install dependencies
4. Create environment variables
5. Run penny ticker fetcher
6. Upload logs (retained 30 days)
7. Create issue on failure

### Script Execution

**File**: `.github/scripts/fetch_penny_tickers.py`

#### Command Line Usage

```bash
# Production run
python fetch_penny_tickers.py

# Dry run (no database writes)
python fetch_penny_tickers.py --dry-run

# Verbose output
python fetch_penny_tickers.py --verbose

# Limit tickers
python fetch_penny_tickers.py --max-tickers 1000

# Disable YFinance validation (not recommended)
python fetch_penny_tickers.py --disable-yfinance-validation
```

#### Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
ALPHA_VANTAGE_API_KEY=<your_alpha_vantage_key>
FMP_API_KEY=<your_fmp_key>
```

## Usage

### Querying Penny Tickers

#### Get All Active Penny Tickers

```sql
SELECT symbol, name, exchange, market_cap
FROM penny_tickers
WHERE is_active = true
ORDER BY market_cap DESC;
```

#### Filter by Exchange

```sql
SELECT symbol, name, market_cap
FROM penny_tickers
WHERE is_active = true
AND exchange IN ('NASDAQ', 'NYSE')
ORDER BY symbol;
```

#### Filter by Sector

```sql
SELECT symbol, name, sector, market_cap
FROM penny_tickers
WHERE is_active = true
AND sector = 'Technology'
ORDER BY market_cap DESC;
```

#### Get Recently Updated Tickers

```sql
SELECT symbol, name, last_fetched
FROM penny_tickers
WHERE is_active = true
AND last_fetched > NOW() - INTERVAL '7 days'
ORDER BY last_fetched DESC;
```

### TypeScript Integration

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Get all active penny tickers
const { data: pennyTickers, error } = await supabase
  .from('penny_tickers')
  .select('*')
  .eq('is_active', true)
  .order('market_cap', { ascending: false });

// Filter by price range (requires YFinance data)
const { data: lowPriceStocks } = await supabase
  .from('penny_tickers')
  .select('*')
  .eq('is_active', true)
  .gte('market_cap', 10000000)  // $10M+
  .lte('market_cap', 100000000); // $100M-
```

## Maintenance

### Monitoring

1. **GitHub Actions**
   - Check workflow runs in Actions tab
   - Review logs for errors or warnings
   - Monitor success rate over time

2. **Database Health**
   - Verify last_fetched timestamps
   - Check ticker count trends
   - Monitor data quality metrics

3. **Issue Tracking**
   - Automated issues created on failure
   - Tagged with `automation`, `penny-tickers`, `bug`
   - Review and resolve promptly

### Common Issues

#### No Tickers Fetched

**Symptoms**: Zero tickers after running script

**Causes**:
- API keys invalid or expired
- Rate limiting from data sources
- Network connectivity issues

**Solutions**:
- Verify API keys in GitHub secrets
- Wait and retry (rate limits reset)
- Check GitHub Actions logs

#### Low Quality Pass Rate

**Symptoms**: < 20% tickers pass validation

**Causes**:
- Overly strict filters
- Market conditions (low volatility)
- Data source issues

**Solutions**:
- Review filter thresholds
- Adjust min_quality_score parameter
- Check data source status

#### Stale Data

**Symptoms**: last_fetched dates > 7 days old

**Causes**:
- Workflow disabled or failing
- API quota exhausted
- Database connection issues

**Solutions**:
- Enable workflow if disabled
- Check API usage limits
- Verify Supabase connectivity

### Manual Updates

If automated updates fail, you can run manually:

```bash
# Clone repository
git clone https://github.com/<your-org>/portfolio.git
cd portfolio/.github/scripts

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=<your_url>
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=<your_key>
ALPHA_VANTAGE_API_KEY=<your_key>
FMP_API_KEY=<your_key>
EOF

# Run script
python fetch_penny_tickers.py --verbose
```

## Quality Metrics

### Typical Results

- **Total Candidates**: 5,000 - 10,000 tickers
- **After Pre-Filtering**: 2,000 - 3,000 tickers
- **After Validation**: 500 - 2,000 tickers
- **Pass Rate**: 20% - 40%

### Quality Scoring

Penny stocks are scored 0-100 based on:

- **Price Range** (30 points max)
  - $0.50 - $2.00: 30 points
  - $0.10 - $0.50: 25 points
  - $2.00 - $5.00: 20 points

- **Volume** (30 points max)
  - 500k+: 30 points
  - 100k+: 25 points
  - 50k+: 20 points
  - 10k+: 10 points

- **Market Cap** (25 points max)
  - $50M - $300M: 25 points
  - $10M - $50M: 20 points
  - $5M - $10M: 15 points

- **Base Score**: 15 points

### Validation Criteria

✅ **Passes Validation**:
- 60+ days of trading history
- Data within last 7 days
- 75%+ data completeness
- 80%+ OHLC quality
- Price: $0.10 - $5.00
- Volume: 10,000+ shares/day

❌ **Fails Validation**:
- Insufficient history (< 60 days)
- Stale data (> 7 days old)
- Too many data gaps (> 15%)
- OHLC violations (> 20%)
- Price out of range
- Insufficient volume

## Best Practices

### For Developers

1. **Always validate penny tickers** before using in production
2. **Implement risk warnings** for penny stock features
3. **Use market_cap and volume filters** to prioritize quality
4. **Cache ticker lists** to reduce database queries
5. **Monitor data freshness** (last_fetched timestamps)

### For Traders

1. **Higher risk**: Penny stocks are volatile and speculative
2. **Due diligence**: Research companies thoroughly
3. **Position sizing**: Use smaller position sizes
4. **Liquidity**: Prefer tickers with 100k+ daily volume
5. **Stop losses**: Always use strict risk management

## Related Documentation

- [Database Schema](./README.md) - Complete database documentation
- [Tickers System](./tickers.md) - Regular tickers documentation
- [GitHub Actions](../../.github/workflows/) - Workflow configurations

## Support

For issues or questions:

1. Check GitHub Actions logs
2. Review automated issues in GitHub
3. Consult data source documentation:
   - [FMP API Docs](https://site.financialmodelingprep.com/developer/docs)
   - [Alpha Vantage Docs](https://www.alphavantage.co/documentation/)
   - [YFinance Docs](https://github.com/ranaroussi/yfinance)

