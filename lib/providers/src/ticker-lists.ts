/**
 * Shared Ticker Lists
 *
 * Canonical ticker lists used by all engine strategies.
 * Import from here instead of duplicating in each command file.
 */

export const TICKER_LISTS: Record<string, string[]> = {
  mega: [
    'AAPL',
    'MSFT',
    'NVDA',
    'GOOGL',
    'AMZN',
    'META',
    'TSLA',
    'AMD',
    'NFLX',
    'AVGO',
  ],
  growth: [
    'AAPL',
    'MSFT',
    'NVDA',
    'GOOGL',
    'AMZN',
    'META',
    'TSLA',
    'AMD',
    'NFLX',
    'AVGO',
    'CRM',
    'ADBE',
    'ORCL',
    'NOW',
    'PLTR',
    'UBER',
    'ABNB',
    'DDOG',
    'SHOP',
    'SQ',
    'NET',
    'PANW',
  ],
  etf: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'SMH', 'SOXX'],
  value: [
    'JPM',
    'BAC',
    'WFC',
    'GS',
    'XOM',
    'CVX',
    'UNH',
    'JNJ',
    'PFE',
    'MRK',
    'ABBV',
  ],
};

/**
 * Get a ticker list by name.
 * Falls back to 'mega' if the list name is not found.
 */
export function getTickerList(name: string): string[] {
  return TICKER_LISTS[name.toLowerCase()] ?? TICKER_LISTS['mega'] ?? [];
}
