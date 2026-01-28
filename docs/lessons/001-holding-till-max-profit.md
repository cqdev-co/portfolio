# Lesson 001: Don't Hold Spreads to Expiration for Max Profit

**Date:** January 2026  
**Ticker:** AVGO  
**Strategy:** Deep ITM Bull Call Spread ($315/$320)  
**DTE:** 32 days  
**Outcome:** -$200 loss (from a winning position)

## What Happened

I opened a deep ITM bull call spread on AVGO with a $315/$320 strike, 32 DTE. For **28+ days**, the position was profitable and in the money. Rather than taking profits, I decided to hold until expiration to capture the maximum profit.

In the final 2-3 days, AVGO started approaching the danger zone near my short strike. On expiration morning, AVGO opened at $315 - right at my short strike. Panicked and uncertain whether it would recover or continue falling, I sold at $317 for a **-$200 loss**.

A position that was winning for nearly a month turned into a loss because I got greedy trying to squeeze out the last bit of profit.

## The Core Lesson

**Take profits at 50-80% of max profit. The last 20% isn't worth the risk.**

When you have a winning spread trade, the risk/reward of holding for the remaining profit becomes increasingly unfavorable:

| Profit Captured | Remaining Profit | Risk Level |
| --------------- | ---------------- | ---------- |
| 50%             | 50%              | Low        |
| 75%             | 25%              | Medium     |
| 90%             | 10%              | High       |
| 95%+            | 5%               | Extreme    |

## Why This Happens

### 1. Gamma Risk Explodes Near Expiration

Options experience maximum gamma in the final days before expiration. Small price moves create large P&L swings. A stock that was "safe" for 28 days can become a disaster in 48 hours.

### 2. Pin Risk at Strikes

Being at or near a strike price on expiration is the worst possible scenario. You have:

- Maximum uncertainty about assignment
- Maximum gamma exposure
- Widest emotional swings
- Forced decision-making under pressure

### 3. Greed Clouds Judgment

After watching profits accumulate for weeks, the psychological pull to "just wait a few more days" for max profit is strong. This is greed overriding risk management.

### 4. No Exit Plan = Emotional Trading

Without predefined exit rules, you're forced to make decisions in real-time under stress. This leads to panic selling at the worst possible moment.

## The Rules Going Forward

### Entry Rules

- [ ] Define profit target BEFORE entering (50%, 75%, or 80% of max profit)
- [ ] Define stop loss BEFORE entering
- [ ] Set calendar reminder 7 days before expiration to evaluate

### Exit Rules

- [ ] **Close at 50% profit** - Minimum acceptable exit
- [ ] **Close at 75% profit** - Ideal exit for most trades
- [ ] **Close at 80% profit** - Maximum greed threshold, DO NOT EXCEED
- [ ] **Close 5-7 DTE regardless** - Never hold spreads into final week unless already closing

### Red Flags (Close Immediately)

- [ ] Stock approaching short strike with > 3 DTE remaining
- [ ] Unusual volatility or news in the final week
- [ ] Any doubt about the position's safety

## The Math That Matters

If my max profit was $300 on this AVGO spread:

| Exit Point  | Profit | Outcome |
| ----------- | ------ | ------- |
| 50% profit  | +$150  | Win ✓   |
| 75% profit  | +$225  | Win ✓   |
| 80% profit  | +$240  | Win ✓   |
| Held to DTE | -$200  | Loss ✗  |

**I gave up $350-$440 in potential profit by trying to capture the last $60-$150.**

## Psychological Autopsy

- **What I told myself:** "It's been winning for 28 days, there's no way it drops $15+ in 3 days"
- **What was true:** Past performance doesn't protect against future risk
- **The bias:** Overconfidence from a long winning streak
- **The fix:** Mechanical rules that don't require prediction

## Summary

> "Bulls make money, bears make money, pigs get slaughtered."

This trade was a textbook case of letting greed override risk management. The position was winning for nearly a month - I had multiple opportunities to lock in profit. Instead, I held for max profit and turned a winner into a loser.

**Never again.** Close at 75% or 5 DTE, whichever comes first.

## Config Changes

This lesson has been codified into `strategy.config.yaml`:

```yaml
exit:
  profit:
    min_acceptable_pct: 50 # Floor - always accept 50%
    target_pct: 75 # Standard target - CLOSE HERE
    greed_limit_pct: 80 # HARD CEILING - never hold past 80%

  time:
    gamma_risk_zone_dte: 7 # Enter danger zone
    forced_exit_dte: 5 # MANDATORY EXIT regardless of P&L
    exit_rule: 'CLOSE_AT_75_OR_5DTE_FIRST'

  pin_risk:
    enabled: true
    cushion_warning_pct: 3 # Warn if cushion drops below 3%
    cushion_exit_pct: 2 # Force exit if cushion drops below 2%
```

---

_This lesson cost me $200 + opportunity cost. But if it prevents future mistakes, it was the cheapest tuition I'll ever pay._
