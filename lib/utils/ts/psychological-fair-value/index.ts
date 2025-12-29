/**
 * Psychological Fair Value (PFV) Utility
 * 
 * Calculates where stock price gravitates based on behavioral
 * biases and market mechanics rather than fundamentals.
 * 
 * @example
 * ```typescript
 * import { 
 *   calculatePsychologicalFairValue,
 *   formatPFVResult,
 * } from '@lib/utils/ts/psychological-fair-value';
 * 
 * const result = calculatePsychologicalFairValue({
 *   ticker: 'AAPL',
 *   technicalData: {
 *     currentPrice: 178.50,
 *     ma200: 175.00,
 *     fiftyTwoWeekHigh: 199.62,
 *     fiftyTwoWeekLow: 164.08,
 *   },
 *   expirations: [...optionsData],
 * });
 * 
 * console.log(formatPFVResult(result));
 * ```
 * 
 * @packageDocumentation
 */

// Main calculator
export { 
  calculatePsychologicalFairValue,
  quickPFV,
  formatPFVResult,
} from './calculator';

// Types
export type {
  // Input types
  PFVInput,
  PFVCalculatorOptions,
  OptionContract,
  OptionsExpiration,
  TechnicalData,
  
  // Output types
  PsychologicalFairValue,
  MagneticLevel,
  PFVComponentBreakdown,
  ConfidenceLevel,
  BiasSentiment,
  ExpirationAnalysis,
  
  // Profile types
  TickerProfile,
  TickerProfileType,
  ProfileWeights,
  
  // Component result types
  MaxPainResult,
  GammaWall,
  GammaWallsResult,
  TechnicalLevel,
  TechnicalLevelsResult,
  RoundNumberLevel,
  RoundNumbersResult,
  
  // Utility types
  ValidationMetrics,
} from './types';

// Profile utilities
export {
  PROFILES,
  detectProfile,
  getProfile,
  createCustomProfile,
  validateWeights,
  normalizeWeights,
} from './profiles';

// Max Pain utilities
export {
  calculateMaxPain,
  calculateWeightedMaxPain,
  isMonthlyOpex,
  isWeeklyOpex,
  formatMaxPainResult,
} from './max-pain';

// Gamma Wall utilities
export {
  detectGammaWalls,
  estimateGammaExposure,
  findGammaFlip,
  formatGammaWalls,
} from './gamma-walls';

// Technical Level utilities
export {
  analyzeTechnicalLevels,
  isNearKeyLevel,
  findConfluenceZones,
  determineTrendBias,
  calculateMilestones,
  formatTechnicalLevels,
} from './technical-levels';

// Round Number utilities
export {
  analyzeRoundNumbers,
  findStrongestMagnet,
  isAtRoundNumber,
  getMidpointLevels,
  getRoundNumberBias,
  formatRoundNumbers,
} from './round-numbers';

// Multi-Expiry utilities
export {
  analyzeMultipleExpirations,
  getWeightedMaxPain,
  getWeightedGammaCenter,
  aggregateGammaWalls,
  getPrimaryExpiration,
  getExpirationsByType,
  calculateTimeGravity,
  formatMultiExpirationAnalysis,
} from './multi-expiry';

