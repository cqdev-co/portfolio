# Stock Opportunity Scanner

An AI-powered TypeScript CLI tool that identifies high-conviction stock buy 
opportunities using confluence of technical, fundamental, and analyst indicators.

**Version 2.0.0** - AI-first architecture using Ollama (cloud by default).

## Overview

The scanner analyzes stocks across three categories:

| Category     | Max Score | Key Signals |
|-------------|-----------|-------------|
| Technical   | 50 pts    | RSI, Golden Cross, Support Levels, Volume |
| Fundamental | 30 pts    | PEG, FCF Yield, Forward P/E, EV/EBITDA |
| Analyst     | 20 pts    | Price Targets, Upgrades, Earnings Revisions |

Stocks are ranked by their total score (0-100), with higher scores indicating 
stronger buy signals.

## Quick Start

```bash
# Navigate to the scanner directory
cd screen-ticker

# Install dependencies
bun install

# Run a test scan (dry run, no DB write)
bun run scan:test

# Scan all stocks from database (2000+ tickers)
bun run scan --list all --min-score 50 --dry-run

# Scan large-cap stocks (S&P 500 approximation)
bun run scan --list sp500 --min-score 50

# Scan custom tickers
bun run scan --tickers NVDA,AAPL,GOOGL --min-score 70
```

**Note**: The scanner loads environment variables from the repository root `.env` 
file (supports `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` and 
`SUPABASE_SERVICE_KEY`/`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`).

## CLI Commands

### Analyze Command (AI-Powered Single Ticker Deep Dive)

Get an AI-powered narrative-driven analysis that tells a coherent story about 
a stock. **AI is enabled by default** and requires Ollama (cloud mode by default).

```bash
# Basic analysis (uses cloud AI by default)
bun run analyze NVDA
# or
bun run src/index.ts analyze <ticker>

# Skip charts for faster output
bun run src/index.ts analyze NVDA --no-chart

# Use local Ollama instead of cloud
bun run analyze NVDA --ai-mode local

# Custom model
bun run analyze NVDA --ai-model llama3.1:70b

# Position management mode
bun run analyze NVDA --position "165/170 Call Debit Spread"
```

| Option | Description |
|--------|-------------|
| `--ai-mode <mode>` | Ollama mode: `local` or `cloud` (default: cloud) |
| `--ai-model <model>` | Optional: Override default model |
| `-p, --position <spread>` | Your position (e.g., '165/170 Call Debit Spread') |
| `--no-chart` | Skip price chart visualization |
| `--no-market` | Skip market regime analysis |

**AI Modes:**
- **cloud (default)**: Uses Ollama Cloud API. Requires `OLLAMA_API_KEY` in `.env`
- **local**: Uses Ollama running on localhost:11434

**Position Management Mode:**
When you provide a position with `--position`, AI switches to position management 
mode:
- Analyzes your specific spread (cushion, probability of profit, risk level)
- Provides HOLD/CLOSE/ROLL/ADD/TRIM recommendation
- Sets alert levels (warning and danger prices)
- Entry Decision shows unified action (HOLD POSITION, ROLL POSITION, etc.)

Output sections (in narrative order):

1. **YOUR POSITION** - Risk analysis if `--position` provided
2. **MARKET CONTEXT** - SPY-based market regime (bull/bear/neutral)
3. **52-WEEK CONTEXT** - Range, MA200, market cap, earnings date
4. **QUARTERLY PERFORMANCE** - Last 4Q revenue/earnings trends, beat/miss history
5. **RELATIVE STRENGTH** - Performance vs SPY (20/50/200 day)
6. **MOMENTUM** - EPS revisions, insider activity, price momentum
7. **PRICE ACTION** - 70-day ASCII chart with:
   - Price candles (green=up, red=down)
   - MA20/MA50 overlays
   - Support/resistance levels
   - Trend direction and strength
   - RSI indicator with status
8. **THE BULL CASE** - All positive signals grouped together
9. **THE BEAR CASE** - Concerns, risks, and warnings
10. **KEY LEVELS** - Support/resistance for entry/exit planning
11. **SCORE BREAKDOWN** - Visual bars for Technical/Fundamental/Analyst
12. **AI ANALYSIS** - Unified comprehensive analysis:
    - Recommendation with confidence (BUY/WAIT/AVOID)
    - Full analysis synthesizing all data with conflict resolution
    - Entry strategy with specific price levels
    - Risk management guidance with stop levels
    - **Position Management** (with `--position`):
      - Action: HOLD/CLOSE/ROLL/ADD/TRIM
      - Position-specific reasoning
      - Alert levels (warning and danger prices)
13. **OPTIONS STRATEGIES** - Deep ITM call spreads if score qualifies
14. **ENTRY DECISION** - Final trade decision:
    - Unified action integrating AI + technical decision engine
    - Conflict detection when AI and technicals disagree
    - Position mode: HOLD POSITION / ROLL POSITION / CLOSE POSITION
    - New entry mode: ENTER NOW / WAIT / ENTER WITH CAUTION / AVOID
    - Confidence score with breakdown
    - Spread quality score with breakdown
    - Position sizing recommendation
    - Entry guidance and risk management

### Scan Command (Batch Scanning)

Scans multiple stocks for buy opportunities with decision status.

```bash
bun run src/index.ts scan [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-l, --list <name>` | `sp500` (large cap) or `all` (all 2000+ stocks) | sp500 |
| `-t, --tickers <symbols>` | Comma-separated tickers | - |
| `-m, --min-score <n>` | Minimum score threshold | 70 |
| `-d, --dry-run` | Don't save to database | false |
| `-v, --verbose` | Verbose output | false |
| **`-a, --actionable`** | **Only show ENTER or WAIT decisions (v1.5.1)** | false |

**Ticker Sources:**
- `--list sp500`: Large-cap stocks (market cap > $10B) from Supabase `tickers` table
- `--list all`: All stocks from Supabase `tickers` table (2000+ with pagination)

**Decision Column (v1.5.1):**
Each scan result now shows a quick decision status:
- ✅ **ENTER** - Passes key checks (above MA200, RSI OK, analyst positive, score 75+)
- ⏳ **WAIT** - Some checks pass but not ready for entry
- ❌ **PASS** - Does not meet criteria

```bash
# Show all results with decisions
bun run scan --min-score 70

# Show only actionable opportunities
bun run scan --min-score 70 --actionable
```

### Trends Command

Shows stocks with improving scores over time.

```bash
bun run src/index.ts trends [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --days <n>` | Days to look back | 7 |
| `-m, --min-delta <n>` | Minimum score improvement | 10 |

## Signal Breakdown

### Technical Signals (Max 50 pts)

| Signal | Points | Condition |
|--------|--------|-----------|
| RSI Oversold | 10 | RSI(14) < 40 |
| Golden Cross | 15 | 50 SMA > 200 SMA crossover |
| Near Support | 10 | Price within 3% of support level |
| Volume Surge | 10 | Volume > 1.5x 10-day avg |
| OBV Uptrend | 5 | On-Balance Volume rising |
| MACD Bullish | 5 | MACD crossed above signal |

### Fundamental Signals (Max 30 pts)

| Signal | Points | Condition |
|--------|--------|-----------|
| PEG < 1 | 10 | PEG Ratio under 1.0 |
| High FCF Yield | 8 | Free Cash Flow Yield > 8% |
| Forward P/E Low | 7 | Forward P/E < Trailing P/E by 15%+ |
| Low EV/EBITDA | 5 | EV/EBITDA < 12 |
| Strong Earnings | 5 | Earnings growth > 15% |
| Revenue Growing | 3 | Revenue growth > 10% |
| Deep Value | 5 | Price/Book < 1.0 |

### Analyst Signals (Max 20 pts)

| Signal | Points | Condition |
|--------|--------|-----------|
| High Upside | 8 | Target price 25%+ above current |
| Recent Upgrades | 7 | 2+ net upgrades in 90 days |
| Positive Revisions | 5 | Positive EPS growth estimates |
| Strong Buy Consensus | 5 | Buy ratings > 3x Sell ratings |
| High Coverage | 2 | 20+ analysts covering |

## Entry Decision Engine (v1.5.0)

The Decision Engine transforms analysis into actionable trade decisions.

### Decision Flow

```
Stock Analysis → Confidence Score → Position Sizing → Entry Decision
      ↓                ↓                  ↓              ↓
   Signals         0-100 pts         % of max      ENTER/WAIT/PASS
```

### Confidence Score (0-100)

| Factor | Weight | Source |
|--------|--------|--------|
| Stock Score | 30% | Total score from scanner |
| Checklist Pass Rate | 25% | 7-point entry checklist |
| Momentum Signals | 20% | EPS, price, insider trends |
| Relative Strength | 15% | Performance vs SPY |
| Market Regime | 10% | Bull/bear/neutral |

### Spread Quality Score (0-100)

| Factor | Weight | Description |
|--------|--------|-------------|
| Intrinsic Value | 20 | % of cost that is intrinsic (100%+ = discount) |
| **Cushion** | **20** | **% below current price to breakeven (safety priority)** |
| Delta | 10 | Alignment to 0.75-0.85 ideal range |
| DTE | 10 | Days to expiry (21-45 ideal) |
| Spread Width | 5 | Exactly $5 width preferred |
| Return on Risk | 10 | Potential return % (lower weight, safety > return) |
| Support Protection | 15 | Support level below breakeven |
| Earnings Risk | 10 | No earnings during spread period |

### Position Sizing Matrix

| Confidence | Bull Market | Neutral | Bear |
|------------|-------------|---------|------|
| 85+ (Very High) | Full (100%) | 75% | 50% |
| 70-84 (High) | 75% | 50% | 25% |
| 55-69 (Moderate) | 50% | 25% | Skip |
| 40-54 (Low) | 25% | Skip | Skip |
| <40 (Insufficient) | Skip | Skip | Skip |

### Entry Timing Logic

**Enter Now** when:
- RSI in ideal zone (35-50) or oversold (<35)
- Price at or below MA20
- Recent pullback (RSI <45 and near support)
- Support level within 3%

**Wait for Pullback** when:
- RSI extended (55-70) or overbought (>70)
- Price 5%+ above nearest support
- Price significantly above MA20

## Database Schema

The scanner stores results in Supabase. Run the schema from:

```
db/stock_opportunities.sql
```

Key tables:
- `stock_opportunities` - Daily scan results
- `stock_score_trends` - Materialized view for 7-day momentum

## Configuration

Create a `.env` file in the repository root:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Required for analyze command (AI-first architecture)
OLLAMA_API_KEY=your-ollama-api-key
```

**AI Configuration:**
- **Cloud mode (default)**: Requires `OLLAMA_API_KEY` environment variable
- **Local mode**: Requires Ollama running on `localhost:11434` (`ollama serve`)
- Default models: `deepseek-v3.1:671b` (cloud), `llama3.2` (local)

**Note:** The `analyze` command requires AI to be available. If using cloud mode 
(default), ensure `OLLAMA_API_KEY` is set. If using local mode, ensure Ollama 
is running.

## Architecture

```
screen-ticker/
├── src/
│   ├── config/thresholds.ts    # Scoring thresholds
│   ├── providers/yahoo.ts      # Yahoo Finance API
│   ├── services/
│   │   └── ollama.ts           # Ollama AI client (v1.6.0)
│   ├── signals/
│   │   ├── technical.ts        # RSI, MA, MACD
│   │   ├── fundamental.ts      # P/E, PEG, FCF
│   │   └── analyst.ts          # Targets, upgrades
│   ├── engine/
│   │   ├── scorer.ts           # Composite scoring
│   │   ├── screener.ts         # Orchestration
│   │   └── decision.ts         # Entry decision engine (v1.5.0)
│   ├── types/
│   │   ├── index.ts            # Core types
│   │   └── decision.ts         # Decision engine types (v1.5.0)
│   ├── utils/
│   │   ├── momentum.ts         # Momentum analysis
│   │   ├── market-regime.ts    # Bull/bear/neutral detection
│   │   ├── ai-narrative.ts     # AI narrative generation (v1.6.0)
│   │   └── ...                 # Other utilities
│   ├── storage/supabase.ts     # Database client
│   └── index.ts                # CLI entry point
└── cache/                      # API response cache
```

## Historical Tracking

The scanner tracks score changes over time to identify "improving" stocks:

- **Score improved 10+ pts in 7 days**: Momentum building
- **Score improved 20+ pts in 7 days**: Strong momentum
- **New entry to 80+ club**: Emerging opportunity

Use the `trends` command to view improving stocks:

```bash
bun run src/index.ts trends --days 7 --min-delta 10
```

## Rate Limiting & Caching

The scanner includes robust rate limiting to handle Yahoo Finance API limits:

**Rate Limiting:**
- Base delay: 500ms between requests
- Burst control: Pauses after every 5 requests
- Exponential backoff: Retries with increasing delays (1s, 2s, 4s)
- Cooldown: 5-second pause after hitting rate limits
- Sequential fetching: Requests are made one at a time per ticker

**Caching:**
- Cache TTL: 5 minutes
- Cache location: `./cache/`
- Clear cache: Delete files in `./cache/`

**Note**: Scanning 2000+ tickers takes ~30-45 minutes due to rate limiting.
For faster results, use `--list sp500` or scan specific tickers.

## Example Output

### Scan Results Table

```
  Top Buy Opportunities - 11/28/2025
┌──────┬────────┬─────────┬─────────┬───────┬─────────────────────────────────────────────┐
│ Rank │ Ticker │ Price   │ Upside  │ Score │ Key Signals                                 │
├──────┼────────┼─────────┼─────────┼───────┼─────────────────────────────────────────────┤
│ 1    │ NVDA   │ $128.40 │ +42%    │ 94    │ Golden Cross, PEG < 1, High Upside          │
│ 2    │ PYPL   │ $72.10  │ +58%    │ 91    │ Near Support, High FCF Yield, Recent Ups    │
│ 3    │ INTC   │ $22.80  │ +71%    │ 88    │ Deep Value, RSI Oversold, Volume Surge      │
└──────┴────────┴─────────┴─────────┴───────┴─────────────────────────────────────────────┘
```

### Entry Decision Output (v1.5.0)

```
  🎯 ENTRY DECISION
  ────────────────────────────────────────────────────────────────────

  ✅ ACTION: ENTER NOW

  Confidence: ███████████████░░░░░ 78/100 (HIGH)
    ├─ Stock: 24/30 │ Checklist: 21/25 │ Momentum: 16/20
    └─ Rel Strength: 10/15 │ Market: 7/10

  Spread: Buy $110C / Sell $115C (Jan 17, 32 DTE)
  Spread Score: 82/100 ★★ (good)
    ├─ Intrinsic: 18/20 │ Cushion: 12/15 │ Delta: 10/10
    ├─ DTE: 10/10 │ Return: 12/15 │ Support: 12/15
    └─ Earnings: 8/10

  Position Size: MODERATE (75%)
    • Confidence: high (78/100)
    • Market: bull regime
    • 75% of max position

  Suggested: 2 contract(s) ($280 total risk)

  Entry Guidance:
    ✓ Enter today: Buy $110C / Sell $115C
    ✓ Cost: $140 per contract
    ✓ Suggested: 2 contract(s) ($280 total)

  Risk Management:
    • Max loss: $280
    • Breakeven: $111.40
    • Exit if price breaks below $108 support
    • Take profit at 50-60% of max gain
```

## Frontend Integration

The frontend reads from the `stock_opportunities` table. 
Add an API route to query opportunities:

```typescript
// Example: /api/opportunities/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  
  const { data } = await supabase
    .from('stock_opportunities')
    .select('*')
    .eq('scan_date', new Date().toISOString().split('T')[0])
    .order('total_score', { ascending: false })
    .limit(20);
    
  return Response.json(data);
}
```

## Current Version: v2.0.0

See [roadmap.md](./roadmap.md) for full version history.

### Recent Features

**v2.0.0 — AI-First Architecture** ✅
- **AI is now the core of the analyze command** — no more `--ai` flag needed
- Cloud mode is the default (`--ai-mode cloud`)
- AI validation at startup with clear error messages if not configured
- Removed non-AI fallback sections (THE STORY, VERDICT)
- Simplified CLI: just `bun run analyze NVDA` for full AI analysis

```bash
# Simple AI-powered analysis (cloud mode default)
bun run analyze NVDA

# Use local Ollama instead
bun run analyze NVDA --ai-mode local

# Position management
bun run analyze NVDA --position "165/170 Call Debit Spread"
```

**v1.6.1 — Enhanced AI Analysis & Position Management** ✅
- **Position-Aware AI**: When `--position` is provided, AI analyzes your specific 
  spread
  - Provides HOLD/CLOSE/ROLL/ADD/TRIM recommendation
  - Factors in cushion, DTE, support levels, and catalysts
  - Sets specific alert levels (warning and danger prices)
- **Unified Entry Decision**: Resolves conflicts between AI and technical decision 
  engine
  - Shows "ENTER WITH CAUTION" when AI says WAIT but technicals say ENTER
  - Position mode shows: HOLD POSITION / ROLL POSITION / CLOSE POSITION
- **Enhanced AI Context**: AI now receives:
  - Conflict identification (growth vs valuation, smart money divergence, etc.)
  - Score calibration (what 74/100 means in context)
  - Catalyst awareness (earnings dates, events)
  - Chain-of-thought prompting for better reasoning
- **AI Conflict Resolution**: When bull/bear signals conflict, AI explicitly 
  addresses which signals it weights more heavily and why

**v1.6.0 — AI-Enhanced Analysis with Ollama** ✅
- AI-powered comprehensive analysis using Ollama
- Supports both local (M3 Max optimized) and cloud modes
- Unified "AI ANALYSIS" section that synthesizes all data:
  - Clear recommendation (BUY/WAIT/AVOID) with confidence level
  - Comprehensive analysis covering technicals, fundamentals, and positioning
  - Specific entry strategy with price levels
  - Risk management guidance with stop levels
- Model override support for custom configurations
- Default model: `deepseek-v3.1:671b` (cloud)

**v1.5.1 — Scan with Decisions** ✅
- Decision column in scan results (✅ ENTER / ⏳ WAIT / ❌ PASS)
- `--actionable` flag to filter only ENTER and WAIT stocks
- Decision summary showing counts at end of scan
- Reason column explaining each decision

**v1.5.0 — Spread Entry Decision Engine** ✅
- Complete decision engine that answers: Enter Now / Wait / Pass
- Unified confidence score (0-100) combining all signals
- Spread quality score (0-100) evaluating spread characteristics
- Position sizing based on confidence level + market regime
- Entry timing logic (RSI zone, MA20 position, support distance)
- Actionable guidance with entry, risk management, and warnings

**v1.4.4 — Deep ITM Call Spreads** ✅
- Complete options strategy overhaul with deep ITM call spreads
- Strict $5 width spreads for consistent risk management
- Long strike 5-15% ITM, short strike near ATM ($4-6 width range)
- 7-point entry checklist (Above MA200, RSI stable, Analyst revisions, etc.)
- Discount detection showing when paying less than intrinsic value
- Low theta, defined risk spreads that behave like discounted stock

**v1.4.3 — Bear Case Completeness** ✅
- Relative strength warnings for underperforming stocks
- Analyst revisions warning when EPS estimates being cut
- Low upside warning (<8%) regardless of analyst score

**v1.4.2 — Logic Fixes & Momentum Integration** ✅
- Fixed score-verdict mismatch (80+ score no longer SPECULATIVE)
- Momentum-aware verdicts (severe issues downgrade by one level)
- Bear case includes momentum warnings (price decline, EPS cuts, etc.)
- Fixed relative strength -100% calculation bug

**v1.4.1 — Enhanced Display & Batch Scan Fixes** ✅
- Quarter labels with year (Q4'24 → Q1'25 → Q2'25 → Q3'25)
- Consistent B/M formatting across quarters
- QoQ growth percentages inline ($1.01B → $0.93B (-9%))
- Options sorted by safety rating (★★★ BEST first)
- Valuation warnings for all stocks including growth
- Suppressed verbose Yahoo Finance validation errors in batch scans

**v1.4.0 — Quarterly Earnings Tracking** ✅
- Quarterly revenue/earnings trends
- Beat/miss history with surprise percentages
- Sequential margin improvement detection
- Management under-promise/over-deliver insight

**v1.3.x — Momentum & Position Analysis** ✅
- EPS estimate trends, analyst revisions, insider activity
- Position analyzer for spreads with risk assessment
- Market regime detection (bull/bear/neutral)
- Profitability warnings for unprofitable companies

**v1.2.x — Smart Entry & Options** ✅
- Risk/reward ratio calculations
- Bull put spread recommendations
- Relative strength vs SPY
- Two-target system (technical + analyst)

**v1.1.x — Style & Sector Context** ✅
- Growth/Value/Blend stock classification
- Sector benchmark comparisons
- Next earnings date warnings
- Style-adjusted narratives

### Future Plans
- Momentum scoring with historical tracking
- Portfolio integration
- Watchlist management
- ML signal weighting

