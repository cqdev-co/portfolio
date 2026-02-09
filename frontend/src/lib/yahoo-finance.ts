/**
 * Shared Yahoo Finance singleton
 *
 * yahoo-finance2 v3 requires instantiation via `new YahooFinance()`.
 * Each instance fetches a "crumb" (CSRF token) from Yahoo on first use.
 * Creating a new instance per request causes 429 rate limits on the crumb endpoint.
 *
 * This module exports a single reusable instance so the crumb is fetched once
 * and cached for the lifetime of the server process.
 */

import YahooFinance from 'yahoo-finance2';

export const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});
