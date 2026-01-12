/**
 * Market Regime Detection Service
 *
 * Re-exports from the shared library (lib/ai-agent/market).
 * The CLI uses the SAME implementation as the frontend.
 *
 * Benefits:
 * - Single source of truth for market regime logic
 * - Shared caching (5-minute TTL via SessionCache)
 * - Consistent behavior across all tools
 */

// Re-export everything from the shared library
export {
  // Types
  type MarketRegimeType,
  type VIXLevel,
  type VIXData,
  type SPYTrend,
  type SectorPerformance,
  type MarketRegime,
  // Functions
  getVIXData,
  getSPYTrend,
  getSectorPerformance,
  getMarketRegime,
  formatRegimeForAI,
  getRegimeBadge,
} from '../../../lib/ai-agent/market/index';
