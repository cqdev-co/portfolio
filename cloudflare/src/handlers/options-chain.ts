/**
 * Options Chain Handler
 *
 * Endpoint for raw options chain data with specific expiration dates
 * Used by positions refresh to get actual option contract prices
 */

import { jsonResponse } from '../utils/response';
import { getYahooAuth, fetchYahooAPI } from '../auth/crumb';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { logger } from '../utils/logger';

interface OptionContract {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

interface OptionsChainData {
  underlying: string;
  underlyingPrice: number;
  expirationDate: string;
  expirationTimestamp: number;
  requestedExpiration?: string; // What was requested
  availableExpirations: string[]; // All available expirations
  calls: OptionContract[];
  puts: OptionContract[];
}

interface YahooOptionContract {
  strike?: number;
  lastPrice?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
}

interface YahooOptionsChainResponse {
  optionChain?: {
    result?: Array<{
      underlyingSymbol?: string;
      quote?: {
        regularMarketPrice?: number;
      };
      expirationDates?: number[];
      options?: Array<{
        expirationDate?: number;
        calls?: YahooOptionContract[];
        puts?: YahooOptionContract[];
      }>;
    }>;
  };
}

/**
 * Find the closest available expiration date to the requested one
 */
function findClosestExpiration(
  availableExpirations: number[],
  requestedTimestamp: number
): number | null {
  if (!availableExpirations || availableExpirations.length === 0) return null;

  // Sort expirations
  const sorted = [...availableExpirations].sort((a, b) => a - b);

  // Find closest
  let closest = sorted[0];
  let minDiff = Math.abs(requestedTimestamp - closest);

  for (const exp of sorted) {
    const diff = Math.abs(requestedTimestamp - exp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = exp;
    }
  }

  return closest;
}

/**
 * Handle /options-chain/:ticker endpoint
 *
 * Query params:
 *   date: Unix timestamp for expiration date (optional, defaults to nearest)
 */
export async function handleOptionsChain(
  ticker: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    const dateParam = searchParams.get('date');
    const requestedTimestamp = dateParam ? parseInt(dateParam, 10) : undefined;

    // Check cache first
    const cacheKey = getCacheKey(
      'options-chain',
      `${ticker}:${requestedTimestamp || 'nearest'}`
    );
    const cached = await getFromCache<OptionsChainData>(cacheKey);

    if (cached) {
      logger.debug(`[Cache] HIT options-chain/${ticker} (age: ${cached.age}s)`);
      return jsonResponse(cached.data);
    }

    const auth = await getYahooAuth();

    // First fetch WITHOUT date to get available expirations
    const baseUrl = `https://query1.finance.yahoo.com/v7/finance/options/${ticker.toUpperCase()}`;
    logger.debug(`[Options Chain] Fetching ${ticker} available expirations`);

    const baseData = await fetchYahooAPI<YahooOptionsChainResponse>(
      baseUrl,
      auth
    );
    const baseResult = baseData.optionChain?.result?.[0];

    if (!baseResult) {
      return jsonResponse({ error: 'Options not found' }, 404);
    }

    // Get available expirations
    const availableExpirations = baseResult.expirationDates || [];
    logger.debug(
      `[Options Chain] ${ticker} has ${availableExpirations.length} expirations`
    );

    // Determine which expiration to fetch
    let targetExpiration: number | undefined;

    if (requestedTimestamp) {
      // Find the closest available expiration
      const closest = findClosestExpiration(
        availableExpirations,
        requestedTimestamp
      );
      if (closest) {
        targetExpiration = closest;
        const requestedDate = new Date(requestedTimestamp * 1000)
          .toISOString()
          .split('T')[0];
        const closestDate = new Date(closest * 1000)
          .toISOString()
          .split('T')[0];
        logger.debug(
          `[Options Chain] Requested: ${requestedDate}, using closest: ${closestDate}`
        );
      }
    }

    // Fetch the target expiration's data
    let data = baseData;
    if (
      targetExpiration &&
      targetExpiration !== baseResult.options?.[0]?.expirationDate
    ) {
      const url = `${baseUrl}?date=${targetExpiration}`;
      logger.debug(
        `[Options Chain] Fetching specific expiration: ${targetExpiration}`
      );
      data = await fetchYahooAPI<YahooOptionsChainResponse>(url, auth);
    }

    const result = data.optionChain?.result?.[0];
    if (!result?.options?.[0]) {
      return jsonResponse({ error: 'Options data not available' }, 404);
    }

    const firstOptions = result.options[0];

    // Debug: log a sample raw option to see what Yahoo returns
    if (firstOptions.calls && firstOptions.calls.length > 0) {
      const sampleCall = firstOptions.calls.find(
        (c: any) => c.strike && c.strike > 0
      );
      if (sampleCall) {
        logger.debug(
          `[Options Chain] ${ticker} sample raw call:`,
          JSON.stringify(sampleCall)
        );
      }
    }

    // Map to cleaner format
    const response: OptionsChainData = {
      underlying: result.underlyingSymbol || ticker.toUpperCase(),
      underlyingPrice: result.quote?.regularMarketPrice || 0,
      expirationDate: firstOptions.expirationDate
        ? new Date(firstOptions.expirationDate * 1000)
            .toISOString()
            .split('T')[0]
        : '',
      expirationTimestamp: firstOptions.expirationDate || 0,
      requestedExpiration: requestedTimestamp
        ? new Date(requestedTimestamp * 1000).toISOString().split('T')[0]
        : undefined,
      availableExpirations: availableExpirations.map(
        (ts) => new Date(ts * 1000).toISOString().split('T')[0]
      ),
      calls: (firstOptions.calls || []).map((c) => ({
        strike: c.strike || 0,
        lastPrice: c.lastPrice || 0,
        bid: c.bid || 0,
        ask: c.ask || 0,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: c.impliedVolatility || 0,
        inTheMoney: c.inTheMoney || false,
      })),
      puts: (firstOptions.puts || []).map((p) => ({
        strike: p.strike || 0,
        lastPrice: p.lastPrice || 0,
        bid: p.bid || 0,
        ask: p.ask || 0,
        volume: p.volume || 0,
        openInterest: p.openInterest || 0,
        impliedVolatility: p.impliedVolatility || 0,
        inTheMoney: p.inTheMoney || false,
      })),
    };

    logger.debug(
      `[Options Chain] ${ticker}: returning ${response.calls.length} calls, ${response.puts.length} puts for ${response.expirationDate}`
    );

    // Cache for 60 seconds
    await storeInCache(cacheKey, response, 60);

    return jsonResponse(response);
  } catch (error) {
    logger.error(`[Options Chain] Error for ${ticker}:`, error);
    return jsonResponse(
      {
        error: String(error),
        ticker,
      },
      500
    );
  }
}
