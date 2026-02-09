# Database Documentation

## Overview

The database runs on **Supabase (PostgreSQL)**. All schema definitions live in `db/schema/` as numbered, domain-grouped SQL files that represent the **current state** of the production database.

## Production Reality (verified via `supabase inspect`)

**14 tables** and **2 views** exist in production. Everything else has been dropped or was never deployed.

### Active Tables (with data)

| Table                               | Rows    | Size   | Schema File                  |
| ----------------------------------- | ------- | ------ | ---------------------------- |
| `unusual_options_signals`           | ~1,367  | 21 MB  | `05_unusual_options.sql`     |
| `unusual_options_signal_continuity` | ~12,008 | 3.3 MB | `05_unusual_options.sql`     |
| `stock_opportunities`               | ~1,777  | 5.2 MB | `06_stock_opportunities.sql` |
| `tickers`                           | ~2,306  | 2.1 MB | `01_tickers.sql`             |
| `penny_stock_signals`               | ~2,478  | 1.8 MB | `04_penny_stock_signals.sql` |
| `penny_signal_performance`          | ~4,040  | 952 KB | `04_penny_stock_signals.sql` |
| `penny_tickers`                     | ~2,020  | 792 KB | `01_tickers.sql`             |
| `signals`                           | new     | —      | `03_signals.sql`             |
| `cds_signals`                       | ~116    | 232 KB | `02_cds_signals.sql`         |
| `user_positions`                    | 6       | 112 KB | `07_positions.sql`           |
| `user_spreads`                      | 4       | 80 KB  | `07_positions.sql`           |

### Empty Tables (exist but no data)

| Table                 | Schema File          | Recommendation            |
| --------------------- | -------------------- | ------------------------- |
| `cds_signal_outcomes` | `02_cds_signals.sql` | Keep (CDS trade tracking) |

### Dropped (removed from production)

Previously existed but had zero application code references:

- `signal_performance` — legacy vol squeeze table (1,155 rows, orphaned)
- `daily_performance_snapshots` — legacy, 0 rows, never used
- `stock_score_trends` — materialized view, never queried (engine computes trends manually)
- `signal_leaderboard` — legacy view on `signal_performance`
- `performance_dashboard` — legacy view on `signal_performance`

### Never Deployed (removed from schema files)

These tables existed only in SQL files but were never created in production:

- **PCS Engine** (`pcs_signals`, `pcs_signal_outcomes`) -- 2 tables
- **AI Analyst** (`analyst_trades`, `analyst_observations`, `analyst_performance`, `analyst_positions`, `analyst_recommendations`, `analyst_confidence_calibration`) -- 6 tables
- **Agentic System** (`agent_watchlist`, `agent_alerts`, `agent_scan_history`, `agent_briefings`, `agent_config`, `agent_alert_cooldowns`) -- 6 tables
- **RDS Analysis** (`ticker_info`, `technical_indicators`, `price_history`, `market_data`, `subreddit_metrics`, `reddit_users`, `reddit_posts`, `reddit_comments`, `ticker_mentions`, `sentiment_analyses`, `opportunity_scores`, `risk_assessments`, `ai_insights`, `ticker_opportunities`, `analysis_results`) -- 15 tables
- **Legacy** (`strategy_performance`) -- 1 table
- **Options Perf** (`unusual_options_signal_performance`) -- 1 table

Old SQL files archived to `db/migrations/_archive/` for historical reference.

## Schema Files

Run in order (numbering reflects dependency order):

| File                         | Domain          | Tables                                                         | Description                                                                                 |
| ---------------------------- | --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `00_utilities.sql`           | Shared          | —                                                              | `set_updated_at()` trigger function                                                         |
| `01_tickers.sql`             | Tickers         | `tickers`, `penny_tickers`                                     | Market ticker registries (includes quality scoring columns)                                 |
| `02_cds_signals.sql`         | CDS Engine      | `cds_signals`, `cds_signal_outcomes`                           | Call Debit Spread scanner signals + outcomes                                                |
| `03_signals.sql`             | **Unified**     | `signals`                                                      | **Master signal registry across all strategies (CDS, PCS, Penny)**                          |
| `04_penny_stock_signals.sql` | Penny Scanner   | `penny_stock_signals`, `penny_signal_performance`              | Penny stock signals + performance                                                           |
| `05_unusual_options.sql`     | Options Scanner | `unusual_options_signals`, `unusual_options_signal_continuity` | Unusual options detection + continuity (includes classification + spread detection columns) |
| `06_stock_opportunities.sql` | Opportunities   | `stock_opportunities`                                          | Daily screening results with composite scores                                               |
| `07_positions.sql`           | Positions       | `user_spreads`, `user_positions`                               | User portfolio positions with RLS                                                           |

## Unified Signals Table

The `signals` table (`03_signals.sql`) is a **master registry** that aggregates actionable, ticker-level daily signals from all strategy engines into a single queryable feed.

### Architecture (Star Schema)

Each engine dual-writes: first to its own detail table, then to `signals` with normalized fields.

```
┌─────────────────────────────────────────────────────┐
│                    signals                          │
│  strategy | ticker | signal_date | score | grade    │
│  detail_id -> FK to strategy-specific table         │
├─────────────────────────────────────────────────────┤
│  cds_signals         │  penny_stock_signals         │
│  (spread analysis)   │  (volume/momentum analysis)  │
└──────────────────────┴──────────────────────────────┘
```

### Included Strategies

| Strategy | Detail Table                     | Score Normalization   | Grade                 |
| -------- | -------------------------------- | --------------------- | --------------------- |
| `cds`    | `cds_signals`                    | Native 0-100          | A/B/C/D (from score)  |
| `pcs`    | `pcs_signals` (not yet deployed) | Native 0-100          | A/B/C/D (from score)  |
| `penny`  | `penny_stock_signals`            | `overall_score * 100` | S/A/B/C/D (from rank) |

**Unusual Options is excluded** — noisy contract-level flow observations, not actionable trade signals.

### Key Queries

```sql
-- Today's signals across all strategies
SELECT * FROM signals WHERE signal_date = CURRENT_DATE ORDER BY score_normalized DESC;

-- Top signals from last 7 days (A-grade or better)
SELECT * FROM signals WHERE signal_date >= CURRENT_DATE - INTERVAL '7 days' AND grade IN ('S', 'A') ORDER BY signal_date DESC, score_normalized DESC;

-- Cross-strategy: tickers flagged by multiple strategies
SELECT ticker, signal_date, array_agg(strategy) AS strategies
FROM signals
WHERE signal_date = CURRENT_DATE
GROUP BY ticker, signal_date
HAVING COUNT(DISTINCT strategy) > 1;
```

### Dual-Write Flow

1. Engine writes to its detail table (e.g. `cds_signals`) → gets back `detail_id`
2. Engine upserts into `signals` with normalized score, grade, headline, and metadata
3. Conflict key: `(strategy, ticker, signal_date)` — one signal per strategy per ticker per day

### Migration

Run `db/migrations/001_create_signals_table.sql` to create the table and backfill from existing data.

## Unused Indexes (candidates for cleanup)

From `supabase inspect db index-stats`, these indexes have **0 scans**:

| Index                             | Size   | Table                               |
| --------------------------------- | ------ | ----------------------------------- |
| `idx_stock_opportunities_signals` | 2 MB   | `stock_opportunities`               |
| `idx_signals_group_id`            | 1.1 MB | `unusual_options_signals`           |
| `idx_continuity_detected_at`      | 488 KB | `unusual_options_signal_continuity` |
| `idx_tickers_quality_score`       | 208 KB | `tickers`                           |
| `idx_continuity_signal_id`        | 160 KB | `unusual_options_signal_continuity` |
| `idx_continuity_group_id`         | 160 KB | `unusual_options_signal_continuity` |
| `idx_penny_signals_overall_score` | 112 KB | `penny_stock_signals`               |
| `idx_penny_signals_volume_score`  | 96 KB  | `penny_stock_signals`               |
| `idx_tickers_sector`              | 80 KB  | `tickers`                           |
| `idx_tickers_country`             | 80 KB  | `tickers`                           |

**Total wasted index space: ~4.7 MB**

To drop unused indexes:

```sql
DROP INDEX IF EXISTS idx_stock_opportunities_signals;
DROP INDEX IF EXISTS idx_signals_group_id;
DROP INDEX IF EXISTS idx_continuity_detected_at;
DROP INDEX IF EXISTS idx_continuity_signal_id;
DROP INDEX IF EXISTS idx_continuity_group_id;
DROP INDEX IF EXISTS idx_tickers_quality_score;
DROP INDEX IF EXISTS idx_penny_signals_overall_score;
DROP INDEX IF EXISTS idx_penny_signals_volume_score;
DROP INDEX IF EXISTS idx_tickers_sector;
DROP INDEX IF EXISTS idx_tickers_country;
```

## Conventions

### Shared Trigger

All tables with `updated_at` use `set_updated_at()` from `00_utilities.sql`.

### RLS Policies

- **Service/public tables** — public read, service role write
- **User-scoped tables** (positions, spreads) — RLS with `auth.uid()`

## Automated Data Management

### Weekly Ticker Updates

GitHub Actions (`/.github/workflows/fetch-tickers.yml`):

- Runs weekly on Sundays at 6:00 AM UTC
- Updates `tickers` and `penny_tickers` tables

### Signal Scanning

- **CDS Scanner**: Every 30 min during market hours
- **Unusual Options Scanner**: Hourly during market hours
- **Penny Stock Scanner**: Daily pre-market

## Quick Reference

```bash
# View schema files
ls db/schema/

# Inspect live DB (requires supabase login + link)
supabase inspect db table-sizes --linked
supabase inspect db index-sizes --linked
```
