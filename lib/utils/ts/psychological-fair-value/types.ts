/**
 * Psychological Fair Value (PFV) - Type Definitions
 *
 * Types for calculating where price gravitates based on
 * behavioral biases and market mechanics.
 */

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface OptionContract {
  strike: number;
  openInterest: number;
  volume: number;
  impliedVolatility?: number;
  delta?: number;
  gamma?: number;
}

export interface OptionsExpiration {
  expiration: Date;
  dte: number;
  calls: OptionContract[];
  puts: OptionContract[];
  totalCallOI: number;
  totalPutOI: number;
}

export interface TechnicalData {
  currentPrice: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  recentSwingHigh?: number;
  recentSwingLow?: number;
  previousClose?: number;
  vwap?: number;
  avgVolume?: number;
}

export interface PFVInput {
  ticker: string;
  technicalData: TechnicalData;
  expirations: OptionsExpiration[];
  // Optional overrides
  profileOverride?: TickerProfileType;
}

// ============================================================================
// TICKER PROFILES
// ============================================================================

export type TickerProfileType =
  | 'BLUE_CHIP'
  | 'MEME_RETAIL'
  | 'ETF'
  | 'LOW_FLOAT'
  | 'DEFAULT';

export interface ProfileWeights {
  maxPain: number;
  gammaWalls: number;
  technical: number;
  volume: number;
  roundNumber: number;
}

export interface TickerProfile {
  type: TickerProfileType;
  name: string;
  description: string;
  weights: ProfileWeights;
  characteristics: string[];
}

// ============================================================================
// COMPONENT OUTPUTS
// ============================================================================

export interface MaxPainResult {
  price: number;
  expiration: Date;
  dte: number;
  totalPainAtMaxPain: number;
  callPain: number;
  putPain: number;
  confidence: number; // Based on OI concentration
}

export interface GammaWall {
  strike: number;
  type: 'CALL_WALL' | 'PUT_WALL' | 'COMBINED';
  openInterest: number;
  relativeStrength: number; // vs median OI
  isSupport: boolean;
  isResistance: boolean;
}

export interface GammaWallsResult {
  walls: GammaWall[];
  strongestSupport: GammaWall | null;
  strongestResistance: GammaWall | null;
  center: number; // Weighted center of gamma walls
}

export interface TechnicalLevel {
  price: number;
  type:
    | 'MA20'
    | 'MA50'
    | 'MA200'
    | '52W_HIGH'
    | '52W_LOW'
    | 'SWING_HIGH'
    | 'SWING_LOW'
    | 'VWAP'
    | 'PREV_CLOSE';
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  distance: number; // % from current price
  isSupport: boolean;
  isResistance: boolean;
}

export interface TechnicalLevelsResult {
  levels: TechnicalLevel[];
  weightedCenter: number;
  nearestSupport: TechnicalLevel | null;
  nearestResistance: TechnicalLevel | null;
}

export interface RoundNumberLevel {
  price: number;
  significance: 'MAJOR' | 'MODERATE' | 'MINOR';
  // Major: $100, $50 intervals
  // Moderate: $25, $10 intervals
  // Minor: $5 intervals
  distance: number;
  magneticPull: number; // 0-1, higher = stronger
}

export interface RoundNumbersResult {
  levels: RoundNumberLevel[];
  nearestMajor: RoundNumberLevel | null;
  magneticCenter: number;
}

export interface ExpirationAnalysis {
  expiration: Date;
  dte: number;
  maxPain: MaxPainResult;
  gammaWalls: GammaWallsResult;
  weight: number; // How much this expiry influences PFV
  isMonthlyOpex: boolean;
  isWeeklyOpex: boolean;
}

// ============================================================================
// MAIN OUTPUT
// ============================================================================

export interface MagneticLevel {
  price: number;
  type:
    | 'MAX_PAIN'
    | 'GAMMA_WALL'
    | 'PUT_WALL'
    | 'CALL_WALL'
    | 'MA200'
    | 'MA50'
    | 'MA20'
    | 'VWAP'
    | 'ROUND_MAJOR'
    | 'ROUND_MODERATE'
    | '52W_HIGH'
    | '52W_LOW';
  strength: number; // 0-1
  distance: number; // % from current price
  expiration?: Date; // For options-based levels
}

export interface PFVComponentBreakdown {
  name: string;
  value: number;
  weight: number;
  contribution: number; // value * weight
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type BiasSentiment = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface PsychologicalFairValue {
  // Core output
  ticker: string;
  fairValue: number;
  currentPrice: number;
  confidence: ConfidenceLevel;

  // Deviation analysis
  deviationPercent: number;
  deviationDollars: number;
  bias: BiasSentiment;

  // Profile used
  profile: TickerProfile;

  // Component breakdown
  components: PFVComponentBreakdown[];

  // Multi-expiration analysis
  expirationAnalysis: ExpirationAnalysis[];
  primaryExpiration: ExpirationAnalysis | null;

  // Key magnetic levels (sorted by strength)
  magneticLevels: MagneticLevel[];

  // Support/Resistance zones
  supportZone: { low: number; high: number } | null;
  resistanceZone: { low: number; high: number } | null;

  // Time context
  calculatedAt: Date;
  dataFreshness: 'FRESH' | 'STALE' | 'WEEKEND';

  // AI-ready context string
  aiContext: string;

  // Interpretation
  interpretation: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PFVCalculatorOptions {
  // Which expirations to consider
  maxDTE?: number; // Default: 60
  minDTE?: number; // Default: 0

  // Weight adjustments
  customWeights?: Partial<ProfileWeights>;

  // Output options
  includeAllLevels?: boolean; // Include weak levels
  maxMagneticLevels?: number; // Limit output size
}

export interface ValidationMetrics {
  touchRate: number; // % of times price touched PFV
  avgDeviation: number; // Avg % deviation at expiration
  levelRespect: number; // % of times levels acted as S/R
  sampleSize: number;
}
