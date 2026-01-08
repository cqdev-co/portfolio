/**
 * Market Data Types
 * Shared interfaces for market data providers
 */

export interface HistoricalBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface MarketDataProvider {
  /**
   * Get historical OHLCV data
   */
  getHistorical: (
    ticker: string,
    days: number
  ) => Promise<HistoricalBar[] | null>;

  /**
   * Get current quote
   */
  getQuote: (ticker: string) => Promise<Quote | null>;

  /**
   * Get quote summary with additional data (earnings, etc.)
   */
  getQuoteSummary?: (ticker: string) => Promise<{
    calendarEvents?: {
      earnings?: {
        earningsDate?: (Date | string)[];
      };
    };
  } | null>;
}
