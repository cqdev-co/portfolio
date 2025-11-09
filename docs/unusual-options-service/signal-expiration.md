# Signal Expiration System

## Overview

The signal expiration system automatically marks options signals as inactive when they reach their expiration date. This ensures the database maintains accurate signal status and prevents expired options from appearing in active signal queries.

## How It Works

### Daily Automated Expiration

A GitHub Actions workflow runs daily at **4:30 PM ET** (30 minutes after market close) to:

1. Query all signals where `is_active = true` AND `expiry <= today`
2. Mark these signals as `is_active = false` in batches
3. Log detailed statistics about expired signals

### Workflow Schedule

- **Scheduled:** Mon-Fri at 4:30 PM ET (20:30 UTC during EDT)
- **Manual trigger:** Available via GitHub Actions UI
- **Timeout:** 10 minutes
- **Workflow file:** `.github/workflows/uos-expire-signals.yml`

## Script Details

### Location
```
unusual-options-service/scripts/expire_signals.py
```

### Features

- **Batch Processing:** Updates signals in batches of 500 for efficiency
- **Detailed Reporting:** Provides statistics grouped by:
  - Expiry date
  - Ticker symbol  
  - Signal grade
- **Dry Run Mode:** Test the script without making changes
- **Comprehensive Logging:** Uses loguru for structured, colorized output

### Usage

#### Run Normally (Mark Signals Inactive)
```bash
cd unusual-options-service
poetry run python scripts/expire_signals.py
```

#### Dry Run (Report Only, No Changes)
```bash
cd unusual-options-service
poetry run python scripts/expire_signals.py --dry-run
```

#### Manual Trigger via GitHub Actions
1. Go to GitHub Actions tab
2. Select "Expire Unusual Options Signals" workflow
3. Click "Run workflow"
4. Optionally enable "Dry run mode"

### Example Output

```
============================================================
UNUSUAL OPTIONS SIGNAL EXPIRATION
============================================================
Checking for expired signals as of 2025-11-07
Found 1,767 expired signals

============================================================
EXPIRATION SUMMARY
============================================================

By Expiry Date:
  2025-11-07: 1,767 signals

By Grade:
  Grade S: 523 signals
  Grade A: 402 signals
  Grade B: 389 signals
  Grade C: 298 signals
  Grade D: 155 signals

Top 10 Tickers:
  TSLA: 187 signals
  AAPL: 143 signals
  SPY: 132 signals
  NVDA: 118 signals
  AMD: 95 signals
  ...
============================================================

Marking 1,767 signals as inactive...
✓ Successfully expired 1,767 signals
```

## Database Impact

### Fields Updated

- **is_active:** Changed from `true` to `false`
- **updated_at:** Automatically updated by Supabase trigger

### Query Filtering

Most queries in the application filter by `is_active = true`, so expired signals will automatically be excluded from:

- Active signal lists
- Continuity tracking
- Performance analysis
- Alert generation

### Data Retention

Expired signals are **NOT deleted** - they remain in the database for:

- Historical analysis
- Performance tracking
- Backtesting
- Audit trail

## Configuration

### Environment Variables

The script requires these environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # Preferred
# OR
SUPABASE_KEY=your-anon-key  # Fallback
```

### GitHub Secrets

The workflow uses these GitHub secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (preferred)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback)

## Why 4:30 PM ET?

The expiration runs **30 minutes after market close** to ensure:

1. **Complete data capture:** All end-of-day signals are recorded
2. **After-hours activity:** Captures any unusual activity during the 
   4:00-4:30 PM window
3. **Safe buffer:** Prevents race conditions with the hourly scanner
4. **Time zone safety:** Works correctly during both EDT and EST

## Monitoring

### Success Indicators

- Workflow completes successfully
- Log shows "Successfully expired X signals"
- `updated_at` timestamps are recent
- Active signal count decreases appropriately

### Troubleshooting

**No signals found when some should expire:**
- Check that signals have `is_active = true`
- Verify expiry dates are in correct format (YYYY-MM-DD)
- Confirm today's date is >= expiry date

**Batch update fails:**
- Check Supabase service key permissions
- Verify RLS policies allow updates
- Ensure database is not under heavy load

**Workflow times out:**
- Increase timeout in workflow file
- Check batch size (default 500)
- Verify database connection is stable

## Integration with Other Systems

### Continuity Tracking

The continuity service automatically respects `is_active = false` and won't try to extend expired signal chains.

### Performance Tracking

Performance calculations can optionally include expired signals for historical analysis.

### Alerts

Alert systems should filter by `is_active = true` to avoid alerting on expired signals.

## Future Enhancements

Potential improvements to consider:

1. **Archive table:** Move very old expired signals to archive table
2. **Notification:** Send summary email/Slack message after expiration
3. **Performance summary:** Include P&L summary for expired signals
4. **Predictive alerts:** Warn about high-value signals expiring soon
5. **Smart scheduling:** Adjust for market holidays automatically

## Related Documentation

- [System Overview](./system-overview.md)
- [Database Schema](./database-schema.md)
- [Continuity Tracking](./README.md#continuity-tracking)
- [GitHub Actions Workflows](../README.md#automation)

