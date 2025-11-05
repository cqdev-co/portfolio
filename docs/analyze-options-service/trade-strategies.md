# Trade Strategies Guide

**Last Updated:** November 5, 2025

---

## 🎯 Overview

This guide explains the two primary strategies the Analyze Options Service 
recommends: **Vertical Spreads** and **Naked Options**. Understand when 
to use each strategy and why.

---

## 📊 Strategy Comparison

| Factor | Vertical Spread | Naked Option |
|--------|----------------|--------------|
| **Cost** | 💰 Lower (net debit) | 💰💰💰 Higher (full premium) |
| **Max Profit** | ✅ Defined | 🚀 Unlimited (calls) |
| **Max Loss** | ✅ Defined (debit paid) | ⚠️ 100% (full premium) |
| **Risk/Reward** | 1:2 to 1:4 typical | 1:2 to 1:10+ |
| **Probability** | 📈 Higher (45-60%) | 📉 Lower (30-45%) |
| **Complexity** | 🔧 Moderate (2 legs) | 🔧 Simple (1 leg) |
| **Theta Decay** | ⏱ Moderate | ⏱⏱⏱ High |
| **Capital Req** | ✅ Smaller | ⚠️ Larger |
| **Best For** | Conservative/Defined risk | Aggressive/High conviction |

---

## 1️⃣ Vertical Spreads

### What is a Vertical Spread?

A vertical spread involves **buying and selling** options at different 
strikes but same expiration, creating a defined-risk, defined-reward trade.

**Two Types:**
1. **Bull Call Spread** - For bullish signals
2. **Bear Put Spread** - For bearish signals

---

### Bull Call Spread (Bullish Strategy)

**Structure:**
- **Buy:** Lower strike call (ATM or slightly OTM)
- **Sell:** Higher strike call (further OTM)

**Example:**
```
Stock: AAPL at $180
Signal: Grade A, Bullish, $500K premium flow

Buy:  1x $180 Call @ $5.00  (30 DTE)
Sell: 1x $185 Call @ $2.50  (30 DTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Debit: $2.50 per spread ($250/contract)
Max Profit: $2.50 per spread ($250/contract)
Max Loss:   $2.50 per spread ($250/contract)
R:R Ratio:  1:1

Break Even:  $182.50 (1.4% above current)
Probability: 52%
```

**When Max Profit Achieved:**
- Stock closes at or above $185 at expiration
- Both calls are ITM, spread = strike width

**When Max Loss Occurs:**
- Stock closes below $180 at expiration
- Both calls expire worthless

**P&L Diagram:**
```
         Profit
           │
       +$250├──────────────────────────────(max profit)
           │                       /
           │                    /
           │                 /
    $0 ────┼──────────────/──────(break-even at $182.50)
           │           /
           │        /
      -$250├─────/────────────────────────(max loss)
           │
           └─────────────────────────────▶ Stock Price
           $180      $182.50      $185
```

---

### Bear Put Spread (Bearish Strategy)

**Structure:**
- **Buy:** Higher strike put (ATM or slightly ITM)
- **Sell:** Lower strike put (further OTM)

**Example:**
```
Stock: TSLA at $240
Signal: Grade A, Bearish, $700K premium flow

Buy:  1x $240 Put @ $8.00  (30 DTE)
Sell: 1x $230 Put @ $4.50  (30 DTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Debit: $3.50 per spread ($350/contract)
Max Profit: $6.50 per spread ($650/contract)
Max Loss:   $3.50 per spread ($350/contract)
R:R Ratio:  1:1.86

Break Even:  $236.50 (1.5% below current)
Probability: 48%
```

**When Max Profit Achieved:**
- Stock closes at or below $230 at expiration
- Spread = full strike width

**When Max Loss Occurs:**
- Stock closes above $240 at expiration
- Both puts expire worthless

---

### Vertical Spread Advantages ✅

1. **Defined Risk**: You know max loss upfront
2. **Lower Cost**: Net debit is smaller than naked option
3. **Higher Probability**: Closer break-even point
4. **Capital Efficiency**: Can deploy more spreads with same capital
5. **Theta Mitigation**: Short leg offsets some time decay

### Vertical Spread Disadvantages ❌

1. **Capped Upside**: Max profit is limited by strike width
2. **Two-Legged**: Slightly more complex execution
3. **Miss Huge Moves**: Won't capture 10x gains on explosive moves
4. **Liquidity**: Need tight spreads on both strikes

---

### When to Use Vertical Spreads?

**✅ USE VERTICAL SPREADS WHEN:**

- Signal grade is **A or B** (not top-tier S grade)
- Capital is limited or you want to trade multiple signals
- Break-even requires **>20% move** (safer to cap max loss)
- You want **defined risk** (know exact max loss)
- You're building a **portfolio of positions** (diversification)
- **Conservative risk tolerance**

**❌ SKIP VERTICAL SPREADS WHEN:**

- S-tier signal with imminent catalyst (use naked for unlimited upside)
- Strike width creates **poor risk/reward** (< 1:2 ratio)
- **Illiquid** short strike (wide bid-ask spread)
- You have high conviction for **explosive move** (>50%)

---

## 2️⃣ Naked Options (Long Calls/Puts)

### What is a Naked Option?

A **naked option** (also called **long option**) is buying a call or put 
without any offsetting position. You pay full premium but get unlimited 
upside (calls) or large upside (puts).

---

### Naked Call (Bullish Strategy)

**Structure:**
- **Buy:** Single call option
- **No hedge:** Full premium at risk

**Example:**
```
Stock: NUAI at $4.20
Signal: Grade S, Bullish, $850K premium flow, Earnings in 12 days

Buy: 1x $5 Call @ $0.65  (30 DTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Premium Cost:   $65 per contract
Max Profit:     Unlimited 🚀
Max Loss:       $65 (100% of premium)

Break Even:     $5.65 (34.5% above current)
Probability:    35% (delta = 0.35)

Potential Gains:
- Stock → $6:    +$35  (54% gain)
- Stock → $7:    +$135 (208% gain)
- Stock → $8:    +$235 (362% gain)
- Stock → $10:   +$435 (669% gain)
```

**P&L Diagram:**
```
         Profit
           │
           │                           /
           │                       /   (unlimited upside)
           │                   /
           │               /
    $0 ────┼───────────/────────────(break-even at $5.65)
           │       /
           │    /
       -$65├─/──────────────────────(max loss)
           │
           └─────────────────────────▶ Stock Price
           $4.20        $5.65        $7+
```

---

### Naked Put (Bearish Strategy)

**Structure:**
- **Buy:** Single put option
- **No hedge:** Full premium at risk

**Example:**
```
Stock: SPY at $430
Signal: Grade A, Bearish, $1.2M premium flow

Buy: 1x $425 Put @ $6.80  (21 DTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Premium Cost:   $680 per contract
Max Profit:     $41,820 (if stock → $0)
Max Loss:       $680 (100% of premium)

Break Even:     $418.20 (2.7% below current)
Probability:    42% (delta = -0.42)

Potential Gains:
- Stock → $420:  +$200  (29% gain)
- Stock → $410:  +$820  (121% gain)
- Stock → $400:  +$1,820 (268% gain)
```

---

### Naked Options Advantages ✅

1. **Unlimited Upside**: Can capture 10x, 20x+ gains on huge moves
2. **Simple Execution**: Single leg, easy to manage
3. **Leverage**: Small premium controls large stock position
4. **Best for Catalysts**: Earnings, FDA approvals, partnerships
5. **Clearer Greeks**: Easy to understand delta/theta

### Naked Options Disadvantages ❌

1. **High Cost**: Full premium paid (no offset from short leg)
2. **100% Loss Risk**: Can lose entire premium if wrong
3. **Aggressive Theta**: Time decay eats value daily
4. **Lower Probability**: Further OTM = lower chance of profit
5. **Emotional Pressure**: Watching premium decay is stressful

---

### When to Use Naked Options?

**✅ USE NAKED OPTIONS WHEN:**

- Signal grade is **S** (top-tier, high conviction)
- Near-term **catalyst** (earnings, FDA, product launch)
- Insider-type play with **abnormal flow** (>$1M premium)
- Premium is **reasonable** (< $500/contract, < 5% of account)
- Delta is in **sweet spot** (0.30-0.50)
- You believe stock could make **explosive move** (>30%)
- **Aggressive risk tolerance**

**❌ SKIP NAKED OPTIONS WHEN:**

- Premium > **$1,000** per contract (too expensive)
- DTE < **14 days** (extreme theta decay)
- IV Rank > **70** (overpaying for volatility)
- Delta < **0.20** or > **0.70** (too speculative or too expensive)
- **No clear catalyst** or low conviction
- You have **multiple positions** and need capital efficiency

---

## 🔀 Strategy Decision Tree

```
                    ┌──────────────────┐
                    │ Unusual Options  │
                    │     Signal       │
                    └────────┬─────────┘
                             │
                    ┌────────▼────────┐
                    │ What is signal  │
                    │     grade?      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
         │ S Grade │    │ A Grade │   │ B Grade │
         └────┬────┘    └────┬────┘   └────┬────┘
              │              │              │
              │              │              │
    ┌─────────▼──────┐       │              │
    │ Near catalyst? │       │              │
    └─────────┬──────┘       │              │
              │              │              │
         Yes  │  No          │              │
              │              │              │
    ┌─────────▼──────┐       │              │
    │Premium < $500? │       │              │
    └─────────┬──────┘       │              │
              │              │              │
         Yes  │  No          │              │
              │              │              │
    ┌─────────▼──────────────▼──────────────▼─────┐
    │        Compare Expected Values:              │
    │  EV(naked) vs EV(spread)                     │
    └─────────┬────────────────────────────────────┘
              │
    ┌─────────▼────────┐
    │ If EV(naked) >   │
    │ 2x EV(spread)    │
    │ → NAKED CALL     │
    │ else             │
    │ → VERTICAL SPREAD│
    └──────────────────┘
```

---

## 💡 Pro Tips

### For Vertical Spreads

1. **Strike Selection**
   - Long strike: ATM or 1 strike OTM
   - Short strike: 5-10% OTM for optimal credit
   - Aim for 1:3 to 1:4 risk/reward ratio

2. **Width Selection**
   - Wider spreads = more profit potential but higher cost
   - Narrower spreads = cheaper but lower max profit
   - Sweet spot: $5-$10 width for most underlyings

3. **Liquidity Check**
   - Both strikes should have volume > 100
   - Both strikes should have OI > 500
   - Bid-ask spread < 5% of mid price

4. **Management**
   - Take profits at 50-75% of max gain
   - Close at 21 DTE to avoid gamma risk
   - Don't hold through expiration week

### For Naked Options

1. **Strike Selection**
   - Target delta: 0.30-0.50 (sweet spot)
   - 0.30 = 30% prob of profit, cheaper, more leverage
   - 0.50 = 50% prob of profit, expensive, less leverage

2. **DTE Selection**
   - Minimum: 14 days (avoid extreme theta)
   - Sweet spot: 21-45 days
   - Catalyst plays: Align with catalyst date + buffer

3. **Entry Timing**
   - Buy on **pullbacks** in strong trends
   - **After** initial unusual flow detection
   - **Before** catalyst (7-14 days out optimal)

4. **Exit Strategy**
   - **Winner**: Take profits at 50%, 100%, let runners
   - **Loser**: Cut at -50% (don't let it go to -100%)
   - **Time Stop**: Exit if no movement in 7 days

---

## 📊 Real-World Examples

### Example 1: Conservative Play (Vertical Spread)

**Scenario:**
- AAPL showing unusual call activity
- Grade A signal, $600K premium flow
- Current price: $180
- You have $10K account, 1.5% risk tolerance

**Analysis:**
```
Bull Call Spread: $180/$185 for 30 DTE
- Net Debit: $2.50 ($250/contract)
- Max Profit: $2.50 ($250/contract)
- R:R: 1:1
- P(Profit): 52%
- Expected Value: +$5 per contract

Position Size:
- 1.5% of $10K = $150 max risk
- No fractional contracts, so can't trade this
- Need to use 1 contract for $250 risk (2.5%)

Verdict: Skip or reduce risk tolerance
```

---

### Example 2: Aggressive Play (Naked Call)

**Scenario:**
- NUAI showing massive unusual activity
- Grade S signal, $850K premium flow
- Earnings in 12 days (potential catalyst)
- Current price: $4.20
- High conviction, willing to risk 2%

**Analysis:**
```
Naked Call: $5 Strike for 30 DTE
- Premium: $0.65 ($65/contract)
- Max Loss: $65 (100%)
- Break Even: $5.65 (34.5% move needed)
- P(Profit): 35%
- Potential: Unlimited

If stock moves to:
- $6:   +54% ($35 profit)
- $7:   +208% ($135 profit)
- $8:   +362% ($235 profit)
- $10:  +669% ($435 profit)

Position Size:
- 2% of $10K = $200 max risk
- Can buy 3 contracts for $195
- Max risk: $195 (1.95%)
- Max profit: Unlimited

Verdict: BUY 3 contracts
Risk/Reward: Great for S-grade + catalyst
```

---

## 🎯 Risk Management Rules

### Universal Rules (All Strategies)

1. **Never risk > 2% per trade** (even S-grade signals)
2. **Max 5 open positions** simultaneously
3. **Max 20% of account** in options (rest in stock/cash)
4. **Diversify by sector** (don't go all-in on tech)

### Vertical Spread Rules

1. **Min R:R of 1:2** (prefer 1:3 or better)
2. **Close at 50-75%** of max profit
3. **Don't hold past 21 DTE**
4. **Avoid earnings** unless specifically targeting it

### Naked Option Rules

1. **Max $500/contract** premium (preferably < $200)
2. **Stop loss at -50%** (don't hold to -100%)
3. **Take profits early** on big moves (50%, 100%)
4. **Min 14 DTE**, ideally 21-45 DTE

---

## 📈 Expected Performance

Based on unusual options signal backtests and options strategy studies:

### Vertical Spreads
- **Win Rate**: 60-70% (higher prob due to defined risk)
- **Avg Win**: +40% (capped by strike width)
- **Avg Loss**: -100% (but this is known upfront)
- **Expectancy**: +$20-40 per contract

**Why High Win Rate?**
- Closer break-even point
- Defined max loss helps with discipline
- Can close early at 50% max profit

### Naked Options
- **Win Rate**: 40-50% (lower prob, but bigger wins)
- **Avg Win**: +100-200% (unlimited upside)
- **Avg Loss**: -60% (disciplined stops prevent -100%)
- **Expectancy**: +$30-60 per contract

**Why Lower Win Rate?**
- Further break-even point
- Theta decay working against you
- Need bigger move to profit

---

## 🧠 Psychology & Discipline

### Vertical Spreads: Easier Emotionally

- **Max loss is known** → Less anxiety
- **Can't lose more** than debit paid
- **Take profits systematically** at 50-75%
- **Easier to hold** through volatility

### Naked Options: Harder Emotionally

- **Watch premium decay daily** → Stressful
- **Temptation to hold losers** → Discipline required
- **FOMO on explosive moves** → Can cause overtrading
- **Need strict stop-loss** discipline

---

## 🎓 Learning Path

**Start with Vertical Spreads**
1. Lower cost = smaller losses while learning
2. Defined risk = easier to manage
3. Higher win rate = builds confidence
4. Learn Greeks and timing

**Graduate to Naked Options**
1. Once comfortable with spreads
2. When you have 10+ successful spread trades
3. Start small (1-2 contracts max)
4. Only on S-grade signals with catalysts

---

## 📚 Additional Resources

- **Options Pricing Calculator**: [optionsprofitcalculator.com](http://optionsprofitcalculator.com)
- **Greeks Explained**: See `/docs/analyze-options-service/greeks-guide.md`
- **Backtest Results**: See `/docs/analyze-options-service/backtests.md`

---

**Remember:**
- **Not all signals are worth trading** (quality > quantity)
- **Position sizing is critical** (never over-leverage)
- **Discipline beats conviction** (follow your stops)
- **Start small, scale up** (earn the right to trade bigger)

🚀 **Ready to analyze signals and identify the best strategy?**

```bash
poetry run analyze scan --days 7 --min-grade A
```

