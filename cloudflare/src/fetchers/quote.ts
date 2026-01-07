/**
 * Quote Fetcher
 *
 * Fetches real-time stock quote data from Yahoo Finance
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import { fetchYahooAPI } from '../auth/crumb';
import { logger } from '../utils/logger';
import type { YahooAuth, QuoteData, YahooQuoteResponse } from '../types';

/**
 * Fetch stock quote data
 *
 * Returns cached data if available, otherwise fetches fresh data
 */
export async function fetchQuote(
  ticker: string,
  auth: YahooAuth
): Promise<QuoteData | null> {
  const cacheKey = getCacheKey('quote', ticker);
  const cached = await getFromCache<QuoteData>(cacheKey);

  if (cached) {
    logger.debug(`[Cache] HIT quote/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }

  // URL-encode ticker to handle symbols with periods (BRK.B -> BRK%2EB)
  const encodedTicker = encodeURIComponent(ticker.toUpperCase());
  const data = await withRetry(
    () =>
      fetchYahooAPI<YahooQuoteResponse>(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodedTicker}`,
        auth
      ),
    `quote/${ticker}`
  );

  const q = data.quoteResponse?.result?.[0];
  if (!q) return null;

  // Match lib/ai-agent expected field names exactly
  const result: QuoteData = {
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePct: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    avgVolume: q.averageDailyVolume3Month ?? 0,
    marketCap: q.marketCap ?? 0,
    // Preserve null for unavailable P/E (loss-making companies)
    // These are supplemented from quoteSummary if available
    peRatio: q.trailingPE ?? null,
    forwardPE: q.forwardPE ?? null,
    eps: q.trailingEps ?? null,
    beta: q.beta ?? null,
    dividendYield: q.dividendYield ?? 0,
    fiftyDayAverage: q.fiftyDayAverage ?? 0,
    twoHundredDayAverage: q.twoHundredDayAverage ?? 0,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
  };

  await storeInCache(cacheKey, result, CONFIG.cache.quote);
  return result;
}
