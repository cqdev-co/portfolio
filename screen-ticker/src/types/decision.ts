/**
 * Decision Engine Types
 * v1.5.0: Spread Entry Decision Engine
 */

import type { MarketRegime } from "../utils/market-regime.ts";

// Entry action types
export type EntryAction = "enter_now" | "wait_for_pullback" | "pass";
export type PositionSize = "full" | "three_quarter" | "half" | "quarter" | "skip";
export type ConfidenceLevel = "very_high" | "high" | "moderate" | "low" | "insufficient";
export type Timeframe = "immediate" | "1-3_days" | "this_week" | "next_week";

/**
 * Spread quality score breakdown
 */
export interface SpreadQualityScore {
  total: number;  // 0-100
  breakdown: {
    intrinsicValue: number;      // 0-20: % of cost that is intrinsic
    cushion: number;             // 0-15: % below current price
    delta: number;               // 0-10: delta alignment (0.70-0.85 ideal)
    dte: number;                 // 0-10: days to expiry alignment
    spreadWidth: number;         // 0-5: spread width appropriateness
    returnOnRisk: number;        // 0-15: potential return %
    supportProtection: number;   // 0-15: support below breakeven
    earningsRisk: number;        // 0-10: no earnings in period
  };
  rating: "excellent" | "good" | "fair" | "poor";
}

/**
 * Confidence score breakdown
 */
export interface ConfidenceScore {
  total: number;  // 0-100
  level: ConfidenceLevel;
  breakdown: {
    stockScore: number;          // 0-30: from existing total score
    checklistPassRate: number;   // 0-25: checklist items passed
    momentum: number;            // 0-20: momentum signals
    relativeStrength: number;    // 0-15: vs SPY performance
    marketRegime: number;        // 0-10: market conditions
  };
}

/**
 * Position sizing recommendation
 */
export interface PositionSizing {
  size: PositionSize;
  percentage: number;           // 0-100%
  maxContracts: number;         // Based on account risk
  maxRiskDollars: number;       // Max loss in dollars
  reasoning: string[];
}

/**
 * Timing analysis
 */
export interface TimingAnalysis {
  action: "enter" | "wait";
  waitTarget?: number;          // Price to wait for
  waitReason?: string;
  enterReason?: string;
  rsiZone: "oversold" | "ideal" | "neutral" | "extended" | "overbought";
  priceVsMA20: "below" | "at" | "above";
  distanceToSupport: number;    // Percentage
  recentPullback: boolean;
}

/**
 * Spread candidate with quality score
 */
export interface ScoredSpread {
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  netDebit: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  intrinsicPct: number;
  cushionPct: number;
  delta: number;
  dte: number;
  qualityScore: SpreadQualityScore;
}

/**
 * Main entry decision output
 */
export interface EntryDecision {
  // Core decision
  action: EntryAction;
  confidence: ConfidenceScore;
  timeframe: Timeframe;
  
  // Position sizing
  positionSizing: PositionSizing;
  
  // Spread details
  recommendedSpread: ScoredSpread | null;
  spreadScore: SpreadQualityScore | null;
  
  // Timing
  timing: TimingAnalysis;
  
  // Context
  marketRegime: MarketRegime;
  
  // Actionable guidance
  reasoning: string[];
  entryGuidance: string[];
  riskManagement: string[];
  
  // Warnings
  warnings: string[];
}

/**
 * Input parameters for decision engine
 */
export interface DecisionEngineInput {
  // Stock analysis
  ticker: string;
  currentPrice: number;
  stockScore: number;           // 0-100 total score
  technicalScore: number;
  fundamentalScore: number;
  analystScore: number;
  
  // Checklist results
  checklistPassed: number;
  checklistTotal: number;
  checklistFailReasons: string[];
  
  // Momentum
  momentumOverall: "improving" | "stable" | "deteriorating";
  momentumSignals: Array<{
    name: string;
    direction: "improving" | "stable" | "deteriorating";
  }>;
  
  // Relative strength
  relativeStrengthTrend: "strong" | "moderate" | "weak" | "underperforming";
  
  // Market context
  marketRegime: MarketRegime;
  
  // Technical levels
  support1?: number;
  support2?: number;
  resistance1?: number;
  ma20?: number;
  ma200?: number;
  rsiValue?: number;
  
  // Earnings
  daysToEarnings?: number;
  
  // Spread candidates
  spreadCandidates: Array<{
    longStrike: number;
    shortStrike: number;
    expiration: Date;
    netDebit: number;
    maxProfit: number;
    breakeven: number;
    intrinsicPct: number;
    cushionPct: number;
    delta: number;
  }>;
  
  // Optional: Account settings
  accountSize?: number;         // Total account value
  maxRiskPercent?: number;      // Max % to risk per trade (default 2%)
}

/**
 * Default account settings
 */
export const DEFAULT_ACCOUNT_SETTINGS = {
  accountSize: 10000,           // $10,000 default
  maxRiskPercent: 2,            // 2% max risk per trade
  maxPositionPercent: 10,       // 10% max position size
};

