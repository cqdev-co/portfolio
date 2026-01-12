# Enhanced Analysis Features

Victor Chen now has advanced analytical capabilities that make him a
more rigorous and accountable financial analyst.

## Overview

These features transform Victor from a "good analyst" to an
"exceptional analyst" by adding:

1. **Recommendation Tracking** - Accountability for past calls
2. **Expected Value Calculations** - Quantified trade quality
3. **Greeks Analysis** - Options risk metrics
4. **Comparative Rankings** - Opportunity cost awareness
5. **Confidence Calibration** - Honest uncertainty assessment
6. **News Sentiment Scoring** - Systematic news analysis

## 1. Recommendation Tracking

### Purpose

Track Victor's recommendations and their outcomes for accountability.

### Database Schema

```sql
-- Run: db/analyst_recommendations_schema.sql

-- Key tables:
-- analyst_recommendations - Every recommendation Victor makes
-- analyst_confidence_calibration - Accuracy stats by confidence level

-- Key views:
-- analyst_confidence_stats - Hit rate by confidence level
-- analyst_action_stats - Hit rate by action type (BUY/WAIT/AVOID)
-- analyst_ticker_recommendations - Per-ticker history
```

### Service API

```typescript
import {
  saveRecommendation,
  getRecommendationsForTicker,
  getConfidenceStats,
  getCalibratedAccuracy,
} from './services/recommendations';

// Save a recommendation
await saveRecommendation({
  ticker: 'NVDA',
  action: 'WAIT',
  confidence: 'HIGH',
  confidenceFactors: ['Elevated RSI', 'Earnings in 7 days'],
  priceAtRecommendation: 890.5,
  thesis: 'RSI at 68 is too hot. Wait for pullback to 850.',
  keyFactors: { rsi: 68, earningsDays: 7 },
});

// Check Victor's track record
const stats = await getConfidenceStats();
// Returns: [{ confidence: 'HIGH', accuracyPct: 72, ... }, ...]
```

### Victor's Behavior

When making recommendations, Victor now states his confidence:

> "MEDIUM confidence on this NVDA call - the trend is strong
> but RSI is pushing limits. My MEDIUM confidence calls are
> historically 65% accurate."

## 2. Expected Value Calculator

### Purpose

Quantify trade quality with probability-weighted outcomes.

### Usage

```typescript
import {
  calculateExpectedValue,
  analyzeScenarios,
} from './engine/expected-value';

const ev = calculateExpectedValue({
  longStrike: 850,
  shortStrike: 855,
  debit: 3.8,
  currentPrice: 890,
  dte: 30,
  iv: 0.35,
});

// Returns:
// {
//   probabilityOfProfit: 0.72,    // 72% chance of profit
//   expectedValue: 42.50,         // +$42.50 per contract expected
//   expectedValuePct: 11.2,       // 11.2% return on risk
//   kellyFraction: 0.28,          // Optimal bet: 28% of bankroll
//   quality: 'GOOD',              // EXCELLENT/GOOD/MARGINAL/POOR
//   ...
// }
```

### Scenario Analysis

```typescript
const scenarios = analyzeScenarios(params);

// Returns P&L for various price movements:
// [
//   { scenario: 'Crash (-15%)', pnl: -380, ... },
//   { scenario: 'Pullback (-5%)', pnl: -120, ... },
//   { scenario: 'Rally (+5%)', pnl: 120, ... },
//   ...
// ]
```

### Victor's Behavior

Victor now cites expected value in his analysis:

> "This spread has 72% probability of profit with +$42 expected
> value per contract. That's solid - you're paying $380 to make
> an expected $42, which is an 11% edge over fair pricing."

## 3. Greeks Analysis

### Purpose

Calculate delta, gamma, theta, vega for spread risk assessment.

### Usage

```typescript
import { calculateSpreadGreeks } from './engine/greeks';

const greeks = calculateSpreadGreeks(
  longStrike: 850,
  shortStrike: 855,
  currentPrice: 890,
  dte: 30,
  iv: 0.35,
  debit: 3.80
);

// Returns:
// {
//   netDelta: 0.72,           // 72% directional exposure
//   netTheta: -0.025,         // Losing $2.50/day to decay
//   deltaPerDollar: 1.89,     // $1.89 delta per $1 risked
//   leverageRatio: 3.2,       // 3.2x stock-equivalent exposure
//   gammaRisk: 'LOW',         // LOW/MODERATE/HIGH
//   thetaProfile: 'NEUTRAL',  // FAVORABLE/NEUTRAL/UNFAVORABLE
//   ...
// }
```

### Victor's Behavior

Victor explains Greeks in practical terms:

> "This spread gives you 72 delta - that's $72 of stock-like
> exposure for every $100 risked. Efficient use of capital.
> Theta's costing you $2.50/day but with 30 DTE you have time."

## 4. Comparative Rankings

### Purpose

Rank opportunities by risk-adjusted expected value.

### Usage

```typescript
import { rankOpportunities, getComparativeAnalysis } from './engine/rankings';

// Rank a set of scan results
const ranked = rankOpportunities(scanResults);

// Get context for a specific ticker
const analysis = getComparativeAnalysis('TSM', ranked);

// Returns:
// {
//   ticker: 'TSM',
//   rank: 7,
//   totalInSet: 15,
//   percentile: 53,
//   summary: "TSM ranks #7 of 15 - middle of the pack...",
//   worseThan: [{ ticker: 'GOOGL', ... }, ...],
//   ...
// }
```

### Victor's Behavior

Victor now compares opportunities:

> "TSM ranks #7 in my current opportunity set. If you want
> semiconductor exposure, AMD is #3 with better RSI (48 vs 62)
> and no earnings for 45 days. My top 3 right now: GOOGL,
> AMZN, AMD."

## 5. Confidence Calibration

### Purpose

Track accuracy by confidence level for honest uncertainty.

### How It Works

Every recommendation Victor makes is tagged with confidence:

- **HIGH**: Strong conviction, multiple confirming signals
- **MEDIUM**: Decent setup, some uncertainty
- **LOW**: Speculative, conflicting signals

Over time, we track accuracy:

```
HIGH confidence calls: 78% accurate (23 of 30)
MEDIUM confidence calls: 62% accurate (18 of 29)
LOW confidence calls: 51% accurate (12 of 24)
```

### Victor's Behavior

Victor calibrates his statements:

> "LOW confidence on this call. Earnings uncertainty makes
> this a coin flip. Historically my LOW confidence calls are
> right 51% of the time - barely better than random."

## 6. News Sentiment Scoring

### Purpose

Systematic analysis of news headlines for sentiment and catalysts.

### Usage

```typescript
import { analyzeNewsSentiment } from './services/sentiment';

const sentiment = analyzeNewsSentiment(newsItems);

// Returns:
// {
//   score: -0.32,                    // -1 to +1
//   label: 'BEARISH',               // VERY_BEARISH to VERY_BULLISH
//   confidence: 'MEDIUM',
//   themes: ['Tariffs', 'AI/ML'],
//   catalysts: [
//     { type: 'REGULATORY', severity: 'HIGH', ... }
//   ],
//   bullishSignals: ['growth', 'beat'],
//   bearishSignals: ['tariff', 'concern'],
// }
```

### Victor's Behavior

Victor factors sentiment into analysis:

> "News sentiment is slightly bearish (-0.3) with high volume
> of tariff-related headlines. I'm seeing 'concern' and 'risk'
> keywords. This adds uncertainty I don't love for a 45 DTE
> spread. Dropping my confidence from HIGH to MEDIUM."

## Integration Example

Here's how these features work together in Victor's analysis:

```
You: What do you think of TSM?

Victor: Let me break this down...

TSM is sitting at $318 with RSI at 62 - that's pushing the
upper limit of my comfort zone. More importantly, earnings
are 7 days out. You know my rule: no earnings within 14 days.

Looking at the expected value: this spread has 58% probability
of profit, which is below my 65% threshold. The $42 expected
value is decent, but you're taking on elevated risk.

News sentiment is slightly bearish (-0.3) with tariff headlines
dominating. That's adding uncertainty.

Here's the kicker - TSM ranks #7 in my current opportunity set.
If you want semiconductor exposure, AMD is #3 with RSI at 48,
no earnings for 45 days, and 71% probability of profit.

MEDIUM confidence call: WAIT on TSM. Watch for a pullback to
$300 with RSI cooling below 55. Or just go with AMD instead.
```

## Files Added

### Database

- `db/analyst_recommendations_schema.sql` - Recommendation tracking tables

### Services

- `ai-analyst/src/services/recommendations.ts` - Recommendation CRUD
- `ai-analyst/src/services/sentiment.ts` - News sentiment analysis

### Engine

- `ai-analyst/src/engine/expected-value.ts` - EV and scenario analysis
- `ai-analyst/src/engine/greeks.ts` - Options Greeks calculator
- `ai-analyst/src/engine/rankings.ts` - Comparative opportunity ranking

### Prompts

- `lib/ai-agent/prompts/victor.ts` - Updated with ENHANCED_ANALYSIS section

## Setup

1. Run the database schema:

```bash
# In Supabase SQL Editor
# Copy and run: db/analyst_recommendations_schema.sql
```

2. The new services are automatically available to Victor through
   the updated system prompt.

3. Data flows automatically:
   - EV/Greeks calculated when spread data available
   - Rankings computed during scans
   - Sentiment analyzed when news data present
   - Recommendations saved after each analysis

## Configuration

No additional configuration required. The features activate
automatically when relevant data is available.

## Smart Tool Optimization

Victor is now smarter about when to use tools:

### Auto-Fetched Financials

For stocks with P/E > 50 (high valuation), financials are
automatically fetched and included in context. This adds:

- Revenue growth (YoY)
- EPS growth
- Free cash flow
- Forward P/E
- Debt/equity ratios

Victor no longer needs to call `get_financials_deep` for these stocks.

### No Redundant Fetches

When ticker data is displayed in the Yahoo Finance box, Victor
sees a note: `⚡ DATA PRE-LOADED: AMD - Do NOT call get_ticker_data`

This prevents wasteful re-fetches that were costing:

- 50% more time (5.4s → 8.6s)
- 2x token usage (13% → 6% efficiency)

### Context-Aware Tool Availability

For trade analysis questions (no research needed), Victor doesn't
have access to tools for pre-loaded data. This prevents:

- Unnecessary research calls that inflate token counts
- Model "deciding" to search when data is already present
- Redundant regime fetches when regime is in context

Tool availability by question type:
| Question Type | Tools Available |
|--------------|-----------------|
| Price check | `get_ticker_data`, `web_search` |
| Trade analysis | `get_financials_deep`, `get_institutional_holdings`, `get_unusual_options_activity` (NO web_search, NO get_trading_regime - both pre-loaded) |
| Research | Full tool set including `web_search` |

### Token Display Fix

Token count now shows **actual context size** (max per iteration),
not cumulative total across all iterations:

**Before (misleading):**

```
30736→614 tokens (2.0% eff)  # Cumulative across 2 iterations
```

**After (accurate):**

```
15368→614 tokens (4.0% eff)  # Actual context size
```

This helps accurately assess prompt optimization.

### Tool Decision Tree

```
User asks about ticker →
  ├─ Data in context? → Use it (no tools)
  ├─ P/E > 50? → Financials auto-fetched
  ├─ Wants news/research? → web_search (if available)
  └─ New ticker? → get_ticker_data (only then)
```

## Future Enhancements

- [ ] Automated outcome tracking (price monitoring)
- [ ] Weekly confidence calibration reports
- [ ] Pattern detection from recommendation history
- [ ] Sector-level sentiment aggregation
