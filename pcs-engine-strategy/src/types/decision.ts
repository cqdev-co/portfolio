/**
 * PCS Decision Engine Types
 * v1.0.0: Put Credit Spread Entry Decision Engine
 *
 * Key differences from CDS:
 * - Credit received instead of debit paid
 * - Short delta targets OTM (0.20-0.35) instead of deep ITM (0.70-0.85)
 * - IV Rank is a positive factor (higher = more premium to sell)
 * - Support buffer: short strike should be BELOW support
 */

// Entry action types
export type EntryAction =
  | 'enter_now'
  | 'scale_in'
  | 'wait_for_pullback'
  | 'pass';

export type PositionSize =
  | 'full'
  | 'three_quarter'
  | 'half'
  | 'quarter'
  | 'skip';

export type ConfidenceLevel =
  | 'very_high'
  | 'high'
  | 'moderate'
  | 'low'
  | 'insufficient';

export type Timeframe = 'immediate' | '1-3_days' | 'this_week' | 'next_week';
export type MarketRegime = 'bull' | 'neutral' | 'bear';

/**
 * PCS Spread Quality Score
 * Tailored for credit spread mechanics (credit ratio, distance OTM, IV rank)
 */
export interface SpreadQualityScore {
  total: number; // 0-100
  breakdown: {
    creditRatio: number; // 0-20: credit as % of width (25-40% ideal)
    distanceOTM: number; // 0-20: how far short strike is below price
    ivRank: number; // 0-15: higher IV = more premium
    supportBuffer: number; // 0-15: support level above short strike
    dte: number; // 0-10: DTE alignment (30-45 ideal)
    delta: number; // 0-10: short delta in 0.20-0.35 range
    earningsRisk: number; // 0-10: no earnings in period
  };
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Confidence score breakdown
 */
export interface ConfidenceScore {
  total: number; // 0-100
  level: ConfidenceLevel;
  breakdown: {
    stockScore: number; // 0-25: from existing total score
    checklistPassRate: number; // 0-20: checklist items passed
    momentum: number; // 0-15: momentum signals
    relativeStrength: number; // 0-15: vs SPY performance
    marketRegime: number; // 0-15: market conditions (higher weight for PCS)
    ivEnvironment: number; // 0-10: IV rank favorable for selling
  };
}

/**
 * Position sizing recommendation
 */
export interface PositionSizing {
  size: PositionSize;
  percentage: number; // 0-100%
  maxContracts: number;
  maxRiskDollars: number;
  reasoning: string[];
}

/**
 * Timing analysis
 */
export interface TimingAnalysis {
  action: 'enter' | 'wait';
  waitTarget?: number;
  waitReason?: string;
  enterReason?: string;
  rsiZone: 'oversold' | 'ideal' | 'neutral' | 'extended' | 'overbought';
  priceVsMA50: 'below' | 'at' | 'above';
  distanceToSupport: number;
  ivRankFavorable: boolean;
}

/**
 * Scored put credit spread candidate
 */
export interface ScoredSpread {
  shortStrike: number; // Higher strike (sold put)
  longStrike: number; // Lower strike (bought put)
  expiration: Date;
  netCredit: number; // Credit received
  maxProfit: number; // = netCredit
  maxLoss: number; // = width - netCredit
  breakeven: number; // = shortStrike - netCredit
  shortDelta: number; // Target: 0.20-0.35
  dte: number;
  ivRank: number;
  qualityScore: SpreadQualityScore;
}

/**
 * Main entry decision output
 */
export interface EntryDecision {
  action: EntryAction;
  confidence: ConfidenceScore;
  timeframe: Timeframe;
  positionSizing: PositionSizing;
  recommendedSpread: ScoredSpread | null;
  spreadScore: SpreadQualityScore | null;
  timing: TimingAnalysis;
  marketRegime: MarketRegime;
  reasoning: string[];
  entryGuidance: string[];
  riskManagement: string[];
  warnings: string[];
}

/**
 * Input parameters for PCS decision engine
 */
export interface DecisionEngineInput {
  ticker: string;
  currentPrice: number;
  stockScore: number;
  technicalScore: number;
  fundamentalScore: number;
  analystScore: number;
  ivScore: number;

  checklistPassed: number;
  checklistTotal: number;
  checklistFailReasons: string[];

  momentumOverall: 'improving' | 'stable' | 'deteriorating';
  momentumSignals: Array<{
    name: string;
    direction: 'improving' | 'stable' | 'deteriorating';
  }>;

  relativeStrengthTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
  marketRegime: MarketRegime;

  // Technical levels
  support1?: number;
  support2?: number;
  resistance1?: number;
  ma50?: number;
  ma200?: number;
  rsiValue?: number;

  // IV context
  ivRank?: number;
  ivPercentile?: number;

  // Earnings
  daysToEarnings?: number;

  // Spread candidates (put credit spreads)
  spreadCandidates: Array<{
    shortStrike: number;
    longStrike: number;
    expiration: Date;
    netCredit: number;
    maxProfit: number;
    breakeven: number;
    shortDelta: number;
    ivRank: number;
  }>;

  // Account settings
  accountSize?: number;
  maxRiskPercent?: number;
}

/**
 * Default account settings
 */
export const DEFAULT_ACCOUNT_SETTINGS = {
  accountSize: 10000,
  maxRiskPercent: 2,
  maxPositionPercent: 10,
};
