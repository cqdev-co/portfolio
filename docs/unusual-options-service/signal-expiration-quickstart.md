# Signal Expiration - Quick Start Guide

## 🚀 What Is This?

Automatic daily cleanup system that marks expired options signals as inactive every day at 4:30 PM ET (30 minutes after market close).

## 📁 Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `unusual-options-service/scripts/expire_signals.py` | Python script to expire signals | 235 |
| `.github/workflows/uos-expire-signals.yml` | GitHub Actions workflow | 81 |
| `docs/unusual-options-service/signal-expiration.md` | Full documentation | 209 |

## 🎯 Quick Commands

### Test Locally (Dry Run)
```bash
cd unusual-options-service
export SUPABASE_URL="your_url"
export SUPABASE_SERVICE_KEY="your_key"
poetry run python scripts/expire_signals.py --dry-run
```

### Run Expiration
```bash
cd unusual-options-service
poetry run python scripts/expire_signals.py
```

### Manual Trigger via GitHub Actions
1. Go to **Actions** tab
2. Click **"Expire Unusual Options Signals"**
3. Click **"Run workflow"**
4. Optionally enable **"Dry run mode"**
5. Click **"Run workflow"** button

## 📅 Schedule

- **Runs:** Mon-Fri at 4:30 PM ET (20:30 UTC during EDT)
- **Duration:** < 1 minute
- **Next Run:** Automatically tomorrow at 4:30 PM ET

## 📊 What It Does

1. Queries: `SELECT * FROM unusual_options_signals WHERE is_active = true AND expiry <= today`
2. Updates: `SET is_active = false` in batches of 500
3. Logs statistics by expiry date, ticker, and grade
4. Preserves signals for historical analysis

## ✅ Success Check

After running, verify:
- [x] Workflow completed successfully in GitHub Actions
- [x] Logs show "Successfully expired X signals"
- [x] Frontend only shows non-expired signals
- [x] Database active count decreased appropriately

## 🔍 Statistics Example

```
By Expiry Date:
  2025-11-07: 1,767 signals

By Grade:
  Grade S: 523 signals
  Grade A: 402 signals
  Grade B: 389 signals

Top Tickers:
  TSLA: 187 signals
  AAPL: 143 signals
  SPY: 132 signals
```

## 🛟 Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow doesn't run | Check cron schedule and workflow is enabled |
| Permission denied | Verify SUPABASE_SERVICE_KEY secret is set |
| No signals found | Check that signals have correct expiry dates |
| Timeout | Increase timeout in workflow file (default: 10 min) |

## 📖 Full Documentation

For detailed information, see:
- [Complete System Documentation](./signal-expiration.md)
- [Implementation Details](./signal-expiration-implementation.md)
- [Scripts README](../../unusual-options-service/scripts/README.md)

## 🎉 That's It!

The system runs automatically every weekday after market close. No manual intervention needed!

**Note:** Expired signals are never deleted, just marked inactive for historical analysis.

