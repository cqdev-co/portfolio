/**
 * Market Regime Detection
 * Core logic for determining market conditions and trading regime.
 *
 * This module provides:
 * 1. Direct regime detection from price data (detectMarketRegime)
 * 2. Bridge functions to map between the AI agent regime types and
 *    strategy config regime types (mapToStrategyRegime, mapToAIRegime)
 *
 * The bridge functions ensure consistent behavior across all consumers
 * regardless of which detection system they use.
 */

export {
  // Core detection
  detectMarketRegime,
  // Bridge functions
  mapToStrategyRegime,
  mapToAIRegime,
  getRegimeAdjustments,
  // Types
  type MarketRegime,
  type AIMarketRegimeType,
  type RegimeSignal,
  type RegimeResult,
} from './detector.ts';
