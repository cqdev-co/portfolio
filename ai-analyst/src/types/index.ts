/**
 * AI Analyst Types
 * Core type definitions for the analyst system
 */

// ============================================================================
// TRADE TYPES
// ============================================================================

export type TradeType = 
  | "call_debit" 
  | "put_credit" 
  | "call_credit" 
  | "put_debit";

export type TradeDirection = "bullish" | "bearish";

export type TradeStatus = "open" | "closed" | "expired" | "assigned";

export type TradeOutcome = 
  | "win" 
  | "loss" 
  | "breakeven" 
  | "max_profit" 
  | "max_loss";

export type CloseReason = 
  | "manual" 
  | "expiration" 
  | "assignment" 
  | "stop_loss" 
  | "target_hit";

export type MarketRegime = "bull" | "neutral" | "bear";

export interface Trade {
  id: string;
  ticker: string;
  tradeType: TradeType;
  direction: TradeDirection;
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  quantity: number;
  openDate: Date;
  closeDate?: Date;
  daysHeld?: number;
  openPremium: number;
  closePremium?: number;
  maxProfit?: number;
  maxLoss?: number;
  realizedPnl?: number;
  returnPct?: number;
  status: TradeStatus;
  outcome?: TradeOutcome;
  closeReason?: CloseReason;
  thesis?: string;
  lessonsLearned?: string;
  entryScore?: number;
  entryRsi?: number;
  marketRegime?: MarketRegime;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// TOON (Token Optimized Object Notation) TYPES
// ============================================================================

/**
 * Compressed trade for AI context
 * Uses abbreviated keys to minimize tokens
 */
export interface TOONTrade {
  ty: string;      // trade type: cd, pc, cc, pd
  d: string;       // direction: b, br
  ls: number;      // long strike
  ss: number;      // short strike
  o: string;       // outcome: w, l, be, mp, ml
  pnl: number;     // realized P&L
  dh?: number;     // days held
  rsi?: number;    // entry RSI
}

/**
 * Compressed ticker history for AI context
 */
export interface TOONTickerContext {
  t: string;                // ticker
  n: number;                // number of trades
  wr: number;               // win rate (0-100)
  pnl: number;              // total P&L
  h: TOONTrade[];           // trade history (last 5)
  p?: string;               // pattern observed
}

/**
 * Full TOON context for AI
 */
export interface TOONContext {
  acct: number;             // account size
  tickers: TOONTickerContext[];
  mkt: string;              // market regime: b, n, br
}

// ============================================================================
// FAIR VALUE TYPES
// ============================================================================

export type ValueVerdict = "undervalued" | "fair" | "overvalued";

export interface FairValueResult {
  ticker: string;
  currentPrice: number;
  dcfValue: number | null;
  peRelativeValue: number | null;
  pegValue: number | null;
  marginOfSafety: number;
  verdict: ValueVerdict;
  reasoning: string[];
}

// ============================================================================
// STRATEGY TYPES
// ============================================================================

export type StrategyType = 
  | "deep_itm_cds"      // Deep ITM Call Debit Spread
  | "put_credit_spread" // Put Credit Spread
  | "cash_secured_put"  // Cash Secured Put
  | "stock_purchase"    // Direct stock purchase
  | "wait";             // No action recommended

export interface StrategyRecommendation {
  type: StrategyType;
  name: string;
  description: string;
  reasoning: string[];
  spread?: {
    longStrike: number;
    shortStrike: number;
    expiration: Date;
    netDebit: number;
    maxProfit: number;
    breakeven: number;
    cushionPct: number;
  };
  confidence: number;    // 0-100
  riskAmount: number;    // $ at risk
  positionSize: number;  // % of account
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

export interface TickerHistory {
  ticker: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgDaysHeld: number;
  lastTrade?: Trade;
  patterns: string[];
  recentTrades: Trade[];
}

export interface AnalysisResult {
  ticker: string;
  name: string;
  price: number;
  score: number;
  upside: number;
  history?: TickerHistory;
  fairValue?: FairValueResult;
  strategy: StrategyRecommendation;
  alternatives: StrategyRecommendation[];
  aiAnalysis: string;
  entryDecision: {
    action: "ENTER" | "WAIT" | "PASS" | "ENTER_WITH_CAUTION";
    confidence: number;
    reasoning: string[];
    positionSize: string;
    riskAmount: number;
  };
}

// ============================================================================
// CSV IMPORT TYPES
// ============================================================================

export interface RobinhoodTransaction {
  activityDate: Date;
  processDate: Date;
  settleDate: Date;
  instrument: string;
  description: string;
  transCode: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface ParsedSpread {
  ticker: string;
  type: TradeType;
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  quantity: number;
  openDate: Date;
  openPremium: number;
  transactions: RobinhoodTransaction[];
}

