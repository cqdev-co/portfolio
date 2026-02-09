/**
 * @portfolio/providers - Shared market data providers
 *
 * Canonical exports for Yahoo Finance data fetching, proxy support,
 * ticker management, and shared market data types.
 */

// Types
export type {
  QuoteData,
  QuoteSummary,
  HistoricalData,
  OptionLeg,
  OptionsChainResult,
  OptionContract,
  VerticalSpread,
  Signal,
  SignalCategory,
} from './types.ts';

// Shared Yahoo proxy
export {
  isProxyConfigured,
  fetchTickerViaProxy,
  fetchTickerCached,
  fetchHoldingsViaProxy,
  fetchHoldingsCached,
  fetchOptionsChainViaProxy,
  fetchOptionsChainCached,
  convertToQuoteData,
  convertToHistoricalData,
  convertToQuoteSummary,
  getProxyStats,
  resetProxyStats,
  clearCache as clearProxyCache,
  getCacheStats as getProxyCacheStats,
} from './shared-yahoo.ts';

export type {
  CombinedTickerResponse,
  HoldingsResponse,
  ProxyOptionsChainResponse,
} from './shared-yahoo.ts';

// Ticker management
export {
  fetchTickersFromDB,
  fetchSP500Tickers,
  fetchAllStockTickers,
  isTickerDBConfigured,
} from './tickers.ts';

// Logger
export { logger } from './logger.ts';
export type { ProviderLogger } from './logger.ts';

// Ticker lists
export { TICKER_LISTS, getTickerList } from './ticker-lists.ts';

// Shared signal detection functions
export {
  // Fundamental signals
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
  // Analyst signals
  checkPriceTargetUpside,
  checkRecentUpgrades,
  checkRecommendationTrend,
  checkEarningsRevisions,
  checkAnalystCoverage,
  DEFAULT_ANALYST_THRESHOLDS,
  DEFAULT_ANALYST_WEIGHTS,
  // Technical common signals
  checkGoldenCross,
  checkVolumeSurge,
  checkOBVTrend,
  checkMACD,
  SIGNAL_GROUP_CAPS,
  applySignalGroupCaps,
} from './signals/index.ts';

export type {
  FundamentalThresholds,
  FundamentalWeights,
  AnalystThresholds,
  AnalystWeights,
} from './signals/index.ts';
