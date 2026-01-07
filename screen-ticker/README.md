# Stock Opportunity Scanner

An AI-powered TypeScript CLI tool that identifies high-conviction stock buy
opportunities using confluence of technical, fundamental, and analyst indicators.

**Version 2.3.0** - Strategy-aware scanning with No-Trade Regime integration.

## What's New in v2.3.0

- **Trading Regime Command** - Check GO/CAUTION/NO_TRADE before scanning
- **Strategy Integration** - Tailored for Deep ITM spreads + cash-preserving
- **Regime-Adjusted Criteria** - Stricter spread requirements in CAUTION
- **Transition Warnings** - Predicts regime changes before they happen

### Previous (v2.2.0)

- Expanded Proxy (v4.1) - Fundamentals, EPS trends, earnings history, insider
- Improved Scoring - 31-61 range with full data
- Insider Activity Signal
- EPS Momentum tracking

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment (from repo root .env)
export OLLAMA_API_KEY=your-ollama-api-key      # Required for AI
export YAHOO_PROXY_URL=https://yahoo-proxy.conorquinlan.workers.dev

# 1. Check trading regime FIRST (recommended workflow)
bun run regime

# 2. If GO/CAUTION, analyze or scan
bun run analyze NVDA
bun run scan --list sp500 --min-score 50

# Full workflow example:
bun run regime            # Check if market is favorable
bun run scan --list sp500 # Scan for opportunities
bun run scan-spreads      # Find spreads for top tickers
bun run analyze NVDA      # Deep dive on candidates
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

| Category    | Max Points | Key Signals                                                 |
| ----------- | ---------- | ----------------------------------------------------------- |
| Technical   | 50         | RSI, Golden Cross, Support, Volume, **RSI/MACD Divergence** |
| Fundamental | 30         | PEG, FCF Yield, P/E, EV/EBITDA, **Insider Ownership**       |
| Analyst     | 20         | Targets, Upgrades, Revisions                                |
| **Total**   | **100**    |                                                             |

### New Signals (v2.1.0)

| Signal                       | Category    | Points | Description                      |
| ---------------------------- | ----------- | ------ | -------------------------------- |
| Bullish RSI Divergence       | Technical   | 8      | Price lower low, RSI higher low  |
| Bullish MACD Divergence      | Technical   | 6      | Price lower low, MACD higher low |
| High Insider Ownership       | Fundamental | 3-5    | Insiders own >5% of shares       |
| Strong Institutional Support | Fundamental | 2-3    | Institutions own >70%            |

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
# Regime command — Check market conditions FIRST
bun run src/index.ts regime [options]
  -w, --weekly             # Include transition warnings
  -j, --json               # Output as JSON

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

# Debug command - troubleshoot proxy/cache issues
bun run src/index.ts debug [options]
  -t, --test <ticker>      # Test fetching a specific ticker

# Add --debug to scan to see stats after completion
bun run scan -t AAPL,GOOGL --debug
```

## Trading Regimes

The scanner integrates with the **No-Trade Regime Detection** system from `lib/ai-agent/market`:

| Regime      | Action             | Spread Criteria      | Position Size |
| ----------- | ------------------ | -------------------- | ------------- |
| 🟢 GO       | Normal scan        | 70% PoP, 5% cushion  | 100%          |
| 🟡 CAUTION  | Grade A only (≥80) | 75% PoP, 7% cushion  | 50%           |
| 🔴 NO_TRADE | Skip/warn          | 80% PoP, 10% cushion | 0%            |

**Regime Factors:**

- Chop Index (trend vs consolidation)
- ADX (trend strength)
- VIX (volatility)
- Market Breadth (SPY/RSP/IWM divergence)
- Signal Conflicts (mixed bullish/bearish signals)

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
- **Data**: yahoo-finance2 (via shared proxy from `lib/`)
- **Indicators**: technicalindicators
- **CLI**: commander + chalk
- **Database**: Supabase
- **Validation**: zod

## Shared Infrastructure

This service leverages shared code from `lib/` to avoid duplication:

| Module         | Location                                 | Purpose                                   |
| -------------- | ---------------------------------------- | ----------------------------------------- |
| Yahoo Proxy    | `lib/ai-agent/data/yahoo-proxy.ts`       | Rate-limited data fetching via Cloudflare |
| Market Regime  | `lib/ai-agent/market/`                   | VIX, SPY trend, chop index                |
| Options Chain  | `lib/ai-agent/options/`                  | Options data for spreads                  |
| PFV Calculator | `lib/utils/ts/psychological-fair-value/` | Fair value estimation                     |

### Using the Yahoo Proxy (v4.1)

Set `YAHOO_PROXY_URL` to use the Cloudflare Worker proxy:

```bash
export YAHOO_PROXY_URL=https://yahoo-proxy.conorquinlan.workers.dev
```

Benefits:

- Bypasses Yahoo's IP-based rate limiting
- Combined endpoint: 1 request fetches 8 Yahoo modules (~8x more efficient)
- Built-in caching (1 min for quotes, 1 hr for historical)

v4.1 Returns:
| Field | Data |
|-------|------|
| `quote` | Price, P/E, beta, averages, 52-week range |
| `chart` | 3-month OHLCV data |
| `fundamentals` | FCF, PEG, ROE, margins, debt metrics |
| `epsTrend` | Current EPS + 7/30/60/90 day revisions |
| `earningsHistory` | Last 4 quarters beat/miss |
| `insiderActivity` | Buy/sell counts and net shares |
| `profile` | Sector, industry, country |
| `analysts` | Strong buy/buy/hold/sell distribution |
| `options` | Expiration count, ATM IV, put/call ratios |
