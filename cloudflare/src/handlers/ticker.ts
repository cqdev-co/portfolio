/**
 * Ticker Handler
 *
 * Main endpoint that fetches all data for a ticker
 *
 * v4.2: Serial requests with rate limiting to respect Yahoo limits
 */

import { CONFIG } from '../config';
import { jsonResponse } from '../utils/response';
import { getYahooAuth } from '../auth/crumb';
import { waitForRateLimit } from '../utils/rate-limiter';
import { logger } from '../utils/logger';
import {
  fetchQuote,
  fetchChart,
  fetchSummary,
  fetchOptions,
  fetchNews,
} from '../fetchers';
import type {
  QuoteData,
  ChartData,
  SummaryData,
  OptionsData,
  NewsItem,
} from '../types';

/**
 * Handle /ticker/:symbol endpoint
 *
 * v4.2: Now fetches SERIALLY with rate limiting between requests
 * to respect Yahoo's ~10 req/sec limit
 */
export async function handleTicker(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();
  logger.debug(`[Yahoo Proxy] Fetching ${symbol} (serial mode)`);

  const startTime = Date.now();
  const errors: string[] = [];

  // Get auth (cached)
  try {
    const auth = await getYahooAuth();

    // Initialize data holders
    let quote: QuoteData | null = null;
    let chart: ChartData | null = null;
    let summary: SummaryData = {
      earnings: null,
      analysts: null,
      shortInterest: null,
      beta: null,
      eps: null,
      // v4.1: Expanded data
      fundamentals: null,
      epsTrend: null,
      earningsHistory: null,
      insiderActivity: null,
      profile: null,
    };
    let options: OptionsData | null = null;
    let news: NewsItem[] = [];

    // v4.2: Fetch SERIALLY with rate limiting between each request
    // This respects Yahoo's rate limits (~10 req/sec)

    // 1. Quote (most important)
    try {
      await waitForRateLimit();
      quote = await fetchQuote(symbol, auth);
      logger.debug(`[Yahoo Proxy] ${symbol}: quote ✓`);
    } catch (e) {
      errors.push(`quote: ${e}`);
      logger.debug(`[Yahoo Proxy] ${symbol}: quote ✗ ${e}`);
    }

    // 2. Chart (needed for technical analysis)
    try {
      await waitForRateLimit();
      chart = await fetchChart(symbol);
      logger.debug(`[Yahoo Proxy] ${symbol}: chart ✓`);
    } catch (e) {
      errors.push(`chart: ${e}`);
      logger.debug(`[Yahoo Proxy] ${symbol}: chart ✗ ${e}`);
    }

    // 3. Summary (fundamentals, analysts, etc.)
    try {
      await waitForRateLimit();
      summary = await fetchSummary(symbol, auth);
      // Supplement quote with beta/eps from summary if unavailable
      if (quote && (!quote.beta || quote.beta === 0) && summary.beta) {
        quote.beta = summary.beta;
      }
      if (quote && (!quote.eps || quote.eps === 0) && summary.eps) {
        quote.eps = summary.eps;
      }
      logger.debug(`[Yahoo Proxy] ${symbol}: summary ✓`);
    } catch (e) {
      errors.push(`summary: ${e}`);
      logger.debug(`[Yahoo Proxy] ${symbol}: summary ✗ ${e}`);
    }

    // 4. Options (if quote available for ATM calculation)
    try {
      await waitForRateLimit();
      options = await fetchOptions(symbol, auth, quote?.price);
      logger.debug(`[Yahoo Proxy] ${symbol}: options ✓`);
    } catch (e) {
      errors.push(`options: ${e}`);
      logger.debug(`[Yahoo Proxy] ${symbol}: options ✗ ${e}`);
    }

    // 5. News (lowest priority)
    try {
      await waitForRateLimit();
      news = await fetchNews(symbol, auth);
      logger.debug(`[Yahoo Proxy] ${symbol}: news ✓`);
    } catch (e) {
      errors.push(`news: ${e}`);
      logger.debug(`[Yahoo Proxy] ${symbol}: news ✗ ${e}`);
    }

    const elapsed = Date.now() - startTime;
    logger.debug(`[Yahoo Proxy] Fetched ${symbol} in ${elapsed}ms`);

    // Build response matching lib/ai-agent CombinedTickerResponse
    // v4.1: Include expanded summary data
    const response: Record<string, unknown> = {
      ticker: symbol,
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      quote,
      chart,
      earnings: summary.earnings,
      analysts: summary.analysts,
      shortInterest: summary.shortInterest,
      // v4.1: Expanded data for scoring
      fundamentals: summary.fundamentals,
      epsTrend: summary.epsTrend,
      earningsHistory: summary.earningsHistory,
      insiderActivity: summary.insiderActivity,
      profile: summary.profile,
      options,
      news,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    if (!quote) {
      return jsonResponse(response, 500);
    }

    return jsonResponse(response, 200, `public, max-age=${CONFIG.cache.quote}`);
  } catch (e) {
    return jsonResponse(
      {
        ticker: symbol,
        timestamp: new Date().toISOString(),
        error: `Auth failed: ${e}`,
      },
      500
    );
  }
}
