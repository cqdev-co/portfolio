/**
 * Shared Options Types
 * 
 * Used by both CLI (ai-analyst) and Frontend (portfolio).
 * These are the REAL types from the CLI's options chain logic.
 */

export interface OptionContract {
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  mid: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  calls: OptionContract[];
  puts: OptionContract[];
  expiration: Date;
  dte: number;
  underlyingPrice: number;
}

export interface SpreadRecommendation {
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  dte: number;
  estimatedDebit: number;
  maxProfit: number;
  breakeven: number;
  /** Distance from current price to breakeven as % */
  cushion: number;
  /** Approximate delta based on ITM % */
  longDelta: number;
  /** Max profit / debit as percentage */
  returnOnRisk: number;
  /** Width between strikes */
  spreadWidth: number;
  /** Probability of Profit (0-100%) */
  pop?: number;
  /** Liquidity score (higher = better) */
  liquidityScore?: number;
  /** Bid-ask spread score */
  bidAskScore?: number;
  /** Total composite score */
  totalScore?: number;
}

export interface SpreadAlternatives {
  primary: SpreadRecommendation | null;
  alternatives: SpreadRecommendation[];
  /** Why alternatives are suggested */
  reason?: string;
}

export interface IVAnalysis {
  /** Current implied volatility as percentage */
  currentIV: number;
  /** IV percentile (0-100) */
  ivPercentile: number;
  /** Categorical IV level */
  ivLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  /** Human-readable recommendation */
  recommendation: string;
  /** Historical volatility for comparison */
  hv20?: number;
}

/**
 * Context for smarter spread selection
 */
export interface SpreadSelectionContext {
  /** 50-day moving average */
  ma50?: number;
  /** 200-day moving average */
  ma200?: number;
  /** Key support levels */
  supportLevels?: number[];
  /** Key resistance levels */
  resistanceLevels?: number[];
  /** Put wall prices (concentrated put OI) */
  putWalls?: number[];
  /** Call wall prices (concentrated call OI) */
  callWalls?: number[];
}

