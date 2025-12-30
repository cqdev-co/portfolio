# Stock Opportunity Scanner

An AI-powered TypeScript CLI tool that identifies high-conviction stock buy 
opportunities using confluence of technical, fundamental, and analyst indicators.

**Version 2.0.0** - AI-first architecture using Ollama (cloud by default).

## Quick Start

```bash
# Install dependencies
bun install

# Set up your API key (required)
export OLLAMA_API_KEY=your-ollama-api-key

# Analyze a single ticker (AI-powered analysis)
bun run analyze NVDA

# Analyze with your position
bun run analyze HOOD --position "111/112 Call Debit Spread"

# Run a test scan (dry run)
bun run scan:test

# Scan large-cap stocks
bun run scan --list sp500 --min-score 50

# Scan specific tickers
bun run scan --tickers NVDA,AAPL,GOOGL --min-score 70

# Find tickers with viable deep ITM spreads
bun run scan-spreads --list mega

# Use relaxed criteria to see "almost viable" setups
bun run scan-spreads --list growth --relaxed
```

**Note**: Environment variables are loaded from the repository root `.env` file.

## Analyze Command

Get an AI-powered narrative-driven analysis that tells a coherent story about 
any stock:

```bash
bun run analyze AMZN

# Skip charts for faster output
bun run src/index.ts analyze AMZN --no-chart

# Skip market regime analysis
bun run analyze AMZN --no-market

# Use local Ollama instead of cloud
bun run analyze AMZN --ai-mode local

# Use a specific model
bun run analyze AMZN --ai-model llama3.1:70b
```

Output tells a story with these sections:

1. **YOUR POSITION** - (if provided) Risk analysis of your options spread
2. **MARKET CONTEXT** - Bull/Bear/Neutral market regime from SPY analysis
3. **52-WEEK CONTEXT** - Price position, MA200, earnings date, sector
4. **RELATIVE STRENGTH** - Performance vs SPY over 20/50/200 days
5. **PRICE ACTION** - High-quality ASCII chart with MAs, support/resistance
6. **THE BULL CASE** - All positive signals grouped together
7. **THE BEAR CASE** - Concerns, risks, and earnings warnings
8. **KEY LEVELS** - Support/resistance for entry/exit planning
9. **SCORE BREAKDOWN** - Visual bars with sector comparisons
10. **AI ANALYSIS** - Unified comprehensive analysis with recommendation
11. **OPTIONS STRATEGIES** - Deep ITM call spread recommendations
12. **ENTRY DECISION** - Action, confidence, position sizing

## Position Analyzer

Track your existing options positions against current price action:

```bash
# Analyze your call debit spread
bun run analyze HOOD --position "111/112 Call Debit Spread"

# Supported formats:
# - "111/112 Call Debit Spread"
# - "115/110 Put Credit Spread"
# - "$120/$115 CDS" (Call Debit Spread)
# - "$100/$95 PCS" (Put Credit Spread)
```

Position analysis shows:
- **Risk Level** - Low/Medium/High/Critical based on cushion to critical strike
- **Probability of Profit** - Rough estimate based on price distance
- **Support vs Your Strike** - Whether support levels are above or below
- **Alert Levels** - Warning and danger price points to monitor
- **Position Advice** - AI-powered HOLD, CLOSE, ROLL, ADD, or TRIM recommendation

## Scoring System

| Category     | Max Points | Key Signals |
|-------------|-----------|-------------|
| Technical   | 50        | RSI, Golden Cross, Support, Volume |
| Fundamental | 30        | PEG, FCF Yield, P/E, EV/EBITDA |
| Analyst     | 20        | Targets, Upgrades, Revisions |
| **Total**   | **100**   | |

## Spread Scanner

Find tickers with viable deep ITM call spreads meeting conservative criteria.

### Two-Stage Workflow (Recommended)

```bash
# Stage 1: Run technical/fundamental scan
bun run scan --list sp500

# Stage 2: Find spreads for ENTER-worthy tickers
bun run scan-spreads --from-scan --relaxed
```

This workflow:
1. First scans for technically sound stocks (score ≥70)
2. Then finds viable spreads only on those pre-qualified tickers

### Direct Scanning

```bash
# Scan mega-cap stocks (default)
bun run scan-spreads

# Scan from database (like regular scan does)
bun run scan-spreads --list db

# Scan different lists: mega, growth, etf, value
bun run scan-spreads --list growth

# Scan specific tickers
bun run scan-spreads --tickers NVDA,AAPL,AMZN

# Use relaxed criteria (60% PoP vs 70%)
bun run scan-spreads --relaxed
```

### Criteria

**Strict Criteria** (default):
- Debit: 55-80% of spread width
- Cushion: ≥5% below current price
- PoP: ≥70% probability of profit
- Return: ≥20% return on risk

**Relaxed Criteria** (`--relaxed`):
- Debit: 50-85% of spread width
- Cushion: ≥3% below current price
- PoP: ≥60% probability of profit
- Return: ≥15% return on risk

## CLI Commands

```bash
# Analyze command (AI-powered)
bun run src/index.ts analyze <ticker> [options]
  --no-chart            # Skip price chart visualization
  --no-market           # Skip market regime analysis
  -p, --position <str>  # Your position (e.g., '111/112 Call Debit Spread')
  --ai-mode <mode>      # Ollama mode: local or cloud (default: cloud)
  --ai-model <model>    # Override default AI model

# Scan command (rule-based, no AI)
bun run src/index.ts scan [options]
  -l, --list <name>        # Predefined list (sp500)
  -t, --tickers <symbols>  # Comma-separated tickers
  -m, --min-score <n>      # Minimum score (default: 70)
  -d, --dry-run            # Don't save to database
  -v, --verbose            # Verbose output

# View score trends
bun run src/index.ts trends [options]
  -d, --days <n>           # Days to look back (default: 7)
  -m, --min-delta <n>      # Min score improvement (default: 10)

# Spread scanner command
bun run src/index.ts scan-spreads [options]
  -l, --list <name>        # Predefined list (mega, growth, etf, value)
  -t, --tickers <symbols>  # Comma-separated tickers
  -r, --relaxed            # Use relaxed criteria
  -v, --verbose            # Verbose output
```

## Configuration

Create a `.env` file in the repository root:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OLLAMA_API_KEY=your-ollama-api-key  # Required for analyze command
```

### AI Modes

- **Cloud (default)**: Uses Ollama cloud API. Requires `OLLAMA_API_KEY`.
- **Local**: Uses local Ollama instance at `localhost:11434`. Requires Ollama
  running locally (`ollama serve`).

## Database Setup

Run the SQL schema in Supabase:

```bash
# Located at: db/stock_opportunities.sql
```

## Documentation

See [docs/stock-scanner/README.md](../docs/stock-scanner/README.md) for:
- Complete signal breakdown
- Architecture overview
- Frontend integration guide
- Historical tracking details

See [docs/stock-scanner/roadmap.md](../docs/stock-scanner/roadmap.md) for:
- Feature history
- Future roadmap

## Tech Stack

- **Runtime**: Bun
- **AI**: Ollama (cloud or local)
- **Data**: yahoo-finance2
- **Indicators**: technicalindicators
- **CLI**: commander + chalk
- **Database**: Supabase
- **Validation**: zod
