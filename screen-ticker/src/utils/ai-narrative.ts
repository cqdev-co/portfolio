/**
 * AI Narrative Generation
 * v1.6.0: Generates AI-powered narratives using Ollama
 *
 * Provides three key AI-generated sections:
 * - THE STORY: A narrative synthesis of all data points
 * - VERDICT: A nuanced recommendation with reasoning
 * - AI INSIGHTS: Unique perspectives and actionable guidance
 */

import type { StockScore, QuarterlyPerformance } from '../types/index.ts';
import type { MomentumAnalysis } from './momentum.ts';
import type { MarketContext } from './market-regime.ts';
import type { RelativeStrengthResult } from './relative-strength.ts';
import { generateCompletion, type OllamaConfig } from '../services/ollama.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface PositionContext {
  /** Parsed position details */
  lowerStrike: number;
  higherStrike: number;
  width: number;
  type: 'call_debit' | 'call_credit' | 'put_debit' | 'put_credit' | 'unknown';
  direction: 'bullish' | 'bearish' | 'neutral';
  criticalStrike: number;
  description: string;
  /** Position analysis */
  cushion: number;
  cushionPct: number;
  probabilityOfProfit: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Days to expiration (if known) */
  dte?: number;
  /** Current P&L % (if known) */
  currentPnlPct?: number;
}

export interface CatalystContext {
  /** Days until next earnings */
  daysToEarnings?: number;
  /** Earnings date string */
  earningsDate?: string;
  /** Ex-dividend date if within 30 days */
  exDividendDate?: string;
  /** Any known upcoming events */
  upcomingEvents?: string[];
}

export interface VolatilityContext {
  /** IV rank (0-100) */
  ivRank?: number;
  /** IV percentile (0-100) */
  ivPercentile?: number;
  /** Current IV */
  currentIV?: number;
  /** Historical volatility */
  historicalVolatility?: number;
  /** IV/HV ratio */
  ivHvRatio?: number;
  /** v1.7.0: Beta (stock volatility vs market) */
  beta?: number;
  /** v1.7.0: ATR (average true range) */
  atr14?: number;
  /** v1.7.0: ATR as percentage of price */
  atrPercent?: number;
}

export interface SectorContext {
  /** Sector name */
  sector: string;
  /** Industry within sector */
  industry?: string;
  /** Sector performance vs SPY (20d) */
  sectorVsSpy20d?: number;
  /** Is money flowing into or out of sector */
  sectorFlow?: 'inflow' | 'outflow' | 'neutral';
  /** Sector rating */
  sectorRating?: 'leading' | 'inline' | 'lagging' | 'underperforming';
  /** Sector ETF used for comparison */
  sectorETF?: string;
}

/** v1.7.0: Short Interest Context */
export interface ShortInterestContext {
  /** Short percent of float */
  shortPercentOfFloat?: number;
  /** Days to cover (short ratio) */
  daysToCover?: number;
  /** Squeeze potential level */
  squeezeRisk?: 'high' | 'moderate' | 'low';
}

/** v1.7.0: Balance Sheet Context */
export interface BalanceSheetContext {
  /** Debt to equity ratio */
  debtToEquity?: number;
  /** Current ratio */
  currentRatio?: number;
  /** Quick ratio */
  quickRatio?: number;
  /** Total cash */
  totalCash?: number;
  /** Total debt */
  totalDebt?: number;
  /** Net cash position (positive = more cash than debt) */
  netCash?: number;
  /** Balance sheet health rating */
  healthRating?:
    | 'fortress'
    | 'healthy'
    | 'moderate'
    | 'leveraged'
    | 'distressed';
}

export interface AIStockContext {
  ticker: string;
  name: string;
  price: number;
  score: StockScore;
  momentum: MomentumAnalysis | null;
  relativeStrength: {
    rs20: RelativeStrengthResult | null;
    rs50: RelativeStrengthResult | null;
    rs200: RelativeStrengthResult | null;
    overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  } | null;
  quarterlyPerformance: QuarterlyPerformance | null;
  marketContext: MarketContext | null;
  trend: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    description: string;
  } | null;
  rsi: {
    value: number;
    status: string;
  } | null;
  levels: {
    support1?: number;
    support2?: number;
    resistance1?: number;
    resistance2?: number;
    ma20?: number;
    ma50?: number;
    ma200?: number;
  } | null;
  /** User's current position (if any) */
  position?: PositionContext;
  /** Catalyst information */
  catalysts?: CatalystContext;
  /** Volatility context */
  volatility?: VolatilityContext;
  /** Sector rotation context */
  sectorContext?: SectorContext;
  /** v1.7.0: Short interest context */
  shortInterest?: ShortInterestContext;
  /** v1.7.0: Balance sheet health */
  balanceSheet?: BalanceSheetContext;
}

export interface AIStoryResult {
  story: string[];
  model: string;
  mode: string;
}

export interface AIVerdictResult {
  verdict: string[];
  model: string;
  mode: string;
}

export interface AIInsightsResult {
  insights: {
    thesis: string;
    uniqueAngle: string;
    primaryRisk: string;
    catalyst: string;
  };
  model: string;
  mode: string;
}

export interface AIAnalysisResult {
  story: AIStoryResult | null;
  verdict: AIVerdictResult | null;
  insights: AIInsightsResult | null;
  unified: AIUnifiedResult | null;
  error?: string;
}

export interface AIUnifiedResult {
  recommendation: string;
  confidence: string;
  analysis: string;
  entry: string;
  risk: string;
  model: string;
  mode: string;
  /** Position management advice (only when position provided) */
  positionAdvice?: {
    action: 'HOLD' | 'CLOSE' | 'ROLL' | 'ADD' | 'TRIM';
    reasoning: string;
    /** If ROLL, suggested new strikes */
    rollTo?: string;
    /** Key levels to watch for position */
    alertLevels?: {
      warning: number;
      danger: number;
    };
  };
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const STORY_SYSTEM_PROMPT = `You are an expert stock analyst providing concise, 
insightful narratives. Your job is to synthesize complex data into a clear, 
actionable story that helps investors understand the opportunity.

Guidelines:
- Be direct and specific, not generic
- Reference actual data points from the analysis
- Highlight what makes this stock unique right now
- Avoid clichés and boilerplate language
- Write 3-4 sentences maximum
- Do not use markdown formatting or bullet points
- Write in plain text paragraphs only`;

const VERDICT_SYSTEM_PROMPT = `You are an expert stock analyst providing 
investment recommendations. Your job is to give clear, actionable guidance 
based on all available data.

Guidelines:
- Start with a clear recommendation: BUY, WAIT, or AVOID
- Explain the 1-2 most important reasons for your recommendation
- Provide a specific entry strategy or conditions to watch
- Mention the primary risk that could invalidate the thesis
- Be decisive, not wishy-washy
- Write 4-5 sentences maximum
- Do not use markdown formatting
- Write in plain text only`;

const INSIGHTS_SYSTEM_PROMPT = `You are an expert stock analyst providing 
unique insights that go beyond standard analysis. Your job is to identify 
angles that other analysts might miss.

Provide exactly 4 items in this exact JSON format (no other text):
{
  "thesis": "One sentence investment thesis",
  "uniqueAngle": "What makes this opportunity different from consensus",
  "primaryRisk": "The single biggest risk to monitor",
  "catalyst": "What could trigger the next move"
}

Guidelines:
- Be specific to this stock, not generic
- Reference actual data from the analysis
- Provide actionable insights
- Output ONLY valid JSON, no other text`;

const UNIFIED_SYSTEM_PROMPT = `You are an expert stock analyst. Your job is to 
synthesize complex data into a clear, actionable recommendation.

THINKING PROCESS (work through this before concluding):
1. FUNDAMENTALS: Is the business quality strong enough to justify current valuation?
2. TECHNICALS: Are price action and momentum supportive or warning?
3. SMART MONEY: What do insiders, institutions, and analysts signal?
4. RISK/REWARD: At current price, is the upside worth the downside risk?
5. CONFLICTS: When bull and bear signals conflict, which is more important NOW?
6. CATALYSTS: Are there upcoming events that could move the stock?
7. SECTOR: Is the sector in favor or out of favor with the market?

After thinking through the above, provide your analysis in this exact JSON format:
{
  "recommendation": "BUY / WAIT / AVOID",
  "confidence": "HIGH / MODERATE / LOW",
  "analysis": "6-8 sentences synthesizing your thinking. Start with your 
conviction level and why. Address the key conflict in the data. Be specific 
with numbers. End with what would change your view.",
  "entry": "2-3 sentences with specific price levels for entry, confirmation signals",
  "risk": "2-3 sentences on primary risk, stop level, and what invalidates the thesis"
}

CRITICAL GUIDELINES:
- When bull/bear signals conflict, explain which you weight more heavily and WHY
- A 74/100 score means top 20% of stocks - but score alone doesn't mean BUY
- Insider selling during price strength is a warning sign
- Weak relative strength means the market is rotating away from this stock
- Reference the CONFLICTS section carefully - these are the key tensions to resolve
- If earnings are within 14 days, factor in event risk
- Output ONLY valid JSON, no other text`;

const POSITION_MANAGEMENT_PROMPT = `You are an expert options trader managing 
an existing position. Your job is to advise whether to HOLD, CLOSE, ROLL, ADD, 
or TRIM the position based on current market conditions.

POSITION ANALYSIS FRAMEWORK:
1. CUSHION: How much room does the position have before losing money?
2. TIME DECAY: Is theta working for or against this position?
3. PRICE ACTION: Is the stock moving in the position's favor?
4. SUPPORT/RESISTANCE: Are key levels protecting the position?
5. CATALYSTS: Are there events that could hurt/help the position?
6. RISK/REWARD: At current levels, is holding justified?

Provide your analysis in this exact JSON format:
{
  "recommendation": "BUY / WAIT / AVOID",
  "confidence": "HIGH / MODERATE / LOW",
  "analysis": "6-8 sentences on the overall stock outlook and how it affects your position.",
  "entry": "2-3 sentences - if recommending to add, when; otherwise skip or brief note",
  "risk": "2-3 sentences on primary risks to your POSITION specifically",
  "positionAdvice": {
    "action": "HOLD / CLOSE / ROLL / ADD / TRIM",
    "reasoning": "2-3 sentences explaining why this action for your specific position",
    "rollTo": "If ROLL, suggest new strikes like '$175/$180 Call Debit' or null",
    "alertLevels": {
      "warning": price_level_for_warning_alert,
      "danger": price_level_for_danger_alert
    }
  }
}

POSITION-SPECIFIC GUIDELINES:
- HOLD: Position has good cushion (>5%), stock thesis intact, no imminent threats
- CLOSE: Take profit (>50% max gain) or cut loss (broken support, thesis invalidated)
- ROLL: Position at risk but thesis intact - roll to safer strikes or later expiry
- ADD: Strong conviction, price pulled back, want to increase exposure
- TRIM: Take some profit but keep partial exposure
- For debit spreads: worry about price going BELOW your long strike
- For credit spreads: worry about price going ABOVE your short strike
- If DTE < 7 and position is profitable, lean toward CLOSE to avoid gamma risk
- Output ONLY valid JSON, no other text`;

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

/**
 * Identify key conflicts in the data for AI to resolve
 */
function identifyConflicts(ctx: AIStockContext): string[] {
  const conflicts: string[] = [];

  // Fundamental vs Valuation conflict
  const fundamentalScore = ctx.score.fundamentalScore;
  const pe = ctx.score.context?.trailingPE;
  if (fundamentalScore >= 15 && pe && pe > 30) {
    conflicts.push(
      `GROWTH vs VALUATION: Strong fundamentals (${fundamentalScore}/30) ` +
        `but P/E of ${pe.toFixed(0)} suggests premium pricing`
    );
  }

  // Insider selling during bullish analyst sentiment
  const insiderSignal = ctx.momentum?.signals.find(
    (s) => s.name === 'Insider Activity'
  );
  const analystSignal = ctx.momentum?.signals.find(
    (s) => s.name === 'Analyst Sentiment'
  );
  if (
    insiderSignal?.direction === 'deteriorating' &&
    (analystSignal?.direction === 'improving' ||
      analystSignal?.direction === 'stable')
  ) {
    conflicts.push(
      `SMART MONEY DIVERGENCE: Insiders are selling while analysts remain bullish ` +
        `— who knows the company better?`
    );
  }

  // Weak relative strength vs strong fundamentals
  if (
    ctx.relativeStrength?.overallTrend === 'weak' ||
    ctx.relativeStrength?.overallTrend === 'underperforming'
  ) {
    if (ctx.score.totalScore >= 70) {
      conflicts.push(
        `MARKET ROTATION: High score (${ctx.score.totalScore}/100) but ` +
          `underperforming SPY — is the market seeing something we're not?`
      );
    }
  }

  // Near resistance vs bullish trend
  const posInRange = ctx.score.context?.positionInRange;
  if (posInRange && posInRange > 0.75) {
    if (ctx.trend?.direction === 'bullish') {
      conflicts.push(
        `TREND vs LEVELS: Bullish trend but at ${(posInRange * 100).toFixed(0)}% ` +
          `of 52-week range — breakout or exhaustion?`
      );
    }
  }

  // Strong score but near resistance
  if (ctx.levels?.resistance1 && ctx.score.totalScore >= 70) {
    const distToResistance =
      ((ctx.levels.resistance1 - ctx.price) / ctx.price) * 100;
    if (distToResistance < 3) {
      conflicts.push(
        `ENTRY TIMING: Strong setup but only ${distToResistance.toFixed(1)}% ` +
          `below resistance — enter now or wait for breakout confirmation?`
      );
    }
  }

  // Momentum improving but price weak
  if (ctx.momentum?.overallTrend === 'improving') {
    const priceMom = ctx.momentum.signals.find(
      (s) => s.name === 'Price Momentum'
    );
    if (
      priceMom?.direction === 'deteriorating' ||
      priceMom?.direction === 'stable'
    ) {
      conflicts.push(
        `MOMENTUM DIVERGENCE: Underlying metrics improving but price not ` +
          `responding — accumulation phase or dead cat?`
      );
    }
  }

  return conflicts.slice(0, 4); // Limit to top 4 conflicts
}

/**
 * Build a structured context string for AI prompts
 */
function buildContextString(ctx: AIStockContext): string {
  const parts: string[] = [];

  // Basic info
  parts.push(`TICKER: ${ctx.ticker}`);
  parts.push(`NAME: ${ctx.name}`);
  parts.push(`CURRENT PRICE: $${ctx.price.toFixed(2)}`);
  parts.push(`STOCK STYLE: ${ctx.score.stockStyle ?? 'blend'}`);

  // Score breakdown with calibration context
  parts.push('');
  parts.push('=== SCORES (with calibration) ===');
  parts.push(`Total Score: ${ctx.score.totalScore}/100`);

  // Calibration context
  let scoreContext = '';
  if (ctx.score.totalScore >= 80) {
    scoreContext = ' [TOP 5% - exceptional setup]';
  } else if (ctx.score.totalScore >= 70) {
    scoreContext = ' [TOP 15% - strong setup]';
  } else if (ctx.score.totalScore >= 60) {
    scoreContext = ' [TOP 30% - above average]';
  } else if (ctx.score.totalScore >= 50) {
    scoreContext = ' [AVERAGE - mixed signals]';
  } else {
    scoreContext = ' [BELOW AVERAGE - significant concerns]';
  }
  parts.push(`Score Context:${scoreContext}`);

  parts.push(`Technical: ${ctx.score.technicalScore}/50 (avg ~25, strong >35)`);
  parts.push(
    `Fundamental: ${ctx.score.fundamentalScore}/30 (growth stocks often <20)`
  );
  parts.push(
    `Analyst: ${ctx.score.analystScore}/20 (max is 20, >15 is bullish consensus)`
  );
  parts.push(
    `Upside Potential: ${(ctx.score.upsidePotential * 100).toFixed(0)}%`
  );

  // Identify and add conflicts
  const conflicts = identifyConflicts(ctx);
  if (conflicts.length > 0) {
    parts.push('');
    parts.push('=== KEY CONFLICTS TO RESOLVE ===');
    conflicts.forEach((conflict, i) => {
      parts.push(`${i + 1}. ${conflict}`);
    });
  }

  // 52-week context
  if (ctx.score.context) {
    const c = ctx.score.context;
    parts.push('');
    parts.push('=== 52-WEEK CONTEXT ===');
    if (c.low52 && c.high52) {
      parts.push(
        `52-Week Range: $${c.low52.toFixed(2)} - $${c.high52.toFixed(2)}`
      );
    }
    if (c.positionInRange !== undefined) {
      parts.push(`Position in Range: ${(c.positionInRange * 100).toFixed(0)}%`);
    }
    if (c.ma200) {
      const pctFromMA = (((ctx.price - c.ma200) / c.ma200) * 100).toFixed(1);
      parts.push(
        `MA200: $${c.ma200.toFixed(2)} (${pctFromMA}% ${ctx.price > c.ma200 ? 'above' : 'below'})`
      );
    }
    if (c.sector) {
      parts.push(`Sector: ${c.sector}`);
    }
    if (c.marketCap) {
      const capStr =
        c.marketCap >= 1e12
          ? `$${(c.marketCap / 1e12).toFixed(1)}T`
          : c.marketCap >= 1e9
            ? `$${(c.marketCap / 1e9).toFixed(1)}B`
            : `$${(c.marketCap / 1e6).toFixed(0)}M`;
      parts.push(`Market Cap: ${capStr}`);
    }
    if (c.nextEarningsDate) {
      const days = Math.ceil(
        (c.nextEarningsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      parts.push(`Next Earnings: ${days} days away`);
    }
  }

  // Market regime
  if (ctx.marketContext) {
    parts.push('');
    parts.push('=== MARKET CONTEXT ===');
    parts.push(`Market Regime: ${ctx.marketContext.regime.toUpperCase()}`);
    parts.push(`SPY: $${ctx.marketContext.spyPrice.toFixed(2)}`);
    parts.push(`Signals: ${ctx.marketContext.signals.join(', ')}`);
  }

  // Momentum
  if (ctx.momentum) {
    parts.push('');
    parts.push('=== MOMENTUM ===');
    parts.push(`Overall Trend: ${ctx.momentum.overallTrend}`);
    for (const signal of ctx.momentum.signals) {
      parts.push(`${signal.name}: ${signal.direction} - ${signal.description}`);
    }
  }

  // Relative Strength
  if (ctx.relativeStrength) {
    parts.push('');
    parts.push('=== RELATIVE STRENGTH (vs SPY) ===');
    parts.push(`Overall: ${ctx.relativeStrength.overallTrend}`);
    if (ctx.relativeStrength.rs20) {
      parts.push(
        `20-day: Stock ${(ctx.relativeStrength.rs20.stockReturn * 100).toFixed(1)}% ` +
          `vs SPY ${(ctx.relativeStrength.rs20.spyReturn * 100).toFixed(1)}%`
      );
    }
    if (ctx.relativeStrength.rs50) {
      parts.push(
        `50-day: Stock ${(ctx.relativeStrength.rs50.stockReturn * 100).toFixed(1)}% ` +
          `vs SPY ${(ctx.relativeStrength.rs50.spyReturn * 100).toFixed(1)}%`
      );
    }
  }

  // Quarterly Performance
  if (ctx.quarterlyPerformance) {
    const qp = ctx.quarterlyPerformance;
    parts.push('');
    parts.push('=== QUARTERLY PERFORMANCE ===');
    parts.push(`Revenue Trend: ${qp.revenueTrend}`);
    parts.push(`Earnings Trend: ${qp.earningsTrend}`);
    parts.push(`Beat/Miss: ${qp.beatMissRecord.summary}`);
    parts.push(
      `Profitable Quarters: ${qp.profitableQuarters}/${qp.totalQuarters}`
    );
    if (qp.surpriseTrend !== 'insufficient_data') {
      parts.push(`Surprise Pattern: ${qp.surpriseTrend}`);
    }
  }

  // Technical Analysis
  if (ctx.trend) {
    parts.push('');
    parts.push('=== TECHNICAL ANALYSIS ===');
    parts.push(`Trend: ${ctx.trend.direction} (${ctx.trend.strength})`);
    parts.push(`Description: ${ctx.trend.description}`);
  }
  if (ctx.rsi) {
    parts.push(`RSI: ${ctx.rsi.value.toFixed(1)} (${ctx.rsi.status})`);
  }

  // Key Levels
  if (ctx.levels) {
    parts.push('');
    parts.push('=== KEY LEVELS ===');
    if (ctx.levels.support1) {
      parts.push(`Support 1: $${ctx.levels.support1.toFixed(2)}`);
    }
    if (ctx.levels.support2) {
      parts.push(`Support 2: $${ctx.levels.support2.toFixed(2)}`);
    }
    if (ctx.levels.resistance1) {
      parts.push(`Resistance 1: $${ctx.levels.resistance1.toFixed(2)}`);
    }
    if (ctx.levels.ma20) {
      parts.push(`MA20: $${ctx.levels.ma20.toFixed(2)}`);
    }
    if (ctx.levels.ma50) {
      parts.push(`MA50: $${ctx.levels.ma50.toFixed(2)}`);
    }
  }

  // Bull and Bear Signals
  const bullSignals = ctx.score.signals
    .filter((s) => s.points >= 3)
    .slice(0, 5);
  const bearSignals = ctx.score.warnings ?? [];

  if (bullSignals.length > 0) {
    parts.push('');
    parts.push('=== BULL SIGNALS ===');
    for (const s of bullSignals) {
      parts.push(`${s.name}: ${s.description}`);
    }
  }

  if (bearSignals.length > 0) {
    parts.push('');
    parts.push('=== BEAR SIGNALS ===');
    for (const s of bearSignals) {
      parts.push(`${s.name}: ${s.description}`);
    }
  }

  // Quick summary for AI
  parts.push('');
  parts.push('=== QUICK SUMMARY ===');
  parts.push(`Bull signals: ${bullSignals.length}`);
  parts.push(`Bear signals: ${bearSignals.length}`);

  // Momentum summary
  if (ctx.momentum) {
    const improving = ctx.momentum.signals.filter(
      (s) => s.direction === 'improving'
    ).length;
    const deteriorating = ctx.momentum.signals.filter(
      (s) => s.direction === 'deteriorating'
    ).length;
    parts.push(
      `Momentum: ${improving} improving, ${deteriorating} deteriorating`
    );
  }

  // Position context (if user has a position)
  if (ctx.position) {
    const p = ctx.position;
    parts.push('');
    parts.push('=== YOUR CURRENT POSITION ===');
    parts.push(`Position: ${p.description}`);
    parts.push(`Type: ${p.type.replace('_', ' ').toUpperCase()}`);
    parts.push(`Direction: ${p.direction.toUpperCase()}`);
    parts.push(
      `Critical Strike: $${p.criticalStrike} (lose money ${p.direction === 'bullish' ? 'below' : 'above'} this)`
    );
    parts.push(
      `Current Cushion: ${p.cushionPct.toFixed(1)}% ($${p.cushion.toFixed(2)})`
    );
    parts.push(`Probability of Profit: ~${p.probabilityOfProfit}%`);
    parts.push(`Risk Level: ${p.riskLevel.toUpperCase()}`);
    if (p.dte !== undefined) {
      parts.push(`Days to Expiration: ${p.dte}`);
      if (p.dte <= 7) {
        parts.push(`⚠️ WARNING: Low DTE - gamma risk elevated`);
      }
    }
    if (p.currentPnlPct !== undefined) {
      parts.push(
        `Current P&L: ${p.currentPnlPct > 0 ? '+' : ''}${p.currentPnlPct.toFixed(1)}%`
      );
    }

    // Position-specific conflicts
    if (p.cushionPct < 5) {
      conflicts.push(
        `POSITION AT RISK: Only ${p.cushionPct.toFixed(1)}% cushion to critical strike — ` +
          `should you close or hold?`
      );
    }
    if (p.dte !== undefined && p.dte <= 7 && p.cushionPct < 10) {
      conflicts.push(
        `TIME DECAY PRESSURE: ${p.dte} DTE with only ${p.cushionPct.toFixed(1)}% cushion — ` +
          `close now or risk gamma?`
      );
    }
  }

  // Catalyst context
  if (ctx.catalysts) {
    const c = ctx.catalysts;
    parts.push('');
    parts.push('=== UPCOMING CATALYSTS ===');
    if (c.daysToEarnings !== undefined) {
      parts.push(
        `Earnings: ${c.daysToEarnings} days away${c.earningsDate ? ` (${c.earningsDate})` : ''}`
      );
      if (c.daysToEarnings <= 14) {
        parts.push(
          `⚠️ EARNINGS RISK: Event within 2 weeks — factor in IV crush and gap risk`
        );
      }
    } else {
      parts.push(`Earnings: No imminent earnings date`);
    }
    if (c.exDividendDate) {
      parts.push(`Ex-Dividend: ${c.exDividendDate}`);
    }
    if (c.upcomingEvents && c.upcomingEvents.length > 0) {
      parts.push(`Events: ${c.upcomingEvents.join(', ')}`);
    }
  }

  // Volatility context
  if (ctx.volatility) {
    const v = ctx.volatility;
    parts.push('');
    parts.push('=== VOLATILITY CONTEXT ===');
    if (v.beta !== undefined) {
      const betaDesc =
        v.beta > 1.5
          ? 'HIGH volatility vs market'
          : v.beta > 1.1
            ? 'Above average volatility'
            : v.beta > 0.9
              ? 'Market-like volatility'
              : v.beta > 0.5
                ? 'Below average volatility'
                : 'LOW volatility (defensive)';
      parts.push(`Beta: ${v.beta.toFixed(2)} (${betaDesc})`);
    }
    if (v.atr14 !== undefined && v.atrPercent !== undefined) {
      const atrDesc =
        v.atrPercent > 5
          ? 'HIGH daily swings'
          : v.atrPercent > 3
            ? 'Moderate volatility'
            : v.atrPercent > 1.5
              ? 'Normal volatility'
              : 'Low volatility';
      parts.push(
        `ATR(14): $${v.atr14.toFixed(2)} (${v.atrPercent.toFixed(1)}% daily range — ${atrDesc})`
      );
    }
    if (v.ivRank !== undefined) {
      parts.push(
        `IV Rank: ${v.ivRank}% (${v.ivRank < 30 ? 'LOW' : v.ivRank < 70 ? 'MODERATE' : 'HIGH'})`
      );
    }
    if (v.ivPercentile !== undefined) {
      parts.push(`IV Percentile: ${v.ivPercentile}%`);
    }
    if (v.ivHvRatio !== undefined) {
      const ivHvStatus =
        v.ivHvRatio > 1.2
          ? 'IV elevated vs HV'
          : v.ivHvRatio < 0.8
            ? 'IV depressed vs HV'
            : 'IV near HV';
      parts.push(`IV/HV Ratio: ${v.ivHvRatio.toFixed(2)} (${ivHvStatus})`);
    }
  }

  // Sector context
  if (ctx.sectorContext) {
    const s = ctx.sectorContext;
    parts.push('');
    parts.push('=== SECTOR CONTEXT ===');
    parts.push(`Sector: ${s.sector}`);
    if (s.industry) {
      parts.push(`Industry: ${s.industry}`);
    }
    if (s.sectorETF) {
      parts.push(`Sector ETF: ${s.sectorETF}`);
    }
    if (s.sectorVsSpy20d !== undefined) {
      const flow =
        s.sectorVsSpy20d > 2
          ? 'outperforming'
          : s.sectorVsSpy20d < -2
            ? 'underperforming'
            : 'inline with';
      parts.push(
        `20-day vs SPY: ${s.sectorVsSpy20d > 0 ? '+' : ''}${s.sectorVsSpy20d.toFixed(1)}% (${flow} market)`
      );
    }
    if (s.sectorRating) {
      parts.push(`Sector Rating: ${s.sectorRating.toUpperCase()}`);
    }
    if (s.sectorFlow) {
      parts.push(`Money Flow: ${s.sectorFlow.toUpperCase()}`);
    }
  }

  // v1.7.0: Short Interest context
  if (ctx.shortInterest) {
    const si = ctx.shortInterest;
    parts.push('');
    parts.push('=== SHORT INTEREST ===');
    if (si.shortPercentOfFloat !== undefined) {
      const shortPct =
        si.shortPercentOfFloat > 1
          ? si.shortPercentOfFloat
          : si.shortPercentOfFloat * 100;
      parts.push(`Short % of Float: ${shortPct.toFixed(1)}%`);
    }
    if (si.daysToCover !== undefined) {
      parts.push(`Days to Cover: ${si.daysToCover.toFixed(1)}`);
    }
    if (si.squeezeRisk) {
      parts.push(`Squeeze Risk: ${si.squeezeRisk.toUpperCase()}`);
      if (si.squeezeRisk === 'high') {
        parts.push(`⚠️ High short interest — potential squeeze but also risk`);
      }
    }
  }

  // v1.7.0: Balance Sheet context
  if (ctx.balanceSheet) {
    const bs = ctx.balanceSheet;
    parts.push('');
    parts.push('=== BALANCE SHEET HEALTH ===');
    if (bs.healthRating) {
      parts.push(`Health Rating: ${bs.healthRating.toUpperCase()}`);
    }
    if (bs.debtToEquity !== undefined) {
      parts.push(`Debt/Equity: ${bs.debtToEquity.toFixed(2)}`);
    }
    if (bs.currentRatio !== undefined) {
      parts.push(`Current Ratio: ${bs.currentRatio.toFixed(2)}`);
    }
    if (bs.netCash !== undefined) {
      const netCashStr =
        Math.abs(bs.netCash) >= 1e9
          ? `$${(bs.netCash / 1e9).toFixed(1)}B`
          : `$${(bs.netCash / 1e6).toFixed(0)}M`;
      parts.push(
        `Net Cash: ${netCashStr} ${bs.netCash > 0 ? '(cash rich)' : '(net debt)'}`
      );
    }
    if (bs.healthRating === 'distressed' || bs.healthRating === 'leveraged') {
      parts.push(`⚠️ Elevated debt — monitor for refinancing risk`);
    }
  }

  // Key question for AI
  parts.push('');
  parts.push('=== KEY QUESTION ===');
  if (ctx.position) {
    parts.push(`You have an existing ${ctx.position.description}.`);
    parts.push(`Should you HOLD, CLOSE, ROLL, ADD, or TRIM this position?`);
    parts.push(`Consider your cushion, time decay, and the stock's outlook.`);
  } else if (conflicts.length > 0) {
    parts.push(`Given the conflicts above, is this a BUY, WAIT, or AVOID?`);
    parts.push(`Your recommendation must address conflict #1 directly.`);
  } else {
    parts.push(`Is this a BUY, WAIT, or AVOID at current levels?`);
  }

  return parts.join('\n');
}

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate AI-powered story narrative
 */
export async function generateAIStory(
  config: OllamaConfig,
  ctx: AIStockContext
): Promise<AIStoryResult> {
  const contextStr = buildContextString(ctx);
  const userPrompt = `Based on the following stock analysis data, write a 
compelling 3-4 sentence narrative that tells the story of ${ctx.ticker}. 
Focus on what makes this opportunity interesting right now and what investors 
should pay attention to.

${contextStr}`;

  const response = await generateCompletion(
    config,
    STORY_SYSTEM_PROMPT,
    userPrompt
  );

  // Split response into lines for display
  const story = response.content
    .split(/\n+/)
    .filter((line) => line.trim().length > 0);

  return {
    story,
    model: response.model,
    mode: response.mode,
  };
}

/**
 * Generate AI-powered verdict
 */
export async function generateAIVerdict(
  config: OllamaConfig,
  ctx: AIStockContext
): Promise<AIVerdictResult> {
  const contextStr = buildContextString(ctx);
  const userPrompt = `Based on the following stock analysis data, provide a 
clear investment recommendation for ${ctx.ticker}. Be decisive and specific 
about entry strategy and risk management.

${contextStr}`;

  const response = await generateCompletion(
    config,
    VERDICT_SYSTEM_PROMPT,
    userPrompt
  );

  // Split response into lines for display
  const verdict = response.content
    .split(/\n+/)
    .filter((line) => line.trim().length > 0);

  return {
    verdict,
    model: response.model,
    mode: response.mode,
  };
}

/**
 * Generate AI-powered insights
 */
export async function generateAIInsights(
  config: OllamaConfig,
  ctx: AIStockContext
): Promise<AIInsightsResult> {
  const contextStr = buildContextString(ctx);
  const userPrompt = `Based on the following stock analysis data for 
${ctx.ticker}, provide unique insights in JSON format.

${contextStr}`;

  const response = await generateCompletion(
    config,
    INSIGHTS_SYSTEM_PROMPT,
    userPrompt
  );

  // Parse JSON response
  let insights: AIInsightsResult['insights'];
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      insights = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch {
    // Fallback if JSON parsing fails
    insights = {
      thesis: 'Unable to generate thesis',
      uniqueAngle: 'Unable to generate unique angle',
      primaryRisk: 'Unable to assess primary risk',
      catalyst: 'Unable to identify catalyst',
    };
  }

  return {
    insights,
    model: response.model,
    mode: response.mode,
  };
}

/**
 * Generate unified AI analysis (recommended - single comprehensive section)
 * When a position is provided, switches to position management mode
 */
export async function generateUnifiedAIAnalysis(
  config: OllamaConfig,
  ctx: AIStockContext
): Promise<AIUnifiedResult> {
  const contextStr = buildContextString(ctx);
  const hasPosition = ctx.position !== undefined;

  // Use position management prompt when user has a position
  const systemPrompt = hasPosition
    ? POSITION_MANAGEMENT_PROMPT
    : UNIFIED_SYSTEM_PROMPT;

  const userPrompt = hasPosition
    ? `You are managing an existing ${ctx.position?.description} on ${ctx.ticker}.
Based on the following analysis data, advise on position management in JSON format.

${contextStr}`
    : `Based on the following comprehensive stock analysis data 
for ${ctx.ticker}, provide a unified investment analysis in JSON format.

${contextStr}`;

  const response = await generateCompletion(config, systemPrompt, userPrompt);

  // Parse JSON response
  let result: AIUnifiedResult;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        recommendation: parsed.recommendation ?? 'WAIT',
        confidence: parsed.confidence ?? 'MODERATE',
        analysis: parsed.analysis ?? 'Unable to generate analysis',
        entry: parsed.entry ?? 'Unable to generate entry strategy',
        risk: parsed.risk ?? 'Unable to assess risks',
        model: response.model,
        mode: response.mode,
      };

      // Parse position advice if provided
      if (hasPosition && parsed.positionAdvice) {
        result.positionAdvice = {
          action: parsed.positionAdvice.action ?? 'HOLD',
          reasoning:
            parsed.positionAdvice.reasoning ?? 'Unable to generate reasoning',
          rollTo: parsed.positionAdvice.rollTo ?? undefined,
          alertLevels: parsed.positionAdvice.alertLevels ?? undefined,
        };
      }
    } else {
      throw new Error('No JSON found in response');
    }
  } catch {
    result = {
      recommendation: 'WAIT',
      confidence: 'LOW',
      analysis: 'Unable to generate unified analysis',
      entry: 'Unable to generate entry strategy',
      risk: 'Unable to assess risks',
      model: response.model,
      mode: response.mode,
    };

    if (hasPosition) {
      result.positionAdvice = {
        action: 'HOLD',
        reasoning: 'Unable to analyze position - defaulting to HOLD',
      };
    }
  }

  return result;
}

/**
 * Generate all AI analysis sections
 */
export async function generateFullAIAnalysis(
  config: OllamaConfig,
  ctx: AIStockContext
): Promise<AIAnalysisResult> {
  try {
    // Generate unified analysis (primary) - single comprehensive section
    const unifiedResult = await generateUnifiedAIAnalysis(config, ctx);

    return {
      story: null,
      verdict: null,
      insights: null,
      unified: unifiedResult,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return {
      story: null,
      verdict: null,
      insights: null,
      unified: null,
      error: `AI analysis failed: ${errorMessage}`,
    };
  }
}

/**
 * Create AIStockContext from analysis data
 * v1.7.0: Added shortInterest and balanceSheet parameters
 */
export function createAIContext(
  score: StockScore,
  momentum: MomentumAnalysis | null,
  relativeStrength: {
    rs20: RelativeStrengthResult | null;
    rs50: RelativeStrengthResult | null;
    rs200: RelativeStrengthResult | null;
    overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  } | null,
  quarterlyPerformance: QuarterlyPerformance | null,
  marketContext: MarketContext | null,
  trend: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: 'strong' | 'moderate' | 'weak';
    description: string;
  } | null,
  rsi: { value: number; status: string } | null,
  levels: {
    support1?: number;
    support2?: number;
    resistance1?: number;
    resistance2?: number;
    ma20?: number;
    ma50?: number;
    ma200?: number;
  } | null,
  position?: PositionContext,
  catalysts?: CatalystContext,
  volatility?: VolatilityContext,
  sectorContext?: SectorContext,
  shortInterest?: ShortInterestContext,
  balanceSheet?: BalanceSheetContext
): AIStockContext {
  return {
    ticker: score.ticker,
    name: score.name ?? score.ticker,
    price: score.price,
    score,
    momentum,
    relativeStrength,
    quarterlyPerformance,
    marketContext,
    trend,
    rsi,
    levels,
    position,
    catalysts,
    volatility,
    sectorContext,
    shortInterest,
    balanceSheet,
  };
}
