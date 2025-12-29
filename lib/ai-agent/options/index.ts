/**
 * Options Module
 * 
 * Real options chain analysis shared between CLI and Frontend.
 * Uses actual Yahoo Finance options data for accurate:
 * - IV (from ATM options)
 * - Spread pricing (from bid/ask)
 * - Probability of profit
 */

// Types
export type {
  OptionContract,
  OptionsChain,
  SpreadRecommendation,
  SpreadAlternatives,
  SpreadSelectionContext,
  IVAnalysis,
} from './types';

// Functions
export { getOptionsChain } from './chain';
export { getIVAnalysis } from './iv';
export { findOptimalSpread, findSpreadWithAlternatives } from './spreads';

