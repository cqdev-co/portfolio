/**
 * TOON (Token-Oriented Object Notation) Context Builder
 * Uses @toon-format/toon for proper TOON encoding
 * 
 * TOON provides:
 * - YAML-like key: value for objects
 * - Tabular arrays[N]{fields}: for uniform data
 * - ~14% fewer tokens than JSON with better LLM accuracy (74% vs 70%)
 * 
 * This module provides shared functions for:
 * - analyze command
 * - debug command  
 * - chat command
 */

import { encode } from "@toon-format/toon";
import type { 
  Trade, 
  TradeType, 
  TradeOutcome,
  MarketRegime,
  TOONTrade, 
  TOONTickerContext, 
  TOONContext,
  TickerHistory,
  FairValueResult,
  StrategyRecommendation,
} from "../types/index.ts";
import type { PsychologicalFairValue } from "../../../lib/utils/ts/psychological-fair-value/types.ts";
import { 
  getKeyMagneticLevels, 
  hasMeanReversionSignal 
} from "../services/psychological-fair-value.ts";

// ============================================================================
// SHARED ANALYSIS DATA TYPES
// ============================================================================

/**
 * Rating change from analyst upgrade/downgrade
 */
export interface RatingChangeInput {
  date: string;
  firm: string;
  action: string;
  toGrade: string;
  fromGrade?: string;
  targetPrice?: number;
  priorTarget?: number;
}

/**
 * Analyst ratings breakdown
 */
export interface AnalystRatingsInput {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  bullishPercent: number;
  recentChanges: RatingChangeInput[];
}

/**
 * Ownership data
 */
export interface OwnershipInput {
  insidersPercent: number;
  institutionsPercent: number;
  institutionsCount: number;
  recentInsiderSales?: {
    totalValue: number;
    transactions: number;
    lastDate?: string;
  };
}

/**
 * Stock data input for TOON encoding
 */
export interface TargetPricesInput {
  low: number;
  mean: number;
  high: number;
  upside: number;
}

export interface PricePerformanceInput {
  day5: number;
  month1: number;
  month3: number;
  ytd: number;
}

export interface EarningsInfoInput {
  date?: string;
  daysUntil?: number;
  streak?: number;
  lastSurprise?: number;
  avgSurprise?: number;
}

export interface SectorContextInput {
  name: string;
  avgPE?: number;
  vsAvg?: number;
}

export interface VolumeAnalysisInput {
  todayPct: number;
  trend: 'increasing' | 'stable' | 'declining';
  unusualDays: number;
}

export interface RiskMetricsInput {
  beta?: number;
}

export interface VolatilityInput {
  iv?: number;          // Implied volatility %
  hv20?: number;        // 20-day historical volatility %
  ivRank?: number;      // IV percentile
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  premium?: 'cheap' | 'fair' | 'expensive';
}

export interface ShortInterestInput {
  shortPct: number;       // % of float shorted
  shortRatio: number;     // Days to cover
  sharesShort: number;
}

export interface RelativeStrengthInput {
  vsSPY: number;          // 30-day return vs SPY
  vsSector?: number;
}

export interface OptionsFlowInput {
  pcRatioOI: number;      // Put/Call ratio (open interest)
  pcRatioVol: number;     // Put/Call ratio (volume)
  totalCallOI: number;
  totalPutOI: number;
}

export interface RiskRewardInput {
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  profitPct: number;
  rrRatio: string;
  pop?: number;  // Probability of Profit (0-100%)
}

export interface StockDataInput {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  trailingPE?: number;
  forwardPE?: number;
  trailingEps?: number;
  forwardEps?: number;
  earningsGrowth?: number;
  revenueGrowth?: number;
  targetPrice?: number;
  numberOfAnalysts?: number;
  beta?: number;
  // Target price range
  targetPrices?: TargetPricesInput;
  // Price performance
  performance?: PricePerformanceInput;
  // Enhanced analyst data
  analystRatings?: AnalystRatingsInput;
  // Ownership data
  ownership?: OwnershipInput;
  // NEW: Earnings info
  earnings?: EarningsInfoInput;
  // NEW: Sector context
  sectorContext?: SectorContextInput;
  // NEW: Volume analysis
  volumeAnalysis?: VolumeAnalysisInput;
  // NEW: Risk metrics
  risk?: RiskMetricsInput;
  // NEW: Volatility metrics (IV vs HV)
  volatility?: VolatilityInput;
  // NEW: Short interest
  shortInterest?: ShortInterestInput;
  // NEW: Relative strength
  relativeStrength?: RelativeStrengthInput;
  // NEW: Options flow
  optionsFlow?: OptionsFlowInput;
  // NEW: Risk/Reward (calculated from spread)
  riskReward?: RiskRewardInput;
}

/**
 * Technical data input for TOON encoding
 */
export interface TechnicalDataInput {
  rsi?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  aboveMA200?: boolean;
  score?: number;
}

/**
 * Full analysis input for TOON encoding (used by analyze/debug/chat)
 */
export interface AnalysisDataInput {
  stock: StockDataInput;
  technical: TechnicalDataInput | null;
  fairValue: FairValueResult;
  strategy: StrategyRecommendation;
  alternatives: StrategyRecommendation[];
  marketRegime: MarketRegime;
  pfv: PsychologicalFairValue | null;
}

// ============================================================================
// SHARED TOON ENCODING (using @toon-format/toon)
// ============================================================================

/**
 * Build system prompt for AI analysis
 * Shared across analyze, debug, and chat commands
 */
export function buildAnalysisSystemPrompt(accountSize: number): string {
  return `You are an AI analyst for a $${accountSize} options account.
Data is in TOON format (token-optimized). Analyze and provide:
1. ENTRY: now/wait/pass with reason
2. RISKS: key risks to watch
3. SIZE: position sizing suggestion`;
}

/**
 * Build analysis data object for TOON encoding
 * Shared across analyze, debug, and chat commands
 */
export function buildAnalysisData(input: AnalysisDataInput): Record<string, unknown> {
  const { stock, technical, fairValue, strategy, alternatives, marketRegime, pfv } = input;
  
  // Build magnetic levels array for TOON tabular format
  // Note: getKeyMagneticLevels already formats distance as string
  const magneticLevels = pfv 
    ? getKeyMagneticLevels(pfv, 5).map(l => ({
        price: l.price,
        type: l.type.toLowerCase().replace(' ', ''),
        dist: l.distance
      }))
    : [];

  // Build strategy alternatives for TOON tabular format
  const stratAlts = alternatives.slice(0, 2).map(a => ({
    name: a.name,
    conf: a.confidence
  }));

  // Calculate derived values
  const volPct = stock.avgVolume > 0 
    ? Math.round(stock.volume / stock.avgVolume * 100) 
    : 100;
  const pos52w = stock.fiftyTwoWeekLow && stock.fiftyTwoWeekHigh
    ? Math.round(((stock.price - stock.fiftyTwoWeekLow) / 
       (stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow)) * 100)
    : null;
  const meanRev = pfv ? hasMeanReversionSignal(pfv) : null;

  return {
    ticker: stock.ticker,
    name: stock.name,
    price: Number(stock.price.toFixed(2)),
    change: `${stock.changePct >= 0 ? '+' : ''}${stock.changePct.toFixed(1)}%`,
    volume: `${volPct}%`,
    pos52w: pos52w ? `${pos52w}%` : null,
    mcap: stock.marketCap >= 1e12 
      ? `${(stock.marketCap / 1e12).toFixed(1)}T`
      : `${Math.round(stock.marketCap / 1e9)}B`,
    market: marketRegime,
    technicals: {
      rsi: technical?.rsi ? Math.round(technical.rsi) : null,
      ma20: technical?.ma20 ? Math.round(technical.ma20) : null,
      ma50: technical?.ma50 ? Math.round(technical.ma50) : null,
      ma200: technical?.ma200 ? Math.round(technical.ma200) : null,
      aboveMA200: technical?.aboveMA200 ?? false,
      score: technical?.score ?? null
    },
    fundamentals: {
      peTrailing: stock.trailingPE ? Math.round(stock.trailingPE) : null,
      peForward: stock.forwardPE ? Math.round(stock.forwardPE) : null,
      epsTrailing: stock.trailingEps ?? null,
      epsForward: stock.forwardEps ?? null,
      growthEarnings: stock.earningsGrowth 
        ? Math.round(stock.earningsGrowth * 100) 
        : null,
      growthRevenue: stock.revenueGrowth 
        ? Math.round(stock.revenueGrowth * 100) 
        : null,
      fairValue: fairValue.verdict,
      margin: Math.round(fairValue.marginOfSafety)
    },
    // NEW: Target prices with full range
    targets: stock.targetPrices ? {
      low: `$${Math.round(stock.targetPrices.low)}`,
      mean: `$${Math.round(stock.targetPrices.mean)}`,
      high: `$${Math.round(stock.targetPrices.high)}`,
      upside: `${stock.targetPrices.upside > 0 ? '+' : ''}${stock.targetPrices.upside}%`,
      analysts: stock.numberOfAnalysts ?? 0,
    } : null,
    // NEW: Price performance (momentum context)
    performance: stock.performance ? {
      d5: `${stock.performance.day5 > 0 ? '+' : ''}${stock.performance.day5}%`,
      m1: `${stock.performance.month1 > 0 ? '+' : ''}${stock.performance.month1}%`,
      m3: `${stock.performance.month3 > 0 ? '+' : ''}${stock.performance.month3}%`,
      ytd: `${stock.performance.ytd > 0 ? '+' : ''}${stock.performance.ytd}%`,
    } : null,
    // NEW: Analyst ratings breakdown and recent changes
    analysts: stock.analystRatings ? {
      consensus: `${stock.analystRatings.bullishPercent}% bullish`,
      strongBuy: stock.analystRatings.strongBuy,
      buy: stock.analystRatings.buy,
      hold: stock.analystRatings.hold,
      sell: stock.analystRatings.sell,
      changes: stock.analystRatings.recentChanges.slice(0, 3).map(c => ({
        firm: c.firm.split(' ')[0], // First word of firm name to save tokens
        grade: c.toGrade,
        target: c.targetPrice ? `$${c.targetPrice}` : null,
      }))
    } : null,
    // NEW: Ownership structure
    ownership: stock.ownership ? {
      insiders: `${stock.ownership.insidersPercent}%`,
      institutions: `${stock.ownership.institutionsPercent}%`,
      instCount: stock.ownership.institutionsCount,
      recentSales: stock.ownership.recentInsiderSales 
        ? `$${Math.round(stock.ownership.recentInsiderSales.totalValue / 1e6)}M`
        : null,
    } : null,
    // NEW: Earnings info with beat/miss history
    earnings: stock.earnings ? {
      date: stock.earnings.date ?? null,
      days: stock.earnings.daysUntil ?? null,
      streak: stock.earnings.streak 
        ? `${stock.earnings.streak > 0 ? '+' : ''}${stock.earnings.streak} beats`
        : null,
      lastSurprise: stock.earnings.lastSurprise 
        ? `${stock.earnings.lastSurprise > 0 ? '+' : ''}${stock.earnings.lastSurprise}%`
        : null,
      avgSurprise: stock.earnings.avgSurprise
        ? `${stock.earnings.avgSurprise > 0 ? '+' : ''}${stock.earnings.avgSurprise}%`
        : null,
    } : null,
    // NEW: Sector context
    sector: stock.sectorContext ? {
      name: stock.sectorContext.name,
      avgPE: stock.sectorContext.avgPE ?? null,
      vsAvg: stock.sectorContext.vsAvg 
        ? `${stock.sectorContext.vsAvg > 0 ? '+' : ''}${stock.sectorContext.vsAvg}%`
        : null,
    } : null,
    // NEW: Volume analysis
    volume: stock.volumeAnalysis ? {
      today: `${stock.volumeAnalysis.todayPct}%`,
      trend: stock.volumeAnalysis.trend,
      unusual: stock.volumeAnalysis.unusualDays > 0 
        ? `${stock.volumeAnalysis.unusualDays}d` 
        : null,
    } : null,
    // NEW: Risk metrics
    risk: stock.risk?.beta ? {
      beta: stock.risk.beta.toFixed(2),
    } : null,
    // NEW: Volatility comparison (IV vs HV)
    volatility: stock.volatility ? {
      iv: stock.volatility.iv ? `${stock.volatility.iv.toFixed(1)}%` : null,
      hv20: stock.volatility.hv20 ? `${stock.volatility.hv20.toFixed(1)}%` : null,
      ivRank: stock.volatility.ivRank 
        ? `${stock.volatility.ivRank.toFixed(0)}%` 
        : null,
      ivLevel: stock.volatility.ivLevel?.toLowerCase() ?? null,
      premium: stock.volatility.premium ?? (
        stock.volatility.iv && stock.volatility.hv20
          ? stock.volatility.iv > stock.volatility.hv20 * 1.15 
            ? 'expensive' 
            : stock.volatility.iv < stock.volatility.hv20 * 0.85 
              ? 'cheap' 
              : 'fair'
          : null
      ),
    } : null,
    // NEW: Short interest
    shorts: stock.shortInterest ? {
      pctFloat: `${stock.shortInterest.shortPct.toFixed(1)}%`,
      daysTocover: stock.shortInterest.shortRatio.toFixed(1),
    } : null,
    // NEW: Relative strength
    rsStrength: stock.relativeStrength ? {
      vsSPY: `${stock.relativeStrength.vsSPY > 0 ? '+' : ''}${stock.relativeStrength.vsSPY.toFixed(1)}%`,
      vsSector: stock.relativeStrength.vsSector 
        ? `${stock.relativeStrength.vsSector > 0 ? '+' : ''}${stock.relativeStrength.vsSector.toFixed(1)}%`
        : null,
    } : null,
    // NEW: Options flow
    optionsFlow: stock.optionsFlow ? {
      pcRatio: stock.optionsFlow.pcRatioOI.toFixed(2),
      sentiment: stock.optionsFlow.pcRatioOI < 0.7 ? 'bullish' 
        : stock.optionsFlow.pcRatioOI > 1.0 ? 'bearish' 
        : 'neutral',
    } : null,
    // NEW: Risk/Reward with Probability of Profit
    riskReward: stock.riskReward ? {
      maxProfit: `$${stock.riskReward.maxProfit}`,
      maxLoss: `$${stock.riskReward.maxLoss}`,
      breakeven: `$${stock.riskReward.breakeven.toFixed(2)}`,
      ratio: stock.riskReward.rrRatio,
      profitPct: `${stock.riskReward.profitPct.toFixed(0)}%`,
      pop: stock.riskReward.pop ? `${stock.riskReward.pop}%` : null,
    } : null,
    pfv: pfv ? {
      value: Math.round(pfv.fairValue),
      bias: pfv.bias.toLowerCase(),
      confidence: pfv.confidence.toLowerCase(),
      deviation: `${pfv.deviationPercent > 0 ? '+' : ''}${pfv.deviationPercent.toFixed(1)}%`,
      support: pfv.supportZone 
        ? `${Math.round(pfv.supportZone.low)}-${Math.round(pfv.supportZone.high)}`
        : null,
      resistance: pfv.resistanceZone 
        ? `${Math.round(pfv.resistanceZone.low)}-${Math.round(pfv.resistanceZone.high)}`
        : null,
      meanReversion: meanRev?.signal 
        ? `${meanRev.direction} ${meanRev.strength}%` 
        : null,
      levels: magneticLevels
    } : null,
    strategy: {
      primary: strategy.name,
      confidence: strategy.confidence,
      alternatives: stratAlts
    }
  };
}

/**
 * Encode analysis data to TOON format string
 * Uses @toon-format/toon library for proper encoding
 */
export function encodeAnalysisToTOON(input: AnalysisDataInput): string {
  const data = buildAnalysisData(input);
  return encode(data);
}

/**
 * Build complete user prompt with TOON-encoded data
 */
export function buildAnalysisUserPrompt(input: AnalysisDataInput): string {
  const toonData = encodeAnalysisToTOON(input);
  return `\`\`\`toon\n${toonData}\n\`\`\`\n\nAnalyze for entry.`;
}

// ============================================================================
// LEGACY TICKER DATA TYPES (for chat command compatibility)
// ============================================================================

export interface TickerDataInput {
  ticker: string;
  price: number;
  changePct: number;
  rsi?: number;
  adx?: number;
  trendStrength?: 'WEAK' | 'MODERATE' | 'STRONG';
  ma20?: number;
  ma50?: number;
  ma200?: number;
  aboveMA200?: boolean;
  iv?: number;
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  nearestSupport?: number;
  nearestResistance?: number;
  spreadLong?: number;
  spreadShort?: number;
  spreadDebit?: number;
  cushion?: number;
  grade?: string;
  riskScore?: number;
  earningsDays?: number | null;
  marketCap?: number;
  peRatio?: number;
  // Analyst ratings
  analystBullishPct?: number;
  analystStrongBuy?: number;
  analystBuy?: number;
  analystHold?: number;
  analystSell?: number;
  // Ownership
  insidersPct?: number;
  institutionsPct?: number;
  recentSalesM?: number;
  // Target prices
  targetLow?: number;
  targetMean?: number;
  targetHigh?: number;
  targetUpside?: number;
  // Price performance
  perf5d?: number;
  perf1m?: number;
  perf3m?: number;
  perfYtd?: number;
  // NEW: Earnings info
  earningsDate?: string;
  earningsDays?: number;
  earningsStreak?: number;
  earningsSurprise?: number;
  // NEW: Sector context
  sectorName?: string;
  sectorAvgPE?: number;
  sectorVsAvg?: number;
  // NEW: Historical volatility
  hv20?: number;
  // NEW: High-value additions
  shortPct?: number;
  shortRatio?: number;
  vsSPY?: number;
  pcRatioOI?: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  tickers?: string[];
  recommendation?: string;
}

// ============================================================================
// TYPE ABBREVIATION MAPS
// ============================================================================

const TRADE_TYPE_MAP: Record<TradeType, string> = {
  call_debit: "cd",
  put_credit: "pc",
  call_credit: "cc",
  put_debit: "pd",
};

const OUTCOME_MAP: Record<TradeOutcome, string> = {
  win: "w",
  loss: "l",
  breakeven: "be",
  max_profit: "mp",
  max_loss: "ml",
};

const REGIME_MAP: Record<MarketRegime, string> = {
  bull: "b",
  neutral: "n",
  bear: "br",
};

// ============================================================================
// COMPRESSION FUNCTIONS
// ============================================================================

/**
 * Compress a single trade to TOON format
 */
export function compressTrade(trade: Trade): TOONTrade {
  const toon: TOONTrade = {
    ty: TRADE_TYPE_MAP[trade.tradeType],
    d: trade.direction === "bullish" ? "b" : "br",
    ls: trade.longStrike,
    ss: trade.shortStrike,
    o: trade.outcome ? OUTCOME_MAP[trade.outcome] : "?",
    pnl: Math.round(trade.realizedPnl ?? 0),
  };

  // Only include optional fields if they have value
  if (trade.daysHeld !== undefined) {
    toon.dh = trade.daysHeld;
  }
  if (trade.entryRsi !== undefined) {
    toon.rsi = Math.round(trade.entryRsi);
  }

  return toon;
}

/**
 * Compress ticker history to TOON format
 */
export function compressTickerHistory(
  ticker: string,
  trades: Trade[],
  pattern?: string
): TOONTickerContext {
  const closedTrades = trades.filter(t => t.status !== "open");
  const wins = closedTrades.filter(
    t => t.outcome === "win" || t.outcome === "max_profit"
  ).length;
  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl ?? 0), 
    0
  );
  const winRate = closedTrades.length > 0 
    ? Math.round((wins / closedTrades.length) * 100) 
    : 0;

  // Only include last 5 trades in history to save tokens
  const recentTrades = trades.slice(0, 5).map(compressTrade);

  const toon: TOONTickerContext = {
    t: ticker.toUpperCase(),
    n: trades.length,
    wr: winRate,
    pnl: Math.round(totalPnl),
    h: recentTrades,
  };

  if (pattern) {
    toon.p = pattern;
  }

  return toon;
}

/**
 * Build full TOON context for AI
 */
export function buildTOONContext(
  accountSize: number,
  tickerHistories: Map<string, Trade[]>,
  marketRegime: MarketRegime,
  patterns: Map<string, string> = new Map()
): TOONContext {
  const tickers: TOONTickerContext[] = [];

  for (const [ticker, trades] of tickerHistories) {
    if (trades.length > 0) {
      tickers.push(
        compressTickerHistory(ticker, trades, patterns.get(ticker))
      );
    }
  }

  // Sort by number of trades descending (most traded first)
  tickers.sort((a, b) => b.n - a.n);

  // Limit to top 10 tickers to save tokens
  const limitedTickers = tickers.slice(0, 10);

  return {
    acct: accountSize,
    tickers: limitedTickers,
    mkt: REGIME_MAP[marketRegime],
  };
}

/**
 * Build TOON context for a single ticker analysis
 */
export function buildTickerTOONContext(
  ticker: string,
  trades: Trade[],
  accountSize: number,
  marketRegime: MarketRegime,
  pattern?: string
): TOONContext {
  const tickerContext = compressTickerHistory(ticker, trades, pattern);

  return {
    acct: accountSize,
    tickers: [tickerContext],
    mkt: REGIME_MAP[marketRegime],
  };
}

/**
 * Convert TOON context to JSON string for AI prompt
 */
export function toonToString(context: TOONContext): string {
  return JSON.stringify(context);
}

// ============================================================================
// TICKER DATA TOON ENCODING (for chat command)
// ============================================================================

/**
 * Encode live ticker data to proper TOON format
 * Uses @toon-format/toon library
 */
export function encodeTickerToTOON(data: TickerDataInput): string {
  const tickerData: Record<string, unknown> = {
    ticker: data.ticker.toUpperCase(),
    price: Number(data.price.toFixed(2)),
    change: `${data.changePct >= 0 ? '+' : ''}${data.changePct.toFixed(1)}%`,
  };
  
  // Technicals
  if (data.rsi) tickerData.rsi = Math.round(data.rsi);
  if (data.adx && data.trendStrength) {
    tickerData.adx = Math.round(data.adx);
    tickerData.trend = data.trendStrength.toLowerCase();
  }
  
  // Moving averages
  const mas: Record<string, unknown> = {};
  if (data.ma20) mas.ma20 = Math.round(data.ma20);
  if (data.ma50) mas.ma50 = Math.round(data.ma50);
  if (data.ma200) mas.ma200 = Math.round(data.ma200);
  if (Object.keys(mas).length > 0) {
    tickerData.mas = mas;
    tickerData.aboveMA200 = data.aboveMA200 ?? false;
  }
  
  // Volatility (IV vs HV)
  if (data.iv || data.hv20) {
    const iv = data.iv ? Math.round(data.iv) : null;
    const hv = data.hv20 ? Math.round(data.hv20) : null;
    let premium: 'cheap' | 'fair' | 'expensive' | null = null;
    
    if (iv && hv) {
      premium = iv > hv * 1.15 ? 'expensive' : iv < hv * 0.85 ? 'cheap' : 'fair';
    }
    
    tickerData.vol = {
      iv: iv ? `${iv}%` : null,
      hv20: hv ? `${hv}%` : null,
      level: data.ivLevel?.toLowerCase() ?? null,
      premium: premium,
    };
  }
  
  // Support/Resistance
  if (data.nearestSupport || data.nearestResistance) {
    tickerData.levels = {
      support: data.nearestSupport ? Math.round(data.nearestSupport) : null,
      resistance: data.nearestResistance ? Math.round(data.nearestResistance) : null
    };
  }
  
  // Spread
  if (data.spreadLong && data.spreadShort && data.spreadDebit) {
    tickerData.spread = {
      long: data.spreadLong,
      short: data.spreadShort,
      debit: Number(data.spreadDebit.toFixed(2)),
      cushion: data.cushion ? `${data.cushion.toFixed(1)}%` : null
    };
  }
  
  // Grade and risk
  if (data.grade) tickerData.grade = data.grade;
  if (data.riskScore) tickerData.risk = data.riskScore;
  
  // Earnings
  if (data.earningsDays !== undefined && data.earningsDays !== null) {
    tickerData.earnings = `${data.earningsDays}d`;
  }
  
  // Fundamentals
  if (data.marketCap) {
    tickerData.mcap = data.marketCap >= 1e12 
      ? `${(data.marketCap / 1e12).toFixed(1)}T`
      : `${Math.round(data.marketCap / 1e9)}B`;
  }
  if (data.peRatio) tickerData.pe = Math.round(data.peRatio);
  
  // Analyst ratings (compact)
  if (data.analystBullishPct !== undefined) {
    tickerData.analysts = {
      bullish: `${data.analystBullishPct}%`,
      sb: data.analystStrongBuy ?? 0,
      b: data.analystBuy ?? 0,
      h: data.analystHold ?? 0,
      s: data.analystSell ?? 0,
    };
  }
  
  // Ownership (compact)
  if (data.insidersPct !== undefined || data.institutionsPct !== undefined) {
    tickerData.ownership = {
      ins: data.insidersPct ? `${data.insidersPct.toFixed(1)}%` : null,
      inst: data.institutionsPct ? `${data.institutionsPct.toFixed(1)}%` : null,
      sales: data.recentSalesM ? `$${data.recentSalesM}M` : null,
    };
  }
  
  // Target prices (compact)
  if (data.targetLow && data.targetMean && data.targetHigh) {
    tickerData.targets = {
      low: `$${Math.round(data.targetLow)}`,
      mean: `$${Math.round(data.targetMean)}`,
      high: `$${Math.round(data.targetHigh)}`,
      upside: data.targetUpside ? `${data.targetUpside > 0 ? '+' : ''}${data.targetUpside}%` : null,
    };
  }
  
  // Price performance (compact)
  if (data.perf5d !== undefined || data.perf1m !== undefined) {
    tickerData.perf = {
      d5: data.perf5d !== undefined ? `${data.perf5d > 0 ? '+' : ''}${data.perf5d}%` : null,
      m1: data.perf1m !== undefined ? `${data.perf1m > 0 ? '+' : ''}${data.perf1m}%` : null,
      m3: data.perf3m !== undefined ? `${data.perf3m > 0 ? '+' : ''}${data.perf3m}%` : null,
      ytd: data.perfYtd !== undefined ? `${data.perfYtd > 0 ? '+' : ''}${data.perfYtd}%` : null,
    };
  }
  
  // Earnings info (compact)
  if (data.earningsDate || data.earningsStreak !== undefined) {
    tickerData.earn = {
      date: data.earningsDate ?? null,
      days: data.earningsDays ?? null,
      streak: data.earningsStreak 
        ? `${data.earningsStreak > 0 ? '+' : ''}${data.earningsStreak}` 
        : null,
      surprise: data.earningsSurprise !== undefined 
        ? `${data.earningsSurprise > 0 ? '+' : ''}${data.earningsSurprise}%`
        : null,
    };
  }
  
  // Sector context (compact)
  if (data.sectorName && data.sectorVsAvg !== undefined) {
    tickerData.sector = {
      name: data.sectorName,
      avgPE: data.sectorAvgPE ?? null,
      vs: `${data.sectorVsAvg > 0 ? '+' : ''}${data.sectorVsAvg}%`,
    };
  }
  
  // Short interest (compact)
  if (data.shortPct && data.shortPct > 0) {
    tickerData.shorts = {
      pct: `${data.shortPct}%`,
      days: data.shortRatio ?? null,
    };
  }
  
  // Relative strength vs SPY
  if (data.vsSPY !== undefined) {
    tickerData.rs = `${data.vsSPY > 0 ? '+' : ''}${data.vsSPY}% vs SPY`;
  }
  
  // Options flow (put/call ratio)
  if (data.pcRatioOI !== undefined) {
    const sentiment = data.pcRatioOI < 0.7 ? 'bullish' 
      : data.pcRatioOI > 1.0 ? 'bearish' 
      : 'neutral';
    tickerData.flow = {
      pc: data.pcRatioOI,
      sentiment,
    };
  }
  
  return encode(tickerData);
}

/**
 * Encode multiple tickers to TOON format
 */
export function encodeTickersToTOON(tickers: TickerDataInput[]): string {
  // Encode as array of ticker objects
  const data = tickers.map(t => ({
    ticker: t.ticker.toUpperCase(),
    price: Number(t.price.toFixed(2)),
    change: `${t.changePct >= 0 ? '+' : ''}${t.changePct.toFixed(1)}%`,
    rsi: t.rsi ? Math.round(t.rsi) : null,
    ma200: t.ma200 ? Math.round(t.ma200) : null,
    aboveMA200: t.aboveMA200 ?? null,
    grade: t.grade ?? null,
    risk: t.riskScore ?? null,
  }));
  return encode({ tickers: data });
}

/**
 * Get TOON format explanation for system prompt
 * Now minimal since TOON is self-documenting
 */
export function getTOONDecoderSpec(): string {
  return `## Data Format
Data is in TOON format (YAML-like, self-documenting).
- Arrays use [N]{fields}: header followed by comma-separated rows
- Nested objects use indentation
- Parse naturally - no special decoding needed`;
}

// ============================================================================
// CONVERSATION SUMMARIZATION
// ============================================================================

/**
 * Extract key information from a message for summarization
 */
function extractMessageKeyInfo(msg: ConversationMessage): {
  tickers: string[];
  action?: string;
} {
  const content = msg.content.toUpperCase();
  
  // Extract tickers (2-5 uppercase letters that look like symbols)
  const tickerMatches = content.match(/\b[A-Z]{2,5}\b/g) || [];
  const commonWords = new Set([
    'THE', 'AND', 'FOR', 'NOT', 'YOU', 'ARE', 'BUT', 'CAN', 'HAS', 'HAD',
    'RSI', 'ITM', 'OTM', 'ATM', 'DTE', 'BUY', 'SELL', 'WAIT', 'PASS',
    'FOMC', 'CPI', 'GDP', 'FED', 'MAX', 'MIN', 'LOW', 'HIGH',
  ]);
  const tickers = [...new Set(
    tickerMatches.filter(t => !commonWords.has(t))
  )];
  
  // Extract action/recommendation
  let action: string | undefined;
  if (/\b(BUY|ENTER|LONG)\b/.test(content)) action = 'BUY';
  else if (/\b(SELL|EXIT|CLOSE)\b/.test(content)) action = 'SELL';
  else if (/\b(WAIT|HOLD)\b/.test(content)) action = 'WAIT';
  else if (/\b(AVOID|PASS)\b/.test(content)) action = 'AVOID';
  
  return { tickers, action };
}

/**
 * Summarize conversation history to reduce tokens
 * Converts full messages to compact summaries
 * 
 * Before: 100+ tokens per message
 * After: ~20 tokens per summary
 */
export function summarizeConversation(
  history: ConversationMessage[],
  maxTurns: number = 5
): string {
  if (history.length === 0) return '';
  
  const summaries: string[] = [];
  
  // Process messages in pairs (user + assistant)
  for (let i = 0; i < history.length && summaries.length < maxTurns; i += 2) {
    const userMsg = history[i];
    const assistantMsg = history[i + 1];
    
    if (!userMsg) continue;
    
    const userInfo = extractMessageKeyInfo(userMsg);
    const tickerStr = userInfo.tickers.length > 0 
      ? userInfo.tickers.slice(0, 2).join(',') 
      : 'general';
    
    let summary = `[U:${tickerStr}`;
    
    if (assistantMsg) {
      const assistantInfo = extractMessageKeyInfo(assistantMsg);
      if (assistantInfo.action) {
        summary += `→V:${assistantInfo.action}`;
      }
    }
    
    summary += ']';
    summaries.push(summary);
  }
  
  return summaries.length > 0 
    ? `Prior: ${summaries.join(' ')}` 
    : '';
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

/**
 * Detect patterns in trade history
 * Returns human-readable pattern strings
 */
export function detectPatterns(trades: Trade[]): string[] {
  const patterns: string[] = [];
  const closedTrades = trades.filter(t => t.status !== "open");
  
  if (closedTrades.length < 3) {
    return patterns;
  }

  // Pattern 1: RSI at entry correlation
  const tradesWithRsi = closedTrades.filter(t => t.entryRsi !== undefined);
  if (tradesWithRsi.length >= 3) {
    const winningRsis = tradesWithRsi
      .filter(t => t.outcome === "win" || t.outcome === "max_profit")
      .map(t => t.entryRsi!);
    const losingRsis = tradesWithRsi
      .filter(t => t.outcome === "loss" || t.outcome === "max_loss")
      .map(t => t.entryRsi!);

    if (winningRsis.length > 0 && losingRsis.length > 0) {
      const avgWinRsi = winningRsis.reduce((a, b) => a + b, 0) / winningRsis.length;
      const avgLossRsi = losingRsis.reduce((a, b) => a + b, 0) / losingRsis.length;

      if (avgLossRsi > avgWinRsi + 10) {
        patterns.push(`Losses tend to occur at RSI > ${Math.round(avgLossRsi)}`);
      }
      if (avgWinRsi < 50 && avgLossRsi > 55) {
        patterns.push(`Better entries at RSI < 50`);
      }
    }
  }

  // Pattern 2: Days held correlation
  const tradesWithDays = closedTrades.filter(t => t.daysHeld !== undefined);
  if (tradesWithDays.length >= 3) {
    const winningDays = tradesWithDays
      .filter(t => t.outcome === "win" || t.outcome === "max_profit")
      .map(t => t.daysHeld!);
    const losingDays = tradesWithDays
      .filter(t => t.outcome === "loss" || t.outcome === "max_loss")
      .map(t => t.daysHeld!);

    if (winningDays.length > 0) {
      const avgWinDays = winningDays.reduce((a, b) => a + b, 0) / winningDays.length;
      if (avgWinDays < 7) {
        patterns.push(`Winning trades held avg ${Math.round(avgWinDays)} days`);
      }
    }

    if (losingDays.length > 0) {
      const avgLossDays = losingDays.reduce((a, b) => a + b, 0) / losingDays.length;
      if (avgLossDays > 14) {
        patterns.push(`Consider cutting losses earlier (avg loss held ${Math.round(avgLossDays)} days)`);
      }
    }
  }

  // Pattern 3: Strategy type success
  const byType = new Map<string, { wins: number; total: number }>();
  for (const trade of closedTrades) {
    const existing = byType.get(trade.tradeType) ?? { wins: 0, total: 0 };
    existing.total++;
    if (trade.outcome === "win" || trade.outcome === "max_profit") {
      existing.wins++;
    }
    byType.set(trade.tradeType, existing);
  }

  for (const [type, stats] of byType) {
    if (stats.total >= 3) {
      const winRate = (stats.wins / stats.total) * 100;
      const typeName = type === "call_debit" ? "Call Debit Spreads" 
        : type === "put_credit" ? "Put Credit Spreads"
        : type;
      if (winRate >= 70) {
        patterns.push(`${Math.round(winRate)}% win rate on ${typeName}`);
      } else if (winRate < 40) {
        patterns.push(`Low win rate on ${typeName} (${Math.round(winRate)}%)`);
      }
    }
  }

  return patterns;
}

/**
 * Get the primary pattern for a ticker (most important one)
 */
export function getPrimaryPattern(trades: Trade[]): string | undefined {
  const patterns = detectPatterns(trades);
  return patterns[0];
}

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

/**
 * Build full ticker history analysis from trades
 */
export function buildTickerHistory(
  ticker: string,
  trades: Trade[]
): TickerHistory {
  const closedTrades = trades.filter(t => t.status !== "open");
  const wins = closedTrades.filter(
    t => t.outcome === "win" || t.outcome === "max_profit"
  ).length;
  const losses = closedTrades.filter(
    t => t.outcome === "loss" || t.outcome === "max_loss"
  ).length;
  
  const totalPnl = closedTrades.reduce(
    (sum, t) => sum + (t.realizedPnl ?? 0), 
    0
  );
  const avgPnl = closedTrades.length > 0 
    ? totalPnl / closedTrades.length 
    : 0;

  const daysHeld = closedTrades
    .filter(t => t.daysHeld !== undefined)
    .map(t => t.daysHeld!);
  const avgDaysHeld = daysHeld.length > 0 
    ? daysHeld.reduce((a, b) => a + b, 0) / daysHeld.length 
    : 0;

  return {
    ticker: ticker.toUpperCase(),
    totalTrades: trades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 
      ? (wins / closedTrades.length) * 100 
      : 0,
    totalPnl,
    avgPnl,
    avgDaysHeld,
    lastTrade: trades[0],
    patterns: detectPatterns(trades),
    recentTrades: trades.slice(0, 5),
  };
}

