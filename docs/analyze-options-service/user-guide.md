# Analyze Options Service - User Guide

**Last Updated:** November 5, 2025

---

## Overview

The Analyze Options Service is an **intelligent trading advisor** that evaluates unusual options signals and provides honest buy/skip recommendations. It helps you make better trading decisions by answering:

- ✅ **Which signals are worth trading?**
- ❌ **Which signals should be skipped and why?**
- 🎯 **What strategy should I use?** (Vertical spread vs naked option)
- 💰 **How much should I risk?** (Position sizing)
- ❓ **What are the risks?** (Comprehensive risk analysis)

---

## Quick Start

### Installation

```bash
cd analyze-options-service
poetry install
```

### Configuration

Set up your environment variables:

```bash
# Supabase Configuration (for accessing signals)
export SUPABASE_URL=your_supabase_project_url
export SUPABASE_KEY=your_supabase_anon_key
```

### Your First Command

```bash
# Analyze ALL signals from the last 7 days
poetry run analyze all --days 7
```

---

## Commands

### 1. `analyze all` - Comprehensive Analysis ⭐ **PRIMARY COMMAND**

**Purpose:** Get an honest assessment of EVERY signal - which to trade and which to skip.

```bash
poetry run analyze all --days 7
poetry run analyze all --days 3 --no-show-skip  # Hide skip signals
```

**What it does:**
1. Fetches ALL unusual options signals (B+ grade and above)
2. Analyzes each signal for viability
3. Categorizes into **4 tiers**: STRONG BUY, BUY, CONSIDER, SKIP
4. Shows detailed skip reasons for rejected signals
5. Provides summary statistics

**Example Output:**
```
╭─────────────────── ALL SIGNALS ANALYSIS ───────────────────╮
│ Analyzed 47 signals from last 7 days                       │
│ 🚀 8 STRONG BUY | ✅ 12 BUY | ⚠️  15 CONSIDER | ❌ 12 SKIP  │
╰─────────────────────────────────────────────────────────────╯

🚀 STRONG BUY - High Conviction (8 signals)
These are excellent setups worth immediate consideration

┌────────┬───────┬───────┬─────────────────┬──────┬────────┬─────┬───────────┐
│ Ticker │ Grade │ Score │ Strategy        │ Cost │ P(Win) │ R:R │ Why Trade │
├────────┼───────┼───────┼─────────────────┼──────┼────────┼─────┼───────────┤
│ NUAI   │   S   │  92   │ Naked Call      │ $65  │  45%   │ 1:6 │ Earnings  │
│ GOOGL  │   A   │  87   │ Bull Call Spread│ $250 │  58%   │ 1:3 │ Technical │
└────────┴───────┴───────┴─────────────────┴──────┴────────┴─────┴───────────┘

❌ SKIP - Don't Trade (12 signals)
These signals don't meet quality standards

┌────────┬───────┬───────┬────────────────────────────────────────┐
│ Ticker │ Grade │ Score │ Skip Reasons                           │
├────────┼───────┼───────┼────────────────────────────────────────┤
│ XYZ    │   B   │  42   │ IV too high (rank 89), overpaying     │
│ ABC    │   A   │  38   │ RSI overbought (78), poor entry       │
│ DEF    │   B   │  35   │ Risk/reward only 1:1.2, not worth it  │
└────────┴───────┴───────┴────────────────────────────────────────┘

📊 FINAL SUMMARY:
  • Total Signals Analyzed: 47
  • Worth Trading (STRONG BUY + BUY): 20
  • Marginal (CONSIDER): 15
  • Skip: 12
  • Quality Rate: 42.6% worth trading
```

**When to use:** Daily routine to see what opportunities exist.

---

### 2. `analyze ask` - Q&A System ⭐ **RECOMMENDED**

**Purpose:** Ask questions about signals and get intelligent answers.

```bash
# Ask about specific tickers
poetry run analyze ask "Why should I trade AAPL?"
poetry run analyze ask "What are the risks for TSLA?"

# Compare signals
poetry run analyze ask "Compare GOOGL vs MSFT"

# Get recommendations
poetry run analyze ask "What's the best signal?"
```

**Supported Question Types:**

| Question Pattern | Example | What You Get |
|-----------------|---------|--------------|
| Why trade X? | "Why should I trade AAPL?" | Detailed analysis, strategy, score, reasoning |
| Risks for X? | "What are the risks for TSLA?" | Max loss, probability, theta decay, warnings |
| Compare X vs Y | "Compare GOOGL vs MSFT" | Side-by-side comparison table |
| Best signal? | "What's the best signal?" | Top 3 opportunities ranked |

**Example Output:**

```
🤔 Signal Q&A
Question: Why should I trade NUAI?

╭─────────── 💡 Answer [Confidence: 90%] ───────────╮
│ ✅ NUAI is worth considering! Here's why:         │
│                                                    │
│ 📊 Signal Quality:                                │
│   • Grade: S                                      │
│   • Score: 92/100 (STRONG BUY)                   │
│   • Premium Flow: $850,000                        │
│                                                    │
│ 🎯 Strategy: Naked Call                          │
│   • Cost: $65/contract                            │
│   • Potential: Unlimited upside                   │
│   • Risk/Reward: 1:6                              │
│   • Probability: 45%                              │
│                                                    │
│ 💡 Why it's good: S-grade + strong score         │
│ ⏰ Catalyst: Earnings in 12 days                 │
╰────────────────────────────────────────────────────╯
```

**When to use:** When researching specific signals or comparing opportunities.

---

### 3. `analyze scan` - Quick Analysis with Filters

**Purpose:** Quickly scan high-quality signals (A+ grade) that pass technical filters.

```bash
poetry run analyze scan --days 7 --min-grade A
```

**What it does:**
- Fetches signals with specified grade
- Applies technical filters (RSI, trend, momentum, volume)
- Shows approved signals with strategy recommendations
- Filters out technically poor setups

**When to use:** When you want to see only the "safe" signals that pass all filters.

---

### 4. `analyze best` - Highest Quality Only

**Purpose:** Show ONLY the cream of the crop - best of the best.

```bash
poetry run analyze best
poetry run analyze best --top-n 3
```

**Quality Filters Applied:**
- Score ≥ 85/100
- Probability ≥ 50% (spreads) / 45% (naked)
- Risk/Reward ≥ 2:1
- Grade A or S only

**When to use:** When you want to see only the highest-conviction trades.

---

### 5. `analyze strategies` - Strategy Comparison

**Purpose:** Compare vertical spreads vs naked options for each signal.

```bash
poetry run analyze strategies --days 7 --top-n 10
```

**When to use:** When you want detailed strategy breakdowns.

---

### 6. `analyze info` - Configuration

**Purpose:** View current settings and configuration.

```bash
poetry run analyze info
```

---

## Understanding Recommendation Tiers

The service uses a **4-tier system** to categorize every signal:

### 🚀 STRONG BUY (Score 85-100)

**What it means:** Excellent setup with high conviction. Trade immediately.

**Characteristics:**
- S or high-quality A grade signal
- Strong technical alignment
- Good probability of profit (>50%)
- Favorable risk/reward (>2:1)
- Clear catalyst or strong momentum

**Action:** 
- Trade with **full position size** (based on account risk)
- These are your best opportunities

---

### ✅ BUY (Score 70-84)

**What it means:** Good setup with moderate conviction. Viable trade.

**Characteristics:**
- A or B grade signal
- Decent technical setup
- Acceptable probability (45-50%)
- Reasonable risk/reward (1.5-2:1)

**Action:**
- Trade with **standard position size**
- Monitor closely and have clear exit plan

---

### ⚠️ CONSIDER (Score 50-69)

**What it means:** Marginal setup with risks. Only trade with extra conviction.

**Characteristics:**
- B or lower A grade
- Mixed technical signals
- Lower probability (<45%)
- Marginal risk/reward

**Action:**
- **Only trade if you have strong conviction** from other research
- Use smaller position size
- Very tight stops

---

### ❌ SKIP (Score < 50)

**What it means:** Poor setup. Don't trade.

**Characteristics:**
- Low scores across multiple factors
- Technical warnings
- Poor probability or risk/reward
- Missing key criteria

**Action:**
- **Don't trade** - Wait for better setups
- Review skip reasons to learn what to avoid
- Save your capital for higher-quality opportunities

---

## Skip Reasons - Learning Guide

Every SKIP recommendation includes detailed reasons. Here's what they mean:

### Cost-Related

| Skip Reason | What It Means | What to Do |
|-------------|---------------|-----------|
| Premium too expensive (>$500/contract) | Option costs too much relative to account size | Look for cheaper alternatives or spreads |
| Capital requirement exceeds risk tolerance | Position would risk too much of your account | Skip or reduce position size dramatically |

### Probability-Related

| Skip Reason | What It Means | What to Do |
|-------------|---------------|-----------|
| Low probability of profit (<40%) | Less than 40% chance of making money | Skip - not worth the risk |
| Unfavorable risk/reward ratio (<1.5:1) | Risking too much for potential reward | Look for better setups with 2:1+ R:R |

### Technical-Related

| Skip Reason | What It Means | What to Do |
|-------------|---------------|-----------|
| RSI overbought (78), poor entry point | Stock is extended, likely to pull back | Wait for pullback before entering |
| RSI oversold (12), bearish momentum | For calls: bearish pressure continues | Avoid or wait for reversal |
| Weak or unfavorable price trend | Price action doesn't support the trade | Skip - fighting the trend |
| Below average volume, liquidity concern | Not enough trading volume | Hard to exit, skip |

### Volatility-Related

| Skip Reason | What It Means | What to Do |
|-------------|---------------|-----------|
| IV rank too high (89), overpaying for volatility | Options are expensive due to high IV | Wait for IV to drop or skip |
| IV too low, limited profit potential | For option sellers, not buyers | Skip if buying options |

### Timing-Related

| Skip Reason | What It Means | What to Do |
|-------------|---------------|-----------|
| Too close to expiry (<14 DTE), theta risk | Theta decay accelerating | Skip unless high conviction |
| Earnings in X days, IV crush risk | Options will lose value after earnings | Exit before earnings or skip |

---

## Typical Workflow

### Morning Routine (5-10 minutes)

```bash
# 1. See all opportunities
poetry run analyze all --days 3

# 2. Identify STRONG BUY and BUY signals

# 3. Ask questions about interesting signals
poetry run analyze ask "Why should I trade AAPL?"
poetry run analyze ask "What are the risks for TSLA?"

# 4. Compare top 2-3 opportunities
poetry run analyze ask "Compare AAPL vs MSFT"

# 5. Make trading decisions based on analysis
```

### Before Placing a Trade

**Checklist:**
- [ ] Signal is STRONG BUY or BUY tier (not CONSIDER/SKIP)
- [ ] Score ≥ 70/100
- [ ] Understand the risks (ask "What are the risks for X?")
- [ ] Position size is appropriate (service provides recommendation)
- [ ] Have clear exit plan (take profits at 50-100%, stop loss at -50%)
- [ ] Not overexposed (max 5 positions, max 20% in options)

---

## Best Practices

### DO ✅

1. **Run `analyze all` daily** to see all opportunities
2. **Use the Q&A system** to understand signals before trading
3. **Focus on STRONG BUY and BUY tiers** - ignore CONSIDER/SKIP unless you have extra conviction
4. **Review skip reasons** to learn what to avoid
5. **Compare signals** when choosing between multiple opportunities
6. **Follow position sizing** recommendations
7. **Set stop losses** on every trade

### DON'T ❌

1. **Don't trade SKIP signals** - they're rejected for good reasons
2. **Don't ignore risk warnings** - they're there to protect you
3. **Don't overtrade** - just because a signal exists doesn't mean you should trade it
4. **Don't risk more than 2% per trade** - even on STRONG BUY signals
5. **Don't skip the Q&A** - understanding WHY matters
6. **Don't chase** - if you missed the entry, wait for the next one

---

## Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# Optional - adjust these in config file
DEFAULT_ACCOUNT_SIZE=10000
DEFAULT_RISK_PCT=2.0
RISK_TOLERANCE=conservative  # conservative, moderate, aggressive
```

### Risk Tolerance Settings

| Setting | When to Use | Position Sizing | Strategy Preference |
|---------|-------------|-----------------|---------------------|
| Conservative | Smaller account, new trader | 1-1.5% risk | Prefer spreads |
| Moderate | Medium account, some experience | 1.5-2% risk | Balanced |
| Aggressive | Larger account, experienced | 2-2.5% risk | Prefer naked options |

---

## Troubleshooting

### "No signals found"

**Cause:** No signals in database for specified timeframe.

**Solution:** 
- Increase `--days` parameter
- Check that unusual-options-service is running and generating signals

### "Unable to fetch market data"

**Cause:** API rate limiting or network issues.

**Solution:**
- Wait a few seconds and try again
- Check internet connection
- Verify yfinance is installed: `poetry install`

### "All signals skipped"

**Cause:** All signals failed quality checks (this is actually good - means no good setups right now).

**Solution:**
- Wait for better market conditions
- Lower `--min-grade` to see more signals
- Use `--no-show-skip` to hide SKIP signals

---

## Support

- **Documentation:** See `/docs/analyze-options-service/`
- **Issues:** Open an issue on GitHub
- **Questions:** Use the Q&A system! `poetry run analyze ask "your question"`

---

**Remember:** This tool provides analysis and recommendations, but YOU make the final decision. Always:
- Understand the risks
- Use proper position sizing
- Have an exit plan
- Never risk money you can't afford to lose

Good luck trading! 🚀

