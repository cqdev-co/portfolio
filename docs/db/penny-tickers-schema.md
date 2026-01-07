# Penny Tickers Database Schema

## Overview

The `penny_tickers` table stores penny stock data with enhanced risk metrics, quality indicators, and compliance information. Penny stocks are typically defined as stocks trading under $5 and often carry higher risk due to lower liquidity, less regulatory oversight, and higher volatility.

## Table: `penny_tickers`

### Core Fields

| Field        | Type         | Description                                |
| ------------ | ------------ | ------------------------------------------ |
| `id`         | SERIAL       | Primary key                                |
| `symbol`     | VARCHAR(20)  | Unique stock ticker symbol                 |
| `name`       | VARCHAR(255) | Company/security name                      |
| `exchange`   | VARCHAR(50)  | Trading exchange (NYSE, NASDAQ, OTC, etc.) |
| `country`    | VARCHAR(50)  | Country of origin                          |
| `currency`   | VARCHAR(10)  | Trading currency                           |
| `sector`     | VARCHAR(100) | Business sector                            |
| `industry`   | VARCHAR(100) | Industry classification                    |
| `market_cap` | BIGINT       | Market capitalization in dollars           |

### Penny Stock Specific Fields

| Field            | Type           | Description                                                |
| ---------------- | -------------- | ---------------------------------------------------------- |
| `current_price`  | DECIMAL(10, 4) | Current trading price (4 decimal precision for low prices) |
| `average_volume` | BIGINT         | Average daily trading volume (liquidity indicator)         |
| `daily_volume`   | BIGINT         | Current day's trading volume                               |
| `float_shares`   | BIGINT         | Outstanding shares available for trading                   |
| `short_interest` | DECIMAL(10, 2) | Percentage of float that is shorted                        |

### Risk and Quality Indicators

| Field              | Type          | Description                                         |
| ------------------ | ------------- | --------------------------------------------------- |
| `is_otc`           | BOOLEAN       | Over-the-counter stock (not on major exchange)      |
| `is_pink_sheet`    | BOOLEAN       | Pink sheet listing (minimal reporting requirements) |
| `risk_level`       | VARCHAR(20)   | Risk classification: 'high', 'medium', or 'low'     |
| `volatility_score` | DECIMAL(5, 2) | 30-day volatility percentage                        |

### Compliance and Reporting

| Field                      | Type    | Description                        |
| -------------------------- | ------- | ---------------------------------- |
| `is_sec_reporting`         | BOOLEAN | Files regular reports with SEC     |
| `has_financial_statements` | BOOLEAN | Has available financial statements |
| `last_earnings_date`       | DATE    | Most recent earnings report date   |

### Trading Status

| Field         | Type         | Description              |
| ------------- | ------------ | ------------------------ |
| `is_active`   | BOOLEAN      | Currently trading        |
| `is_halted`   | BOOLEAN      | Trading currently halted |
| `halt_reason` | VARCHAR(255) | Reason for trading halt  |

### Price Tracking

| Field          | Type           | Description        |
| -------------- | -------------- | ------------------ |
| `day_high`     | DECIMAL(10, 4) | Today's high price |
| `day_low`      | DECIMAL(10, 4) | Today's low price  |
| `week_52_high` | DECIMAL(10, 4) | 52-week high price |
| `week_52_low`  | DECIMAL(10, 4) | 52-week low price  |

### Metadata

| Field                | Type          | Description                                      |
| -------------------- | ------------- | ------------------------------------------------ |
| `ticker_type`        | VARCHAR(20)   | Always 'penny_stock'                             |
| `data_source`        | VARCHAR(50)   | Source of data (yfinance, fmp, otcmarkets, etc.) |
| `data_quality_score` | DECIMAL(5, 2) | Quality rating 0-100 based on data completeness  |
| `created_at`         | TIMESTAMP     | Record creation timestamp                        |
| `updated_at`         | TIMESTAMP     | Last update timestamp (auto-updated)             |
| `last_fetched`       | TIMESTAMP     | Last time data was fetched from source           |
| `last_price_update`  | TIMESTAMP     | Last time price was updated                      |

## Indexes

### Single Column Indexes

- `symbol` - Primary lookup
- `exchange` - Filter by exchange
- `country` - Geographic filtering
- `sector` - Sector-based queries
- `is_active` - Active stocks only
- `is_otc` - OTC vs exchange-traded
- `risk_level` - Risk-based filtering
- `current_price` - Price range queries
- `market_cap` - Market cap filtering
- `average_volume` - Liquidity filtering
- `data_quality_score` - Quality-based filtering

### Composite Indexes

- `(is_active, current_price)` - Active stocks by price
- `(is_active, average_volume)` - Active stocks by liquidity
- `(is_otc, is_active)` - Active OTC stocks

## Materialized View: `active_quality_penny_tickers`

A materialized view providing quick access to high-quality, actively traded penny stocks:

```sql
SELECT
    symbol,
    name,
    exchange,
    current_price,
    average_volume,
    market_cap,
    volatility_score,
    risk_level,
    data_quality_score,
    is_otc,
    is_sec_reporting,
    last_fetched
FROM penny_tickers
WHERE is_active = true
    AND is_halted = false
    AND data_quality_score >= 50.0
    AND average_volume >= 100000
ORDER BY data_quality_score DESC, average_volume DESC;
```

### Refresh Function

```sql
SELECT refresh_active_quality_penny_tickers();
```

## Data Quality Score Calculation

The `data_quality_score` (0-100) is computed based on:

1. **Data Completeness** (30 points)
   - All core fields populated
   - Price and volume data available
   - Company information complete

2. **Reporting Compliance** (30 points)
   - SEC reporting status
   - Financial statements availability
   - Recent earnings reports

3. **Trading Activity** (40 points)
   - Average volume above threshold
   - Consistent price data
   - No excessive gaps in trading history

## Risk Level Classification

### High Risk

- OTC/Pink Sheet stocks
- No SEC reporting
- Low average volume (<100k)
- High volatility (>50%)
- Frequent trading halts

### Medium Risk

- Exchange-listed but under $2
- SEC reporting but limited volume
- Moderate volatility (20-50%)
- Some financial reporting

### Low Risk

- Exchange-listed (NASDAQ/NYSE)
- SEC reporting
- Average volume >1M
- Low volatility (<20%)
- Regular financial reporting
- Price between $2-$5

## Security and Access Control

### Row Level Security (RLS)

The table has RLS enabled with two policies:

1. **Read Access**: All users can read data

   ```sql
   FOR SELECT USING (true)
   ```

2. **Write Access**: Only service role can insert/update
   ```sql
   FOR ALL USING (auth.role() = 'service_role')
   ```

## Usage Examples

### Find High-Quality Penny Stocks

```sql
SELECT symbol, name, current_price, average_volume, data_quality_score
FROM penny_tickers
WHERE is_active = true
    AND data_quality_score >= 70
    AND average_volume >= 500000
    AND is_sec_reporting = true
ORDER BY data_quality_score DESC
LIMIT 50;
```

### Find Low-Risk Penny Stocks Under $2

```sql
SELECT symbol, name, current_price, risk_level, volatility_score
FROM penny_tickers
WHERE is_active = true
    AND current_price <= 2.00
    AND risk_level = 'low'
    AND is_otc = false
ORDER BY average_volume DESC;
```

### Monitor Recently Halted Stocks

```sql
SELECT symbol, name, halt_reason, last_fetched
FROM penny_tickers
WHERE is_halted = true
    AND last_fetched >= NOW() - INTERVAL '7 days'
ORDER BY last_fetched DESC;
```

### Find SEC-Reporting OTC Stocks

```sql
SELECT symbol, name, exchange, current_price, average_volume
FROM penny_tickers
WHERE is_otc = true
    AND is_sec_reporting = true
    AND is_active = true
ORDER BY average_volume DESC;
```

## Constraints

1. **valid_price**: `current_price >= 0`
2. **valid_market_cap**: `market_cap >= 0`
3. **valid_volume**: `average_volume >= 0`
4. **valid_risk_level**: Risk level must be 'high', 'medium', or 'low'

## Auto-Update Triggers

The `updated_at` field is automatically updated on any row modification via the `update_penny_tickers_updated_at` trigger.

## Integration with Main Tickers Table

The `penny_tickers` table is separate from the main `tickers` table for several reasons:

1. **Different Schema Requirements**: Penny stocks need additional risk and compliance fields
2. **Different Update Frequencies**: Penny stocks may need more frequent price updates
3. **Different Quality Filters**: Penny stocks use different validation criteria
4. **Performance Optimization**: Separate indexes for penny-stock-specific queries

## Best Practices

1. **Always Filter by is_active**: Most queries should only consider active stocks
2. **Consider Volume**: Low volume stocks can be illiquid and hard to trade
3. **Check SEC Reporting**: SEC-reporting companies are generally more reliable
4. **Monitor Quality Scores**: Stick to stocks with quality scores above 50
5. **Respect Risk Levels**: Be aware of the computed risk classification
6. **Refresh Materialized View**: Refresh the quality view regularly for best performance

## Automated Data Collection

The `penny_tickers` table is automatically populated by the Penny Tickers Fetcher system:

- **Schedule**: Weekly on Mondays at 7:00 AM UTC
- **Workflow**: `.github/workflows/fetch-penny-tickers.yml`
- **Script**: `.github/scripts/fetch_penny_tickers.py`

For detailed information about the fetcher system, see:

- **[Penny Tickers Fetcher Guide](penny-tickers-fetcher.md)** - Complete documentation on the automated fetcher system

## Future Enhancements

Potential additions to the schema:

- **Social Media Sentiment**: Twitter/Reddit mention tracking
- **Insider Trading Data**: Recent insider buy/sell activity
- **Short Interest Changes**: Track short interest over time
- **Price Targets**: Analyst price targets where available
- **News Events**: Significant news and PR releases
- **Pump-and-Dump Detection**: Pattern analysis for manipulation
