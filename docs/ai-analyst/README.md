# AI Analyst

Your first "employee" at your personal hedge fund - an AI analyst that finds 
trades, makes recommendations, and helps you grow your options account.

**Version 2.8.0**

## What's New (v2.8.0) - Bug Fixes & Probability of Profit

### Bug Fixes
- **Spread Consistency**: All commands now use `findSpreadWithAlternatives` for consistent spread recommendations
- **Sector Detection**: Fixed sector always showing "Unknown" - now properly fetches from Yahoo Finance `assetProfile`
- **R/R Display**: Chat now shows risk/reward calculations for spreads

### Probability of Profit (PoP)

The AI now receives **Probability of Profit** for each spread recommendation:

```toon
riskReward:
  maxProfit: $82
  maxLoss: $418
  breakeven: $174.18
  ratio: "1:0.2"
  profitPct: 20%
  pop: 72%        # NEW: Probability of Profit
```

**How PoP is Calculated:**
- Uses Black-Scholes-inspired normal distribution approximation
- Based on: Current Price, Breakeven, Implied Volatility, and Days to Expiration
- Formula: `PoP = N(ln(currentPrice/breakeven) / (IV × √(DTE/365)))`
- Where N() is the cumulative normal distribution function

**Chat Display Enhancement:**
```
│   📈 $180/$185 · $335 debit · 2.8% cushion
│   💰 R/R: $82/$418 (1:0.2) · 19.8% return · 72% PoP
```

---

## Version 2.7.1 - Complete Data Integration

All data points now fully integrated across `debug`, `analyze`, and `chat` commands:

### Complete Volatility Analysis
```toon
volatility:
  iv: 34.4%           # Implied volatility from options
  hv20: 31.6%         # 20-day historical volatility
  ivRank: 59%         # IV percentile (0-100)
  ivLevel: normal     # LOW/NORMAL/ELEVATED/HIGH
  premium: fair       # Options pricing: cheap/fair/expensive
```

### Full Spread Recommendation
```toon
spread:
  longStrike: $170
  shortStrike: $175
  estimatedDebit: $4.18
  maxProfit: $0.82
  breakeven: $174.18
  cushion: 7.7%
```

### Calculated Risk/Reward
```toon
riskReward:
  maxProfit: $82      # Per contract
  maxLoss: $418       # Debit paid
  breakeven: $174.18
  ratio: 1:0.2        # Risk/Reward ratio
  profitPct: 20%      # Max profit as % of risk
```

All features now work consistently across all commands.

---

## What's New (v2.7.0) - High-Value Data Additions

The AI Analyst receives **4 high-value data points** for comprehensive analysis:

### 1. Short Interest
```toon
shorts:
  pctFloat: 1.1%      # % of float shorted
  daysTocover: 1.28   # Days to cover at avg volume
```
Helps identify squeeze potential and bearish positioning.

### 2. Relative Strength vs SPY
```toon
rsStrength:
  vsSPY: +3.8%        # 30-day outperformance vs SPY
```
Identifies true outperformers vs stocks just riding the market.

### 3. Put/Call Ratio (Options Flow)
```toon
optionsFlow:
  pcRatio: 0.89       # Put/Call open interest ratio
  sentiment: neutral  # bullish (<0.7) / neutral / bearish (>1.0)
```
Smart money positioning signals from options markets.

### 4. Risk/Reward Calculation
```toon
riskReward:
  maxProfit: $165     # Max profit potential
  maxLoss: $335       # Max loss (debit paid)
  breakeven: $183.35  # Breakeven price
  ratio: 1:0.5        # Risk/Reward ratio
  profitPct: 49%      # Max profit as % of risk
```
Clear trade economics for smarter position sizing.

### Enhanced Chat Display

The chat now shows all new data in a single line:
```
┌─ Yahoo Finance ─────────────────────────────────────────────
│ NVDA $188.61 -0.3% RSI 57 ↑MA200 ↔12
│   ...
│   📈 IV: 33.8% · HV20: 31.6% · Options fair
│   🔍 Short 1.1% (1.28d) · vs SPY +3.8% · P/C 0.89 (neutral)
│   ...
└───────────────────────────────────────────────────────────────
```

**Token increase:** ~50 tokens (+10%), for significantly richer analysis.

---

## What's New (v2.6.0) - IV vs HV Volatility Comparison

The AI now receives **historical volatility (HV20)** to compare against implied volatility (IV):

### Volatility Analysis
```toon
vol:
  iv: 42%         # Current implied volatility
  hv20: 35%       # 20-day historical (realized) volatility
  level: normal   # IV level (low/normal/elevated/high)
  premium: expensive  # Options pricing vs realized vol
```

**What This Means:**
- **cheap** (IV < 0.85 × HV): Options are underpriced vs realized vol - good for buying
- **fair** (IV ≈ HV): Options are fairly priced
- **expensive** (IV > 1.15 × HV): Options are overpriced - consider selling premium

---

## What's New (v2.5.0) - Comprehensive Context Update

The AI now receives **significantly more context** for smarter decision making:

### Earnings History with Beat/Miss Tracking
```toon
earnings:
  date: Feb 25
  days: 62
  streak: +4 beats      # 4 consecutive beats!
  lastSurprise: +5.2%   # Beat by 5.2% last quarter
  avgSurprise: +5.2%    # Average beat over 4 quarters
```

### Sector Context
```toon
sector:
  name: Technology
  avgPE: 28
  vs: +68%              # NVDA is 68% above sector avg P/E
```

### Volume Analysis
```toon
volume:
  today: 36%            # % of average volume
  trend: stable         # increasing/stable/declining
  unusual: null         # Days with >2x volume in last 10
```

### Risk Metrics
```toon
risk:
  beta: 1.8             # Market sensitivity
```

### Enhanced Chat Display

The chat now shows all new data in a clean format:
```
┌─ Yahoo Finance ─────────────────────────────────────────────
│ NVDA $188.61 -0.3% RSI 57 ↑MA200 ↔12
│   MCap $4.6T · P/E 46.7 · +68% vs sector
│   🎯 Target: $140-$253-$352 (+34%)
│   📊 Perf: 5d: +4.2% · 1m: +6.1% · YTD: +36.4%
│   👥 94% Bullish (11SB 49B 3H 1S)
│   📅 Earnings: Feb 25 (safe) · 4 beats · +5.2% last
│   ...
└───────────────────────────────────────────────────────────────
```

**New Data Points:**
| Data | Before | After |
|------|--------|-------|
| Earnings Date | `62 days` | `Feb 25 (62d)` |
| Beat/Miss Streak | ❌ Not sent | `4 beats` |
| Last Surprise | ❌ Not sent | `+5.2%` |
| Sector P/E Comparison | ❌ Not sent | `+68% vs sector` |
| Volume Trend | Just `36%` | `36%, stable, 0 unusual days` |
| Beta | ❌ Not sent | `1.8` |

Token increase: ~450 → ~500 tokens (+11%), for dramatically better analysis.

---

## What's New (v2.4.0) - Target Prices & Price Performance

The AI now receives **analyst target prices** and **price performance** for better entry decisions:

### Target Prices
```toon
targets:
  low: $140
  mean: $253
  high: $352
  upside: +34.1%
  analysts: 57
```

### Price Performance (Momentum Context)
```toon
performance:
  d5: +4.2%    # 5-day return
  m1: +6.1%    # 1-month return
  m3: +5.8%    # 3-month return
  ytd: +36.4%  # Year-to-date return
```

**New Data Points:**
| Data | Before | After |
|------|--------|-------|
| Target Price | Just `target: $253` (mean only) | Full range: `$140 - $253 - $352` with upside % |
| 5-Day Return | ❌ Not sent | `+4.2%` |
| 1-Month Return | ❌ Not sent | `+6.1%` |
| 3-Month Return | ❌ Not sent | `+5.8%` |
| YTD Return | ❌ Not sent | `+36.4%` |

This helps the AI identify:
- **Momentum stocks** (positive across all timeframes)
- **Mean reversion opportunities** (recent pullback but strong YTD)
- **Falling knives** (negative across all timeframes)
- **Realistic price targets** (low/mean/high range vs single point estimate)

Token increase: ~400 → ~450 tokens (+12%), but significantly better entry timing.

---

## What's New (v2.3.0) - Enhanced Analyst & Ownership Data

The AI now receives **comprehensive analyst and ownership data** for smarter analysis:

### Analyst Ratings Breakdown
```toon
analysts:
  consensus: 94% bullish
  strongBuy: 11
  buy: 49
  hold: 3
  sell: 1
  changes[3]{firm,grade,target}:
    Truist,Buy,$275
    Tigress,Strong Buy,$350
    Morgan,Overweight,$250
```

### Ownership Structure
```toon
ownership:
  insiders: 4.3%
  institutions: 69.4%
  instCount: 6934
  recentSales: $230M
```

---

## What's New (v2.2.1) - MA200 Bug Fix

Fixed a data consistency bug where MA200 was being calculated incorrectly:

- **Bug**: MA200 was being computed from only 250 days of historical data, 
  which only yields ~50 valid MA200 values (an average of the recent 50-day 
  window, not the true 200-day average)
- **Fix**: Now uses Yahoo Finance's pre-calculated `twoHundredDayAverage`, 
  which is the correct 200-day simple moving average
- **Impact**: For NVDA, MA200 was showing $189 (incorrect) instead of $159 
  (correct), causing wrong `aboveMA200` signals

All commands (`analyze`, `debug`, `chat`) now show consistent MA200 values.

---

## What's New (v2.2.0) - Rich Context + Debug Mode

### Rich AI Context

The AI now receives **comprehensive data** instead of sparse summaries:

| Data Point | Before | After |
|------------|--------|-------|
| Price | `$188.61` | `$188.61 (-0.3% today)` |
| Volume | ❌ Not sent | `64.8M (64% below avg)` |
| 52W Range | ❌ Not sent | `81% of range ($87-$212)` |
| Market Cap | ❌ Not sent | `$4.6T` |
| MAs | `Above MA200: No` | `MA20: $181, MA50: $186, MA200: $159 (above ✓)` |
| Valuation | ❌ Not sent | `P/E: 46.7/25.0, EPS: $4.04/$7.55, Growth: 67%/63%` |
| Analyst Ratings | ❌ Not sent | `94% bullish (11 Strong Buy, 49 Buy, 3 Hold, 1 Sell)` |
| Recent Changes | ❌ Not sent | `Truist→Buy $275, Tigress→Strong Buy $350` |
| Ownership | ❌ Not sent | `4.3% insiders, 69.4% institutions (6,934)` |
| Insider Activity | ❌ Not sent | `$230M recent insider sales` |
| PFV Levels | 3 levels | 5 levels + support/resistance zones |
| Strategy | Name only | `Primary + Alternatives with confidence %` |

Token increase: ~270 → ~400 tokens (+48%), but dramatically better analysis.

### Debug Mode

New `debug` command shows all context without making AI calls:

```bash
bun run debug NVDA              # Show ALL raw context (no AI call)
bun run debug NVDA --compact    # Shorter output (summarize PFV)
bun run debug NVDA --log        # Save full output to logs/ folder
bun run debug NVDA -c -l        # Compact + log file
```

**Log file output:** The `--log` flag saves a clean text file (no ANSI colors) 
to `ai-analyst/logs/debug-{TICKER}-{timestamp}.log` - useful for reviewing 
the full output, comparing runs, or sharing with others.

See exactly what data the AI receives before running analysis.

---

## What's New (v2.1.1) - Tool Call Synthesis Fix

### Bug Fix: Tool Call Loop Termination

Fixed a critical bug where Victor's chat would terminate abruptly after
making multiple web searches without synthesizing the results.

**The Problem:**
- When Victor made 3 consecutive tool calls (web searches), the agent loop
  would exit after the final tool execution
- The tool results would remain unsynthesized, leaving the conversation
  hanging without Victor's analysis

**The Fix:**
- Added post-loop synthesis: If the agent loop exits due to hitting max
  iterations with pending tool results, a final synthesis call is now made
- Added tool call protection: On the final iteration, any tool calls from
  the model are ignored to force synthesis over additional research

**Technical Details:**
- DeepSeek V3 would continue outputting tool-call-like tokens even when
  tools were disabled (because tool definitions existed in conversation
  context from earlier turns)
- The Ollama client would parse these as actual tool calls, causing
  unexpected tool execution on the "final" iteration
- Now, tool calls are explicitly ignored on `isLastIteration = true`

---

## What's New (v2.1.0) - Psychological Fair Value

Victor now incorporates **Psychological Fair Value (PFV)** analysis - understanding where price gravitates based on options mechanics and behavioral psychology.

### New: Psychological Fair Value

- **Max Pain Analysis** - Where options expire worthless (MM profit zone)
- **Gamma Walls** - High OI strikes that act as support/resistance
- **Multi-Expiration Weighting** - Considers multiple expirations, weights monthly OPEX higher
- **Round Number Magnetism** - Human cognitive bias toward $100, $50, etc.
- **Mean Reversion Signals** - Alerts when price deviates significantly from PFV

The `analyze` command now shows:

```
═══════════════════════════════════════════════════════════════════════

  🧠 PSYCHOLOGICAL FAIR VALUE
  ────────────────────────────────────────────────────────────────────

  Fair Value: $175.00  Current: $178.50  -1.9% BEARISH
  Confidence: HIGH  Profile: Blue Chip

  Components:
  Max Pain          $175.00 ████████████ 30%
  Gamma Walls       $174.50 ████ 10%
  Technical Levels  $176.20 ██████████ 25%
  Volume Anchor     $177.80 ████████ 20%
  Round Numbers     $175.00 ██████ 15%

  Magnetic Levels:
  🟢 $  175.00 - MAX PAIN      (-1.96%)
  🔴 $  180.00 - ROUND MAJOR   (+0.84%)
  🟢 $  170.00 - PUT WALL      (-4.76%)

  Support Zone: $170.00 - $172.50
  Resistance Zone: $180.00 - $182.50
```

### AI Analysis Enhanced

Victor's AI analysis now considers both **fundamental** and **psychological** fair value:

- References max pain when OPEX is approaching
- Notes gamma wall support/resistance levels
- Identifies mean reversion opportunities
- Warns about options-related risks

---

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

### Token Optimization (~14% vs JSON + better accuracy)

- 🔄 **TOON Encoding** - Uses `@toon-format/toon` library for proper TOON format
- 📦 **Shared Functions** - `context/toon.ts` provides `buildAnalysisData`, `encodeAnalysisToTOON` used by analyze, debug, and chat commands
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

### TOON Format

The `analyze` command uses proper [TOON](https://github.com/toon-format/toon)
(Token-Oriented Object Notation) for ~14% token savings vs JSON with **higher
LLM comprehension accuracy** (74% vs 70% in benchmarks).

```yaml
ticker: NVDA
name: NVIDIA Corporation
price: 188.61
change: "-0.3%"
volume: 36%
pos52w: 81%
mcap: 4.6T
market: bull
technicals:
  rsi: 57
  ma20: 181
  ma50: 186
  ma200: 189
  aboveMA200: false
  score: 65
fundamentals:
  peTrailing: 47
  peForward: 25
  epsTrailing: 4.04
  growthEarnings: 67
  target: 253
  analysts: 57
  fairValue: fair
  margin: 10
pfv:
  value: 180
  bias: bearish
  deviation: "-4.4%"
  support: 186-189
  meanReversion: SHORT 44%
  levels[5]{price,type,dist}:
    200,callwall,+6.0%
    185,gammawall,"-1.9%"
    195,callwall,+3.4%
strategy:
  primary: Deep ITM Call Debit Spread
  confidence: 75
  alternatives[2]{name,conf}:
    Put Credit Spread,75
    Cash Secured Put,55
```

**TOON Features:**
- YAML-like `key: value` syntax for nested objects
- Tabular arrays with `[N]{fields}:` headers for uniform data
- Indentation-based structure (no braces/brackets)
- Self-documenting - LLMs parse naturally without schema explanation
- **74% accuracy** vs JSON's 70% in LLM comprehension benchmarks

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

### `debug <ticker>`

**Debug mode** - Shows ALL raw context and the proper TOON-encoded prompts sent
to the AI without making the actual API call. Displays Yahoo Finance data,
technical indicators, PFV, and the exact prompts. Uses `@toon-format/toon` lib.

```bash
bun run debug NVDA              # Show ALL raw context (no AI call)
bun run debug NVDA --compact    # Shorter output, hide PFV details
bun run debug AAPL --account 3000
```

**Shows:**
- Raw Yahoo Finance data (JSON)
- Raw technical indicators
- Raw PFV calculations
- Proper TOON-encoded prompt
- Token estimation and cost
- Compression analysis (TOON vs JSON)

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --account <size>` | Account size in dollars | 1500 |
| `-c, --compact` | Hide full PFV magnetic levels array | false |

**Output sections:**
- 📈 Raw Yahoo Finance Data - Full `stockData` object from YFinance
- 📉 Raw Technical Indicators - RSI, MAs, score calculation
- 🌐 Market Regime Data - SPY analysis for bull/bear/neutral
- 🧠 Psychological Fair Value - Full PFV data with magnetic levels
- 🔧 Derived Data - Fair value calc, strategy selection
- 🤖 System Prompt - The AI's instructions (raw text)
- 💬 User Prompt - The exact context sent to AI (rich format)
- 🔢 Token Estimation - Approximate input tokens and cost
- 🔬 Context Analysis - Shows all data now included in prompt

**Rich Context (v2.2)** - The AI now receives comprehensive data:
- Price with % change, volume relative to average
- 52-week range position, market cap
- All MA values (MA20/50/200) with above/below indicators
- P/E ratios, EPS, growth rates, analyst targets
- 5 PFV magnetic levels with support/resistance zones
- Strategy alternatives with confidence scores

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
│   ├── context/
│   │   └── toon.ts           # SHARED: TOON encoding using @toon-format/toon
│   │                         #   - buildAnalysisSystemPrompt()
│   │                         #   - buildAnalysisData()
│   │                         #   - encodeAnalysisToTOON()
│   │                         #   - encodeTickerToTOON() (for chat)
│   ├── agent/                # Agentic components
│   │   ├── ai-review.ts      # AI validation layer
│   │   ├── briefing.ts       # Morning briefing generator
│   │   ├── decision.ts       # Alert decision engine
│   │   └── monitor.ts        # Background daemon
│   ├── commands/
│   │   ├── alerts.ts         # Alert management
│   │   ├── analyze.ts        # Main analysis (uses shared TOON)
│   │   ├── briefing.ts       # Briefing commands
│   │   ├── chat.ts           # Interactive chat (uses shared TOON)
│   │   ├── debug.ts          # Debug mode (uses shared TOON)
│   │   ├── import.ts         # Robinhood CSV import
│   │   ├── journal.ts        # Trade history
│   │   ├── position.ts       # Position management
│   │   └── watch.ts          # Watchlist management
│   ├── engine/
│   │   ├── fair-value.ts     # DCF + relative valuation
│   │   ├── strategy.ts       # Strategy selector
│   │   └── trade-analyzer.ts # Trade grading
│   ├── context/
│   │   ├── history.ts        # Conversation history
│   │   └── toon.ts           # Token-optimized context + encoding
│   ├── services/
│   │   ├── calendar.ts       # Economic calendar (FOMC, CPI, NFP, GDP)
│   │   ├── discord.ts        # Discord webhooks
│   │   ├── market-regime.ts  # VIX + regime detection
│   │   ├── ollama.ts         # AI integration
│   │   ├── psychological-fair-value.ts  # NEW: PFV integration
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

### `short-term`

Scan SPY/QQQ for 1-3 day swing trade entries.

```bash
bun run short-term               # Scan SPY and QQQ
bun run short-term --account 500 # With custom account size
```

| Option | Description | Default |
|--------|-------------|---------|
| `--ai-mode <mode>` | Ollama mode: local or cloud | cloud |
| `--ai-model <model>` | Override default AI model | - |
| `-a, --account <size>` | Account size in dollars | 1500 |
| `-v, --verbose` | Show detailed analysis | false |

**Strategy highlights:**
- RSI oversold bounces (< 35)
- VWAP mean reversion setups
- 5-10 DTE debit spreads
- 35% profit target, 40% stop loss
- Max 15% risk per trade

See [SHORT-TERM-STRATEGY.md](./SHORT-TERM-STRATEGY.md) for full documentation.

## Roadmap

### Completed

- ✅ **Phase 1**: Foundation (Victor Chen personality, streaming, tools)
- ✅ **Phase 2**: Token Optimization + Market Intelligence
- ✅ **Phase 3**: Agentic Victor (background monitoring, Discord alerts, morning briefings)

### Future Phases

- **Phase 4**: Advanced Analysis (Greeks, patterns, backtesting)
- **Phase 5**: Autonomy (paper trading, trade queue, learning system)

---

## Psychological Fair Value (PFV)

The PFV system calculates where price gravitates based on behavioral biases and market mechanics.

### Components & Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Max Pain | 30% | Strike where most options expire worthless |
| Gamma Walls | 10% | High OI strikes with MM hedging pressure |
| Technical Levels | 25% | MAs, 52-week high/low, swing points |
| Volume Anchor | 20% | VWAP and volume-weighted center |
| Round Numbers | 15% | Psychological magnetism ($100, $50, etc.) |

### Ticker Profiles

PFV adjusts weights based on stock type:

| Profile | When Used | Key Adjustment |
|---------|-----------|----------------|
| Blue Chip | AAPL, MSFT, etc. | Higher technical weight |
| Meme/Retail | GME, AMC, PLTR | Higher round number & gamma |
| ETF | SPY, QQQ | Higher max pain (very reliable) |
| Low Float | Small caps | Higher gamma (exaggerated effects) |

### Using PFV in Analysis

1. **Mean Reversion**: When price > PFV by 3%+, expect pullback
2. **OPEX Approach**: Max pain magnetism strongest 0-7 days out
3. **Gamma Walls**: High OI strikes act as support/resistance
4. **Round Numbers**: Watch $100, $50 levels for retail stocks

See [lib/psychological-fair-value.md](../lib/psychological-fair-value.md) for full documentation.
