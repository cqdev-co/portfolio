/**
 * Configuration constants for Yahoo Finance Proxy
 */

export const CONFIG = {
  cache: {
    crumb: 3600, // 1 hour for auth crumb
    quote: 60, // 1 min for real-time prices
    chart: 300, // 5 min for historical data
    options: 120, // 2 min for options chains
    summary: 300, // 5 min for earnings/analysts
    news: 600, // 10 min for news
    financials: 3600, // 1 hour for financials
    holdings: 3600, // 1 hour for holdings
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
  },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/120.0.0.0 Safari/537.36',
} as const;

export type Config = typeof CONFIG;
