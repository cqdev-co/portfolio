# PCS Engine Strategy - CI/CD Automation

## Overview

The PCS Engine Strategy includes automated CI/CD capabilities via GitHub Actions to eliminate manual daily runs. The system automatically:

1. **Morning Briefing** - Daily pre-market PCS overview
2. **Opportunity Scanning** - Market-hours scanning for put credit spread opportunities
3. **Weekly Reports** - Market regime analysis, performance summary, and top picks

## Workflow Schedule

| Job              | Schedule                           | Description                              |
| ---------------- | ---------------------------------- | ---------------------------------------- |
| Morning Briefing | 9:30 AM ET (Mon-Fri)              | Market regime, IV environment, PCS setup |
| Opportunity Scan | 10:30 AM, 1:30 PM, 3:45 PM ET    | Scan for high-score PCS opportunities    |
| Weekly Report    | Sunday 7:00 PM ET                 | Regime, performance, top picks           |

> **Note:** PCS scans are offset by 30 minutes from CDS scans to avoid concurrent API calls and GitHub Actions resource contention.

## Manual Triggers

The workflow can be manually triggered with different job types:

```bash
# Via GitHub UI or CLI
gh workflow run pcs-scanner.yml -f job_type=briefing
gh workflow run pcs-scanner.yml -f job_type=scan -f min_score=70
gh workflow run pcs-scanner.yml -f job_type=scan -f tickers=AAPL,MSFT,NVDA
gh workflow run pcs-scanner.yml -f job_type=scan_spreads -f list=growth
gh workflow run pcs-scanner.yml -f job_type=weekly_report
```

### Job Types

- `briefing` - Morning briefing (market regime + IV environment + PCS outlook)
- `scan` - Opportunity scan with configurable min score and ticker list
- `scan_spreads` - Detailed put credit spread analysis for specific tickers/lists
- `weekly_report` - Comprehensive weekly summary (regime + performance + scan)

### Options

- `min_score` - Minimum score threshold (default: 65, PCS-specific)
- `tickers` - Custom comma-separated ticker symbols (overrides list)
- `list` - Ticker list: mega, growth, value, etf, sp500 (default: mega)

## How Scanning Works

### Automatic Database Storage

Unlike CDS which requires `--store`, the PCS `scan-all` command **automatically stores** every scanned signal to the `pcs_signals` table in Supabase. No additional flags are needed.

### Scoring Thresholds

| Score Range | Grade | Action                            |
| ----------- | ----- | --------------------------------- |
| 80+         | A     | Strong PCS candidate, scan spread |
| 65-79       | B     | Viable candidate, monitor         |
| 50-64       | C     | Below threshold, skip             |
| <50         | D     | Not suitable for PCS              |

### IV Analysis (PCS-Specific)

The PCS engine uniquely scores IV rank since selling premium benefits from elevated volatility:

- **IV Rank >= 50**: Excellent premium (12 pts)
- **IV Rank >= 30**: Decent premium (8 pts)
- **IV Rank >= 15**: Low premium, consider waiting (3 pts)
- **IV Rank < 15**: Insufficient for PCS (0 pts)
- **IV Rank > 80**: Warning - extreme IV may signal danger

## Required Secrets

Add these secrets to your GitHub repository:

| Secret                                  | Description                                  |
| --------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key                    |
| `DISCORD_PCS_WEBHOOK_URL`               | (Optional) Discord webhook for notifications |

## Local Development

Run the same commands locally:

```bash
cd pcs-engine-strategy

# Morning briefing
bun run briefing

# Quick scan
bun run engine  # alias for scan-all --summary

# Full scan (auto-stores to DB)
bun run scan-all --min-score 65

# Find specific spreads
bun run scan-spreads --tickers AAPL,MSFT,NVDA

# Market regime
bun run regime

# Performance report
bun run performance
```

## Monitoring

### Viewing Workflow Runs

```bash
# List recent runs
gh run list --workflow=pcs-scanner.yml

# View run details
gh run view <run-id>

# Watch a running workflow
gh run watch
```

### Checking PCS Performance

Query the database directly:

```sql
-- Recent PCS signals
SELECT ticker, scan_date, total_score, iv_rank, price
FROM pcs_signals
WHERE total_score >= 65
ORDER BY scan_date DESC
LIMIT 20;

-- Trade performance
SELECT ticker, status, credit, debit, 
       (credit - COALESCE(debit, 0)) as pnl
FROM pcs_signal_outcomes
WHERE status = 'closed'
ORDER BY exit_date DESC;
```

## CDS vs PCS Workflow Comparison

| Feature          | CDS Scanner               | PCS Scanner                |
| ---------------- | ------------------------- | -------------------------- |
| Briefing Time    | 9:00 AM ET                | 9:30 AM ET                 |
| Scan Times       | 10:00, 1:00, 3:30 PM     | 10:30, 1:30, 3:45 PM      |
| Weekly Report    | Sunday 6 PM ET            | Sunday 7 PM ET             |
| Default Min Score| 70                        | 65                         |
| Auto-Store       | Requires `--store` flag   | Automatic                  |
| Signal Outcomes  | Yes (7-60 day tracking)   | Not yet implemented        |
| Universe Scan    | Yes (manual, ~2000 tickers)| Not yet implemented       |
| Spread Scanning  | N/A                       | Yes (manual `scan_spreads`)|
| Discord Webhook  | `DISCORD_CDS_WEBHOOK_URL` | `DISCORD_PCS_WEBHOOK_URL`  |

## Future Enhancements

1. **Signal Outcome Tracking** - Port CDS signal accuracy tracking to PCS
2. **Universe Scan** - Full SP500 scan (resource intensive, manual trigger)
3. **Discord Rich Embeds** - Detailed notifications with spread opportunity cards
4. **Adaptive Scheduling** - Skip scans during bear regime (PCS is dangerous in bear markets)
5. **Spread Auto-Scan** - Automatically scan spreads for top-scoring stocks after scan-all

---

**Last Updated**: 2026-02-09
