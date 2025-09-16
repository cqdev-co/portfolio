/**
 * TypeScript type definitions for ticker data
 * 
 * These types match the database schema and can be used across
 * the entire monorepo for type safety.
 */

export interface Ticker {
  id: number;
  symbol: string;
  name: string;
  exchange?: string | null;
  country?: string | null;
  currency?: string | null;
  sector?: string | null;
  industry?: string | null;
  market_cap?: number | null;
  is_active: boolean;
  ticker_type: string;
  created_at: string;
  updated_at: string;
  last_fetched: string;
}

export interface TickerSearchParams {
  active_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface TickerSearchOptions extends TickerSearchParams {
  search_fields?: string[];
}

export interface TickerFilters {
  exchange?: string;
  country?: string;
  sector?: string;
  industry?: string;
  ticker_type?: string;
}

export interface TickerQueryResult {
  data: Ticker[];
  count?: number;
  error?: string;
}

// Utility types for common operations
export type TickerSymbol = string;
export type ExchangeName = string;
export type CountryCode = string;
export type SectorName = string;

// Response types for API endpoints
export interface GetTickersResponse {
  tickers: Ticker[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface SearchTickersResponse {
  results: Ticker[];
  query: string;
  total_matches: number;
}

// Enum-like constants for common values
export const TICKER_TYPES = {
  STOCK: 'stock',
  ETF: 'etf',
  CRYPTO: 'crypto',
  FOREX: 'forex',
  COMMODITY: 'commodity',
} as const;

export type TickerType = typeof TICKER_TYPES[keyof typeof TICKER_TYPES];

export const MAJOR_EXCHANGES = {
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  AMEX: 'AMEX',
  LSE: 'LSE',
  TSE: 'TSE',
} as const;

export type MajorExchange = typeof MAJOR_EXCHANGES[keyof typeof MAJOR_EXCHANGES];
