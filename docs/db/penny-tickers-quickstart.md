# Penny Tickers Quick Start Guide

Get started with the Penny Tickers system in 5 minutes.

## 1. Database Setup ✅

You've already completed this step! The `penny_tickers` table is now ready in Supabase.

## 2. Run Your First Fetch

### Option A: Manual Test (Local)

Test the fetcher locally before running in production:

```bash
# Navigate to scripts directory
cd .github/scripts

# Install dependencies (if not already installed)
pip install -r requirements.txt
pip install yfinance

# Create .env file with your credentials
cat > .env << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FMP_API_KEY=your_fmp_key
EOF

# Run in dry-run mode (no database writes)
python fetch_penny_tickers.py --dry-run --verbose --max-tickers 100

# If successful, run for real
python fetch_penny_tickers.py --max-tickers 500
```

### Option B: GitHub Actions (Recommended)

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Find **"Weekly Penny Stock Tickers Update"**
4. Click **"Run workflow"**
5. Configure settings:
   - **Dry Run**: ✅ (for first test)
   - **Verbose**: ✅ (to see details)
   - **Max Price**: 5.0
   - **Max Tickers**: 500
6. Click **"Run workflow"**
7. Watch the logs in real-time

## 3. Verify Data in Supabase

After the fetch completes, check your data:

### Query 1: Count Total Tickers

```sql
SELECT COUNT(*) as total_penny_tickers
FROM penny_tickers
WHERE is_active = true;
```

### Query 2: View High-Quality Stocks

```sql
SELECT
    symbol,
    name,
    current_price,
    average_volume,
    risk_level,
    data_quality_score
FROM penny_tickers
WHERE is_active = true
    AND data_quality_score >= 70
ORDER BY data_quality_score DESC
LIMIT 20;
```

### Query 3: Risk Distribution

```sql
SELECT
    risk_level,
    COUNT(*) as count,
    AVG(current_price) as avg_price,
    AVG(average_volume) as avg_volume
FROM penny_tickers
WHERE is_active = true
GROUP BY risk_level
ORDER BY risk_level;
```

## 4. Use the Materialized View

The system automatically creates a materialized view for high-quality penny stocks:

```sql
-- View pre-filtered quality stocks
SELECT * FROM active_quality_penny_tickers
LIMIT 20;

-- Refresh the view (run after updates)
SELECT refresh_active_quality_penny_tickers();
```

## 5. Common Queries for Trading

### Find Low-Risk Penny Stocks Under $2

```sql
SELECT
    symbol,
    name,
    current_price,
    average_volume,
    volatility_score,
    data_quality_score
FROM penny_tickers
WHERE is_active = true
    AND risk_level = 'low'
    AND current_price <= 2.00
    AND average_volume >= 500000
ORDER BY data_quality_score DESC, average_volume DESC
LIMIT 25;
```

### Find SEC-Reporting OTC Stocks

```sql
SELECT
    symbol,
    name,
    exchange,
    current_price,
    average_volume,
    data_quality_score
FROM penny_tickers
WHERE is_otc = true
    AND is_sec_reporting = true
    AND is_active = true
    AND average_volume >= 100000
ORDER BY data_quality_score DESC
LIMIT 20;
```

### Find Recently Active Stocks

```sql
SELECT
    symbol,
    name,
    current_price,
    day_high,
    day_low,
    daily_volume,
    average_volume,
    (daily_volume::float / NULLIF(average_volume, 0)) as volume_ratio
FROM penny_tickers
WHERE is_active = true
    AND daily_volume IS NOT NULL
    AND average_volume > 0
    AND daily_volume > average_volume * 2  -- 2x normal volume
ORDER BY volume_ratio DESC
LIMIT 20;
```

### Find Volatile Penny Stocks

```sql
SELECT
    symbol,
    name,
    current_price,
    volatility_score,
    average_volume,
    risk_level
FROM penny_tickers
WHERE is_active = true
    AND volatility_score IS NOT NULL
    AND volatility_score >= 40
    AND average_volume >= 250000
ORDER BY volatility_score DESC
LIMIT 20;
```

## 6. Configure Automated Updates

The workflow is already set up to run **every Monday at 7:00 AM UTC**.

### Customize the Schedule

Edit `.github/workflows/fetch-penny-tickers.yml`:

```yaml
on:
  schedule:
    # Change the cron schedule here
    - cron: '0 7 * * 1' # Default: Mondays at 7 AM UTC
```

Cron schedule examples:

- `'0 7 * * 1'` - Every Monday at 7 AM UTC
- `'0 12 * * 1,4'` - Mondays and Thursdays at 12 PM UTC
- `'0 6 * * *'` - Every day at 6 AM UTC

### Adjust Fetcher Parameters

Edit the workflow to change default parameters:

```yaml
- name: Run penny ticker fetch (production)
  run: |
    cd .github/scripts
    python fetch_penny_tickers.py \
      --max-price 5.0 \         # Change price threshold
      --min-volume 10000 \      # Change volume requirement
      --max-tickers 2000        # Change ticker limit
```

## 7. Monitor and Maintain

### Check Workflow Status

1. Go to **Actions** tab on GitHub
2. View recent runs of "Weekly Penny Stock Tickers Update"
3. Check for failures or warnings
4. Download logs if needed (30-day retention)

### Refresh Materialized View

Run this weekly after the fetch completes:

```sql
SELECT refresh_active_quality_penny_tickers();
```

Or automate with a PostgreSQL cron job (if using pg_cron extension):

```sql
SELECT cron.schedule(
    'refresh-penny-tickers-view',
    '0 8 * * 1',  -- Mondays at 8 AM (after fetch at 7 AM)
    'SELECT refresh_active_quality_penny_tickers();'
);
```

### Monitor Data Quality

Weekly quality check:

```sql
SELECT
    COUNT(*) as total_tickers,
    AVG(data_quality_score) as avg_quality,
    COUNT(CASE WHEN data_quality_score >= 70 THEN 1 END) as high_quality_count,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) as low_risk_count,
    COUNT(CASE WHEN is_sec_reporting THEN 1 END) as sec_reporting_count,
    MAX(last_fetched) as last_update
FROM penny_tickers
WHERE is_active = true;
```

## 8. Integration Examples

### Frontend Query Example

For a Next.js/React frontend with Supabase:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Fetch quality penny stocks
async function fetchQualityPennyStocks() {
  const { data, error } = await supabase
    .from('active_quality_penny_tickers')
    .select('*')
    .limit(50);

  if (error) throw error;
  return data;
}

// Search by symbol
async function searchPennyStock(symbol: string) {
  const { data, error } = await supabase
    .from('penny_tickers')
    .select('*')
    .eq('symbol', symbol.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error) throw error;
  return data;
}

// Filter by risk and price
async function filterPennyStocks({
  maxPrice = 5.0,
  riskLevel = 'low',
  minVolume = 100000,
}) {
  const { data, error } = await supabase
    .from('penny_tickers')
    .select('*')
    .eq('is_active', true)
    .eq('risk_level', riskLevel)
    .lte('current_price', maxPrice)
    .gte('average_volume', minVolume)
    .order('data_quality_score', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}
```

### Python Analysis Example

```python
from supabase import create_client
import pandas as pd

# Initialize client
supabase = create_client(
    os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

# Fetch data
response = supabase.table('penny_tickers')\
    .select('*')\
    .eq('is_active', True)\
    .gte('data_quality_score', 60)\
    .execute()

# Convert to DataFrame
df = pd.DataFrame(response.data)

# Analyze by sector
sector_analysis = df.groupby('sector').agg({
    'symbol': 'count',
    'current_price': 'mean',
    'average_volume': 'mean',
    'volatility_score': 'mean'
}).round(2)

print(sector_analysis)
```

## 9. Troubleshooting

### No data after fetch?

1. Check GitHub Actions logs for errors
2. Verify Supabase credentials
3. Test RLS policies:
   ```sql
   -- Temporarily disable RLS for testing
   ALTER TABLE penny_tickers DISABLE ROW LEVEL SECURITY;
   -- Re-enable after testing
   ALTER TABLE penny_tickers ENABLE ROW LEVEL SECURITY;
   ```

### Quality scores too low?

Lower the volume requirement:

```bash
python fetch_penny_tickers.py --min-volume 5000
```

### Fetch taking too long?

Reduce the ticker limit:

```bash
python fetch_penny_tickers.py --max-tickers 1000
```

### API rate limits?

1. Wait for the limit to reset
2. Use dry-run mode for testing
3. Consider upgrading API plans

## 10. Next Steps

Now that your penny tickers system is running:

1. **Build a Frontend**: Create a penny stock screener UI
2. **Add Alerts**: Set up notifications for new high-quality stocks
3. **Integrate with Trading**: Connect to your trading analysis tools
4. **Track Performance**: Monitor which tickers perform well
5. **Expand Data**: Add social sentiment, news, insider trading

## Resources

- [Penny Tickers Schema](penny-tickers-schema.md) - Complete field reference
- [Penny Tickers Fetcher](penny-tickers-fetcher.md) - Detailed fetcher guide
- [Database README](README.md) - General database documentation

## Need Help?

Common issues and solutions:

| Issue                | Solution                                            |
| -------------------- | --------------------------------------------------- |
| "No API key found"   | Add keys to `.env` or GitHub Secrets                |
| "No tickers fetched" | Check API limits, try dry-run with verbose          |
| "Permission denied"  | Verify service role key, check RLS policies         |
| "Timeout"            | Reduce `--max-tickers` or increase workflow timeout |

---

**Quick Command Reference:**

```bash
# Local dry-run test
python fetch_penny_tickers.py --dry-run --verbose --max-tickers 100

# Production run with custom settings
python fetch_penny_tickers.py --max-price 3.0 --max-tickers 1000

# Refresh materialized view
psql -c "SELECT refresh_active_quality_penny_tickers();"
```

**You're all set! 🚀**
