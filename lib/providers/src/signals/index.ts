/**
 * Shared Signal Detection Functions
 *
 * Re-exports all shared fundamental, analyst, and technical signal functions.
 */

// Fundamental signals
export {
  checkPEGRatio,
  checkFCFYield,
  checkForwardPE,
  checkEVEBITDA,
  checkEarningsGrowth,
  checkRevenueGrowth,
  checkProfitMargins,
  checkROE,
  checkPriceToBook,
  checkShortInterest,
  checkBalanceSheetHealth,
  checkInsiderOwnership,
  checkInstitutionalOwnership,
  DEFAULT_FUNDAMENTAL_THRESHOLDS,
  DEFAULT_FUNDAMENTAL_WEIGHTS,
} from './fundamental.ts';

export type {
  FundamentalThresholds,
  FundamentalWeights,
} from './fundamental.ts';

// Analyst signals
export {
  checkPriceTargetUpside,
  checkRecentUpgrades,
  checkRecommendationTrend,
  checkEarningsRevisions,
  checkAnalystCoverage,
  DEFAULT_ANALYST_THRESHOLDS,
  DEFAULT_ANALYST_WEIGHTS,
} from './analyst.ts';

export type { AnalystThresholds, AnalystWeights } from './analyst.ts';

// Technical common signals
export {
  checkGoldenCross,
  checkVolumeSurge,
  checkOBVTrend,
  checkMACD,
  SIGNAL_GROUP_CAPS,
  applySignalGroupCaps,
} from './technical-common.ts';
