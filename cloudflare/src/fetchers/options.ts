/**
 * Options Fetcher
 * 
 * Fetches options chain data and calculates summary metrics
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import { fetchYahooAPI } from '../auth/crumb';
import type { YahooAuth, OptionsData, YahooOptionsResponse } from '../types';

/**
 * Fetch options chain summary
 * 
 * Returns aggregated options data including ATM IV and P/C ratios
 */
export async function fetchOptions(
  ticker: string,
  auth: YahooAuth,
  underlyingPrice?: number
): Promise<OptionsData | null> {
  const cacheKey = getCacheKey('options', ticker);
  const cached = await getFromCache<OptionsData>(cacheKey);
  
  if (cached) {
    console.log(`[Cache] HIT options/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }
  
  const data = await withRetry(
    () => fetchYahooAPI<YahooOptionsResponse>(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker.toUpperCase()}`,
      auth
    ),
    `options/${ticker}`
  );
  
  const opts = data.optionChain?.result?.[0];
  if (!opts?.options?.[0]) return null;
  
  const firstExp = opts.options[0];
  const calls = firstExp.calls || [];
  const puts = firstExp.puts || [];
  const price = opts.quote?.regularMarketPrice || underlyingPrice || 0;
  
  // Calculate ATM IV (average of options within 5% of current price)
  const atmIV = calculateATMIV(calls, price);
  
  // Calculate volume and OI totals
  const callVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0);
  const putVolume = puts.reduce((sum, p) => sum + (p.volume || 0), 0);
  const callOI = calls.reduce((sum, c) => sum + (c.openInterest || 0), 0);
  const putOI = puts.reduce((sum, p) => sum + (p.openInterest || 0), 0);
  
  const result: OptionsData = {
    expirations: opts.expirationDates?.length || 0,
    nearestExpiry: firstExp.expirationDate 
      ? new Date(firstExp.expirationDate * 1000).toISOString().split('T')[0]
      : '',
    callCount: calls.length,
    putCount: puts.length,
    atmIV,
    callVolume,
    putVolume,
    callOI,
    putOI,
    pcRatioVol: callVolume > 0
      ? Math.round((putVolume / callVolume) * 100) / 100
      : null,
    pcRatioOI: callOI > 0
      ? Math.round((putOI / callOI) * 100) / 100
      : null,
  };
  
  await storeInCache(cacheKey, result, CONFIG.cache.options);
  return result;
}

/**
 * Calculate ATM (at-the-money) implied volatility
 */
function calculateATMIV(
  calls: Array<{ 
    strike?: number; 
    impliedVolatility?: number 
  }>,
  price: number
): number | null {
  // Filter for ATM calls (within 5% of current price with valid IV)
  const atmCalls = calls.filter(c => 
    c.strike && 
    c.impliedVolatility &&
    Math.abs(c.strike - price) / price < 0.05 &&
    c.impliedVolatility > 0.01
  );
  
  if (atmCalls.length === 0) return null;
  
  // Average IV of closest 3 ATM options
  const avgIV = atmCalls
    .slice(0, 3)
    .reduce((sum, c) => sum + (c.impliedVolatility || 0), 0) / 
    Math.min(3, atmCalls.length);
  
  // Convert to percentage and round
  return Math.round(avgIV * 10000) / 100;
}

