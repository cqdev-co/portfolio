# Volatility Squeeze Scanner - Utility Scripts

This directory contains utility scripts for maintaining and managing the volatility squeeze scanner database.

## Scripts Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `clean_signals.py` | Clean signals by score threshold | Score-based filtering, comprehensive analysis, safe deletion |
| `clean_table.py` | Clean duplicate entries | Duplicate detection, ticker deduplication, date-based cleanup |
| `cleanup_meaningless_trades.py` | Clean 0.0% return trades | Performance dashboard cleanup, GitHub Actions integration |
| `fix_duplicate_signals.py` | Fix signal duplicates | Signal continuity repair, cross-date duplicate resolution |

## clean_signals.py

A comprehensive script for cleaning volatility squeeze signals based on minimum score thresholds. This tool helps maintain database quality by removing low-scoring signals while preserving valuable data.

### Features

- **Score-Based Filtering**: Remove signals below specified threshold (0.0-1.0)
- **Comprehensive Analysis**: Score distribution, recommendation breakdown, opportunity rank analysis
- **Safety Features**: Automatic backup, confirmation prompts, dry-run mode
- **Flexible Filtering**: Date-specific or time-range based cleanup
- **Rich Reporting**: Color-coded output with detailed statistics

### Usage

```bash
# Activate the virtual environment first
source ../venv/bin/activate

# Show help
python clean_signals.py --help

# BASIC USAGE
# Preview cleanup for signals with score < 0.80
python clean_signals.py --min-score 0.80 --dry-run

# Actually clean signals with score < 0.80
python clean_signals.py --min-score 0.80

# TARGETED CLEANUP
# Clean signals for specific date
python clean_signals.py --min-score 0.90 --date 2024-01-15

# Clean signals from last 7 days
python clean_signals.py --min-score 0.75 --days-back 7

# BACKUP OPERATIONS
# Create backup only (no cleanup)
python clean_signals.py --min-score 0.60 --backup-only

# Custom backup path
python clean_signals.py --min-score 0.70 --backup-path /path/to/backup.json
```

### Safety Considerations

1. **Always dry-run first**: Use `--dry-run` to preview changes
2. **Start conservative**: Begin with lower thresholds (e.g., 0.3) and work up
3. **Check actionable signals**: Pay attention to warnings about actionable signals
4. **Verify backups**: Ensure backup files are created and accessible

### Output Example

```
🧹 Volatility Squeeze Scanner - Signal Score Cleaner

✅ Connected to Supabase successfully
✅ Backup created: backup_volatility_signals_20240920_143022.json (5000 records)

📊 Signal Score Analysis Results
Date Range: All dates
Minimum Score Threshold: 0.8
Total Signals in Database: 5000
Signals Below Threshold: 1200
Percentage to Clean: 24.0%

📈 Score Range Distribution:
┏━━━━━━━━━━━━━┳━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Score Range ┃ Count ┃ Action               ┃
┡━━━━━━━━━━━━━╇━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━┩
│ 0.0-0.2     │   300 │ Will remove 300      │
│ 0.2-0.4     │   400 │ Will remove 400      │
│ 0.4-0.6     │   350 │ Will remove 350      │
│ 0.6-0.8     │   150 │ Will remove 150      │
└─────────────┴───────┴──────────────────────┘

⚠️  WARNING: 45 actionable signals will be removed!

Proceed with removing 1200 signals below score 0.8? [y/N]: y

✅ Successfully removed 1200 signals below score 0.8

🎉 Cleanup completed successfully! Removed 1200 signals below score 0.8.
```

## clean_table.py

A comprehensive script for cleaning duplicate entries from the `volatility_squeeze_signals` table.

### Features

- **Safe Operations**: Always creates backups before making changes
- **Dry Run Mode**: Preview what would be cleaned without making changes
- **Flexible Filtering**: Clean by specific date, date range, or all records
- **Rich Output**: Beautiful console output with progress indicators
- **Batch Processing**: Handles large datasets efficiently
- **Error Handling**: Robust error handling with detailed logging

### Usage

```bash
# Activate the virtual environment first
source ../venv/bin/activate

# Show help
python clean_table.py --help

# TICKER DEDUPLICATION (recommended for frontend dashboard)
# Analyze duplicate tickers
python clean_table.py --analyze-tickers

# Preview ticker cleanup (safe)
python clean_table.py --clean-tickers --dry-run

# Clean duplicate tickers (keeps most recent record per ticker)
python clean_table.py --clean-tickers

# DATE-BASED DUPLICATE CLEANING
# Dry run - see what would be cleaned (safe)
python clean_table.py --dry-run

# Clean duplicates for a specific date
python clean_table.py --date 2024-01-15

# Clean duplicates for the last 7 days
python clean_table.py --days-back 7

# Clean all duplicates (creates backup first)
python clean_table.py --all

# BACKUP AND MAINTENANCE
# Create backup only (no cleaning)
python clean_table.py --backup-only

# Test database constraints
python clean_table.py --test-constraints

# Clean with custom backup path
python clean_table.py --all --backup-path /path/to/backup.json
```

### Safety Features

1. **Automatic Backups**: Creates JSON backups before any cleanup operation
2. **Confirmation Prompts**: Asks for confirmation before deleting records
3. **Dry Run Mode**: Always test with `--dry-run` first
4. **Detailed Logging**: Shows exactly what will be or was cleaned
5. **Batch Processing**: Handles large datasets without timeouts

### Output Example

```
🧹 Volatility Squeeze Scanner - Table Cleaner

✅ Connected to Supabase successfully
✅ Backup created: backup_volatility_signals_20240115_143022.json (1500 records)

📊 Duplicate Analysis Results
Date Range: Range: 2024-01-08 to 2024-01-15
Total Signals: 1500
Unique Combinations: 1485
Duplicate Records: 15

🔍 Duplicate Groups Found:
┏━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Symbol ┃ Scan Date  ┃ Total Count ┃ Duplicates ┃ Action               ┃
┡━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━┩
│ AAPL   │ 2024-01-15 │           2 │          1 │ Will remove 1        │
│ GOOGL  │ 2024-01-14 │           3 │          2 │ Will remove 2        │
└────────┴────────────┴─────────────┴────────────┴──────────────────────┘

Proceed with removing 15 duplicate records? [y/N]: y

✅ Successfully removed 15 duplicate records

🎉 Cleanup completed successfully! Removed 15 duplicates.
```

### Environment Requirements

The script requires the same environment as the main scanner:

- Python 3.8+
- Virtual environment with scanner dependencies
- Supabase credentials in environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### How It Works

1. **Analysis Phase**: Scans the database for duplicate records (same symbol + scan_date)
2. **Backup Phase**: Creates a JSON backup of all records (if not dry-run)
3. **Cleanup Phase**: Removes older duplicate records, keeping the most recent
4. **Reporting Phase**: Shows detailed results of the cleanup operation

### Best Practices

1. **Always test first**: Use `--dry-run` to see what would be cleaned
2. **Regular maintenance**: Run weekly with `--days-back 7`
3. **Keep backups**: Don't delete backup files immediately
4. **Monitor logs**: Check for any errors during cleanup
5. **Verify results**: Run analysis again after cleanup to confirm

### Troubleshooting

**Connection Issues**:
- Ensure environment variables are set correctly
- Check network connectivity to Supabase
- Verify credentials have proper permissions

**No Duplicates Found**:
- This is normal if the upsert logic is working correctly
- The scanner should prevent duplicates automatically

**Backup Failures**:
- Check disk space for backup files
- Ensure write permissions in the script directory
- Large datasets may take time to backup

### Integration with Scanner

This script complements the scanner's built-in duplicate prevention:

- **Scanner**: Prevents duplicates during data insertion (upsert logic)
- **Cleanup Script**: Removes any duplicates that may have occurred due to race conditions or system issues

The combination ensures data integrity and optimal database performance.

## cleanup_meaningless_trades.py

A specialized script for cleaning meaningless trades (0.0% return) from the performance tracking system. This script is designed to keep the performance dashboard clean and meaningful by removing trades that provide no actionable insights.

### Features

- **Zero-Return Filtering**: Removes trades with exactly 0.0% return regardless of hold time
- **Dashboard Cleanup**: Keeps performance metrics clean and meaningful
- **GitHub Actions Integration**: Designed to run automatically in CI/CD pipeline
- **Dry Run Support**: Preview what would be cleaned without making changes
- **Safe Operations**: Detailed logging and error handling
- **Comprehensive Reporting**: Shows before/after statistics

### Usage

```bash
# Activate the virtual environment first
cd volatility-squeeze-scanner
source ../venv/bin/activate

# Show help
python scripts/cleanup_meaningless_trades.py --help

# BASIC USAGE
# Preview cleanup (safe)
python scripts/cleanup_meaningless_trades.py --dry-run

# Actually clean meaningless trades
python scripts/cleanup_meaningless_trades.py

# POETRY USAGE (recommended)
# Preview cleanup
poetry run python scripts/cleanup_meaningless_trades.py --dry-run

# Run cleanup
poetry run python scripts/cleanup_meaningless_trades.py
```

### GitHub Actions Integration

This script is automatically integrated into the volatility squeeze scanner workflow (`vss.yml`) and runs after each market scan to keep the performance dashboard clean:

```yaml
- name: Cleanup Meaningless Trades
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY }}
  working-directory: volatility-squeeze-scanner
  run: |
    echo "🧹 Running performance tracking cleanup..."
    poetry run python scripts/cleanup_meaningless_trades.py
    echo "✅ Cleanup complete"
```

### What Gets Cleaned

The script removes performance tracking records where:
- **Return percentage is exactly 0.0%** (within 0.01% tolerance)
- **Any hold time** (0 days, 1 day, or longer)
- **Status is CLOSED** (doesn't affect active trades)

### Output Example

```
🧹 PERFORMANCE TRACKING CLEANUP
==================================================
Mode: LIVE CLEANUP

📊 ANALYSIS RESULTS:
  Total closed trades: 25
  Meaningful trades: 20
  Meaningless trades (0.0% return): 5

❌ MEANINGLESS TRADES TO REMOVE:
  • PC: $8.32 → $8.32 (+0.00%) in 0d [2025-09-24]
  • EGG: $6.26 → $6.26 (+0.00%) in 0d [2025-09-24]
  • ADCT: $3.52 → $3.52 (+0.00%) in 1d [2025-09-24]
  • SRI: $8.06 → $8.06 (+0.00%) in 0d [2025-09-24]
  • MSA: $169.97 → $169.97 (+0.00%) in 0d [2025-09-24]

🗑️  REMOVING MEANINGLESS TRADES...
    ✅ Deleted PC
    ✅ Deleted EGG
    ✅ Deleted ADCT
    ✅ Deleted SRI
    ✅ Deleted MSA

✅ CLEANUP COMPLETE:
  Successfully deleted: 5/5 trades
  Remaining meaningful trades: 20

📈 SAMPLE MEANINGFUL TRADES:
  • BBGI: +2.48% in 0d
  • ABVC: -1.24% in 0d
  • NMG: +2.44% in 0d
  • TE: +0.22% in 0d
  • CLCO: +0.54% in 0d

✅ CLEANUP COMPLETE: 5 meaningless trades removed
```

### Why This Matters

**Before Cleanup:**
- Performance dashboard cluttered with 0.0% trades
- Misleading win rates and average returns
- Difficult to identify meaningful patterns
- Poor user experience

**After Cleanup:**
- Clean, actionable performance data
- Accurate win rates and return metrics
- Clear identification of profitable strategies
- Professional presentation of results

### Integration with Performance Tracking

This script works in conjunction with the enhanced performance tracking service:

1. **Prevention**: Updated `PerformanceTrackingService` prevents most 0.0% trades from being created
2. **Cleanup**: This script removes any that slip through or were created before the prevention logic
3. **Automation**: GitHub Actions ensures cleanup happens after every scan
4. **Maintenance**: Can be run manually for historical cleanup

### Best Practices

1. **Run after major scans**: Especially useful after full market scans
2. **Monitor output**: Check logs to understand what's being cleaned
3. **Test first**: Use `--dry-run` when running manually
4. **Regular automation**: Let GitHub Actions handle routine cleanup
5. **Historical cleanup**: Run manually on historical data as needed

### Environment Requirements

Same as other scripts:
- Python 3.8+
- Poetry environment with scanner dependencies
- Supabase credentials in environment variables

This script ensures your **Live Performance Tracking** dashboard shows only meaningful, actionable trade data! 🎯
