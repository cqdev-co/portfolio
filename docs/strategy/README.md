# Deep ITM Call Debit Spread Strategy

> **Business Strategy Documentation for Small Account Trading**

This document describes the core trading strategy, risk management framework,
and systematic approach to building wealth through Deep ITM Call Debit Spreads.

## Table of Contents

- [Strategy Overview](#strategy-overview)
- [Why This Strategy](#why-this-strategy)
- [Entry Criteria](#entry-criteria)
- [Exit Rules](#exit-rules)
- [Position Sizing](#position-sizing)
- [Risk Management](#risk-management)
- [Business Plan](#business-plan)
- [Tools & Infrastructure](#tools--infrastructure)
- [Performance Tracking](#performance-tracking)

---

## Strategy Overview

### What Is a Deep ITM Call Debit Spread?

A **Call Debit Spread** (also called a Bull Call Spread) is an options strategy:

```
Buy: Lower strike call (long leg) - Deep In The Money
Sell: Higher strike call (short leg) - At or Near The Money

Cost: Net debit paid = Long premium - Short premium
Max Profit: Strike width - Net debit
Max Loss: Net debit paid (defined risk)
```

**Example:**

```
Stock: AAPL @ $188
Buy: $180 Call @ $10.00 (Deep ITM, ~80 delta)
Sell: $185 Call @ $6.00 (Near ATM, ~55 delta)

Net Debit: $4.00 ($400 per contract)
Max Profit: $1.00 ($100 per contract)
Breakeven: $184.00
```

### Why "Deep ITM"?

| Long Strike Position | Delta  | Behavior        | Risk      |
| -------------------- | ------ | --------------- | --------- |
| ATM                  | ~50    | Highly volatile | High      |
| Slightly ITM         | ~60-70 | Moderate        | Medium    |
| **Deep ITM**         | ~75-85 | Stock-like      | **Lower** |

Deep ITM calls have:

- **Higher intrinsic value** (less time decay impact)
- **Lower extrinsic value** (less premium to lose)
- **Higher delta** (moves more with stock)
- **Higher probability of profit** (already in the money)

---

## Why This Strategy

### Perfect for Small Accounts

| Challenge           | How Deep ITM CDS Solves It                   |
| ------------------- | -------------------------------------------- |
| Limited capital     | $300-500 per position vs $10,000+ for shares |
| PDT rule (<$25k)    | Options don't trigger PDT                    |
| Can't afford losses | Defined risk — max loss is known             |
| Need leverage       | 5-10x leverage without margin                |
| Theta decay         | Deep ITM minimizes time decay                |

### Risk/Reward Profile

```
Typical Trade:
- Debit: $350 (max loss)
- Max Profit: $130 (37% return)
- Probability of Profit: 65-75%
- Hold Time: 7-21 days
```

### Compared to Alternatives

| Strategy         | Capital Needed | Max Loss  | Complexity |
| ---------------- | -------------- | --------- | ---------- |
| Buy Stock        | $18,800        | Unlimited | Low        |
| Buy Call         | $1,000         | 100%      | Low        |
| Sell Put         | $18,800 margin | High      | Medium     |
| **Deep ITM CDS** | **$350**       | **$350**  | **Medium** |

---

## Entry Criteria

> **Rule: ALL criteria must pass. No exceptions.**

### The Checklist

```yaml
# From strategy.config.yaml
entry:
  trend:
    above_ma200: true # REQUIRED
    above_ma50: true # PREFERRED

  momentum:
    rsi_min: 30 # Not oversold
    rsi_max: 55 # Not overbought

  cushion:
    minimum_pct: 7.0 # HARD FLOOR

  volatility:
    iv_max_pct: 50 # Options not expensive
    avoid_if_iv_above: 60 # HARD CEILING

  earnings:
    min_days_until: 14 # No earnings lottery

  sentiment:
    analyst_bullish_min_pct: 70 # Smart money agrees
```

### Visual Decision Tree

```
Is price > MA200?
    ├─ NO → PASS (wait for uptrend)
    └─ YES → Continue
        │
        Is RSI between 30-55?
        ├─ NO → PASS (wrong momentum)
        └─ YES → Continue
            │
            Is cushion ≥ 7%?
            ├─ NO → PASS (too risky)
            └─ YES → Continue
                │
                Is IV < 50%?
                ├─ NO → PASS (too expensive)
                └─ YES → Continue
                    │
                    Days to earnings > 14?
                    ├─ NO → PASS (earnings risk)
                    └─ YES → ✅ ENTER TRADE
```

### Why Each Criterion Matters

| Criterion            | Purpose                  | What Happens If Ignored       |
| -------------------- | ------------------------ | ----------------------------- |
| Above MA200          | Confirms uptrend         | Fighting the trend = losses   |
| RSI 30-55            | Optimal entry timing     | Chasing or catching knives    |
| Cushion ≥7%          | Room to be wrong         | One bad day wipes profit      |
| IV <50%              | Fair option pricing      | Paying premium for volatility |
| 14+ days to earnings | Avoid binary events      | 50/50 gambling                |
| Analyst ≥70% bullish | Institutional validation | Swimming against smart money  |

---

## Exit Rules

### Profit Taking

```yaml
exit:
  profit:
    target_pct: 35 # Take profits at +35%
```

**Why 35%?**

- Spreads rarely hit max profit before expiration
- 35% captures most of the move
- Frees capital for next trade
- Prevents giving back gains

### Stop Loss

```yaml
exit:
  stop_loss:
    max_loss_pct: 40 # Cut losses at -40%
```

**Why 40%?**

- Preserves capital for recovery
- A 40% loss needs 67% gain to recover
- A 100% loss needs new capital
- Cutting early preserves optionality

### Time-Based Exits

```yaml
exit:
  time:
    max_hold_days: 30 # Reassess after 30 days
    exit_before_expiry_days: 7 # Never hold to expiration
```

### Exit Decision Matrix

| Condition          | Action                           |
| ------------------ | -------------------------------- |
| +35% profit        | **CLOSE** — Take the win         |
| -40% loss          | **CLOSE** — Cut the loss         |
| 7 days to expiry   | **CLOSE** — Avoid gamma risk     |
| Earnings in 3 days | **CLOSE** — Avoid binary event   |
| 30 days held, flat | **REASSESS** — Is thesis intact? |

---

## Position Sizing

### The Kelly-Adjusted Framework

Full Kelly Criterion suggests 57% position size at 75% win rate.
**We use ~25-30% (half Kelly) for safety.**

### Scaling With Account Size

| Account | Max Position | Max Positions | Total Deployed |
| ------- | ------------ | ------------- | -------------- |
| $2,500  | $500 (20%)   | 4             | $2,000 (80%)   |
| $5,000  | $750 (15%)   | 6             | $3,250 (65%)   |
| $10,000 | $1,200 (12%) | 8             | $6,500 (65%)   |
| $25,000 | $2,000 (8%)  | 12            | $16,000 (65%)  |

### Position Size Calculator

```
Max Position $ = Account Size × Max Position %

Example ($5,000 account):
  Max Position = $5,000 × 15% = $750

  If spread costs $400:
    Position Size = $400 / $5,000 = 8% ✅

  If spread costs $900:
    Position Size = $900 / $5,000 = 18% ❌ (exceeds 15%)
```

---

## Risk Management

### Circuit Breakers

Automatic trading pauses to prevent emotional decisions:

| Trigger               | Action                   | Duration        |
| --------------------- | ------------------------ | --------------- |
| 3 consecutive losses  | Pause trading            | 48 hours        |
| -20% monthly drawdown | Reduce position size 50% | Until month end |
| -30% monthly drawdown | Stop trading             | Until month end |

### Diversification Rules

```yaml
risk_management:
  correlation:
    max_same_sector: 3 # Max 3 positions in same sector
    max_correlated_positions: 4 # Max 4 highly correlated trades
```

### Blacklist

Tickers that have historically caused losses or don't fit the strategy:

```yaml
blacklist:
  tickers:
    - CRWD # Learned lesson: poor entries, revenge trading
```

---

## Business Plan

### Goal

**Build a $100,000 trading account that generates $1,000/month passive income.**

### Timeline (Aggressive-Smart)

| Year | Contributions | Trading P&L | Year-End Balance |
| ---- | ------------- | ----------- | ---------------- |
| 1    | $6,000        | $4,800      | $13,300          |
| 2    | $6,000        | $8,000      | $27,300          |
| 3    | $6,000        | $13,000     | $46,300          |
| 4    | $6,000        | $22,000     | $74,300          |
| 4.5  | $3,000        | $14,000     | **$100,000**     |

### Assumptions

- **Win Rate**: 75% (achievable with strict criteria)
- **Avg Win**: $70
- **Avg Loss**: $50
- **Trades/Month**: 8-10
- **Monthly Contribution**: $500

### Income Phase (Post-$100k)

| Withdrawal Rate | Monthly Income | Annual Return Needed |
| --------------- | -------------- | -------------------- |
| 1%              | $1,000         | 12% to stay flat     |
| 1.5%            | $1,500         | 18% to stay flat     |
| 2%              | $2,000         | 24% to stay flat     |

**Sustainable target: $1,000/month (12% annual) with continued growth.**

---

## Tools & Infrastructure

### Scanner Pipeline

```
screen-ticker (scan 3,794 tickers)
    ↓
Strategy Config Validation
    ↓
AI Analyst (Victor) Verification
    ↓
Unusual Options Scanner (smart money)
    ↓
ENTER/WAIT/PASS Decision
    ↓
Log to Supabase (strategy_signals table)
```

### Services

| Service                    | Purpose            | Integration                |
| -------------------------- | ------------------ | -------------------------- |
| `cds-engine-strategy`      | Find opportunities | Reads strategy.config.yaml |
| `ai-analyst`               | Validate entries   | Reads strategy.config.yaml |
| `unusual-options-service`  | Smart money flow   | Additional signal          |
| `spread_quant_analysis.py` | Track performance  | Validates against config   |
| `frontend`                 | Dashboard          | Displays signals           |

### Configuration

All services read from `strategy.config.yaml`:

```python
# Validate a trade (Python)
from lib.utils.strategy_config import validate_entry

result = validate_entry(
    price=188.61,
    ma200=175.00,
    rsi=42,
    cushion_pct=8.5,
)
```

---

## Performance Tracking

### What We Track

Every trade logs:

```yaml
entry_conditions:
  - price, ma200, ma50
  - rsi, cushion_pct
  - iv, iv_rank
  - days_to_earnings
  - analyst_bullish_pct
  - validation_score
  - passed_criteria: true/false

outcome:
  - entry_date, exit_date
  - pnl_dollars, pnl_pct
  - days_held
  - exit_reason (target/stop/time/earnings)
```

### Analysis Commands

```bash
# Show current trade database
python scripts/spread_quant_analysis.py show

# Run correlation analysis
python scripts/spread_quant_analysis.py analyze

# Check data coverage
python scripts/spread_quant_analysis.py coverage

# Analyze open positions
python scripts/spread_quant_analysis.py open
```

### Key Metrics

| Metric        | Target | Current |
| ------------- | ------ | ------- |
| Win Rate      | ≥70%   | —       |
| Profit Factor | ≥1.5   | —       |
| Sharpe Ratio  | ≥1.0   | —       |
| Max Drawdown  | ≤25%   | —       |
| Avg Days Held | 10-20  | —       |

---

## Quick Reference Card

### Entry Checklist

```
□ Price > MA200
□ Price > MA50 (preferred)
□ RSI between 30-55
□ Cushion ≥ 7%
□ IV < 50%
□ Days to earnings > 14
□ Analyst bullish ≥ 70%
□ Position size ≤ 15-20%
□ Not in blacklist

ALL boxes checked? → ENTER
Any box unchecked? → NO TRADE
```

### Exit Checklist

```
□ Hit +35% profit → CLOSE
□ Hit -40% loss → CLOSE
□ 7 days to expiry → CLOSE
□ Earnings in 3 days → CLOSE
□ 3 losses in a row → PAUSE 48h
```

### Position Size Quick Calc

```
$2,500 account → $500 max per trade
$5,000 account → $750 max per trade
$10,000 account → $1,200 max per trade
```

---

## Related Documentation

- [Strategy Config Reference](../lib/strategy-config.md)
- [AI Analyst Setup](../ai-analyst/README.md)
- [CDS Engine Strategy](../cds-engine-strategy/README.md)
- [Quant Analysis Guide](../scripts/spread-quant-analysis.md)

---

**Last Updated**: 2026-01-07
