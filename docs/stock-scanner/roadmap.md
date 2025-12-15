# Stock Scanner Roadmap

## Current Version: v1.7.0 ✅

Production-ready CLI tool with Decision Engine, smart analysis, options features, quarterly earnings tracking, and enhanced data analysis.

---

### v1.7.0 Features (Current) — Enhanced Data Analysis ✅

**Major data enhancements for better stock analysis and risk assessment.**

**New Technical Indicators:**
- ✅ **ADX (Average Directional Index)** - Trend strength measurement
  - ADX > 30: Strong trend in place (+5 pts)
  - ADX 25-30: Trend developing (+3 pts)
  - ADX < 20: Consolidating, watch for breakout (+2 pts)
- ✅ **Bollinger Bands Position** - Mean reversion detection
  - Near lower band: Oversold bounce potential (+5 pts)
  - Lower band zone: Favorable entry area (+3 pts)
- ✅ **ATR (Average True Range)** - Volatility measurement for position sizing
  - Used for stop loss calculation
  - Shows daily volatility as % of price

**New Fundamental Signals:**
- ✅ **Short Interest Analysis**
  - Short squeeze potential (>15% short + high days to cover)
  - Low short interest signal (<5% = limited bearish sentiment)
  - Elevated short interest warnings (10-15%)
- ✅ **Balance Sheet Health**
  - Fortress balance sheet (low D/E, high current ratio)
  - Net cash position detection
  - High debt load warnings
  - Liquidity concern warnings (current ratio < 1)
- ✅ **Beta/Volatility Context**
  - Stock volatility vs market
  - Used for position sizing recommendations

**New Sector Analysis:**
- ✅ **Sector Relative Strength** - Compare sector ETF vs SPY
  - Leading/inline/lagging/underperforming rating
  - Money flow direction (inflow/outflow/neutral)
  - Sector ETF mapping (XLK, XLF, XLV, etc.)

**Enhanced AI Context:**
- ✅ **Short Interest Context** - Squeeze risk assessment for AI
- ✅ **Balance Sheet Context** - Debt health for AI analysis
- ✅ **Volatility Context** - Beta and ATR included
- ✅ **Sector Context** - Sector strength and rotation data

**Technical Improvements:**
- ✅ Added BollingerBands and ADX from technicalindicators library
- ✅ ATR calculation for volatility measurement
- ✅ Sector ETF data fetching for rotation analysis
- ✅ Balance sheet metrics from Yahoo Finance financialData module

**Files Added/Modified:**
- `src/utils/sector-strength.ts` - NEW: Sector relative strength utility
- `src/signals/technical.ts` - Added ADX, Bollinger Bands
- `src/signals/fundamental.ts` - Added short interest, balance sheet signals
- `src/engine/scorer.ts` - Added ATR, beta, debt context calculation
- `src/engine/screener.ts` - Added sector strength to analysis
- `src/utils/ai-narrative.ts` - Enhanced context interfaces
- `src/types/index.ts` - Extended WeekContext and QuoteSummary
- `src/providers/yahoo.ts` - Map additional Yahoo Finance fields

---

### v1.5.1 Features — Scan with Decisions ✅

**Scan Command Improvements:**
- ✅ **Decision Column** - Every scan result shows ENTER/WAIT/PASS status
- ✅ **`--actionable` Flag** - Filter to show only ENTER and WAIT decisions
- ✅ **Decision Summary** - Shows count of ENTER, WAIT, PASS at end of scan
- ✅ **Quick Decision Logic** - Fast evaluation using available score data
- ✅ **Reason Column** - Shows why each decision was made

**Example Output:**
```
  Actionable Opportunities - 12/3/2025
┌──────┬────────┬──────────┬────────┬────────────┬─────────────────────┐
│ Rank │ Ticker │ Price    │ Score  │ Decision   │ Reason              │
├──────┼────────┼──────────┼────────┼────────────┼─────────────────────┤
│ 1    │ BYD    │ $82.61   │ 80     │ ✅ ENTER   │ 4/5 checks          │
│ 2    │ ALL    │ $209.03  │ 78     │ ✅ ENTER   │ 4/5 checks          │
│ 3    │ VNT    │ $35.70   │ 78     │ ⏳ WAIT    │ Below MA200         │
│ 4    │ AMZN   │ $232.66  │ 72     │ ✅ ENTER   │ 4/5 checks          │
└──────┴────────┴──────────┴────────┴────────────┴─────────────────────┘

  Decision Summary: 3 ENTER | 1 WAIT | 0 PASS
```

**Usage:**
```bash
# Show all results with decisions
bun run scan --min-score 70

# Show only actionable (ENTER or WAIT)
bun run scan --min-score 70 --actionable
```

---

### v1.5.0 Features — Spread Entry Decision Engine ✅

**Complete Decision Engine:**
- ✅ **Entry Decision** - ENTER NOW / WAIT FOR PULLBACK / PASS
- ✅ **Confidence Score** - 0-100 combining all signals
- ✅ **Spread Quality Score** - 0-100 evaluating spread characteristics
- ✅ **Position Sizing** - Based on confidence level + market regime
- ✅ **Entry Timing Logic** - RSI zone, MA20 position, support distance
- ✅ **Actionable Guidance** - Entry, risk management, and warnings

**Scoring Weights:**
| Factor | Confidence | Spread Quality |
|--------|------------|----------------|
| Stock Score | 30% | - |
| Checklist | 25% | - |
| Momentum | 20% | - |
| Relative Strength | 15% | - |
| Market Regime | 10% | - |
| Intrinsic Value | - | 20 pts |
| Cushion | - | 20 pts |
| Delta/DTE/Width | - | 25 pts |
| Return/Support | - | 25 pts |
| Earnings Risk | - | 10 pts |

**Position Sizing Matrix:**
| Confidence | Bull | Neutral | Bear |
|------------|------|---------|------|
| 85+ | 100% | 75% | 50% |
| 70-84 | 75% | 50% | 25% |
| 55-69 | 50% | 25% | Skip |
| <55 | 25% | Skip | Skip |

**Deep ITM Spread Improvements:**
- ✅ **$5 Width Constraint** - Consistent risk per spread
- ✅ **Both Legs ITM** - Long 6-12% ITM, Short 2-10% ITM
- ✅ **Safety Priority** - Cushion weighted 20 pts (highest)
- ✅ **Safer Spreads First** - Higher cushion preferred over return

---

### v1.4.4 Features — Deep ITM Call Spreads ✅

**Complete Options Strategy Overhaul:**
- ✅ **Deep ITM Call Spreads** - Buy intrinsic value, not hope
- ✅ **Entry Checklist** - 7-point validation before recommending spreads
- ✅ **Discount Detection** - Shows when paying less than intrinsic value (>100%)
- ✅ **Low Theta Strategy** - Deep ITM spreads have minimal time decay
- ✅ **Defined Risk** - Max loss = net debit paid

**Entry Checklist Requirements:**
- Above MA200 (long-term trend up)
- RSI 35-55 (stable, not overbought)
- Analyst revisions positive
- No earnings within 10 days
- Momentum not severely deteriorating
- Fundamentals/Growth adequate
- Score ≥ 55

**Example Output:**
```
Entry Checklist:
  ✓ Above MA200: $181 > MA200 $154
  ✓ RSI Stable (35-55): RSI 46 ✓
  ✓ Analyst Revisions: 33 analysts raised, 1 cut estimates (30d)
  ...
✅ 7/7 checks passed — conditions favorable

Deep ITM Call Spreads:
  Buy intrinsic value, not hope | Low theta | Defined risk

Buy $170C / Sell $180C (Jan 1, 31 DTE) — ★★★ BEST
  Debit: $660 | Max Profit: $340 | Return: 52%
  Breakeven: $176.60 (2.7% below current)
  Intrinsic: 174% (discount!) of cost | Delta ≈ 82
```

---

### v1.4.3 Features — Bear Case Completeness ✅

**Bear Case Improvements:**
- ✅ **Relative Strength Warnings** - "Underperforming SPY across all timeframes" when lagging benchmark
- ✅ **Analyst Revisions Warning** - "Analysts cutting EPS estimates — negative sentiment"
- ✅ **Low Upside Warning** - "Limited upside (X%) — risk/reward may be unfavorable" for <8% upside
- ✅ **Complete Bear Cases** - No more "No major concerns identified" for stocks with issues

**Issues Fixed:**
- ✅ GIL: Now shows underperforming relative strength warning
- ✅ MRK: Now shows analyst estimate cuts + low upside warnings
- ✅ IPG: Now shows relative strength underperformance

---

### v1.4.2 Features — Logic Fixes & Momentum Integration ✅

**Verdict Logic Fixes:**
- ✅ **Fixed Score-Verdict Mismatch** - High score stocks (80+) no longer incorrectly labeled SPECULATIVE
- ✅ **Priority: Score over Upside** - Score 80+ = STRONG BUY, Score 65+ = BUY regardless of upside
- ✅ **Momentum-Aware Verdicts** - Severe momentum issues downgrade verdict by one level

**Bear Case Improvements:**
- ✅ **Momentum Warnings** - Price decline, EPS cuts, downgrades, insider selling now shown
- ✅ **Comprehensive Concerns** - Up to 6 concerns displayed (from 5)
- ✅ **Specific Momentum Flags** - "Price down X% (20d) — significant weakness"

**Bug Fixes:**
- ✅ **Relative Strength -100% Bug** - Fixed calculation errors from bad data
- ✅ **Data Validation** - Bounds checking for unrealistic returns (>1000% or <-99%)
- ✅ **Dead Code Removed** - Cleaned up unused helper functions and variables

**Code Quality:**
- ✅ **Zero Linter Warnings** - All unused imports and variables cleaned up
- ✅ **54/54 Tests Passing** - Full test suite verified

---

### v1.4.1 Features — Enhanced Display & Batch Scan Fixes ✅

**Display Improvements:**
- ✅ **Quarter Labels** - Shows `Q4'24 → Q1'25 → Q2'25 → Q3'25` for context
- ✅ **Consistent Formatting** - All quarters use same unit (B or M) for comparability
- ✅ **QoQ Growth %** - Shows sequential growth: `$1.01B → $0.93B (-9%) → $0.99B (+7%)`
- ✅ **Options Sorting Fixed** - Now sorted by safety rating (★★★ BEST first)
- ✅ **Valuation Warnings** - Bear case flags P/E above sector avg for ALL stocks (including growth)
- ✅ **Story Enhancements** - Quarterly insights in executive summary (beats/misses, revenue trend)

**Batch Scan Improvements:**
- ✅ **Suppressed Validation Errors** - No more verbose yahoo-finance2 schema errors
- ✅ **Cleaner Output** - Skipped tickers shown in summary, not individual warnings
- ✅ **Skip Counter** - Shows "X skipped due to missing data" at end of scan
- ✅ **Graceful Error Handling** - Validation errors treated as expected, not logged as warnings

---

### v1.4.0 Features — Quarterly Earnings Tracking ✅

**Goal**: Show quarter-over-quarter actual performance, not just projections.

**Data Available** (from Yahoo Finance `earnings` module):
- Quarterly revenue and earnings (last 4 quarters)
- EPS actual vs estimate (beat/miss)
- Surprise percentage

**Implemented Features**:
- ✅ **Quarterly Revenue Trend** - Q1 → Q2 → Q3 → Q4 revenue growth/decline with trend indicator
- ✅ **Quarterly Earnings Trend** - Show if earnings improving/declining/mixed QoQ
- ✅ **Beat/Miss History** - "Beat 3 of last 4 quarters" or "Missed 2 straight"
- ✅ **Sequential Improvement** - Detects margins improving QoQ
- ✅ **Earnings Surprise Trend** - Identifies consistently beating or missing patterns
- ✅ **Profitability Summary** - "Profitable X of Y quarters"
- ✅ **Management Insight** - Flags companies that under-promise/over-deliver

**Example Output**:
```
📊 QUARTERLY PERFORMANCE (Last 4Q)
────────────────────────────────────────────────────────────────────

Revenue:    $1.39B → $1.41B → $1.51B → $1.14B (📊 mixed)
Earnings:   $68M → $59M → $201M → $-129M (📊 mixed)
Beat/Miss:  N/A → Beat (+12600.0%) → Miss (-2.4%) → Miss (-6.3%)

Trend: Profitable 3 of 4 quarters. Missed 2 of last 3 quarters.
```

**Why This Matters**:
- DKNG shows -4.9% margin now, but was actually PROFITABLE in Q1-Q2
- Shows actual execution, not just analyst hopes
- Identifies seasonal patterns (DKNG weak in Q3 = off-season)
- NVDA shows "Consistently beating estimates — management under-promises"

---

### v1.3.4 Features — Profitability Trend
- ✅ **Profitability Momentum** - Shows if unprofitable companies are improving or worsening
- ✅ **Margin + Growth Context** - "Margin -4.9% but +183% growth expected"
- ✅ **Path to Profitability** - Indicates if company is moving toward/away from profitability

### v1.3.3 Features — Enhanced Momentum
- ✅ **EPS Estimate Trend** - Current EPS vs 30d/60d/90d ago (% change)
- ✅ **Analyst EPS Revisions** - # analysts raising vs cutting estimates (30d)
- ✅ **Insider Activity** - Net insider buying vs selling (6 months)
- ✅ **Institutional Ownership** - % institutional + # of holders

### v1.3.2 Features — Momentum Tracking
- ✅ **Analyst Sentiment Momentum** - Tracks if analyst bullishness is increasing
- ✅ **Rating Changes Momentum** - Counts upgrades vs downgrades over 90 days
- ✅ **Price Momentum** - 20-day and 50-day rate of change

### v1.3.1 Features — Fundamental Warnings
- ✅ **Unprofitable Company Warning** - Alerts when company has negative profit margins
- ✅ **Declining Earnings Warning** - Alerts when earnings are down significantly
- ✅ **Negative EBITDA Warning** - Alerts when cash flow is negative
- ✅ **Data Quality Indicator** - Shows if fundamental data is good/partial/poor

### v1.3.0 Features — Position Analyzer
- ✅ **Position Tracking** - Input your spread with `--position "111/112 Call Debit Spread"`
- ✅ **Risk Assessment** - Shows probability of profit and risk level (low/medium/high/critical)
- ✅ **Strike vs Support Analysis** - Shows where your critical strike sits relative to support levels
- ✅ **Cushion Calculator** - Displays how much the stock can move before threatening your position
- ✅ **Alert Levels** - Suggests warning and danger price levels to monitor

### v1.2.6 Features
- ✅ **Market Regime Detection** - Analyzes SPY to determine bull/bear/neutral market
- ✅ **Position Size Guidance** - Adjusts recommendations based on market conditions
- ✅ **Market Context Display** - Shows SPY vs MA200, MA50, momentum signals

### v1.2.5 Features
- ✅ **Combined Analyst + Technical Analysis** - Uses both for complete picture
- ✅ **Two-Target System** - T1 (R1 technical) for partial profits, T2 (analyst) for full target
- ✅ **Technical Stop Placement** - Stop based on S1 support level

### v1.2.4 Features
- ✅ **Fixed Entry Analysis** - Uses analyst targets instead of dynamic support (no moving goalposts)
- ✅ **Optimal Entry Detection** - Recognizes when price drop creates better opportunity

### v1.2.3 Features
- ✅ **Return on Risk Display** - Shows percentage return if trade wins
- ✅ **Required Win Rate** - The minimum win rate needed to break even
- ✅ **Cushion Display** - How far stock can drop before losing

### v1.2.2 Features
- ✅ **High Probability Options** - Spreads sorted by return on risk
- ✅ **Multiple Spread Candidates** - Shows 3 spreads at different levels
- ✅ **Clear Risk Labels** - ★★★ BEST, ★★ GOOD, ★ OK ratings

### v1.2.1 Features
- ✅ **Options Vertical Spreads** - Bull Put Spread recommendations for bullish stocks
- ✅ **Strike Selection** - Auto-selects optimal strikes based on support levels
- ✅ **Risk/Reward Display** - Shows max profit, max loss, breakeven for each spread
- ✅ **Earnings Awareness** - Warns when spreads will be affected by earnings IV crush

### v1.2.0 Features
- ✅ **Smart Entry Calculator** - Shows optimal entry prices for favorable R/R when current R/R is unfavorable
- ✅ **Relative Strength** - Compares stock performance vs SPY (20/50/200 day)
- ✅ **Better Entry Points** - Calculates R/R at each support level

### v1.1.3 Fixes
- ✅ **Fixed epochGradeDate Bug** - Analyst upgrade dates now compared correctly (Date vs epoch)
- ✅ **Graduated Upside Scoring** - ≥25% (8pts), ≥15% (5pts), ≥10% (3pts)
- ✅ **New Analyst Coverage Signal** - 3+ initiations in 90 days = 3pts
- ✅ **Better Upgrade Descriptions** - Shows "X up vs Y down (net +Z)"
- ✅ **TSM now scores 15/20** analyst (was 10/20 missing moderate upside signal)

### v1.1.2 Fixes
- ✅ **Fixed FCF Yield Calculation** - Now uses actual Market Cap (was broken formula)
- ✅ **Added Quality Signals** - Profit Margins (>20%=5pts) and ROE (>20%=5pts)
- ✅ **Graduated Scoring** - Partial credit for PEG <2, EV/EBITDA <20, FCF >3%
- ✅ **Relaxed Thresholds** - PEG <1.5 (was 1.0), FCF >3% (was 8%), EV/EBITDA <15 (was 12)
- ✅ **Fundamental scores now 10-15pts higher** for quality growth stocks

### v1.1.1 Fixes
- ✅ **Improved Sector Comparison** - Now shows both bullish (✓ green) and bearish (⚠ yellow) comparisons
- ✅ **Lowered Growth Threshold** - 35% earnings (was 50%) or 25% revenue (was 30%)
- ✅ **Analyst Target Fallback** - R/R uses analyst target when no resistance level exists
- ✅ **Direct P/E Extraction** - P/E from quote data, not signals (more reliable)

### v1.1 Features (Implemented)
- ✅ **Stock Style Classification** - `[GROWTH]`/`[VALUE]`/`[BLEND]` tags
- ✅ **Risk/Reward Ratio** - Calculated and displayed in Entry Strategy
- ✅ **Next Earnings Date** - Countdown with ⚠️ warning if < 14 days
- ✅ **Sector Comparison** - Compare P/E, PEG, EV/EBITDA to sector averages
- ✅ **Style-Adjusted Narrative** - Growth stocks don't get "weak value metrics" warnings

### v1.0 Features
- Composite scoring (Technical/Fundamental/Analyst)
- Narrative-driven `analyze` command
- ASCII price charts with MA overlays
- Support/resistance detection
- 52-week context and MA200 positioning
- Graduated technical scoring
- Actionable verdicts with entry strategies

---

## Version 1.1 Implementation Details

### 1. Growth vs Value Distinction

**Problem**: High-growth stocks (e.g., HOOD with 260% earnings growth) get flagged 
for "weak value metrics" even though value metrics are irrelevant for growth plays.

**Solution**: Classify stocks and adjust narrative accordingly.

```typescript
type StockStyle = "growth" | "value" | "blend";

function classifyStock(summary: QuoteSummary): StockStyle {
  const earningsGrowth = summary.financialData?.earningsGrowth?.raw ?? 0;
  const revenueGrowth = summary.financialData?.revenueGrowth?.raw ?? 0;
  const peg = summary.defaultKeyStatistics?.pegRatio?.raw;
  
  // High growth: >50% earnings or >30% revenue growth
  if (earningsGrowth > 0.5 || revenueGrowth > 0.3) return "growth";
  
  // Value: PEG < 1 or P/E < 15
  if (peg && peg < 1) return "value";
  
  return "blend";
}
```

**Narrative Changes**:
- **Growth stocks**: Emphasize momentum, growth trajectory, analyst targets
- **Value stocks**: Emphasize P/E, FCF yield, dividend potential
- **Blend**: Current balanced approach

**Files to modify**:
- `src/types/index.ts` - Add `stockStyle` to `StockScore`
- `src/engine/scorer.ts` - Add classification logic
- `src/index.ts` - Adjust story generation based on style

---

### 2. Risk/Reward Ratio Display

**Problem**: Entry strategy shows stop loss and target but doesn't show if the 
trade makes mathematical sense.

**Solution**: Calculate and display risk/reward ratio.

```typescript
function calculateRiskReward(
  currentPrice: number,
  stopLoss: number,
  target: number
): { ratio: number; favorable: boolean } {
  const risk = currentPrice - stopLoss;
  const reward = target - currentPrice;
  const ratio = reward / risk;
  
  return {
    ratio: Math.round(ratio * 10) / 10,
    favorable: ratio >= 2.0  // 2:1 minimum for favorable
  };
}
```

**Display**:
```
Entry Strategy:
  • Near support — current entry viable with stop below $169.41
  • First target: $184.31 (+4.1%)
  • Risk/Reward: 1:2.3 ✅ (favorable)
```

**Color coding**:
- `ratio >= 3.0`: Green "Excellent"
- `ratio >= 2.0`: Green "Favorable"  
- `ratio >= 1.5`: Yellow "Acceptable"
- `ratio < 1.5`: Red "Unfavorable"

**Files to modify**:
- `src/index.ts` - Add ratio calculation in `generateVerdict()`

---

### 3. Next Earnings Date

**Problem**: Earnings are high-impact catalysts. Users should know if earnings 
are imminent before entering a position.

**Solution**: Display next earnings date with countdown.

```typescript
// Yahoo Finance provides this in quoteSummary
const earningsDate = summary.calendarEvents?.earnings?.earningsDate?.[0];

if (earningsDate) {
  const daysUntil = Math.ceil(
    (new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysUntil <= 14) {
    // Flag as high-impact
    console.log(`⚠️  Earnings in ${daysUntil} days — elevated volatility risk`);
  }
}
```

**Display in 52-WEEK CONTEXT section**:
```
📅 52-WEEK CONTEXT
────────────────────────────────────────────────────────────────────

52-Week Range: $86.62 [──────────────●─────] $212.19
             +104.3% from low  |  -16.6% from high

MA200: $153.67 — price is 13.2% above (long-term trend)
Market Cap: $4.32T
Next Earnings: Dec 15, 2025 (15 days) ⚠️
```

**Bear case addition** (if earnings < 14 days):
```
⚠️  Earnings in 12 days — consider waiting or sizing down
```

**Files to modify**:
- `src/types/index.ts` - Add `nextEarningsDate` to `WeekContext`
- `src/engine/scorer.ts` - Populate earnings date
- `src/index.ts` - Display in context section and bear case

---

### 4. Sector Comparison

**Problem**: A P/E of 25 is expensive for utilities but cheap for tech. 
No sector context is provided.

**Solution**: Compare key metrics to sector averages.

**Implementation approach**:

```typescript
// Sector benchmark data (can be hardcoded or fetched)
const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  "Technology": { avgPE: 28, avgPEG: 1.8, avgFCFYield: 4 },
  "Healthcare": { avgPE: 22, avgPEG: 2.0, avgFCFYield: 5 },
  "Financials": { avgPE: 12, avgPEG: 1.2, avgFCFYield: 8 },
  "Consumer Cyclical": { avgPE: 20, avgPEG: 1.5, avgFCFYield: 5 },
  // ... etc
};

function compareToBenchmark(
  sector: string,
  pe: number,
  peg: number
): string[] {
  const benchmark = SECTOR_BENCHMARKS[sector];
  if (!benchmark) return [];
  
  const signals: string[] = [];
  
  if (pe < benchmark.avgPE * 0.8) {
    signals.push(`P/E ${pe.toFixed(1)} is 20%+ below ${sector} avg`);
  }
  
  return signals;
}
```

**Display**:
```
💰 Fundamental  ███████░░░░░░░░░░░░░ 11/30
   vs Technology sector: P/E 28 (avg 32), FCF 5.2% (avg 4%)
```

**Data source options**:
1. Hardcoded benchmarks (simplest, update quarterly)
2. Fetch from Yahoo Finance sector ETFs (XLK, XLF, etc.)
3. Calculate from scanned stocks in same sector

**Files to modify**:
- `src/config/sectors.ts` - New file with sector benchmarks
- `src/signals/fundamental.ts` - Add sector comparison
- `src/index.ts` - Display comparison in score breakdown

---

## Version 1.6: Scan Revamp (Planned)

### Problem Statement
The current scan shows all stocks meeting score threshold, but many are marked PASS by the decision engine. Users waste time reviewing stocks that aren't actionable.

### Planned Improvements

**1. Full Decision Engine Integration**
- Run complete decision engine on top results (not just quick check)
- Fetch options data for top 20-30 candidates
- Show spread recommendations directly in scan results

**2. Smart Filtering**
- Default to showing only ENTER and WAIT decisions
- Add `--all` flag to show PASS results
- Add `--enter-only` flag for strictest filtering

**3. Rich Scan Output**
```
  Actionable Opportunities - 12/3/2025
┌────────┬─────────┬────────┬────────────┬────────────────────────────────┐
│ Ticker │ Price   │ Score  │ Decision   │ Spread Recommendation          │
├────────┼─────────┼────────┼────────────┼────────────────────────────────┤
│ AMZN   │ $231    │ 75     │ ✅ ENTER   │ $210/$215C • $450 • 7.7% cush  │
│ ALL    │ $209    │ 78     │ ✅ ENTER   │ No spread data available       │
│ NVDA   │ $180    │ 69     │ ✅ ENTER   │ $165/$170C • $410 • 6.8% cush  │
└────────┴─────────┴────────┴────────────┴────────────────────────────────┘
```

**4. Confidence Thresholds**
- Add `--min-confidence <n>` flag to filter by decision confidence
- Show confidence score in results table

**5. Batch Analysis Mode**
- `bun run scan --analyze-top 10` - Run full analysis on top 10
- Generate report with all spread recommendations
- Export to JSON for frontend consumption

**6. Scan Profiles**
- `--profile conservative` - Higher thresholds, ENTER only
- `--profile aggressive` - Lower thresholds, include WAIT
- `--profile earnings` - Focus on stocks near earnings

### Implementation Priority
| Feature | Effort | Impact |
|---------|--------|--------|
| Smart Filtering | Low | High |
| Confidence Filter | Low | Medium |
| Full Decision Integration | High | High |
| Batch Analysis Mode | Medium | High |
| Scan Profiles | Medium | Medium |

---

## Version 1.7: Advanced Features (Future)

### Momentum Scoring
- Track score changes over 7/14/30 days
- Bonus points for improving scores
- "Emerging Opportunity" flag for new high-scorers

### Portfolio Integration
- Track positions and entry prices
- Calculate unrealized P&L
- Alert when price hits targets or stops

### Watchlist Management
- Save tickers to watchlists
- Scheduled scans with notifications
- Export to CSV/JSON

### ML Signal Weighting
- Learn which signals correlate with future returns
- Adjust weights based on historical accuracy
- Backtest scoring model

---

## Implementation Priority

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Risk/Reward Ratio | Low | High | 🟢 Do First |
| Growth vs Value | Medium | High | 🟢 Do Second |
| Next Earnings Date | Low | Medium | 🟡 Nice to Have |
| Sector Comparison | High | Medium | 🟡 Nice to Have |

---

## File Change Summary

```
src/
├── types/index.ts          # Add stockStyle, nextEarningsDate
├── config/
│   ├── thresholds.ts       # (existing)
│   └── sectors.ts          # NEW: sector benchmarks
├── engine/scorer.ts        # Add classification, earnings date
├── signals/fundamental.ts  # Add sector comparison
└── index.ts                # Risk/reward, style-based narrative
```

---

## Testing Checklist

### Automated Tests (54 tests)

```bash
bun test  # Run all tests
```

**Test Files:**
- `tests/support-resistance.test.ts` - Support/resistance detection (11 tests)
- `tests/analyst-signals.test.ts` - Analyst scoring (12 tests)
- `tests/fundamental-signals.test.ts` - Fundamental scoring (14 tests)
- `tests/integration.test.ts` - End-to-end with real API (17 tests)

### Manual Testing

v1.1+ features tested:

- [x] **Risk/Reward**: HOOD shows `1:1.9 ✅ (Acceptable)`
- [x] **Growth vs Value**: HOOD shows `[GROWTH]` (260% earnings)
- [x] **Sector Comparison**: NVDA shows `Technology`, HOOD shows `Financial Services`
- [x] **Support/Resistance**: HOOD S1=$120.68, S2=$98.20 (verified accurate)
- [x] **Analyst Scoring**: Graduated upside, date handling fixed
- [x] **Score Bounds**: All scores within valid ranges (Tech 0-50, Fund 0-30, Analyst 0-20)

