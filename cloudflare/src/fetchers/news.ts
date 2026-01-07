/**
 * News Fetcher
 *
 * Fetches recent news headlines for a ticker
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import { fetchYahooAPI } from '../auth/crumb';
import { logger } from '../utils/logger';
import type { YahooAuth, NewsItem, YahooSearchResponse } from '../types';

/**
 * Fetch recent news for a ticker
 *
 * Returns up to 5 recent headlines. Non-critical - returns empty array on error.
 */
export async function fetchNews(
  ticker: string,
  auth: YahooAuth
): Promise<NewsItem[]> {
  const cacheKey = getCacheKey('news', ticker);
  const cached = await getFromCache<NewsItem[]>(cacheKey);

  if (cached) {
    logger.debug(`[Cache] HIT news/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }

  try {
    const data = await withRetry(
      // URL-encode ticker to handle symbols with periods (BRK.B -> BRK%2EB)
      () =>
        fetchYahooAPI<YahooSearchResponse>(
          `https://query1.finance.yahoo.com/v1/finance/search?` +
            `q=${encodeURIComponent(ticker.toUpperCase())}&newsCount=5&quotesCount=0`,
          auth
        ),
      `news/${ticker}`
    );

    const result: NewsItem[] = (data.news || []).slice(0, 5).map((n) => ({
      title: n.title || '',
      source: n.publisher || '',
      link: n.link || '',
      date: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toISOString()
        : '',
    }));

    await storeInCache(cacheKey, result, CONFIG.cache.news);
    return result;
  } catch {
    // News is non-critical, return empty on error
    return [];
  }
}
