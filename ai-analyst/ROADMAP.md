# AI Analyst Roadmap

Your AI Financial Analyst - building toward a fully autonomous trading assistant.

## Current State (v1.0)

**Working:**

- Real-time Yahoo Finance data (price, RSI, MAs)
- Conversational interface with employee personality
- Options chain fetching and spread recommendations
- Earnings date awareness
- Position tracking (database ready)
- Trade journal integration
- Token-optimized context (TOON)

**Known Issues:**

- AI occasionally misreads above/below MA comparisons
- MA200 not showing in UI card
- Options data unavailable after hours
- No streaming responses (user waits 3-6s)

---

## Phase 1: Foundation Fixes (1-2 weeks)

### 1.1 Fix Data Display ✅

- [x] Show MA200 in Yahoo Finance card
- [x] Show earnings date in card when available
- [x] Show open positions count in header
- [x] Fix MA comparison logic in AI context
- [x] Add current date/time awareness
- [x] Add market status (open/closed/weekend)
- [x] Remove false promises (monitoring, reminders)
- [x] Prevent future price hallucinations

### 1.2 Streaming Responses ✅

- [x] Implement streaming from Ollama API
- [x] Show text as it generates (like ChatGPT)
- [x] Real-time word wrapping
- [x] Token/timing stats captured from stream

### 1.3 Position Integration ✅

- [x] Auto-detect tickers from user's positions
- [x] Show position details when discussing a ticker
- [ ] "What are my positions?" command works
- [ ] Expiration warnings (< 7 DTE)

---

## Phase 2: Market Intelligence (2-4 weeks)

### 2.1 Economic Calendar

- [ ] Integrate FED meeting dates
- [ ] CPI, Jobs Report, GDP dates
- [ ] Warn when major events within trade window
- [ ] Source: `tradingeconomics` or `finnhub` API

### 2.2 Enhanced Earnings

- [ ] Show historical earnings reactions
- [ ] Average move % on earnings
- [ ] Warn about IV crush risk
- [ ] Track earnings beat/miss history

### 2.3 Market Regime Detection

- [ ] VIX integration for volatility awareness
- [ ] Sector rotation tracking
- [ ] SPY trend analysis
- [ ] Adjust recommendations based on regime

---

## Phase 3: Proactive Assistant (4-6 weeks)

### 3.1 Morning Briefing

```bash
bun run briefing
```

- [ ] Overnight market summary
- [ ] Position status check
- [ ] Upcoming events affecting holdings
- [ ] Top 3 opportunity scans

### 3.2 Position Monitoring

- [ ] Background price monitoring
- [ ] Alert when position hits targets
- [ ] DTE countdown warnings
- [ ] Suggested actions (roll, close, hold)

### 3.3 Trade Journaling

- [ ] Auto-log trades when closed
- [ ] Capture entry/exit reasoning
- [ ] Calculate actual P&L
- [ ] Pattern detection from history

---

## Phase 4: Advanced Analysis (6-8 weeks)

### 4.1 Options Greeks

- [ ] Delta, gamma, theta for positions
- [ ] IV percentile vs historical
- [ ] Expected move calculations
- [ ] Greeks-based recommendations

### 4.2 Technical Patterns

- [ ] Support/resistance detection
- [ ] Chart pattern recognition
- [ ] Volume analysis
- [ ] Momentum indicators beyond RSI

### 4.3 Backtesting

- [ ] Test strategy on historical data
- [ ] Win rate by entry RSI
- [ ] Optimal DTE analysis
- [ ] Strike selection optimization

---

## Phase 5: Autonomy (8-12 weeks)

### 5.1 Paper Trading

- [ ] Simulated order execution
- [ ] Track paper P&L
- [ ] Compare AI picks vs actual
- [ ] Confidence calibration

### 5.2 Trade Recommendations Queue

- [ ] AI queues trade ideas
- [ ] User reviews and approves
- [ ] One-click execution (future)
- [ ] Performance tracking per idea

### 5.3 Learning System

- [ ] Track which recommendations worked
- [ ] Adjust confidence based on outcomes
- [ ] Personalized to your risk tolerance
- [ ] Strategy refinement suggestions

---

## Tech Debt / Infrastructure

- [ ] Add unit tests for core functions
- [ ] Error handling improvements
- [ ] Rate limiting for Yahoo Finance
- [ ] Caching layer for repeated queries
- [ ] Logging and debugging tools
- [ ] Configuration file (vs hardcoded values)

---

## Success Metrics

| Metric             | Current      | Target             |
| ------------------ | ------------ | ------------------ |
| Response time      | 3-6s         | <2s (streaming)    |
| Data accuracy      | ~90%         | 99%+               |
| Win rate tracking  | Manual       | Automated          |
| Position awareness | Manual input | Auto-detected      |
| Event calendar     | None         | FED, Earnings, CPI |

---

## Priority Matrix

```
                    IMPACT
                    High    Low
              ┌─────────┬─────────┐
        High  │ Phase 1 │ Phase 4 │
   EFFORT     │ Phase 2 │         │
              ├─────────┼─────────┤
        Low   │ Phase 3 │ Tech    │
              │         │ Debt    │
              └─────────┴─────────┘
```

**Recommended order:** 1.1 → 1.2 → 1.3 → 2.1 → 3.1 → 2.2 → 3.2

---

## Advanced Features (Implemented)

### Trade Grading System ✅

- A+/A/A-/B+/B/B-/C+/C/C-/D/F grades
- Criteria: MA200, RSI, Cushion, Earnings, DTE, Risk/Reward
- Automatic recommendation: STRONG BUY / BUY / WAIT / AVOID

### Risk Scoring ✅

- 1-10 scale (1=low, 10=high)
- Factors: RSI, Cushion, Earnings, DTE, Position Size, Trend
- Levels: LOW / MODERATE / HIGH / EXTREME

### Scenario Analysis ✅

- What-if calculations: Up 10%, Up 5%, Flat, Down 5%, Down 10%, Down 15%
- Shows P&L and outcome for each scenario
- To Breakeven and To Long Strike scenarios

### IV Analysis ✅

- Current IV from ATM options
- IV Percentile (estimated 0-100)
- Levels: LOW / NORMAL / ELEVATED / HIGH
- Recommendation: when to buy spreads vs wait

### Support/Resistance ✅

- MA20, MA50, MA200 levels
- 52-week high/low
- Recent 30-day high/low
- Round number (psychological) levels
- Distance calculation from current price

### Fundamentals ✅

- Market Cap (formatted: $4.4T, $250B, $500M)
- P/E Ratio (trailing)
- Forward P/E
- EPS (trailing twelve months)
- Dividend Yield
- Beta (volatility vs market)

### Economic Calendar ✅

- FOMC/Fed meeting dates (2024-2025)
- Market holidays (NYSE closed)
- Quad Witching days
- Auto-warns when high-impact events within 7 days
- Shows in chat header when warnings present

### News Awareness ✅

- Fetches recent headlines from Yahoo Finance
- Shows 2-3 headlines in ticker card
- Provides context to AI for analysis
- Flags if major news could affect trade

### Trade Scanner ✅

- Scans 15+ mega-cap tickers automatically
- Grades all opportunities (A+/A/B+/B/C)
- Filters by: min grade, max risk, min cushion
- Returns sorted results with reasons
- Trigger: "find opportunities", "scan", "setups"

### Web Search Integration ✅

- DuckDuckGo API for internet access
- Triggers on: "why is", "what's happening", "news about"
- Shows search results in UI
- AI references findings in analysis

### Victor Chen - AI Personality ✅

- 67-year-old veteran Wall Street trader (45 years experience)
- Direct, decisive, numbers-driven personality
- References past market events (Black Monday, 2008, etc.)
- Strong convictions backed by data
- Protective of capital, pushes back on bad trades
- Proactive: suggests trades, warns about risks

### Agent Loop with Tool Calling ✅

- Proper Ollama tool calling per official docs
- Agent loop: Victor can make multiple tool calls to research
- Ollama's official web_search API (better results than DuckDuckGo)
- Tools available:
  - web_search: Search the web via Ollama API for news, FOMC info, market analysis
  - get_ticker_data: Fetch real-time stock data
  - scan_for_opportunities: Scan market for trade setups
- Visual feedback for tool calls in UI
- Proactive research: Victor searches autonomously when asked to research

### Thinking Mode ✅

- Hybrid approach: Non-streaming first call for thinking, streaming for tool results
- Shows Victor's reasoning process in dedicated box (up to 20 lines)
- Limitation: Tools must be excluded from first call (DeepSeek-v3.1 API limitation)
- Auto-triggers web search for "research" requests
- Subsequent calls use streaming with tools for fast tool execution

### Response Quality ✅

- Whole contracts rule: Never suggests fractional contracts (0.75, etc.)
- Concise formatting: Quick questions 50-100 words, analysis 150-200 words
- Leads with recommendation, then supporting data
- Position sizing respects 20% max rule

### Fair Value Calculation ✅

- P/E-based fair value (sector comparison)
- Growth premium adjustments
- Valuation verdicts (UNDERVALUED/FAIR/OVERVALUED)
- Can answer "What is X worth?" questions

### Data Quality Checks ✅

- Spread pricing validation (rejects <10% return)
- Data staleness detection (weekend warning)
- IV sanity checks (filters invalid data)
- Return on risk calculation added to spreads

### Bug Fixes (Dec 2025)

- Fixed earnings showing negative days (past earnings now filtered)
- Fixed spread debit calculation for weekend/stale data
- Fixed IV showing 0% when options data unavailable
- Added validation for spread pricing (can't exceed spread width)
- Fixed news showing unrelated tickers (now filters by symbol/company)

---

## Quick Wins (This Week)

1. **Fix MA200 display** - 5 min fix
2. **Show earnings in card** - 10 min fix
3. **Add position count to header** - 15 min fix
4. **Remove "set a reminder" false promise** - Update prompt

---

_Last updated: December 2024_
