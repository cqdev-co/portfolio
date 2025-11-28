// Core strategy types for the Odyssey trading dashboard

export type StrategyType = 
  | "options"
  | "technicals" 
  | "fundamentals"
  | "volatility"
  | "momentum";

export type OpportunityType = 
  | "credit_spread"
  | "debit_spread"
  | "breakout"
  | "reversal"
  | "earnings_play"
  | "oversold"
  | "overbought";

// Market data interfaces
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface OptionsData {
  symbol: string;
  expiration: string;
  strike: number;
  type: "call" | "put";
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  relativeStrength: number;
}

// Strategy parameter types
export interface BaseStrategyParameters {
  enabled: boolean;
  minConfidence?: number;
  maxResults?: number;
}

export interface OptionsStrategyParameters 
  extends BaseStrategyParameters {
  minDte: number;
  maxDte: number;
  minRiskReward: number;
  minIVPercentile?: number;
  maxIVPercentile?: number;
}

export interface TechnicalStrategyParameters 
  extends BaseStrategyParameters {
  lookbackPeriod: number;
  indicators: string[];
}

export interface FundamentalStrategyParameters 
  extends BaseStrategyParameters {
  minPE?: number;
  maxPE?: number;
  minGrowthRate?: number;
}

export type StrategyParameters = 
  | OptionsStrategyParameters
  | TechnicalStrategyParameters
  | FundamentalStrategyParameters;

// Credit spread specific types
export interface CreditSpreadDetails {
  direction: "bull_put" | "bear_call";
  shortStrike: number;
  longStrike: number;
  shortPrice: number;
  longPrice: number;
  premium: number;
  maxRisk: number;
  maxProfit: number;
  breakEven: number;
  spreadWidth: number;
  expiration: string;
  dte: number;
  probabilityOfProfit?: number;
}

// Debit spread specific types
export interface DebitSpreadDetails {
  direction: "bull_call" | "bear_put";
  longStrike: number;
  shortStrike: number;
  longPrice: number;
  shortPrice: number;
  netDebit: number;
  maxProfit: number;
  maxRisk: number;
  breakEven: number;
  spreadWidth: number;
  expiration: string;
  dte: number;
  probabilityOfProfit?: number;
}

// Technical opportunity details
export interface TechnicalDetails {
  pattern: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  indicators: Record<string, number>;
  timeframe: string;
}

// Generic opportunity interface
export interface Opportunity {
  id: string;
  symbol: string;
  strategyType: StrategyType;
  opportunityType: OpportunityType;
  title: string;
  description: string;
  riskReward: number;
  confidence: number;
  timestamp: Date;
  details: 
    | CreditSpreadDetails 
    | DebitSpreadDetails 
    | TechnicalDetails 
    | Record<string, unknown>;
}

// Strategy interface - all strategies must implement this
export interface Strategy<T extends StrategyParameters = StrategyParameters> {
  id: string;
  name: string;
  description: string;
  strategyType: StrategyType;
  parameters: T;
  
  // Main detection method
  detect(
    marketData: MarketData[],
    optionsData?: OptionsData[],
    sectorData?: SectorData[]
  ): Promise<Opportunity[]>;
  
  // Validate parameters
  validateParameters(parameters: T): boolean;
  
  // Update parameters
  updateParameters(parameters: Partial<T>): void;
}

// Strategy configuration for persistence
export interface StrategyConfig {
  strategies: Record<string, StrategyParameters>;
  watchlist: string[];
  refreshInterval: number; // in minutes
  notificationsEnabled: boolean;
}

// Strategy engine result
export interface StrategyEngineResult {
  opportunities: Opportunity[];
  executionTime: number;
  errors: Array<{
    strategyId: string;
    error: string;
  }>;
}

// HPF-ICS Strategy Types
export interface ChecklistCondition {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  value?: string | number;
  threshold?: string | number;
  importance: "critical" | "important" | "optional";
}

export interface HPFChecklistResult {
  allPassed: boolean;
  conditions: ChecklistCondition[];
  recommendation: "GO" | "NO_GO" | "CAUTION";
  summary: string;
  timestamp: Date;
}

export interface HPFEntryRules {
  targetDte: { min: number; max: number; target: number };
  shortDelta: { min: number; max: number };
  spreadWidth: number[];
  minCreditPercent: number;
  maxRiskPercent: number;
  entryTimeWindow: { start: string; end: string };
}

export interface HPFExitRules {
  profitTarget: number;
  maxDteToClose: number;
  maxLossMultiple: number;
  deltaDefense: number;
  vixPanicLevel: number;
}

export interface PinnedPlan {
  id: string;
  name: string;
  description: string;
  strategy: "HPF-ICS" | "custom";
  entryRules: HPFEntryRules;
  exitRules: HPFExitRules;
  notes: string[];
  createdAt: Date;
  isPinned: boolean;
}

