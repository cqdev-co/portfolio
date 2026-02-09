/**
 * Shared market data types
 *
 * Re-exports canonical types from @portfolio/providers.
 * Import from here or directly from @portfolio/providers.
 */

// Re-export all market data types from providers
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
} from '@portfolio/providers';
