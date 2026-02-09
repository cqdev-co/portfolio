/**
 * PCS Engine Types
 *
 * Core types for the Put Credit Spread strategy engine.
 * Re-exports shared types from @portfolio/providers and adds PCS-specific types.
 */

// Re-export shared types
export type {
  QuoteData,
  QuoteSummary,
  HistoricalData,
  OptionLeg,
  OptionsChainResult,
  Signal,
  SignalCategory,
} from '@portfolio/providers';

// ============================================================================
// PCS-SPECIFIC TYPES
// ============================================================================

export interface ScanOptions {
  list?: string;
  tickers?: string;
  top?: number;
  minScore: number;
  dryRun: boolean;
  verbose: boolean;
  debugIndicators?: boolean;
}

/**
 * Thresholds for PCS signal detection
 */
export interface PCSThresholdsConfig {
  technical: {
    rsiIdealMin: number;
    rsiIdealMax: number;
    rsiAcceptableMin: number;
    rsiAcceptableMax: number;
    volumeSurgeMultiplier: number;
    nearSupportPercent: number;
  };
  fundamental: {
    pegRatioMax: number;
    pegRatioGood: number;
    fcfYieldMin: number;
    fcfYieldHigh: number;
    forwardPEDiscountPercent: number;
    evEbitdaMax: number;
    evEbitdaGood: number;
  };
  analyst: {
    minUpsidePercent: number;
    recentUpgradesMin: number;
    revisionsTrendDays: number;
  };
  iv: {
    ivRankMin: number;
    ivRankPreferred: number;
    ivRankIdeal: number;
  };
  scoring: {
    minTotalScore: number;
    momentumBonusThreshold7d: number;
    strongMomentumThreshold7d: number;
  };
}

/**
 * Score weights for PCS signals
 */
export interface PCSScoreWeights {
  technical: {
    rsiIdealZone: number;
    goldenCross: number;
    nearSupport: number;
    volumeSurge: number;
    obvTrend: number;
    maPosition: number;
  };
  fundamental: {
    pegUnderOne: number;
    fcfYieldHigh: number;
    forwardPELow: number;
    evEbitdaLow: number;
  };
  analyst: {
    highUpside: number;
    recentUpgrades: number;
    positiveRevisions: number;
  };
  iv: {
    elevatedIV: number;
    highIV: number;
  };
}

/**
 * Stock score output for PCS screening
 */
export interface PCSStockScore {
  ticker: string;
  name?: string;
  price: number;
  technicalScore: number;
  fundamentalScore: number;
  analystScore: number;
  ivScore: number;
  totalScore: number;
  upsidePotential: number;
  signals: Array<{
    name: string;
    category: string;
    points: number;
    description: string;
    value?: number | string | boolean;
  }>;
  warnings: string[];
  scanDate: Date;
  sector?: string;
  industry?: string;
  ivRank?: number;
}
