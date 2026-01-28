# CDS Engine Strategy - CI/CD Automation

## Overview

The CDS Engine Strategy includes automated CI/CD capabilities via GitHub Actions to eliminate manual daily runs. The system automatically:

1. **Morning Briefing** - Daily pre-market summary
2. **Opportunity Scanning** - Market-hours scanning for CDS opportunities
3. **Signal Outcome Tracking** - Automatic verification of signal accuracy
4. **Weekly Reports** - Performance analysis and universe scanning

## Workflow Schedule

| Job              | Schedule                      | Description                               |
| ---------------- | ----------------------------- | ----------------------------------------- |
| Morning Briefing | 9:00 AM ET (Mon-Fri)          | Market regime, watchlist alerts, earnings |
| Opportunity Scan | 10:00 AM, 1:00 PM, 3:30 PM ET | Scan for high-score opportunities         |
| Weekly Report    | Sunday 6:00 PM ET             | Signal outcomes, performance, top picks   |

## Manual Triggers

The workflow can be manually triggered with different job types:

```bash
# Via GitHub UI or CLI
gh workflow run cds-scanner.yml -f job_type=briefing
gh workflow run cds-scanner.yml -f job_type=scan -f min_score=80
gh workflow run cds-scanner.yml -f job_type=scan_universe
gh workflow run cds-scanner.yml -f job_type=signal_outcomes
gh workflow run cds-scanner.yml -f job_type=weekly_report
```

### Job Types

- `briefing` - Morning briefing (regime + watchlist + earnings)
- `scan` - Quick opportunity scan with configurable min score
- `scan_universe` - Full scan of all ~2000 tickers (resource intensive)
- `signal_outcomes` - Check if past signals hit their targets
- `weekly_report` - Comprehensive weekly summary

### Options

- `min_score` - Minimum score threshold (default: 70)
- `dry_run` - Run without database updates (for testing)

## Signal Outcome Tracking

### How It Works

The system automatically tracks whether generated signals achieve their target prices:

1. **Signal Capture** - When `scan-all` runs with `--store`, signals are saved to `cds_signals` with:
   - Current price
   - Target price (based on upside potential)
   - Market regime at time of signal
   - Spread viability

2. **Outcome Checking** - The `signal-outcomes` command:
   - Fetches signals 7-60 days old
   - Gets current and historical high prices
   - Determines if target was hit
   - Updates database with outcome status

3. **Accuracy Reporting** - Generates accuracy statistics by:
   - Signal grade (A/B/C/D)
   - Market regime (bull/neutral/bear/caution)

### Database Schema

The tracking uses these columns added to `cds_signals`:

```sql
upside_potential  -- Expected % gain (e.g., 0.15 = 15%)
target_price      -- Calculated target (price * (1 + upside))
outcome_status    -- pending | target_hit | target_missed | expired
outcome_date      -- When outcome was determined
max_price_seen    -- Highest price since signal
max_gain_pct      -- Maximum gain achieved
days_to_outcome   -- Days from signal to outcome
```

### Running Outcome Checks

```bash
# Check outcomes (7-60 day old signals)
bun run signal-outcomes

# Verbose output with all details
bun run signal-outcomes --verbose

# Dry run (no database updates)
bun run signal-outcomes --dry-run

# Custom age range
bun run signal-outcomes --min-age 14 --max-age 90
```

### Sample Output

```
📊 Signal Outcome Tracker

  Fetching signals 7-60 days old...
  Found 45 signals to check
  Fetching price data for 38 tickers...

✅ Target Hits
┌────────┬───────┬─────────────┬─────────┬─────────┬─────────┬────────┬──────┐
│ Ticker │ Grade │ Signal Date │ Entry   │ Target  │ High    │ Gain   │ Days │
├────────┼───────┼─────────────┼─────────┼─────────┼─────────┼────────┼──────┤
│ NVDA   │ A     │ 2025-12-15  │ $125.40 │ $143.21 │ $152.30 │ +21.5% │ 18   │
│ CRWD   │ B     │ 2025-12-20  │ $385.20 │ $423.72 │ $445.00 │ +15.5% │ 12   │
└────────┴───────┴─────────────┴─────────┴─────────┴─────────┴────────┴──────┘

📈 Session Summary
  ─────────────────────────
  Signals checked: 45
  Target hits: 12
  Misses/Expired: 8
  Database updated: 20

📊 Signal Accuracy Report
  ─────────────────────────
┌───────┬─────────┬──────┬────────┬─────────┬──────────┐
│ Grade │ Signals │ Hits │ Misses │ Pending │ Accuracy │
├───────┼─────────┼──────┼────────┼─────────┼──────────┤
│ A     │ 15      │ 10   │ 3      │ 2       │ 76.9%    │
│ B     │ 25      │ 12   │ 8      │ 5       │ 60.0%    │
│ C     │ 18      │ 5    │ 10     │ 3       │ 33.3%    │
└───────┴─────────┴──────┴────────┴─────────┴──────────┘
```

## Required Secrets

Add these secrets to your GitHub repository:

| Secret                                  | Description                                  |
| --------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key                    |
| `DISCORD_CDS_WEBHOOK_URL`               | (Optional) Discord webhook for notifications |

## Database Migration

Before using signal outcome tracking, run the migration:

```sql
-- Run in Supabase SQL Editor
-- File: db/migrations/add_signal_target_tracking.sql
```

This adds the required columns and functions for outcome tracking.

## Local Development

Run the same commands locally:

```bash
cd cds-engine-strategy

# Morning briefing
bun run briefing

# Quick scan
bun run engine  # alias for scan-all --summary

# Full scan with storage (use --store for explicit DB writes)
bun run scan-all --store

# Check signal outcomes
bun run signal-outcomes --verbose

# Performance report
bun run performance
```

## Monitoring

### Viewing Workflow Runs

```bash
# List recent runs
gh run list --workflow=cds-scanner.yml

# View run details
gh run view <run-id>

# Watch a running workflow
gh run watch
```

### Checking Signal Accuracy

Query the database directly:

```sql
-- Overall accuracy by grade
SELECT * FROM cds_signal_accuracy;

-- Recent outcomes
SELECT ticker, signal_date, signal_grade, outcome_status,
       days_to_outcome, max_gain_pct
FROM cds_signals
WHERE outcome_status != 'pending'
ORDER BY outcome_date DESC
LIMIT 20;

-- Pending signals
SELECT ticker, signal_date, signal_grade, price_at_signal, target_price
FROM cds_signals
WHERE outcome_status = 'pending'
  AND target_price IS NOT NULL
ORDER BY signal_date DESC;
```

## Future Enhancements

1. **Discord Rich Embeds** - Detailed notifications with opportunity cards
2. **Watchlist Alerts** - Price target hit notifications
3. **Adaptive Scheduling** - Skip scans during NO_TRADE regime
4. **Performance Dashboard** - Frontend visualization of accuracy metrics
