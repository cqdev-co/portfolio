# AI Analyst

Your first "employee" at your personal hedge fund - **Victor Chen**, a veteran 
Wall Street trader with 45 years of experience. He finds trades, makes 
recommendations, and helps you grow your account.

**Version 2.0.0**

## What's New (v2.0.0) - Agentic Victor

Victor is now **autonomous**! He monitors markets in the background, sends Discord alerts for opportunities, and delivers morning briefings - all without you having to ask.

### Background Monitoring

- **Watchlist Scanning** - Victor scans your watchlist every 30 minutes during market hours
- **Position Risk Alerts** - Get notified when DTE drops below 5 or cushion gets dangerously low
- **AI-Validated Alerts** - Every alert is reviewed by AI with a conviction score before sending

### Discord Integration

- **Rich Embeds** - Beautiful alert cards with price, grade, spread details
- **Morning Briefings** - Daily market summary at 9:00 AM ET
- **Priority Colors** - Red for high, yellow for medium, green for low priority

### New Commands

```bash
# Watchlist Management
bun run watch list                    # View watchlist
bun run watch add NVDA AAPL GOOGL     # Add tickers
bun run watch remove NVDA             # Remove ticker
bun run watch configure NVDA --rsi-low 30 --cushion 10

# Background Agent
bun run agent start                   # Start monitoring daemon
bun run agent stop                    # Stop monitoring
bun run agent status                  # Check agent health
bun run agent test-discord            # Test Discord webhook

# Briefings
bun run briefing                      # Generate morning briefing now
bun run briefing history              # View past briefings

# Alerts
bun run alerts                        # View recent alerts
bun run alerts --unack                # Unacknowledged only
bun run alerts ack abc123             # Acknowledge an alert
bun run alerts summary                # Statistics
```

### Setup

See [AGENTIC_SETUP.md](./AGENTIC_SETUP.md) for detailed setup instructions.

---

## What's New (v1.2.0) - Phase 2 Update

### Token Optimization (60% cost reduction)

- 🔄 **TOON Encoding** - Ticker data compressed from ~800 to ~50 tokens per ticker
- 🧠 **Smart Context** - Question classification loads only relevant data
- 💬 **Conversation Summary** - Older messages summarized to save tokens
- ⚡ **Dynamic Prompt** - Optimized from ~1,500 to ~1,000 tokens

### Market Intelligence

- 📊 **VIX Integration** - Real-time volatility awareness with regime detection
- 📅 **Enhanced Calendar** - CPI, Jobs Report (NFP), GDP, Fed speeches
- 📈 **Earnings History** - Historical earnings reactions, IV crush risk
- 🎯 **Market Regime** - RISK_ON / RISK_OFF / HIGH_VOL detection

### Quality & Reliability Improvements

- 🔴 **Market Hours Status** - Shows OPEN/CLOSED/PRE-MKT/AH in header
- 📈 **ADX Trend Strength** - Allows higher RSI in strong trends (ADX >40)
- 📊 **Grade Rubric** - Transparent scoring breakdown (MA200, RSI, cushion, IV, earnings)
- ⚠️ **Stale Data Warnings** - Weekend/after-hours data clearly marked
- 💰 **Fundamentals in TOON** - Market Cap (MC) and P/E (PE) now encoded for AI access
- 🚫 **Anti-Hallucination** - Reinforced prompt to use provided data only

## Quick Start

```bash
cd ai-analyst
bun install

# Talk to your analyst
bun run chat
```

## The Concept

This isn't just a tool - it's your analyst employee **Victor Chen**. He's a 
67-year-old veteran Wall Street trader with 45 years of experience. Talk to 
him like you would a real analyst:

- "What should I buy today?"
- "Find me a good setup"
- "Research NVDA for me"  
- "Is this a good entry?"

## Example Conversation

```
  📊 YOUR ANALYST
  ════════════════════════════════════════════════════════════════════

  Fund Size: $1,500 | Strategy: Deep ITM CDS | 2 positions
  🟢 VIX 15.2 📈 RISK_ON
  Type 'quit' to end session

  ┌─ Market Calendar ───────────────────────────────────────────────
  │ ⚠️ FOMC Meeting Wed, Dec 10 (2d) - HIGH volatility risk
  │ ⚠️ CPI Report Thu, Dec 11 (3d) - Inflation data release
  └───────────────────────────────────────────────────────────────────

  ────────────────────────────────────────────────────────────────────

  Victor: Morning. Victor Chen here. Markets are open and I've
          been watching the tape. Give me a ticker to analyze, ask me
          to scan for setups, or let's review what we're holding.
          What's on your mind?

  You: Should I buy NVDA before FOMC?

  ┌─ Victor's Analysis ─────────────────────────────────────────
  │ The user is asking about buying NVDA right before a major
  │ FOMC meeting. This is a classic timing question where market
  │ volatility risks are high...
  └───────────────────────────────────────────────────────────────

  Victor: Let me be direct: NO. This is exactly the kind of impatient
          trading that blows up accounts.

          • FOMC RISK: The Fed meets in 2 days. Powell could spark a
          5-10% market move with one comment.

          • THE SETUP: Technically, NVDA looks decent - price above MA200,
          RSI 51, 8.8% cushion. This would be a Grade B trade normally.

          • MY CALL: WAIT. Let the FOMC pass, see how NVDA reacts.
          In my 45 years, I've learned: Never fight the Fed.
```

## New Features in v1.2.0

### Market Regime Detection

The chat now displays real-time market regime at startup:

| Regime | Description | Trading Recommendation |
|--------|-------------|----------------------|
| RISK_ON | VIX low, SPY above MA200 | Normal position sizing |
| RISK_OFF | SPY below MA200, bearish | Reduce exposure, wait |
| HIGH_VOL | VIX elevated (>20) | Reduce sizes by 50% |
| NEUTRAL | Mixed signals | Grade A setups only |

### Enhanced Economic Calendar

Now tracks 7 event types:

| Event | Impact | Typical Market Reaction |
|-------|--------|------------------------|
| FOMC | HIGH | ±1-3% on surprises |
| CPI | HIGH | ±1-2% on inflation data |
| Jobs (NFP) | HIGH | ±0.5-1% on employment |
| GDP | MEDIUM-HIGH | Growth signals |
| Fed Beige Book | MEDIUM | Regional economic data |
| Quad Witching | MEDIUM | High volume |
| Holidays | MEDIUM | Market closed |

### TOON Ticker Encoding

Live market data is now compressed using pipe-delimited format:

```
NVDA|185.55|+1.7%|RSI51|ADX32M|MA:184/187/155|↑MA200|IV40E|S180R190|165/170@4.02|8.6%|B+|R3|E45|MC1.5T|PE55
```

**Key:**
- `RSI51` = RSI at 51
- `ADX32M` = ADX 32, M=Moderate (W=Weak, M=Moderate, S=Strong)
- `MA:184/187/155` = MA20/MA50/MA200 prices
- `↑MA200` = Price above 200-day MA
- `IV40E` = 40% IV, E=Elevated (L/N/E/H)
- `S180R190` = Support $180, Resistance $190
- `165/170@4.02` = Spread strikes and debit
- `R3` = Risk score 3/10
- `E45` = 45 days until earnings (E- = no data)
- `MC1.5T` = Market Cap $1.5 Trillion (MC360B = $360B)
- `PE55` = P/E Ratio 55

### Smart Context Loading

Questions are classified to load only relevant data:

| Question Type | Data Loaded |
|--------------|-------------|
| Price check | Quote only (fast) |
| Trade analysis | + Options, calendar, grade |
| Research | + Web search, news |
| Position check | + Open positions, history |
| Scan | Full market scan |

### Trade Grading Rubric

Transparent scoring system (100 points max):

| Criterion | Max Points | Description |
|-----------|-----------|-------------|
| Above MA200 | 25 | Price above 200-day MA = bullish trend |
| RSI Zone | 20 | 35-55 ideal, 55-65 partial (unless ADX >40) |
| Cushion | 20 | >10% full, 7-10% partial, <7% risky |
| IV Level | 15 | Normal/Low = full, Elevated = partial |
| Earnings | 10 | >14 days safe, 7-14 partial, <7 avoid |
| Risk/Reward | 10 | >20% return = full, 15-20% partial |

**Grades**: A+ (95+), A (90+), B (75+), C (60+), D (50+), F (<50)

### ADX Trend Strength

RSI rules are flexible based on trend strength (now included in TOON data):

| ADX Value | Trend | Display | RSI Flexibility |
|-----------|-------|---------|-----------------|
| <20 | WEAK | `↔15` | Strict 35-55 RSI only |
| 20-40 | MODERATE | `→26` | RSI up to 60 acceptable |
| >40 | STRONG | `📈42` | RSI up to 65 acceptable |

### Earnings Data

Always displayed in Yahoo Finance card:

| Days Out | Display | Status |
|----------|---------|--------|
| <14 days | `⚠️ EARNINGS 12d - AVOID` | Red warning |
| 14-30 days | `📅 Earnings: 25 days` | Yellow caution |
| >30 days | `📅 Earnings: 45d (safe)` | Green safe |
| Unknown | `📅 Earnings: Not available` | Gray note |

## CLI Reference

### `chat`

Start a conversational chat with your AI Analyst.

```bash
bun run chat
bun run chat --account 3000
bun run chat --ai-mode local
```

| Option | Description | Default |
|--------|-------------|---------|
| `--ai-mode <mode>` | Ollama mode: local or cloud | cloud |
| `--ai-model <model>` | Override default AI model | - |
| `-a, --account <size>` | Account size in dollars | 1500 |

### `analyze <ticker>`

Analyze a ticker for entry decision.

| Option | Description | Default |
|--------|-------------|---------|
| `--ai-mode <mode>` | Ollama mode: local or cloud | cloud |
| `--ai-model <model>` | Override default AI model | - |
| `-p, --position <spread>` | Your existing position | - |
| `-a, --account <size>` | Account size in dollars | 1500 |
| `--no-chart` | Skip price chart | false |

### `journal [ticker]`

View trade history.

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --stats` | Show performance statistics | false |
| `-l, --limit <n>` | Limit trades shown | 20 |

### `import <file>`

Import Robinhood CSV.

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dry-run` | Don't save to database | false |
| `-v, --verbose` | Verbose output | false |

### `log <ticker>`

Log a trade manually.

| Option | Description | Required |
|--------|-------------|----------|
| `-t, --type <type>` | Trade type: cds, pcs, ccs, pds | Yes |
| `-s, --strikes <strikes>` | Strikes (e.g., 120/125) | Yes |
| `-p, --premium <premium>` | Premium per share | Yes |
| `-e, --expiration <date>` | Expiration (YYYY-MM-DD) | No |
| `--thesis <text>` | Entry thesis | No |

## Architecture

```
ai-analyst/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── agent/                # NEW: Agentic components
│   │   ├── ai-review.ts      # AI validation layer
│   │   ├── briefing.ts       # Morning briefing generator
│   │   ├── decision.ts       # Alert decision engine
│   │   └── monitor.ts        # Background daemon
│   ├── commands/
│   │   ├── alerts.ts         # NEW: Alert management
│   │   ├── analyze.ts        # Main analysis command
│   │   ├── briefing.ts       # NEW: Briefing commands
│   │   ├── chat.ts           # Interactive chat with Victor
│   │   ├── import.ts         # Robinhood CSV import
│   │   ├── journal.ts        # Trade history
│   │   ├── position.ts       # Position management
│   │   └── watch.ts          # NEW: Watchlist management
│   ├── engine/
│   │   ├── fair-value.ts     # DCF + relative valuation
│   │   ├── strategy.ts       # Strategy selector
│   │   └── trade-analyzer.ts # Trade grading
│   ├── context/
│   │   ├── history.ts        # Conversation history
│   │   └── toon.ts           # Token-optimized context + encoding
│   ├── services/
│   │   ├── calendar.ts       # Economic calendar (FOMC, CPI, NFP, GDP)
│   │   ├── discord.ts        # NEW: Discord webhooks
│   │   ├── market-regime.ts  # VIX + regime detection
│   │   ├── ollama.ts         # AI integration
│   │   ├── scanner.ts        # Market scanning
│   │   ├── supabase.ts       # Database operations (extended)
│   │   ├── web-search.ts     # Web search integration
│   │   └── yahoo.ts          # Yahoo Finance + earnings history
│   └── types/
│       └── index.ts          # Type definitions
├── package.json
└── tsconfig.json
```

## Token Optimization Results

| Metric | Before (v1.1) | After (v1.2) | Reduction |
|--------|---------------|--------------|-----------|
| Avg Input Tokens | 3,800 | ~1,500 | 60% |
| System Prompt | 1,500 | ~1,000 | 33% |
| Ticker Data | 800/ticker | 50/ticker | 94% |
| Conversation History | 100+/msg | ~20/msg | 80% |
| Cost per Conv | $0.08 | ~$0.03 | 62% |

## Configuration

Create `.env` in repository root:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OLLAMA_API_KEY=your-ollama-api-key

# Required for Agentic Victor (Discord alerts)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Database Setup

For Agentic Victor, run these SQL schemas in Supabase:

1. `db/analyst_schema.sql` - Base tables (trades, observations)
2. `db/positions_schema.sql` - Position tracking
3. `db/agent_schema.sql` - Agent tables (watchlist, alerts, briefings)

## Dependencies

- **Runtime**: Bun
- **AI**: Ollama (cloud or local)
- **Data**: yahoo-finance2
- **Indicators**: technicalindicators
- **CLI**: commander + chalk
- **Database**: Supabase
- **CSV**: csv-parse

## CLI Reference (Agentic Commands)

### `watch`

Manage watchlist for automated monitoring.

```bash
bun run watch list               # View current watchlist
bun run watch add NVDA AAPL      # Add tickers
bun run watch remove NVDA        # Remove ticker
bun run watch configure NVDA     # Configure thresholds
```

| Subcommand | Description |
|------------|-------------|
| `list` | View current watchlist |
| `add <tickers...>` | Add ticker(s) to watchlist |
| `remove <ticker>` | Remove ticker from watchlist |
| `configure <ticker>` | Set RSI/IV/cushion thresholds |

**Configure Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--rsi-low <n>` | Minimum RSI threshold | 35 |
| `--rsi-high <n>` | Maximum RSI threshold | 55 |
| `--iv <n>` | IV percentile threshold | 50 |
| `--cushion <n>` | Minimum cushion % | 8 |
| `--grade <g>` | Minimum grade | B |

### `agent`

Background monitoring agent controls.

```bash
bun run agent start              # Start background monitoring
bun run agent stop               # Stop monitoring
bun run agent status             # Check agent health
bun run agent test-discord       # Test Discord webhook
```

| Subcommand | Description |
|------------|-------------|
| `start` | Start the background monitoring daemon |
| `stop` | Stop monitoring |
| `status` | Check agent health and statistics |
| `test-discord` | Test Discord webhook configuration |

### `briefing`

Generate or view morning briefings.

```bash
bun run briefing                 # Generate morning briefing
bun run briefing history         # View past briefings
bun run briefing view 2024-12-11 # View specific briefing
```

### `alerts`

View and manage triggered alerts.

```bash
bun run alerts                   # View recent alerts
bun run alerts --unack           # Unacknowledged only
bun run alerts ack abc123        # Acknowledge an alert
bun run alerts summary           # View statistics
```

| Option | Description |
|--------|-------------|
| `-l, --limit <n>` | Number of alerts to show |
| `-t, --ticker <ticker>` | Filter by ticker |
| `--type <type>` | Filter by type |
| `-u, --unack` | Show only unacknowledged |

## Roadmap

### Completed

- ✅ **Phase 1**: Foundation (Victor Chen personality, streaming, tools)
- ✅ **Phase 2**: Token Optimization + Market Intelligence
- ✅ **Phase 3**: Agentic Victor (background monitoring, Discord alerts, morning briefings)

### Future Phases

- **Phase 4**: Advanced Analysis (Greeks, patterns, backtesting)
- **Phase 5**: Autonomy (paper trading, trade queue, learning system)
