# GitHub Actions Scripts

This directory contains automation scripts used by GitHub Actions workflows.

## Table of Contents

- [Ticker Fetchers](#ticker-fetchers)
- [Utilities](#utilities)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Testing](#testing)

## Ticker Fetchers

### fetch_tickers.py

**Purpose**: Fetches high-quality US stock tickers for the main trading systems.

**Target Criteria:**

- US stocks from major exchanges (NASDAQ, NYSE, NYSEARCA, NYSEMKT)
- Price: $0.50+ (excludes penny stocks)
- Volume: 25,000+ shares/day
- Market Cap: $25M+
- Quality score: 45+
- Max tickers: 2,500

**Usage:**

```bash
# Production run
python fetch_tickers.py

# Dry run (no database writes)
python fetch_tickers.py --dry-run

# Verbose output
python fetch_tickers.py --verbose

# Disable quality filter
python fetch_tickers.py --disable-quality-filter

# Include global markets (default: US-only)
python fetch_tickers.py --include-global

# Custom quality score threshold
python fetch_tickers.py --min-quality-score 50.0

# Custom ticker limit
python fetch_tickers.py --max-tickers 3000

# Disable YFinance validation (not recommended)
python fetch_tickers.py --disable-yfinance-validation
```

**Workflow:** `.github/workflows/fetch-tickers.yml`  
**Schedule:** Sundays at 6:00 AM UTC  
**Database Table:** `tickers`

### fetch_penny_tickers.py

**Purpose**: Fetches penny stock tickers (stocks under $5) for
specialized trading strategies.

**Target Criteria:**

- Price: $0.10 - $5.00 (penny stock range)
- Market Cap: $5M - $300M (micro to small cap)
- Volume: 10,000+ shares/day
- Includes OTC markets (OTCQX, OTCQB, PINK)
- Max tickers: 2,000

**Usage:**

```bash
# Production run
python fetch_penny_tickers.py

# Dry run (no database writes)
python fetch_penny_tickers.py --dry-run

# Verbose output
python fetch_penny_tickers.py --verbose

# Custom ticker limit
python fetch_penny_tickers.py --max-tickers 1500

# Disable YFinance validation (not recommended)
python fetch_penny_tickers.py --disable-yfinance-validation
```

**Workflow:** `.github/workflows/fetch-penny-tickers.yml`  
**Schedule:** Mondays at 7:00 AM UTC  
**Database Table:** `penny_tickers`

**Documentation:** [Penny Tickers Guide](../../docs/db/penny-tickers.md)

## Utilities

### utils/efficient_ticker_filter.py

**Purpose**: High-performance ticker filtering with batch processing.

**Features:**

- CFD (Contract for Difference) detection
- S&P 500 symbol prioritization
- Exchange filtering (US markets)
- Heuristic-based quality scoring
- Batch API calls to multiple data sources
- Symbol validation patterns

**Key Classes:**

- `EfficientTickerFilter`: Main filtering logic
- `EfficientTickerMetrics`: Lightweight ticker metrics

### utils/yfinance_validator.py

**Purpose**: Validates ticker data quality on Yahoo Finance.

**Features:**

- Historical data availability checks
- OHLC (Open-High-Low-Close) validation
- Volume data verification
- Price range validation
- Data completeness scoring
- Gap detection
- Parallel batch processing with rate limiting

**Key Classes:**

- `YFinanceValidator`: Main validation logic
- `YFinanceValidation`: Validation result data class

### test_yfinance_validation.py

**Purpose**: Test suite for YFinance validator.

**Usage:**

```bash
cd .github/scripts
python test_yfinance_validation.py
```

**Tests:**

- Known valid tickers (AAPL, MSFT, GOOGL)
- Known invalid tickers (fake symbols)
- Batch validation performance
- Rate limiting behavior

## Requirements

### Python Dependencies

**File:** `requirements.txt`

```
python-dotenv==1.0.0
requests==2.31.0
supabase==2.0.3
yfinance==0.2.32
pandas==2.1.3
numpy==1.26.2
```

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or with virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Environment Variables

All scripts require these environment variables:

### Required for Database Access

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Required for Data Sources

```bash
# Alpha Vantage (US stock listings)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

# Financial Modeling Prep (global markets, penny stocks)
FMP_API_KEY=your_fmp_key
```

### Setting Up Environment

#### Local Development

Create `.env` file in project root:

```bash
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
ALPHA_VANTAGE_API_KEY=<your_alpha_vantage_key>
FMP_API_KEY=<your_fmp_key>
EOF
```

#### GitHub Actions

1. Go to repository Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`
   - `ALPHA_VANTAGE_API_KEY`
   - `FMP_API_KEY`

## Testing

### Dry Run Mode

Test scripts without writing to database:

```bash
# Regular tickers
python fetch_tickers.py --dry-run --verbose

# Penny tickers
python fetch_penny_tickers.py --dry-run --verbose
```

### Validation Testing

Test YFinance validator:

```bash
python test_yfinance_validation.py
```

### Manual Workflow Triggers

Test workflows via GitHub UI:

1. Go to Actions tab
2. Select workflow:
   - "Weekly Global Market Tickers Update" (regular tickers)
   - "Weekly Penny Stock Tickers Update" (penny tickers)
3. Click "Run workflow"
4. Set parameters:
   - `dry_run`: true (test without database writes)
   - `verbose`: true (detailed logging)
   - `max_tickers`: Custom limit (optional)

### Expected Results

#### fetch_tickers.py

**Typical Output:**

```
Total Candidates: 10,000 - 15,000 tickers
After Pre-Filtering: 5,000 - 8,000 tickers
After Quality Filtering: 3,000 - 5,000 tickers
After YFinance Validation: 2,000 - 2,500 tickers
Pass Rate: 20% - 25%
Execution Time: 15-25 minutes
```

#### fetch_penny_tickers.py

**Typical Output:**

```
Total Candidates: 5,000 - 10,000 tickers
After Deduplication: 4,000 - 8,000 tickers
After YFinance Validation: 1,000 - 2,000 tickers
Pass Rate: 20% - 40%
Execution Time: 10-20 minutes
```

## Common Issues

### API Rate Limiting

**Symptoms:**

- 401/429 HTTP errors
- "Too many requests" messages
- Incomplete results

**Solutions:**

- Wait and retry (limits reset hourly/daily)
- Reduce `max_tickers` parameter
- Use `--verbose` to see detailed errors
- Check API usage quotas

### YFinance Validation Failures

**Symptoms:**

- Very low pass rates (< 10%)
- "No historical data" errors
- Connection timeouts

**Solutions:**

- Check internet connectivity
- Reduce batch size (built-in: 100 tickers/batch)
- Increase timeout (workflow default: 30-45 minutes)
- Disable validation if necessary (not recommended)

### Supabase Connection Issues

**Symptoms:**

- "Missing Supabase credentials" error
- Database write failures
- Timeout during inserts

**Solutions:**

- Verify environment variables
- Check Supabase project status
- Verify service role key permissions
- Check database row limits

## Best Practices

1. **Always test with dry-run first**

   ```bash
   python fetch_tickers.py --dry-run --verbose
   ```

2. **Monitor workflow runs in GitHub Actions**
   - Check logs for warnings
   - Review automated issues
   - Track success rates over time

3. **Use appropriate ticker limits**
   - Regular tickers: 2,000 - 3,000 recommended
   - Penny tickers: 1,500 - 2,000 recommended

4. **Respect API rate limits**
   - Don't run scripts too frequently
   - Use built-in rate limiting
   - Stagger different scripts (separate days)

5. **Keep dependencies updated**
   ```bash
   pip list --outdated
   pip install --upgrade <package>
   ```

## Monitoring

### GitHub Actions

- View workflow runs: `Actions` tab
- Check logs: Click on workflow run → job → step
- Download artifacts: Logs are saved for 30 days

### Automated Issues

Failed workflows create GitHub issues automatically:

- Tagged with `automation`, `tickers`, `bug`
- Include run details and error information
- Should be reviewed and resolved promptly

### Database Health

Monitor ticker data quality:

```sql
-- Check last update times
SELECT
  'tickers' as table_name,
  COUNT(*) as ticker_count,
  MAX(last_fetched) as last_update
FROM tickers
WHERE is_active = true
UNION ALL
SELECT
  'penny_tickers' as table_name,
  COUNT(*) as ticker_count,
  MAX(last_fetched) as last_update
FROM penny_tickers
WHERE is_active = true;

-- Check data freshness
SELECT
  symbol,
  name,
  last_fetched,
  NOW() - last_fetched as age
FROM tickers
WHERE is_active = true
AND last_fetched < NOW() - INTERVAL '7 days'
ORDER BY last_fetched
LIMIT 10;
```

## Contributing

When modifying scripts:

1. Test locally with `--dry-run`
2. Update documentation
3. Add tests for new features
4. Update `requirements.txt` if adding dependencies
5. Update workflow files if changing parameters

## Support

For issues or questions:

1. Check this README
2. Review script logs (`--verbose` flag)
3. Check GitHub Actions logs
4. Review data source documentation:
   - [FMP API Docs](https://site.financialmodelingprep.com/developer/docs)
   - [Alpha Vantage Docs](https://www.alphavantage.co/documentation/)
   - [YFinance Docs](https://github.com/ranaroussi/yfinance)
   - [Supabase Docs](https://supabase.com/docs)

## Related Documentation

- [Database Documentation](../../docs/db/README.md)
- [Penny Tickers Guide](../../docs/db/penny-tickers.md)
- [GitHub Actions Workflows](../.github/workflows/)
