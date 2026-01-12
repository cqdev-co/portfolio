/**
 * Batch Quotes Handler
 *
 * Fetches quotes for multiple tickers in parallel.
 * Used for sector performance (8 ETFs) in a single request.
 *
 * Endpoint: GET /batch-quotes?symbols=XLK,XLF,XLE,XLV,XLY,XLP,XLI,XLB
 */

import { jsonResponse } from '../utils/response';
import { getYahooAuth } from '../auth/crumb';
import { fetchQuote } from '../fetchers';
import type { QuoteData } from '../types';
import { logger } from '../utils/logger';

interface BatchQuotesResponse {
  quotes: Record<string, QuoteData | null>;
  timestamp: string;
  elapsed_ms: number;
  errors: string[];
}

/**
 * Handle /batch-quotes endpoint
 *
 * @param symbols - Comma-separated list of tickers
 */
export async function handleBatchQuotes(symbols: string): Promise<Response> {
  const startTime = Date.now();
  const tickers = symbols
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  if (tickers.length === 0) {
    return jsonResponse(
      { error: 'No symbols provided. Use ?symbols=XLK,XLF,...' },
      400
    );
  }

  if (tickers.length > 20) {
    return jsonResponse({ error: 'Maximum 20 symbols per batch request' }, 400);
  }

  logger.debug(
    `[Batch] Fetching ${tickers.length} quotes: ${tickers.join(',')}`
  );

  try {
    const auth = await getYahooAuth();
    const errors: string[] = [];
    const quotes: Record<string, QuoteData | null> = {};

    // Fetch all quotes in parallel
    const results = await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const quote = await fetchQuote(ticker, auth);
          return { ticker, quote };
        } catch (e) {
          errors.push(`${ticker}: ${e}`);
          return { ticker, quote: null };
        }
      })
    );

    // Build response object
    for (const { ticker, quote } of results) {
      quotes[ticker] = quote;
    }

    const response: BatchQuotesResponse = {
      quotes,
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - startTime,
      errors,
    };

    logger.debug(
      `[Batch] Got ${Object.keys(quotes).length} quotes in ${response.elapsed_ms}ms`
    );

    return jsonResponse(response);
  } catch (error) {
    logger.error('[Batch] Error:', error);
    return jsonResponse({ error: String(error) }, 500);
  }
}
