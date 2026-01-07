# Trading Strategy Framework for Unusual Options Signals

**Version:** 1.0  
**Date:** November 6, 2025  
**Purpose:** Systematic approach to identify, validate, and execute high-probability options trades

---

## Table of Contents

1. [The 5-Filter System](#the-5-filter-system)
2. [Signal Validation Checklist](#signal-validation-checklist)
3. [Entry Timing Strategies](#entry-timing-strategies)
4. [Position Sizing Framework](#position-sizing-framework)
5. [Multi-Signal Correlation Strategy](#multi-signal-correlation-strategy)
6. [The 3-Tier Portfolio Approach](#the-3-tier-portfolio-approach)
7. [Real-Time Monitoring System](#real-time-monitoring-system)
8. [Exit Strategies & Profit Taking](#exit-strategies--profit-taking)
9. [Weekly Workflow](#weekly-workflow)
10. [Advanced Strategies](#advanced-strategies)

---

## The 5-Filter System

Use this systematic approach to filter 1,000+ signals down to your best 5-10
plays:

### Filter 1: Quality Score (Reduce to ~300 signals)

```
Keep only:
- Grade: S or A
- Score: ≥ 0.75
- Confidence: ≥ 0.70
```

**Why:** These signals have the highest statistical edge and institutional
backing.

### Filter 2: Time Decay Protection (Reduce to ~150 signals)

```
Keep only:
- Days to Expiry: ≥ 10 days
- Avoid anything expiring in <7 days
```

**Why:** Gives you time to be right. Theta decay under 7 days is brutal.

### Filter 3: Premium Flow Significance (Reduce to ~75 signals)

```
Keep only:
- Premium Flow: ≥ $500,000
- OR Volume Ratio: ≥ 5x average
```

**Why:** Small bets aren't worth following. Need meaningful institutional
commitment.

### Filter 4: Moneyness Sweet Spot (Reduce to ~40 signals)

```
Keep only:
- ITM (already profitable)
- ATM (needs small move)
- Avoid: Deep ITM (likely hedges) and Far OTM (lottery tickets)
```

**Why:** ATM/ITM options have better risk/reward and less likely to be
pure hedges.

### Filter 5: Ticker Consistency (Reduce to ~10-20 plays)

```
Prioritize:
- Tickers with 3+ signals in same direction
- Same strike getting repeated signals
- Multiple strikes in bullish/bearish ladder
```

**Why:** Consistency = conviction. Random one-off signals are noise.

---

## Signal Validation Checklist

Before entering ANY trade, validate with this 10-point checklist:

### ✅ Technical Validation

**1. Chart Confirmation**

- [ ] Stock at support/resistance level that aligns with signal
- [ ] RSI not overbought (>70) for calls, oversold (<30) for puts
- [ ] MACD confirms direction
- [ ] Volume trending up

**2. IV Rank Check**

- [ ] IV Rank < 50 for buying options (cheaper premium)
- [ ] IV Rank > 50 for selling options (expensive premium)
- [ ] Not expecting IV crush (post-earnings)

**3. Earnings Calendar**

- [ ] No earnings within expiration window (unless intentional play)
- [ ] If earnings play: confirmed by multiple signals + high premium flow

### ✅ Signal Quality Validation

**4. Score Breakdown**

- [ ] Overall score ≥ 0.75
- [ ] Grade: S or A preferred
- [ ] Confidence ≥ 0.75

**5. Flow Analysis**

- [ ] Premium flow ≥ $500K
- [ ] Volume ratio ≥ 3x (shows unusual activity)
- [ ] Not marked as "likely_spread" (unless both legs identified)

**6. Timing Check**

- [ ] Signal detected within last 24 hours (fresher = better)
- [ ] Multiple detections across different timestamps (continuity)
- [ ] Days to expiry: 10-45 optimal

### ✅ Macro Validation

**7. Market Environment**

- [ ] SPY/QQQ trend aligns with trade direction
- [ ] VIX not spiking (unless hedging strategy)
- [ ] Sector momentum supports thesis

**8. Ticker Fundamentals**

- [ ] No pending legal issues or negative catalysts
- [ ] Check recent news for context
- [ ] Understand WHY institutions might be betting this way

**9. Risk Assessment**

- [ ] Risk factors acceptable (review risk_factors field)
- [ ] Position size doesn't exceed limits
- [ ] Stop loss planned before entry

**10. Correlation Check**

- [ ] Multiple signals on same ticker pointing same direction
- [ ] Not contradicted by opposite signals (calls vs puts)
- [ ] Aligns with sector trend

### Scoring System

- **10/10 = Enter immediately** (rare, perfect setup)
- **8-9/10 = Strong entry** (most good trades)
- **6-7/10 = Watch list** (wait for confirmation)
- **<6/10 = Pass** (too many red flags)

---

## Entry Timing Strategies

### Strategy 1: The First Hour Fade

**Best for:** Day trading high-conviction signals

**Process:**

1. Market opens, watch first 30 minutes
2. Identify direction (gap up/down)
3. Wait for fade/pullback (30-60 min into session)
4. Enter on the retracement

**Example:**

- AMD gaps up to $260 on bullish signal
- Pulls back to $258.50 at 10:30am
- Enter AMD $260C at discounted premium

**Why it works:** Avoid paying inflated IV at open, get better entry

### Strategy 2: The Confirmation Entry

**Best for:** Swing trades (10-30 day holds)

**Process:**

1. Signal detected (e.g., AAPL $270C)
2. Wait for next day's price action
3. Enter only if stock confirms direction (breaks key level)

**Example:**

- AAPL signal shows $270C buying
- Next day: AAPL breaks above $272 (resistance)
- Enter $270C now that direction confirmed

**Why it works:** Reduces false signals, confirms institutions right

### Strategy 3: The Scale-In Approach

**Best for:** Large positions or uncertain entries

**Process:**

1. Enter 33% position immediately
2. Add 33% if profitable after 2 days
3. Add final 33% if hitting targets

**Example:**

- TSM $297.5C signal at $9.50 premium
- Day 1: Buy 3 contracts
- Day 3: TSM at $307, contracts at $13 → Add 3 more
- Day 5: TSM at $312, contracts at $16 → Add final 4 (total 10)

**Why it works:** Reduces risk of mistiming, pyramids winners

### Strategy 4: The Spread Entry

**Best for:** Risk reduction, expensive premium

**Process:**

1. See expensive call signal (e.g., $12 premium)
2. Instead of naked call, buy call spread
3. Buy signal strike, sell higher strike

**Example:**

- AMD $260C premium = $10 (expensive)
- Buy AMD $260C / Sell AMD $265C spread
- Net cost: $3.50 instead of $10
- Max profit: $1.50 (43% return vs 50% return on naked call)

**Why it works:** Reduces capital, increases win rate, limits losses

### Strategy 5: The Gap-Fill Entry

**Best for:** Signals on stocks with overnight gaps

**Process:**

1. Stock gaps 2%+ on news
2. Signal appears after gap
3. Wait for gap to fill 50%
4. Enter at better price

**Example:**

- COIN gaps from $315 to $330 on Bitcoin rally
- Signal: COIN $340C
- Wait for pullback to $322.50 (50% fill)
- Enter $340C at lower premium

**Why it works:** Avoids FOMO entries, gets better pricing

---

## Position Sizing Framework

### The Kelly Criterion Adapted for Options

**Formula:**

```
Position Size = (Win Rate × Avg Win - Loss Rate × Avg Loss) / Avg Win
```

**For unusual options signals:**

- High conviction (score ≥0.85): 55-60% win rate
- Medium conviction (score 0.70-0.84): 45-50% win rate
- Spec plays: 30-35% win rate

**Example Calculation:**

```
Signal: AAPL $262.5C, Score 0.90, High Conviction
- Win Rate: 60%
- Avg Win: 50% (you take profits at 50%)
- Loss Rate: 40%
- Avg Loss: 25% (stop loss)

Position Size = (0.60 × 0.50 - 0.40 × 0.25) / 0.50
              = (0.30 - 0.10) / 0.50
              = 0.40 or 4% of portfolio
```

### The 3-Tier Position Sizing System

**Tier 1: High Conviction (Score ≥0.85)**

- Position size: 3-5% per trade
- Max simultaneous positions: 3
- Max total exposure: 15%

**Tier 2: Medium Conviction (Score 0.70-0.84)**

- Position size: 2-3% per trade
- Max simultaneous positions: 4
- Max total exposure: 12%

**Tier 3: Spec Plays (Score <0.70 or Far OTM)**

- Position size: 0.5-1% per trade
- Max simultaneous positions: 5
- Max total exposure: 5%

**Total Portfolio Options Exposure: Max 25%**

### Dollar-Based Position Sizing

**Example $50,000 Portfolio:**

| Tier      | Per Trade    | Max Positions | Max Total     |
| --------- | ------------ | ------------- | ------------- |
| Tier 1    | $1,500-2,500 | 3             | $7,500        |
| Tier 2    | $1,000-1,500 | 4             | $6,000        |
| Tier 3    | $250-500     | 5             | $2,500        |
| **Total** | -            | 12            | $16,000 (32%) |

**Pro Tip:** Start at lower end of ranges, scale up as you prove profitability

---

## Multi-Signal Correlation Strategy

When multiple signals align, probability increases significantly.

### The Confirmation Matrix

**Single Signal (1 indicator):**

- Win rate: ~45%
- Position size: 2%

**Double Confirmation (2 indicators):**

- Win rate: ~55%
- Position size: 3%

**Triple Confirmation (3 indicators):**

- Win rate: ~65%
- Position size: 4-5%

### Correlation Types

#### 1. Same Strike Repetition

```
Signal 1: AAPL $270C detected 11/3 at 10am
Signal 2: AAPL $270C detected 11/3 at 2pm
Signal 3: AAPL $270C detected 11/4 at 11am
```

**Interpretation:** Sustained buying pressure = high conviction

#### 2. Strike Ladder (Bullish)

```
Signal 1: AMD $255C
Signal 2: AMD $260C
Signal 3: AMD $265C
```

**Interpretation:** Institutions buying multiple upside strikes =
major move expected

#### 3. Strike Ladder (Bearish)

```
Signal 1: ORCL $260P
Signal 2: ORCL $255P
Signal 3: ORCL $250P
```

**Interpretation:** Downside protection across strikes = bearish or hedging

#### 4. Time Spread

```
Signal 1: GOOG $280C exp 11/14
Signal 2: GOOG $280C exp 11/21
Signal 3: GOOG $280C exp 12/19
```

**Interpretation:** Sustained move expected over time = swing trade

#### 5. Sector Rotation

```
Signal 1: AMD $260C
Signal 2: NVDA $950C
Signal 3: TSM $310C
Signal 4: AVGO $360C
```

**Interpretation:** Semiconductor sector rally = broad bullish thesis

#### 6. Hedging Pattern (Avoid or Fade)

```
Signal 1: SPY $580C (large premium)
Signal 2: SPY $560P (large premium)
```

**Interpretation:** Straddle = volatility play, not directional

### Correlation Score System

**Award points for each confirmation:**

- Same strike repetition: +3 points
- Adjacent strikes same direction: +2 points
- Different expirations same strike: +2 points
- Sector confirmation: +1 point
- Premium flow >$5M: +2 points
- Multiple days of signals: +1 point per day

**Scoring:**

- 8+ points = Highest conviction (5% position)
- 5-7 points = High conviction (3-4% position)
- 3-4 points = Medium conviction (2-3% position)
- 1-2 points = Low conviction (1% position)
- 0 points = Pass (single isolated signal)

---

## The 3-Tier Portfolio Approach

Build a balanced options portfolio across risk levels:

### Tier 1: Core Holdings (60% of options capital)

**Characteristics:**

- High conviction (score ≥0.85)
- ITM or ATM options
- 14-45 days to expiry
- Liquid underlyings (AAPL, AMD, GOOG, etc.)
- Large premium flow (>$1M)

**Current Examples:**

1. AAPL $262.5C exp 11/14 (ITM, 0.90 score)
2. TSM $297.5C exp 11/14 (ITM, 0.90 score)
3. DAVE $220C exp 11/21 (ITM, $4.79M flow)

**Expected Return:** 30-50% wins, 60% win rate
**Risk Profile:** Low-Medium

### Tier 2: Opportunistic Plays (30% of options capital)

**Characteristics:**

- Medium conviction (score 0.70-0.84)
- ATM or slightly OTM
- 10-30 days to expiry
- Moderate premium flow ($500K-$1M)

**Current Examples:**

1. AMD $260C exp 11/14 (ATM, 0.79 score)
2. BE $120C exp 11/21 (ITM, high IV)
3. COIN $340C exp 11/14 (OTM but 0.90 score)

**Expected Return:** 50-100% wins, 45-50% win rate
**Risk Profile:** Medium

### Tier 3: Lottery Tickets (10% of options capital)

**Characteristics:**

- Spec plays
- OTM options (>10% from current price)
- LEAPS or short-dated
- High premium flow despite distance

**Current Examples:**

1. RIO $72.5C exp 01/16/26 (5% OTM, LEAPS)
2. HUT $58C exp 11/21 (16% OTM, crypto play)
3. ASTS $85C exp 11/14 (far OTM, high vol)

**Expected Return:** 200-500% wins, 25-35% win rate
**Risk Profile:** High (expect full losses)

### Portfolio Construction Example

**$50,000 Portfolio, $15,000 allocated to options:**

**Tier 1 - $9,000 (60%):**

- $3,000 AAPL $262.5C exp 11/14 × 30 contracts
- $3,000 TSM $297.5C exp 11/14 × 30 contracts
- $3,000 DAVE $220C exp 11/21 × 15 contracts

**Tier 2 - $4,500 (30%):**

- $1,500 AMD $260C exp 11/14 × 25 contracts
- $1,500 BE $120C exp 11/21 × 12 contracts
- $1,500 COIN $340C exp 11/14 × 20 contracts

**Tier 3 - $1,500 (10%):**

- $500 RIO $72.5C exp 01/16/26 × 20 contracts
- $500 HUT $58C exp 11/21 × 100 contracts
- $500 ASTS $85C exp 11/14 × 150 contracts

**Expected Outcomes:**

- Tier 1: 2/3 profitable = $2,700 profit (30% avg gain)
- Tier 2: 1/3 profitable = $750 profit (50% on winner)
- Tier 3: 1/3 profitable = $1,000 profit (200% on winner)
- **Total: $4,450 profit = 29.7% return on options capital**

---

## Real-Time Monitoring System

### Daily Monitoring Routine

**Pre-Market (8:00 AM - 9:30 AM EST):**

1. Check overnight news on all holdings
2. Review futures (SPY, QQQ, sector ETFs)
3. Check if any new signals on existing positions
4. Adjust stop losses if needed

**First Hour (9:30 AM - 10:30 AM):**

1. Watch price action on holdings
2. Identify entry opportunities on watch list
3. Don't chase - wait for pullbacks
4. Take profits on overnight gaps >50% gain

**Mid-Day Check (12:00 PM - 1:00 PM):**

1. Review P&L on positions
2. Tighten stops on profitable positions
3. Check for new signals from service
4. Add to watch list for afternoon

**Power Hour (3:00 PM - 4:00 PM):**

1. Final monitoring of positions
2. Decide on overnight holds vs exits
3. Close anything <7 days to expiry unless very confident
4. Set alerts for next day

**Post-Market (4:00 PM - 5:00 PM):**

1. Run fresh scan if service allows
2. Review daily performance
3. Journal trades (what worked, what didn't)
4. Prepare watch list for tomorrow

### Position Monitoring Dashboard

Track each position with these metrics:

| Metric               | Green (Hold)   | Yellow (Watch) | Red (Exit)         |
| -------------------- | -------------- | -------------- | ------------------ |
| P&L                  | >0%            | -10% to 0%     | <-20%              |
| Days to Expiry       | >10 days       | 7-10 days      | <7 days            |
| Underlying vs Strike | Moving toward  | Sideways       | Moving away        |
| Theta Decay          | <5% per day    | 5-10% per day  | >10% per day       |
| New Signals          | Same direction | None           | Opposite direction |

**Action Rules:**

- **All Green:** Hold, consider adding
- **1-2 Yellow:** Watch closely, tighten stop
- **Any Red:** Consider exit or roll
- **Multiple Red:** Exit immediately

### Alert System Setup

**Critical Alerts (Immediate action):**

- Position hits stop loss (-20% to -25%)
- Position hits profit target (+50%, +100%)
- Underlying moves >5% against position
- Major news/earnings announcement

**Watch Alerts (Review within hour):**

- New signal same ticker/strike
- Underlying approaching key support/resistance
- IV change >20%
- Days to expiry hits 7

**Info Alerts (Daily review):**

- New signals same sector
- Insider trading activity
- Analyst upgrades/downgrades
- Options flow summary

---

## Exit Strategies & Profit Taking

### The 3-Step Exit System

**Step 1: Take Initial Profits (50% position at 50% gain)**

- Lock in profits
- Reduce risk
- Let remaining position run

**Step 2: Secure Winners (25% position at 100% gain)**

- Bank substantial gains
- Keep skin in game
- Trail stop on remaining

**Step 3: Trail the Moon Shot (Final 25%)**

- Trail with 20-25% stop
- Let winners run to maximum
- Accept getting stopped out

### Exit by Position Type

#### ITM Options Exit

```
Entry: AAPL $262.5C at $10.50 (stock at $270)
Exit 1: Sell 50% at $15.75 (+50% at $275)
Exit 2: Sell 25% at $21.00 (+100% at $283)
Exit 3: Trail final 25% with $4 stop
```

#### ATM Options Exit

```
Entry: AMD $260C at $6.00 (stock at $258)
Exit 1: Sell 50% at $9.00 (+50% at $265)
Exit 2: Sell 25% at $12.00 (+100% at $272)
Exit 3: Trail final 25% with $2.50 stop
```

#### OTM Options Exit

```
Entry: COIN $340C at $3.00 (stock at $318)
Exit 1: Sell 50% at $4.50 (+50% at $330)
Exit 2: Sell 75% total at $6.00 (+100% at $345)
Exit 3: Let final 25% expire or hit $10+ (homerun)
```

### Time-Based Exits

**With 14+ days remaining:**

- Let winners run
- Trail stops
- Don't take quick profits unless >100% gain

**With 7-14 days remaining:**

- Tighten stops to 15-20%
- Take profits at 50%+ if uncertain
- Roll winning positions to next month

**With <7 days remaining:**

- Close anything not deep ITM
- Take profits immediately on any gains
- Don't hold through expiration week unless 100% confident

### Signal-Based Exits

**Exit Immediately If:**

- Multiple opposite signals appear (calls when you have puts)
- Premium flow reverses direction
- Underlying breaks key technical level
- Major negative news

**Consider Exit If:**

- No new signals detected in 2+ days (flow dried up)
- Market (SPY/QQQ) reverses hard
- VIX spikes >30%
- Position down 15-20%

---

## Weekly Workflow

### Sunday (Preparation)

**Evening (6:00 PM - 8:00 PM):**

1. Export latest signals from service (if fresh data available)
2. Run analysis script from GitHub Actions or manual
3. Apply 5-Filter System to identify top 20 signals
4. Run Signal Validation Checklist on top candidates
5. Check economic calendar for week ahead
6. Prepare watch list for Monday

**Output:**

- Watch list with 10-20 tickers
- Entry prices identified
- Position sizes planned

### Monday (Fresh Start)

**Pre-Market:**

- Review weekend news
- Check futures sentiment
- Confirm watch list still valid

**During Market:**

- Execute 2-3 highest conviction entries
- Use First Hour Fade strategy
- Don't over-trade - patience

**Post-Market:**

- Review entries
- Set stops
- Journal reasoning

### Tuesday-Thursday (Management Days)

**Focus:**

- Monitor existing positions
- Add to winners if confirmed
- Cut losers at stops
- Look for 2-3 new opportunities per day
- Take profits systematically

**Key Activities:**

- Run daily monitoring routine
- Check for new signals on holdings
- Scale in/out as appropriate
- Roll expiring winners

### Friday (Week-End Review)

**During Market:**

- Take profits on positions <10 days to expiry
- Don't hold risky positions through weekend
- Close losers you don't believe in

**Post-Market:**

- Calculate week's performance
- Journal lessons learned
- Identify what worked/didn't
- Prepare watchlist for next week

**Weekend:**

- Deep analysis of upcoming week
- Research macro events
- Update strategy based on results

---

## Advanced Strategies

### Strategy 1: The Straddle on AMD

**Thesis:** 180 signals with $388M premium = high volatility expected

**Setup:**

- Buy AMD $258 Straddle (ATM call + ATM put) exp 11/21
- Cost: ~$12 ($6 call + $6 put)
- Breakeven: $246 or $270 (need 4.6% move either direction)

**Win Conditions:**

- AMD moves significantly in either direction
- Volatility spike increases both premiums
- Profitable if move >5% by expiration

**Risk Management:**

- Max loss: $12 per straddle (if AMD stays at $258)
- Close at 50% profit (AMD at $252 or $264)
- Hold one side, sell other if directional

### Strategy 2: The Poor Man's Covered Call

**Thesis:** Want call exposure but expensive premium

**Setup:**

- Instead of buying AAPL $270C for $10
- Buy AAPL $262.5C (ITM) for $13
- Sell AAPL $277.5C (OTM) for $4
- Net debit: $9 (vs $10 for naked call)
- Max profit: $15 - $9 = $6 (67% return)

**Benefits:**

- Lower cost basis
- Higher delta (more movement with stock)
- Defined risk

### Strategy 3: The Ratio Back Spread

**Thesis:** Expect major move in AMD but unsure of direction

**Setup (Bullish Bias):**

- Sell 1x AMD $260C
- Buy 2x AMD $265C
- Net credit or small debit
- Unlimited upside if AMD rallies
- Breakeven: $270

**When to Use:**

- High conviction in volatility
- Directional lean but want protection
- IV elevated (collect more premium)

### Strategy 4: The Calendar Spread

**Thesis:** Signal shows both Nov and Dec options on same strike

**Setup:**

- Sell GOOG $280C exp 11/14 (collect premium)
- Buy GOOG $280C exp 12/19 (long-term position)
- Net debit: ~$3
- Profit if GOOG stays near $280 (front month expires worthless)
- Keep long December call for continuation

**Benefits:**

- Reduces cost of long-dated options
- Profits from time decay
- Maintains upside exposure

### Strategy 5: The Earnings Strangle

**Thesis:** Multiple signals ahead of earnings

**Setup (for Nov 12 earnings):**

- Buy AMD $250P exp 11/14 (OTM)
- Buy AMD $270C exp 11/14 (OTM)
- Cost: ~$8 total
- Need >3% move either direction

**Timing:**

- Enter 2-3 days before earnings
- Exit immediately after earnings (IV crush)
- Don't hold through entire expiration

**Risk:**

- IV crush after earnings can hurt both sides
- Need significant move to overcome premium cost

### Strategy 6: The Sector Basket

**Thesis:** Multiple semiconductor signals

**Setup:**

- Instead of betting on one, diversify
- $1,000 AMD $260C
- $1,000 TSM $310C
- $1,000 NVDA $950C
- $1,000 AVGO $360C
- Total: $4,000 across sector

**Benefits:**

- Reduces single-stock risk
- Captures sector momentum
- One big winner can carry others

---

## Risk Management Commandments

### The 10 Commandments

1. **Thou shalt not risk more than 5% on any single trade**
   - Even highest conviction needs limits
2. **Thou shalt always use stop losses**
   - 20-25% on options is standard
   - Move to breakeven after 50% profit
3. **Thou shalt take profits systematically**
   - 50% at 50%, 25% at 100%, trail remainder
   - Pigs get fat, hogs get slaughtered
4. **Thou shalt not hold options <7 days to expiry without conviction**
   - Theta decay accelerates exponentially
5. **Thou shalt size positions by conviction, not excitement**
   - Score-based sizing system is your friend
6. **Thou shalt not average down on options**
   - Options are wasting assets
   - Down 20%? Cut it. Don't add to it.
7. **Thou shalt diversify across tickers**
   - Max 30% in any single underlying
8. **Thou shalt not trade the first or last 10 minutes**
   - Liquidity and spreads are terrible
9. **Thou shalt respect the macro environment**
   - Don't fight the Fed
   - Don't fight the trend
10. **Thou shalt keep a trading journal**
    - Track every trade
    - Learn from mistakes
    - Iterate strategy

---

## Performance Tracking

### Metrics to Track Weekly

**Win Rate:**

```
Winning Trades / Total Trades
Target: >50% for Tier 1, >40% for Tier 2
```

**Average Win/Loss Ratio:**

```
Avg Win % / Avg Loss %
Target: >1.5 (win $1.50 for every $1 lost)
```

**Return on Capital:**

```
Net Profit / Capital Deployed
Target: >30% quarterly on options capital
```

**Max Drawdown:**

```
Largest peak-to-trough decline
Target: <15% max
```

### Monthly Review Questions

1. Which signals types performed best?
2. What was my win rate by grade (S vs A vs B)?
3. Did I follow my position sizing rules?
4. Did I take profits systematically?
5. What was my biggest mistake?
6. What pattern can I exploit next month?

---

## Conclusion

Success with unusual options signals requires:

1. **Systematic Filtering:** Don't try to trade everything
2. **Validation:** Use checklist before every trade
3. **Timing:** Entry timing matters more than signal itself
4. **Position Sizing:** Kelly Criterion + conviction-based tiers
5. **Correlation:** Multiple confirming signals = higher edge
6. **Portfolio Balance:** 60/30/10 across risk tiers
7. **Monitoring:** Daily routine prevents disasters
8. **Exits:** Systematic profit-taking and stops
9. **Workflow:** Weekly rhythm creates consistency
10. **Risk Management:** The 10 Commandments save you

**Remember:** These signals show you what smart money is doing, but you
still need to execute with discipline. The edge is real, but only if you
follow the system.

Start small, track everything, iterate based on results. The traders who
make consistent money aren't the ones who find the best signals - they're
the ones who execute the same system repeatedly with discipline.

---

**Next Steps:**

1. Print this framework
2. Set up your monitoring dashboard
3. Run the 5-Filter System on current signals
4. Start with 1-2 Tier 1 trades this week
5. Journal every trade
6. Review results Friday
7. Iterate and improve

Good luck, and trade safe! 🚀
