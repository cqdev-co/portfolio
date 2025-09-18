# Database Documentation

## Automated Data Management

### Weekly Ticker Updates
The portfolio includes an automated GitHub Actions workflow (`/.github/workflows/fetch-tickers.yml`) that maintains the database ticker list:

- **Schedule**: Runs weekly on Sundays at 6:00 AM UTC
- **Purpose**: Updates the global market tickers database with new listings and removes delisted symbols
- **Coverage**: Fetches tickers from multiple exchanges and markets
- **Manual Trigger**: Can be run manually via GitHub Actions with dry-run and verbose options

### Real-Time Signal Scanning
The volatility squeeze scanner runs every 30 minutes during market hours to provide real-time trading signals:

- **Schedule**: Every 30 minutes during US market hours (9:30 AM - 4:00 PM EST, Monday-Friday)
- **Purpose**: Scans all database symbols for volatility squeeze opportunities
- **Storage**: Results stored in Supabase for immediate access via the frontend interface

## Database Files

- `tickers.sql`: Database schema for ticker symbols and metadata
- `volatility_squeeze.sql`: Database schema for volatility squeeze signals and analysis results