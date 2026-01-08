# Perfect Opportunity Process Flow

> **Version**: 2.7.0 (2026-01-07)
>
> A systematic workflow for identifying, validating, and executing
> optimal deep ITM call debit spread entries with performance tracking.

---

## 🎯 Daily Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MORNING ROUTINE (5-10 min)                      │
├─────────────────────────────────────────────────────────────────────┤
│  1. Check Market Regime  →  bun run regime                         │
│  2. Sector Rotation      →  bun run sectors                        │
│  3. Earnings Calendar    →  bun run earnings --watchlist           │
│  4. Watchlist Alerts     →  bun run watchlist check                │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    SCAN FOR OPPORTUNITIES (5-15 min)               │
├─────────────────────────────────────────────────────────────────────┤
│  5. Full Scan            →  bun run scan-all --list sp500          │
│  6. Find Spreads         →  bun run scan-spreads --from-scan       │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    DEEP ANALYSIS (5-10 min per ticker)             │
├─────────────────────────────────────────────────────────────────────┤
│  7. AI Analysis          →  bun run analyze <TICKER>               │
│  8. Validate Entry       →  Check all criteria                     │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    EXECUTE (if criteria met)                       │
├─────────────────────────────────────────────────────────────────────┤
│  9. Enter Position       →  Execute in broker                      │
│  10. Add to Watchlist    →  bun run watchlist add <TICKER>         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Check Market Regime 🌡️

```bash
bun run regime
```

**What to look for:**

| Regime      | Action                     | Min Score | Position Size |
| ----------- | -------------------------- | --------- | ------------- |
| 🟢 BULL     | Trade normally             | 65        | 100%          |
| 🟡 CAUTION  | Grade A setups only        | 80        | 50%           |
| 🔴 BEAR     | Cash or defensive only     | 85+       | 25%           |
| ⛔ NO-TRADE | Wait (VIX > 35, SPY crash) | N/A       | 0%            |

**Key metrics:**

- **Chop Index**: < 40 = trending, > 60 = choppy
- **ADX**: > 25 = trend confirmed
- **Breadth**: > 50% = healthy market participation

---

## Step 2: Sector Rotation Analysis 📊

```bash
bun run sectors
```

**Focus areas:**

- ✅ **LEADING** sectors: Prioritize stocks in these sectors
- ↗️ **ROTATING IN**: Watch for emerging opportunities
- ⬇️ **LAGGING**: Avoid or reduce exposure

**Example output interpretation:**

```
Healthcare (XLV) - LEADING  → Focus on: UNH, JNJ, ABBV
Materials (XLB)  - Rotating  → Watch: FCX, NUE
Utilities (XLU)  - LAGGING   → Avoid: NEE, DUK
```

---

## Step 3: Earnings Calendar 📅

```bash
# Check watchlist
bun run earnings --watchlist

# Check potential trades
bun run earnings --tickers AAPL,NVDA,MSFT
```

**Critical rules:**

| Days Until Earnings | Action                       |
| ------------------- | ---------------------------- |
| ≤ 7 days            | 🔴 CLOSE existing positions  |
| 7-14 days           | 🟡 Plan exit, no new entries |
| 14-30 days          | 🟢 OK to enter (plan exit)   |
| > 30 days           | ✅ Safe for new positions    |

---

## Step 4: Check Watchlist Alerts 🔔

```bash
bun run watchlist check
```

**Alert types:**

- **↑ TRIGGERED**: Price hit your upside target (breakout)
- **↓ TRIGGERED**: Price hit your downside target (pullback entry)
- **% to target**: How close price is to your alert level

---

## Step 5: Full Opportunity Scan 🔍

```bash
# 🎯 RECOMMENDED: Scan your watchlist only (fast!)
bun run cds:scan-all --watchlist

# Re-scan tickers that scored well recently
bun run cds:scan-all --from-signals --signal-days 7

# Quick summary mode (full S&P 500 - slow)
bun run cds:scan-all --list sp500 --summary

# Focused lists
bun run cds:scan-all --list mega    # Top 10 liquid names
bun run cds:scan-all --list growth  # Tech/growth stocks
```

**Ticker sources (choose one):**

| Flag                               | Description                          | Count  | Speed     |
| ---------------------------------- | ------------------------------------ | ------ | --------- |
| `--watchlist`                      | Your curated watchlist               | ~10    | ⚡ Fast   |
| `--from-db`                        | Top scorers from stock_opportunities | ~50    | ⚡ Fast   |
| `--from-tickers`                   | Master tickers table                 | ~2000  | 🐢 Slow   |
| `--from-tickers --exchange NASDAQ` | NASDAQ tickers only                  | ~821   | 🐌 Medium |
| `--from-tickers --exchange NYSE`   | NYSE tickers only                    | ~1000+ | 🐌 Medium |
| `--from-signals`                   | Recent signals (cds_signals)         | varies | ⚡ Fast   |
| `--list sp500`                     | Hardcoded S&P 500 list               | ~503   | 🐢 Slow   |
| `--tickers X,Y,Z`                  | Specific tickers                     | custom | ⚡ Fast   |

**Filter options:**

| Option              | Description                       | Default |
| ------------------- | --------------------------------- | ------- |
| `--exchange <name>` | Filter by exchange (NYSE, NASDAQ) | all     |
| `--sector <name>`   | Filter by sector (if populated)   | all     |
| `--db-limit <n>`    | Max tickers to pull               | 500     |
| `--signal-days <n>` | Days of history                   | 30      |

**Decision types:**

| Decision    | Meaning                                  | Action              |
| ----------- | ---------------------------------------- | ------------------- |
| ✅ ENTER    | All criteria met, above MAs, good timing | Proceed to analysis |
| 📊 SCALE_IN | Near MA200 reclaim, recovery in progress | 50% now, 50% later  |
| ⏳ WAIT     | Good stock but timing/trend not ideal    | Add to watchlist    |
| ❌ PASS     | Multiple issues, not worth pursuing      | Skip                |

---

## Step 6: Find Viable Spreads 💰

```bash
# From scan results
bun run scan-spreads --from-scan

# Specific tickers
bun run scan-spreads --tickers NVDA,META,AAPL

# With width options
bun run scan-spreads --widths all --relaxed
```

**Spread criteria (strict mode):**

| Metric   | Minimum | Preferred | Excellent |
| -------- | ------- | --------- | --------- |
| Cushion  | 5%      | 7%        | 10%+      |
| PoP      | 70%     | 75%       | 80%+      |
| Return   | 20%     | 25%       | 30%+      |
| Debit %  | 55-80%  | 60-75%    | 65-70%    |
| Open Int | 10      | 50        | 100+      |

---

## Step 7: Deep AI Analysis 🤖

```bash
bun run analyze NVDA
```

**Key sections to review:**

1. **52-Week Context**: Position in range, distance from MAs
2. **Relative Strength**: vs SPY performance
3. **Momentum**: Price/RSI/MACD trends
4. **Bull/Bear Case**: AI-generated thesis
5. **Entry Recommendation**: AI's verdict

---

## Step 8: Entry Validation Checklist ✅

Before entering any position, verify:

### Technical (all must pass)

- [ ] Price above MA200 (or within 5% showing recovery)
- [ ] Price above MA50 (short-term trend)
- [ ] RSI between 35-55 (ideal entry zone)
- [ ] No bearish divergence

### Fundamental

- [ ] Analyst consensus bullish (> 70%)
- [ ] No negative earnings surprise history
- [ ] Healthy sector (not lagging)

### Risk Management

- [ ] No earnings within 14 days
- [ ] Spread cushion ≥ 5%
- [ ] Position size per regime guidelines
- [ ] Total portfolio exposure < 65%

---

## Step 9: Execute Position 📈

**Entry checklist:**

1. Verify current price matches analysis
2. Place limit order at calculated debit (not market)
3. Set alerts for:
   - 50% profit target
   - Breakeven level
   - Support breakdown

**Position sizing:**

```
Account: $10,000
Max risk per trade: 2% = $200
Spread cost: $400 per contract
Max contracts: $200 / $400 = 0.5 → 1 contract
```

**Record the trade for performance tracking:**

```bash
# After executing in your broker
bun run cds:trade entry NVDA --spread 180/190 --debit 6.50 --quantity 2
```

---

## Step 10: Post-Entry Management 📋

```bash
# Add to watchlist with targets
bun run watchlist add NVDA --above 200 --below 165 \
  --notes "170/175 spread, 30 DTE, 7.9% cushion"
```

**Daily monitoring:**

- Check `watchlist check` for alerts
- Review position if stock drops to support
- Exit at 50% profit or before earnings

**When exiting:**

```bash
# Record exit for performance tracking
bun run cds:trade exit NVDA --credit 8.50 --reason target --notes "Hit 50% profit target"
```

Exit reasons: `target`, `stop`, `time`, `earnings`, `manual`

---

## 🏆 Perfect Entry Criteria Summary

The **ideal opportunity** has ALL of these:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Market Regime: BULL or CAUTION (not BEAR/NO-TRADE)             │
│  ✅ Sector: LEADING or ROTATING IN (not LAGGING)                   │
│  ✅ Earnings: > 14 days away                                        │
│  ✅ Decision: ENTER (not WAIT/PASS)                                 │
│  ✅ Score: ≥ 75 (or ≥ 80 in CAUTION regime)                        │
│  ✅ RSI: 35-50 (ideal entry zone)                                   │
│  ✅ Price: Above MA200 and MA50                                     │
│  ✅ Spread: ≥ 5% cushion, ≥ 70% PoP, ≥ 20% return                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Weekly Review

```bash
# Check strategy performance
bun run cds:performance

# Performance by signal grade
bun run cds:performance grades

# Performance by market regime
bun run cds:performance regimes

# Review historical backtest
bun run backtest --days 7

# Review sector rotation
bun run sectors

# Update watchlist
bun run watchlist check
```

---

## Quick Reference Commands

> **Note**: Run all commands from monorepo root

| Task                      | Command                                                       |
| ------------------------- | ------------------------------------------------------------- |
| **Daily briefing**        | `bun run cds:briefing`                                        |
| Morning check             | `bun run cds:regime && bun run cds:sectors`                   |
| **Watchlist scan (fast)** | `bun run cds:scan-watchlist`                                  |
| **Top DB scorers (fast)** | `bun run cds:scan-db`                                         |
| NASDAQ scan (medium)      | `bun run cds:scan-nasdaq`                                     |
| NYSE scan (medium)        | `bun run cds:scan-nyse`                                       |
| Full universe (~2000)     | `bun run cds:scan-universe`                                   |
| Re-scan recent signals    | `bun run cds:scan-all --from-signals`                         |
| Hardcoded S&P 500         | `bun run cds:scan-all --list sp500`                           |
| Quick scan                | `bun run cds --list mega`                                     |
| Find spreads              | `bun run cds:spreads --from-scan`                             |
| Deep analysis             | `cd cds-engine-strategy && bun run analyze TICKER`            |
| Check earnings            | `bun run cds:earnings`                                        |
| Manage watchlist          | `bun run cds:watchlist show`                                  |
| Check watchlist alerts    | `bun run cds:watchlist check`                                 |
| Sector analysis           | `bun run cds:sectors`                                         |
| **Record trade entry**    | `bun run cds:trade entry TICKER --spread X/Y --debit 5.00`    |
| **Record trade exit**     | `bun run cds:trade exit TICKER --credit 7.00 --reason target` |
| **View recent signals**   | `bun run cds:trade list`                                      |
| **Strategy performance**  | `bun run cds:performance`                                     |
| Performance by grade      | `bun run cds:performance grades`                              |
| Performance by regime     | `bun run cds:performance regimes`                             |

---

## 🚨 Red Flags - DO NOT TRADE

- ❌ Market regime is BEAR or NO-TRADE
- ❌ VIX > 35
- ❌ Earnings within 7 days
- ❌ Stock below MA200 (unless SCALE_IN signal)
- ❌ RSI > 70 (overbought)
- ❌ Sector is LAGGING
- ❌ Spread cushion < 5%
- ❌ Portfolio already at 65%+ deployment

---

---

## 📈 Signal Performance Tracking

Signals are **automatically captured** when you run `scan-all`. The system:

1. **Auto-logs every signal** with score, regime, spread data
2. **Handles multiple scans/day** - keeps the best score for each ticker
3. **Tracks outcomes** only when you record a trade entry

**Workflow:**

```
scan-all → signals auto-captured → trade entry (manual) → exit (manual) → analyze
```

**Key commands:**

```bash
# View recent signals you could trade
bun run cds:trade list

# Record entry after executing in broker
bun run cds:trade entry NVDA --spread 180/190 --debit 6.50

# Record exit when closing position
bun run cds:trade exit NVDA --credit 8.50 --reason target

# Analyze your performance over time
bun run cds:performance
```

**Performance insights:**

- Which signal grades (A/B/C/D) perform best?
- Which market regimes favor CDS strategy?
- What's your actual win rate vs theoretical?

---

_Last updated: 2026-01-07 | Scanner v2.7.0_
