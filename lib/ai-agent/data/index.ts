/**
 * AI Agent Data Module
 *
 * Shared data fetching and formatting for CLI and Frontend.
 */

// Types
export type {
  TickerData,
  SpreadRecommendation,
  IVAnalysis,
  TradeGrade,
  NewsItem,
  DataQuality,
  AnalystRatings,
  TargetPrices,
  PricePerformance,
  SectorContext,
  ShortInterest,
  OptionsFlow,
  RelativeStrength,
  EarningsHistory,
  ToolResult,
  TickerToolResult,
  SearchToolResult,
  SearchResult,
  // New financial types
  IncomeStatement,
  BalanceSheet,
  CashFlow,
  FinancialsDeep,
  FinancialsToolResult,
  InstitutionalHolder,
  InstitutionalHoldings,
  HoldingsToolResult,
  UnusualOptionsSignal,
  UnusualOptionsActivity,
  UnusualOptionsToolResult,
} from './types';

// Data fetching (Yahoo with Polygon fallback)
export {
  fetchTickerData,
  calculateRSI,
  calculateADX,
  getTrendStrength,
  checkDataStaleness,
  clearYahooCache,
  isYahooRateLimited,
} from './yahoo';

// Polygon.io fallback
export { fetchTickerDataFromPolygon } from './polygon';

// Cloudflare Worker proxy (bypasses Yahoo rate limits)
export { isProxyConfigured, checkProxyHealth } from './yahoo-proxy';

// Formatters
export {
  formatTickerDataForAI,
  formatSearchResultsForAI,
  formatTickerSummary,
} from './formatters';
