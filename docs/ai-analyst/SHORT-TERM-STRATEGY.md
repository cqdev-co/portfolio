# Short-Term Trading Strategy

SPY/QQQ 1-3 day swing trades for capital-conscious traders.

## Overview

The `short-term` command scans SPY and QQQ for high-probability
entry points using mean reversion and technical signals. Designed
for traders with limited capital who cannot afford big losses.

## Quick Start

```bash
cd ai-analyst
bun run short-term
bun run short-term --account 500
```

## Strategy Philosophy

**Core Principle**: Wait for high-probability setups only.

| Parameter      | Value          | Rationale                     |
| -------------- | -------------- | ----------------------------- |
| Instruments    | SPY, QQQ only  | Maximum liquidity             |
| Holding Period | 1-3 days       | Minimize overnight risk       |
| Position Type  | Debit spreads  | Defined, limited risk         |
| DTE            | 5-10 days      | Weeklies with time buffer     |
| Max Risk       | 15% of account | Survive losing streaks        |
| Profit Target  | 35%            | Take profits, don't be greedy |
| Stop Loss      | 40%            | Cut losers quickly            |

## Entry Signals

The scanner evaluates multiple factors and generates a confidence
score (0-100):

### Primary Triggers

1. **RSI Oversold (< 35)**
   - +25 points
   - Mean reversion bounce likely
   - Most reliable signal

2. **VWAP Deviation (> 1.5% below)**
   - +15 points
   - Price extended, snap-back expected

3. **Support Level Proximity (< 1%)**
   - +15 points
   - 20-day low acting as floor

### Secondary Factors

- **Trend Alignment** (+10 if bullish, -5 if bearish)
- **VIX Level** (elevated = better premium, extreme = caution)
- **MA200 Position** (+10 above, -10 below)

### Signal Levels

| Score | Signal     | Action                   |
| ----- | ---------- | ------------------------ |
| 80+   | STRONG_BUY | Enter immediately        |
| 65-79 | BUY        | Enter with standard size |
| 45-64 | WAIT       | Hold for better setup    |
| < 45  | AVOID      | Do not trade             |

## Trade Structure

### Recommended: ITM Call Debit Spread

The spread width adjusts based on your account size:

| Account Size  | Max Risk (15%) | Spread Width | Est. Cost |
| ------------- | -------------- | ------------ | --------- |
| $2,500+       | $375+          | $5           | ~$350     |
| $1,400-$2,499 | $210-$374      | $3           | ~$210     |
| $950-$1,399   | $140-$209      | $2           | ~$140     |
| < $950        | < $140         | $1           | ~$70      |

```
Example for SPY at $689 ($1,500 account):
- Buy: $684 Call (ITM)
- Sell: $687 Call (ATM)
- Width: $3 (auto-sized for account)
- Cost: ~$210/contract (70% of width)
- Max Profit: ~$90/contract
- DTE: Next Friday expiration
```

### Why Debit Spreads?

1. **Defined Risk** - Max loss is the debit paid
2. **No Margin Issues** - Works in small accounts
3. **Time Decay** - ITM spreads have less theta risk
4. **High Probability** - 60-70% win rate when entries are selective

## Risk Management

### Position Sizing

```
Max Risk = Account Size × 15%

Example ($1,500 account):
- Max Risk = $1,500 × 0.15 = $225
- If spread costs $350, cannot take trade
- If spread costs $175, can take 1 contract
```

### Exit Rules

| Condition   | Action                 |
| ----------- | ---------------------- |
| +35% gain   | Close position         |
| -40% loss   | Close position         |
| 3 days held | Reassess, likely close |
| Major news  | Close before event     |

### Capital Preservation Tips

1. **Never risk more than 15%** on a single trade
2. **Take the 35%** - Don't hold for max profit
3. **Cut at 40%** - A -40% loss needs +67% to recover
4. **Skip uncertain setups** - Patience is an edge

## VIX Awareness

| VIX Level | Implication    | Action                     |
| --------- | -------------- | -------------------------- |
| < 15      | Low volatility | Smaller moves expected     |
| 15-18     | Normal         | Standard position sizing   |
| 18-25     | Elevated       | Better premium, watch size |
| > 25      | Extreme        | Reduce size or skip trades |

## Example Output

```
  ⚡ SHORT-TERM TRADE SCANNER
  SPY/QQQ 1-3 Day Swing Trades
  ═══════════════════════════════════

  ● MARKET OPEN   VIX: 16.2 (normal)
  Normal market conditions

  ──────────────────────────────────
  SPY  $589.45  +0.32%

  Signal: BUY  (72% confidence)

  RSI: 33  VWAP: -1.8%  Trend: 📈
  Support: $585.20 (0.7% away)  Resistance: $595.80

  ✓ RSI oversold at 33 - bounce likely
  ✓ 1.8% below VWAP - mean reversion setup
  ✓ Near 20-day support ($585.20)

  💡 Suggested Trade:
     Buy $585C / Sell $590C
     Cost: $350 → Target: $472 (+35%) | Stop: $210 (-40%)
     5-10 DTE (next Friday expiration)

  ──────────────────────────────────
  QQQ  $512.30  -0.15%

  Signal: WAIT  (58% confidence)

  RSI: 48  VWAP: +0.3%  Trend: ➡️
  Support: $505.10 (1.4% away)  Resistance: $520.40

  ⚠ No clear signal - wait for pullback

  ═══════════════════════════════════

  🟡 ENTRY OPPORTUNITY (be selective)

  📋 RISK RULES
  Max risk per trade: $225 (15% of $1500)
  Profit target: 35% | Stop loss: 40%
  Hold time: 1-3 days max

  🤖 AI INSIGHT
  ──────────────────────────────────
  SPY showing oversold bounce setup near 20-day support.
  RSI at 33 with VWAP deviation suggests mean reversion
  likely within 1-2 days. QQQ lacks conviction - skip it.
  Recommendation: Enter SPY $585/$590 spread, target 35%
  profit by Wednesday. Set hard stop at -40%.
```

## CLI Options

| Flag                   | Description               | Default |
| ---------------------- | ------------------------- | ------- |
| `--ai-mode <mode>`     | Ollama mode (local/cloud) | cloud   |
| `--ai-model <model>`   | Override AI model         | -       |
| `-a, --account <size>` | Account size in dollars   | 1500    |
| `-v, --verbose`        | Show detailed analysis    | false   |

## When NOT to Trade

1. **Before major events** - FOMC, CPI, Jobs Report
2. **VIX > 30** - Too volatile, wide spreads
3. **No clear signal** - WAIT is a valid trade
4. **After a loss** - Don't revenge trade
5. **Market closed** - Don't chase after-hours

## Integration with 30-45 DTE Strategy

This short-term strategy **complements** your existing
30-45 DTE deep ITM call debit spreads:

| Strategy   | Use When                                |
| ---------- | --------------------------------------- |
| 30-45 DTE  | Bullish conviction on individual stocks |
| Short-Term | Quick tactical plays on index pullbacks |

Both use defined-risk debit spreads, but different timeframes
and instruments. Run both scans for a complete picture.

## Technical Implementation

The scanner uses:

- RSI (14-period) for oversold/overbought
- VWAP approximation (5-day typical price average)
- EMA(9) and SMA(20) for trend detection
- 20-day high/low for support/resistance
- VIX for volatility regime

## Best Practices

1. **Run the scanner daily** at market open
2. **Wait for STRONG_BUY or BUY** signals only
3. **Don't chase** - if you miss an entry, wait
4. **Log your trades** with `bun run log`
5. **Review weekly** - adjust thresholds if needed

---

_Strategy added December 2024_
