# Penny Tickers Fetcher

## Overview

The Penny Tickers Fetcher is an automated system that identifies, enriches, and stores penny stock data (typically stocks under $5) into the `penny_tickers` database table. It provides comprehensive risk assessment, quality scoring, and trading metrics specifically tailored for penny stock analysis.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  Penny Ticker Fetcher                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │           1. Fetch from Data Sources              │
    │  • Financial Modeling Prep (primary)              │
    │  • Alpha Vantage (supplemental)                   │
    └───────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │         2. Filter by Price & Basic Criteria       │
    │  • Price: $0.01 - $5.00                          │
    │  • Valid symbol and name                          │
    │  • Classify OTC/Pink Sheet                        │
    └───────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │         3. Enrich with YFinance Data              │
    │  • Volume metrics (avg, daily)                    │
    │  • Price ranges (52-week, daily)                  │
    │  • Volatility calculation (30-day)                │
    │  • Company info (sector, industry)                │
    │  • Float shares, short interest                   │
    └───────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │       4. Calculate Risk & Quality Metrics         │
    │  • Risk Level: high/medium/low                    │
    │  • Quality Score: 0-100                           │
    │  • Data completeness assessment                   │
    └───────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │         5. Filter by Volume & Quality             │
    │  • Minimum volume: 10,000 (default)               │
    │  • Remove illiquid stocks                         │
    │  • Quality score validation                       │
    └───────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────┐
    │            6. Store in penny_tickers              │
    │  • Batch upsert (500 per batch)                   │
    │  • Conflict resolution on symbol                  │
    │  • Update timestamps                              │
    └───────────────────────────────────────────────────┘
```

## Script: `fetch_penny_tickers.py`

Location: `.github/scripts/fetch_penny_tickers.py`

### Features

1. **Multi-Source Data Collection**
   - Financial Modeling Prep API for comprehensive penny stock listings
   - YFinance for real-time pricing and volume data
   - Alpha Vantage for supplemental data (optional)

2. **Intelligent Filtering**
   - Price threshold filtering (default: under $5)
   - Volume-based liquidity filtering
   - Data quality validation
   - Automatic OTC/Pink Sheet detection

3. **Risk Assessment**
   - Automated risk classification (high/medium/low)
   - Based on multiple factors:
     - Exchange type (OTC, Pink Sheet)
     - Trading volume
     - Volatility metrics
     - SEC reporting status
     - Price level

4. **Quality Scoring**
   - Data completeness (30 points)
   - Reporting compliance (30 points)
   - Trading activity (40 points)
   - Overall score: 0-100

5. **Production-Ready**
   - Comprehensive error handling
   - Rate limiting to respect API limits
   - Batch processing for efficiency
   - Detailed logging
   - Dry-run mode for testing

### Usage

#### Basic Usage

```bash
cd .github/scripts
python fetch_penny_tickers.py
```

#### Dry Run Mode

Test the script without writing to database:

```bash
python fetch_penny_tickers.py --dry-run --verbose
```

#### Custom Configuration

```bash
python fetch_penny_tickers.py \
  --max-price 3.0 \
  --min-volume 50000 \
  --max-tickers 1000 \
  --verbose
```

### Command-Line Arguments

| Argument        | Type  | Default | Description                             |
| --------------- | ----- | ------- | --------------------------------------- |
| `--dry-run`     | flag  | false   | Run without storing data (testing mode) |
| `--verbose`     | flag  | false   | Enable detailed debug logging           |
| `--max-price`   | float | 5.0     | Maximum price for penny stocks          |
| `--min-volume`  | int   | 10,000  | Minimum average daily volume            |
| `--max-tickers` | int   | 2,000   | Maximum number of tickers to store      |

### Environment Variables

Required in `.env` file:

```bash
# Supabase credentials (required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API keys (at least one required)
FMP_API_KEY=your_fmp_key  # Primary source
ALPHA_VANTAGE_API_KEY=your_av_key  # Optional
```

## GitHub Actions Workflow

File: `.github/workflows/fetch-penny-tickers.yml`

### Automatic Schedule

Runs **every Monday at 7:00 AM UTC** (after the main ticker update on Sunday)

### Manual Trigger

You can manually trigger the workflow from GitHub Actions with custom parameters:

1. Go to **Actions** → **Weekly Penny Stock Tickers Update**
2. Click **Run workflow**
3. Configure options:
   - **Dry Run**: Test without database writes
   - **Verbose**: Enable detailed logging
   - **Max Price**: Custom price threshold (e.g., "3.0")
   - **Max Tickers**: Custom limit (e.g., "1000")

### Workflow Features

- **Caching**: Pip dependencies cached for faster runs
- **Timeout**: 45 minutes (handles large datasets)
- **Logs**: Automatically uploaded as artifacts (30-day retention)
- **Summary**: Generates execution summary in Actions UI
- **Error Handling**: Continues on non-fatal errors

## Risk Classification System

### High Risk (Score ≥ 60)

Characteristics:

- OTC or Pink Sheet listing
- Low volume (< 100k)
- High volatility (> 50%)
- No SEC reporting
- Very low price (< $0.50)

**Trading Implications**: Extreme caution, potential for manipulation

### Medium Risk (Score 30-59)

Characteristics:

- Exchange-listed but under $2
- Moderate volume (100k-500k)
- Moderate volatility (20-50%)
- Some SEC reporting
- Limited financial reporting

**Trading Implications**: Higher risk than blue chips, require careful analysis

### Low Risk (Score < 30)

Characteristics:

- Exchange-listed (NASDAQ/NYSE)
- Good volume (> 1M)
- Low volatility (< 20%)
- SEC reporting current
- Price $2-$5 range
- Regular financial reporting

**Trading Implications**: Lower risk for penny stocks, but still volatile

## Quality Score Calculation

### Data Completeness (30 points)

Points awarded for populated fields:

- Basic info (name, exchange, price)
- Volume data
- Company info (sector, industry)
- Market cap
- Price ranges (daily, 52-week)

**Formula**: `(populated_fields / total_fields) * 30`

### Reporting Compliance (30 points)

- SEC reporting: **20 points**
- Financial statements: **10 points**

### Trading Activity (40 points)

Volume-based scoring:

- ≥ 1M volume: **20 points**
- ≥ 500k volume: **15 points**
- ≥ 100k volume: **10 points**
- ≥ 50k volume: **5 points**

Bonus points:

- Not OTC: **+10 points**
- Low volatility (< 30%): **+10 points**
- Medium volatility (30-50%): **+5 points**

**Maximum Score**: 100

## Data Sources

### Financial Modeling Prep (Primary)

**Endpoint**: `/api/v3/stock/list`

**Provides**:

- Comprehensive stock listings
- Basic price data
- Exchange information
- Currency data

**Rate Limits**: 250 requests/day (free), 750+/day (paid)

### YFinance (Enrichment)

**Library**: `yfinance`

**Provides**:

- Real-time pricing
- Volume metrics (average, daily)
- Company information
- Price ranges
- Float shares
- Short interest
- Historical data for volatility

**Rate Limits**: ~2,000 requests/hour (unofficial)

### Alpha Vantage (Optional)

**Endpoint**: `LISTING_STATUS`

**Provides**:

- US stock listings
- Exchange data
- Basic company info

**Rate Limits**: 5 requests/minute, 500/day (free)

## Performance Optimization

### Batching Strategy

1. **Fetch Phase**: Retrieve all matching tickers from FMP
2. **Pre-filtering**: Filter by price before enrichment
3. **Deduplication**: Remove duplicates early
4. **Limit Before Enrichment**: Cap at max_tickers to avoid unnecessary API calls
5. **Batch Storage**: Insert in batches of 500

### Rate Limiting

- YFinance: 0.1s delay between requests
- Supabase: 0.2s delay between batch inserts
- Configurable for production use

### Expected Runtime

| Ticker Count | Expected Time  |
| ------------ | -------------- |
| 500 tickers  | ~5-8 minutes   |
| 1000 tickers | ~10-15 minutes |
| 2000 tickers | ~20-30 minutes |

## Monitoring and Logs

### Log Levels

**INFO**: Progress updates, statistics, summaries
**DEBUG**: Individual ticker processing (verbose mode only)
**WARNING**: Skipped tickers, missing data
**ERROR**: API failures, database errors

### Log Files

- **Local**: `penny_ticker_fetch.log`
- **GitHub Actions**: Uploaded as artifact (30-day retention)

### Key Metrics Logged

- Total tickers fetched
- Enrichment success rate
- Average quality score
- Risk distribution
- Volume statistics
- Storage success rate

## Troubleshooting

### No Tickers Found

**Possible causes**:

- Invalid API keys
- API rate limits exceeded
- Network issues
- Price threshold too restrictive

**Solutions**:

- Verify API keys in `.env`
- Wait for rate limit reset
- Increase `--max-price`
- Enable `--verbose` for details

### Low Enrichment Success Rate

**Possible causes**:

- YFinance rate limiting
- Invalid ticker symbols
- Network timeouts

**Solutions**:

- Reduce batch size
- Add delay between requests
- Check ticker symbol format
- Verify network connectivity

### Database Errors

**Possible causes**:

- Invalid Supabase credentials
- RLS policy restrictions
- Schema mismatch
- Network issues

**Solutions**:

- Verify service role key
- Check RLS policies
- Confirm schema matches
- Test Supabase connection

### Quality Scores Too Low

**Possible causes**:

- Missing data from APIs
- Volume requirements too high
- Incomplete ticker information

**Solutions**:

- Lower `--min-volume`
- Check API response data
- Verify enrichment logic
- Review quality score calculation

## Best Practices

### For Production Use

1. **Use Scheduled Runs**: Let the weekly cron job handle updates
2. **Monitor Logs**: Check GitHub Actions artifacts regularly
3. **Set Reasonable Limits**: Default 2000 tickers balances coverage and quality
4. **Enable Caching**: GitHub Actions cache significantly speeds up runs
5. **Test with Dry Run**: Always test configuration changes in dry-run mode

### For Development

1. **Use Verbose Mode**: Get detailed debugging information
2. **Start with Dry Run**: Validate logic before database writes
3. **Limit Ticker Count**: Use `--max-tickers 100` for quick tests
4. **Check Quality Scores**: Verify scoring logic with sample data
5. **Review Logs**: Understand failure patterns and edge cases

### For Trading

1. **Focus on Quality**: Filter by quality score ≥ 70
2. **Require Volume**: Minimum 500k average volume for liquidity
3. **Check Risk Level**: Understand risk classification before trading
4. **Verify SEC Reporting**: Prefer companies with SEC filings
5. **Monitor Halts**: Check `is_halted` status regularly

## Future Enhancements

### Planned Features

- [ ] Integration with OTC Markets API for enhanced OTC data
- [ ] Social media sentiment tracking
- [ ] Insider trading activity monitoring
- [ ] Price target aggregation
- [ ] News and PR release integration
- [ ] Pump-and-dump pattern detection
- [ ] Historical price change tracking
- [ ] Sector-specific risk scoring

### Integration Opportunities

- **Unusual Options Service**: Correlate penny stock movements with options activity
- **Reddit Sentiment**: Track penny stock mentions and sentiment
- **Volatility Scanner**: Identify penny stocks with squeeze patterns
- **ML Predictor**: Train models on penny stock price movements

## Support and Resources

### Documentation

- [Penny Tickers Schema](penny-tickers-schema.md)
- [Database README](README.md)
- [Main Ticker Fetcher](.github/workflows/fetch-tickers.yml)

### API Documentation

- [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs/)
- [Alpha Vantage](https://www.alphavantage.co/documentation/)
- [YFinance](https://github.com/ranaroussi/yfinance)

### GitHub Actions

- [View Workflow Runs](https://github.com/YOUR_USERNAME/portfolio/actions/workflows/fetch-penny-tickers.yml)
- [Scheduled Run History](https://github.com/YOUR_USERNAME/portfolio/actions)

---

**Last Updated**: November 2024  
**Version**: 1.0.0  
**Maintained by**: Portfolio Project Team
