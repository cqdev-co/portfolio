# Trading Lessons Learned

A collection of lessons learned from real trades - both wins and losses. Each lesson documents what happened, why it happened, and the rules created to prevent repeating mistakes.

## Why Document Lessons?

1. **Memory fades, documents don't** - In 6 months, you'll forget the pain of this loss
2. **Patterns emerge** - Multiple lessons may reveal systematic weaknesses
3. **Rules need context** - Understanding _why_ a rule exists helps follow it
4. **Accountability** - Writing it down creates commitment

## Lessons Index

| #                                                      | Title                                  | Date     | Ticker | Core Lesson                                                     |
| ------------------------------------------------------ | -------------------------------------- | -------- | ------ | --------------------------------------------------------------- |
| [001](./001-holding-till-max-profit.md)                | Don't Hold Spreads to Expiration       | Jan 2026 | AVGO   | Take profits at 50-80%, never hold for max profit               |
| [002](./002-viable-spread-criteria-too-restrictive.md) | Viable Spread Criteria Too Restrictive | Feb 2026 | ALL    | Cushion + debit ratio were contradictory — zero trades surfaced |

## Lesson Template

When adding new lessons, include:

1. **What Happened** - Objective facts of the trade
2. **The Core Lesson** - One-sentence summary
3. **Why This Happens** - Psychological/market mechanics
4. **Rules Going Forward** - Specific, actionable rules
5. **The Math** - Quantify the cost of the mistake
6. **Psychological Autopsy** - What bias led to this?

## Quick Reference: Key Rules from Lessons

### From Lesson 001: Spread Profit Taking

- Close at 50-75% of max profit
- Never hold past 5-7 DTE
- Define exit rules BEFORE entering

### From Lesson 002: Viable Spread Criteria

- Cushion minimum: 5% (not 7% — conflicts with deep ITM debit ratio)
- Max debit ratio: 85% (not 80% — deep ITM naturally has higher ratios)
- Always try mid-market pricing before rejecting a spread on debit ratio

## Integration with Strategy Config

Lessons learned are codified into `strategy.config.yaml` at the repo root. The config has a `lessons` section that tracks which rules changed due to which lessons.

```yaml
# From strategy.config.yaml
lessons:
  - id: '001'
    title: "Don't Hold Spreads to Expiration for Max Profit"
    rules_changed:
      - 'exit.profit.target_pct: 35 → 75 (of max profit)'
      - 'exit.profit.greed_limit_pct: NEW at 80%'
      - 'exit.time.forced_exit_dte: NEW at 5 DTE'
```

This creates a feedback loop:

1. **Trade** → Experience gains/losses
2. **Document** → Write lesson in `docs/lessons/`
3. **Codify** → Update `strategy.config.yaml`
4. **Enforce** → Services read config and enforce rules

---

_"The market is a device for transferring money from the impatient to the patient." - Warren Buffett_

_"And from the greedy to the disciplined." - Every options trader who learned the hard way_
