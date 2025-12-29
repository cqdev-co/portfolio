/**
 * Shared Data Types for AI Agent Tools
 * 
 * Types used by both CLI and Frontend for ticker analysis.
 */

// ============================================================================
// TICKER DATA
// ============================================================================

export interface TickerData {
  ticker: string;
  price: number;
  change: number;
  changePct: number;
  
  // Technical indicators
  rsi?: number;
  adx?: number;
  trendStrength?: 'WEAK' | 'MODERATE' | 'STRONG';
  aboveMA200?: boolean;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  
  // Volatility (standalone for convenience)
  hv20?: number;
  
  // 52-week range
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  
  // Fundamentals
  marketCap?: number;
  peRatio?: number;
  forwardPE?: number;
  eps?: number;
  dividendYield?: number;
  beta?: number;
  
  // Options data
  spread?: SpreadRecommendation;
  iv?: IVAnalysis;
  
  // Analysis
  earningsDays?: number | null;
  earningsWarning?: boolean;
  grade?: TradeGrade;
  
  // Support/Resistance
  support?: number;
  resistance?: number;
  
  // News
  news?: NewsItem[];
  
  // Data quality
  dataQuality?: DataQuality;
  
  // Additional context
  analystRatings?: AnalystRatings;
  targetPrices?: TargetPrices;
  performance?: PricePerformance;
  sectorContext?: SectorContext;
  shortInterest?: ShortInterest;
  
  // NEW: Rich data (same as CLI)
  optionsFlow?: OptionsFlow;
  relativeStrength?: RelativeStrength;
  earnings?: EarningsHistory;
  
  // Psychological Fair Value (PFV)
  pfv?: {
    fairValue: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    deviationPercent: number;
  };
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface SpreadRecommendation {
  longStrike: number;
  shortStrike: number;
  estimatedDebit: number;
  maxProfit: number;
  maxLoss?: number;
  breakeven?: number;
  cushion: number;
  pop?: number; // Probability of profit
  expiration?: Date;
  dte?: number;
  longDelta?: number;
  returnOnRisk?: number;
  spreadWidth?: number;
  liquidityScore?: number;
  bidAskScore?: number;
  totalScore?: number;
}

export interface IVAnalysis {
  currentIV: number;
  ivPercentile?: number;
  ivLevel?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  hv20?: number;
  premium?: 'cheap' | 'fair' | 'expensive';
}

export interface TradeGrade {
  grade: string;
  score: number;
  recommendation: string;
}

export interface NewsItem {
  title: string;
  publisher?: string;
  source?: string;
  link?: string;
  url?: string;
  date?: string;
  publishedAt?: Date;
}

export interface DataQuality {
  isStale: boolean;
  ageHours: number;
  warning?: string;
}

export interface AnalystRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  bullishPercent: number;
}

export interface TargetPrices {
  low: number;
  mean: number;
  high: number;
  upside: number;
}

export interface PricePerformance {
  day1?: number;
  day5: number;
  month1: number;
  month3?: number;
  ytd?: number;
}

export interface SectorContext {
  name: string;
  avgPE?: number;
  vsAvg?: number;
}

export interface ShortInterest {
  shortPct: number;
  shortRatio: number;
}

export interface OptionsFlow {
  pcRatioOI: number;     // Put/Call ratio by open interest
  pcRatioVol: number;    // Put/Call ratio by volume
  sentiment: 'bullish' | 'neutral' | 'bearish';
}

export interface RelativeStrength {
  vsSPY: number;         // % outperformance vs SPY (30 days)
  trend: 'outperforming' | 'inline' | 'underperforming';
}

export interface EarningsHistory {
  date?: string;
  daysUntil?: number;
  streak?: number;           // Positive = beats, negative = misses
  lastSurprise?: number;     // Last EPS surprise %
  avgSurprise?: number;      // Avg surprise over last 4 quarters
}

// ============================================================================
// TOOL RESULT TYPES
// ============================================================================

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  formatted?: string; // AI-friendly formatted string
}

export interface TickerToolResult extends ToolResult {
  data?: TickerData;
}

export interface SearchToolResult extends ToolResult {
  data?: SearchResult[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

