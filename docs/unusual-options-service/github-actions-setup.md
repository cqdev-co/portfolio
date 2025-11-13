# GitHub Actions Workflow Setup

Complete guide for setting up and using the automated Unusual Options Scanner via GitHub Actions.

## Overview

The Unusual Options Scanner includes a GitHub Actions workflow (`.github/workflows/uos.yml`) that automatically scans the market for unusual options activity during US market hours.

## Workflow Schedule

The workflow runs **every 30 minutes** during US EDT market hours:

- **Start:** 9:30 AM EDT (13:30 UTC)
- **End:** 4:00 PM EDT (20:00 UTC) - Market close
- **Frequency:** Every 30 minutes (14 scans per day)
- **Days:** Monday through Friday (market days only)

### Schedule Details

| Time (EDT) | Time (UTC) | Cron Expression |
|------------|-----------|-----------------|
| 9:30 AM | 13:30 | `30 13 * * 1-5` |
| 10:00 AM | 14:00 | `0 14 * * 1-5` |
| 10:30 AM | 14:30 | `30 14 * * 1-5` |
| 11:00 AM | 15:00 | `0 15 * * 1-5` |
| 11:30 AM | 15:30 | `30 15 * * 1-5` |
| 12:00 PM | 16:00 | `0 16 * * 1-5` |
| 12:30 PM | 16:30 | `30 16 * * 1-5` |
| 1:00 PM | 17:00 | `0 17 * * 1-5` |
| 1:30 PM | 17:30 | `30 17 * * 1-5` |
| 2:00 PM | 18:00 | `0 18 * * 1-5` |
| 2:30 PM | 18:30 | `30 18 * * 1-5` |
| 3:00 PM | 19:00 | `0 19 * * 1-5` |
| 3:30 PM | 19:30 | `30 19 * * 1-5` |
| 4:00 PM | 20:00 | `0 20 * * 1-5` |

## Manual Trigger

You can also trigger the workflow manually from the GitHub Actions UI with custom parameters:

### Input Parameters

- **`min_grade`** (optional): Minimum signal grade to display
  - Options: `S`, `A`, `B`, `C`, `D`, `F`
  - Default: `B`
  
- **`limit`** (optional): Maximum number of tickers to scan
  - Type: Number
  - Default: Unlimited (scans all tickers)
  - Example: `500` to scan first 500 tickers (faster execution)

### How to Trigger Manually

1. Go to GitHub repository → **Actions** tab
2. Select **"Unusual Options Scanner"** workflow
3. Click **"Run workflow"** button
4. Select branch (usually `main`)
5. Optionally set:
   - Minimum grade (default: `B`)
   - Limit (optional, leave empty for unlimited)
6. Click **"Run workflow"**

## Configuration

### Required GitHub Secrets

The workflow requires these secrets to be configured in your GitHub repository:

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Your Supabase project URL
   - Example: `https://xxxxx.supabase.co`

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Supabase anonymous key (for read operations)

3. **`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`**
   - Supabase service role key (for write operations)
   - Required for storing signals in database

### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret with the exact name listed above
5. Paste the corresponding value from your Supabase dashboard

## How It Works

### Execution Flow

1. **Checkout:** Clones the repository
2. **Setup Python:** Installs Python 3.11
3. **Install Poetry:** Sets up Poetry package manager
4. **Cache Dependencies:** Uses GitHub Actions cache for faster builds
5. **Install Dependencies:** Installs project dependencies via Poetry
6. **Run Scanner:** Executes `scan-all` command with:
   - Minimum grade filter (from input or default `B`)
   - Optional limit (if provided)
   - `--store` flag to save signals to database

### Command Execution

The workflow runs:

```bash
poetry run python -m unusual_options.cli scan-all \
  --min-grade <min_grade> \
  [--limit <limit>] \
  --store
```

**Note:** The `--limit` flag is only included when a limit value is provided. This prevents errors when the limit input is empty (e.g., during scheduled runs).

### Signal Storage

All detected signals are automatically stored in the Supabase database with:
- Signal metadata (ticker, contract, grade, score)
- Detection timestamp
- Premium flow, volume, open interest data
- Continuity tracking for signal lifecycle management

## Signal Lifecycle

### Continuity Tracking

The scanner includes continuity tracking to:
- **Detect new signals:** First-time detection of unusual activity
- **Track signal evolution:** Monitor how signals change over time
- **Prevent duplicates:** Avoid storing the same signal multiple times
- **Signal expiration:** Automatically mark expired options as inactive

### Signal States

- **Active:** Signal is current and options haven't expired
- **Inactive:** Options have expired or signal is no longer relevant
- **New:** First detection of this signal
- **Continuation:** Signal detected in previous scans

## Monitoring

### Viewing Workflow Runs

1. Go to **Actions** tab in GitHub
2. Click on **"Unusual Options Scanner"** workflow
3. View recent runs and their status
4. Click on a run to see detailed logs

### Success Indicators

✅ **Workflow completes successfully**
- Exit code: 0
- "Scanning all tickers..." completes
- Signals displayed in output (if any found)

✅ **Signals stored in database**
- Check Supabase dashboard → `unusual_options_signals` table
- Verify `detection_timestamp` is recent
- Confirm `is_active = true` for new signals

### Log Output

The workflow logs include:
- Configuration status
- Scan progress
- Detected signals (formatted table)
- Summary statistics
- Error messages (if any)

## Troubleshooting

### Common Issues

#### Workflow Fails with "Invalid value for '--limit'"

**Problem:** The `--limit` flag receives an invalid value.

**Solution:** This has been fixed in the workflow. The `--limit` flag is now conditionally included only when a value is provided. If you see this error, ensure you're using the latest workflow version.

#### "No .env file found" Warning

**Status:** This is expected and safe to ignore.

**Explanation:** The workflow uses environment variables from GitHub Secrets instead of a `.env` file. The warning is informational and doesn't affect functionality.

#### Workflow Times Out

**Problem:** Workflow exceeds 60-minute timeout.

**Solutions:**
- Reduce the `limit` parameter to scan fewer tickers
- Check for API rate limiting issues
- Review logs for specific bottlenecks

#### No Signals Detected

**Status:** This is normal.

**Explanation:** Most scans don't find unusual activity. This indicates:
- Market conditions are normal
- Detection thresholds are working correctly
- No insider-type activity detected

**To find more signals:**
- Lower the `min_grade` parameter (try `C` or `D`)
- Scan during high-volatility periods
- Check during earnings season

#### Database Connection Errors

**Problem:** Cannot connect to Supabase.

**Solutions:**
1. Verify GitHub Secrets are set correctly
2. Check Supabase project is active
3. Verify service role key has write permissions
4. Check Supabase RLS policies allow inserts

#### Poetry Installation Fails

**Problem:** Poetry dependencies fail to install.

**Solutions:**
- Check `poetry.lock` file is committed
- Verify Python version compatibility
- Clear GitHub Actions cache and retry

### Debugging Tips

1. **Check Workflow Logs:**
   - Go to Actions → Select workflow run → View logs
   - Look for error messages in red
   - Check environment variable values (masked)

2. **Test Locally:**
   ```bash
   cd unusual-options-service
   poetry run python -m unusual_options.cli scan-all \
     --min-grade B \
     --store
   ```

3. **Verify Secrets:**
   - Double-check secret names match exactly
   - Ensure no extra spaces or characters
   - Test Supabase connection manually

4. **Check Database:**
   - Verify `unusual_options_signals` table exists
   - Check RLS policies allow service role writes
   - Confirm table schema matches expected structure

## Performance

### Execution Time

- **Full scan (unlimited):** 30-60 minutes
- **Limited scan (500 tickers):** 5-15 minutes
- **Limited scan (100 tickers):** 2-5 minutes

### Resource Usage

- **Runner:** `ubuntu-latest` (2-core, 7GB RAM)
- **Timeout:** 60 minutes
- **Cache:** Poetry dependencies cached for faster builds

### Optimization Tips

1. **Use limit parameter** for faster scans during testing
2. **Schedule scans strategically** - avoid overlapping runs
3. **Monitor API rate limits** if using paid data providers
4. **Use GitHub Actions cache** to speed up dependency installation

## Best Practices

### 1. Start with Limited Scans

When testing, use a small limit:
```
limit: 100
```

### 2. Monitor Signal Quality

Review detected signals regularly:
- Check signal grades match expectations
- Verify premium flow amounts are reasonable
- Confirm tickers are relevant to your strategy

### 3. Adjust Minimum Grade

- **Conservative:** Use `min_grade: A` for high-quality signals only
- **Balanced:** Use `min_grade: B` (default) for good signals
- **Aggressive:** Use `min_grade: C` to catch more opportunities

### 4. Review Workflow History

Regularly check:
- Workflow success rate
- Execution times
- Error patterns
- Signal detection trends

### 5. Database Maintenance

- Monitor database size
- Review expired signals periodically
- Clean up old inactive signals if needed
- Check for duplicate signals

## Related Documentation

- [Quick Start Guide](quick-start.md) - Local setup and first scans
- [Signal Expiration](signal-expiration.md) - Automatic signal expiration
- [System Overview](system-overview.md) - Architecture and components
- [Database Schema](database-schema.md) - Database structure
- [FAQ](faq.md) - Common questions and answers

## Changelog

### November 13, 2025
- **Fixed:** `--limit` flag handling for empty values
  - Workflow now conditionally includes `--limit` only when a value is provided
  - Prevents "Invalid value for '--limit'" errors during scheduled runs
  - Manual triggers with empty limit now work correctly

### Previous Updates
- Initial workflow setup with scheduled scans
- Manual trigger support with custom parameters
- Continuity tracking integration
- Database storage automation

---

**Need Help?** Check the [FAQ](faq.md) or review workflow logs for specific error messages.

