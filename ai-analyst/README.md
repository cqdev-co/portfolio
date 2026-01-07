# AI Analyst

Your first "employee" at your personal hedge fund.

## Overview

The AI Analyst is a Financial Analyst AI that works for you. It's not just a tool -
it's your analyst who finds trades, makes recommendations, and helps you grow your
$1,500 Robinhood account using Deep ITM Call Debit Spreads.

Think of it like having a real employee you can talk to:

- "What should I buy today?"
- "Analyze NVDA for me"
- "Is this a good entry point?"
- "What's the risk here?"

## Quick Start

```bash
# Install dependencies
bun install

# Talk to your analyst
bun run chat

# Or analyze a specific ticker
bun run analyze NVDA
```

## Features

- **Conversational Interface** - Talk to your analyst like a real employee
- **Live Market Data** - Fetches real prices, RSI, and moving averages from Yahoo Finance
- **Trade Recommendations** - Specific strikes, costs, and entry points
- **Strategy Execution** - Follows Deep ITM Call Debit Spread strategy
- **Risk Assessment** - Warns you about bad entries
- **Trade History** - Remembers your past trades and patterns

## CLI Commands

```bash
# Debug mode - see ALL raw context sent to AI (no AI call made)
bun run debug NVDA
bun run debug NVDA --compact   # Shorter output, hide PFV details
bun run debug AAPL --account 3000

# Analyze ticker for entry
bun run analyze NVDA
bun run analyze AAPL --account 3000
bun run analyze GOOGL --ai-mode local

# Trade journal
bun run journal              # All trades
bun run journal NVDA         # Specific ticker
bun run journal --stats      # Performance stats

# Import trades
bun run import ./trades.csv --dry-run

# Log trade manually
bun run log NVDA --type cds --strikes 120/125 --premium 3.80
```

## Tech Stack

- **Runtime**: Bun
- **AI**: Ollama (cloud or local)
- **Data**: yahoo-finance2
- **Indicators**: technicalindicators
- **CLI**: commander + chalk
- **Database**: Supabase
- **Validation**: zod

## Documentation

See [docs/ai-analyst/README.md](../docs/ai-analyst/README.md) for:

- Complete CLI reference
- Architecture overview
- TOON format specification
- Strategy descriptions

## Database Setup

Run the schema in Supabase SQL Editor:

```bash
# Located at: db/analyst_schema.sql
```

Tables:

- `analyst_trades` - Trade journal
- `analyst_observations` - Patterns detected
- `analyst_performance` - Period summaries
