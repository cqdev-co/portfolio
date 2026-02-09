import type { PCSThresholdsConfig, PCSScoreWeights } from '../types/index.ts';

/**
 * Default thresholds for PCS signal detection
 *
 * Key differences from CDS:
 * - RSI ideal range shifted up: 40-55 (neutral/slightly bullish)
 * - IV Rank thresholds: HIGHER is better (selling premium)
 * - Support proximity: want price well above support
 */
export const defaultThresholds: PCSThresholdsConfig = {
  technical: {
    rsiIdealMin: 40,
    rsiIdealMax: 55,
    rsiAcceptableMin: 35,
    rsiAcceptableMax: 65,
    volumeSurgeMultiplier: 1.5,
    nearSupportPercent: 0.03,
  },
  fundamental: {
    pegRatioMax: 1.5,
    pegRatioGood: 2.0,
    fcfYieldMin: 0.03,
    fcfYieldHigh: 0.05,
    forwardPEDiscountPercent: 0.1,
    evEbitdaMax: 15,
    evEbitdaGood: 20,
  },
  analyst: {
    minUpsidePercent: 0.15, // Lower bar than CDS - PCS doesn't need big upside
    recentUpgradesMin: 2,
    revisionsTrendDays: 90,
  },
  iv: {
    ivRankMin: 20, // Minimum to make credit worthwhile
    ivRankPreferred: 40, // Good premium level
    ivRankIdeal: 50, // Sweet spot for PCS
  },
  scoring: {
    minTotalScore: 65, // Slightly lower than CDS since PCS has higher PoP
    momentumBonusThreshold7d: 10,
    strongMomentumThreshold7d: 20,
  },
};

/**
 * Score weights for PCS strategy
 *
 * Differences from CDS:
 * - Technical max: 40 points (lower than CDS 50 - less directional)
 * - Fundamental max: 25 points (similar importance)
 * - Analyst max: 15 points (less weight - PCS doesn't need strong conviction)
 * - IV max: 20 points (NEW - critical for premium selling)
 * Total: max 100 points
 */
export const defaultWeights: PCSScoreWeights = {
  technical: {
    rsiIdealZone: 8,
    goldenCross: 10,
    nearSupport: 8,
    volumeSurge: 5,
    obvTrend: 4,
    maPosition: 5,
  },
  fundamental: {
    pegUnderOne: 8,
    fcfYieldHigh: 7,
    forwardPELow: 5,
    evEbitdaLow: 5,
  },
  analyst: {
    highUpside: 6,
    recentUpgrades: 5,
    positiveRevisions: 4,
  },
  iv: {
    elevatedIV: 12,
    highIV: 8,
  },
};
