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
} from './types';

// Data fetching
export {
  fetchTickerData,
  calculateRSI,
  calculateADX,
  getTrendStrength,
  checkDataStaleness,
} from './yahoo';

// Formatters
export {
  formatTickerDataForAI,
  formatSearchResultsForAI,
  formatTickerSummary,
} from './formatters';

