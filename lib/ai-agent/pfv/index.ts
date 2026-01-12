/**
 * Psychological Fair Value (PFV) Service
 *
 * Shared PFV service for CLI and Frontend.
 * Fetches data and calculates psychological fair value
 * including put/call walls that affect spread selection.
 *
 * This is the SAME logic used by the CLI.
 *
 * CACHING: Uses SessionCache for 5-minute TTL caching of PFV results.
 * PFV calculations require 4+ options chain fetches, so caching is essential.
 */

import { sessionCache, CacheKeys, CACHE_TTL } from '../cache';
import { log } from '../utils';

import type {
  PFVInput,
  TechnicalData,
  OptionsExpiration,
  PsychologicalFairValue,
  PFVCalculatorOptions,
  TickerProfileType,
} from '../../utils/ts/psychological-fair-value/types';
import {
  calculatePsychologicalFairValue,
  formatPFVResult,
} from '../../utils/ts/psychological-fair-value/calculator';

// ============================================================================
// DATA FETCHING (uses proxy to avoid rate limiting)
// ============================================================================

/**
 * Fetch options chain for PFV calculation via proxy
 * Gets multiple expirations for multi-expiry analysis
 */
async function fetchOptionsExpirations(
  ticker: string,
  maxExpirations: number = 4
): Promise<OptionsExpiration[]> {
  const proxyUrl = process.env.YAHOO_PROXY_URL;

  // Use proxy if available - use /options-chain/ endpoint for raw data
  if (proxyUrl) {
    try {
      // Use options-chain endpoint which returns raw chain data
      const url = `${proxyUrl}/options-chain/${ticker.toUpperCase()}`;
      log.debug(`[PFV] Fetching options via proxy: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        log.debug(`[PFV] Proxy options returned ${response.status}`);
      }
      if (response.ok) {
        // /options-chain/ returns OptionsChainData directly
        const data = (await response.json()) as {
          underlying?: string;
          underlyingPrice?: number;
          expirationDate?: string;
          expirationTimestamp?: number;
          availableExpirations?: string[];
          calls?: Array<{
            strike: number;
            openInterest: number;
            volume: number;
            impliedVolatility: number;
          }>;
          puts?: Array<{
            strike: number;
            openInterest: number;
            volume: number;
            impliedVolatility: number;
          }>;
        };

        log.debug(
          `[PFV] Proxy options response:`,
          data.availableExpirations
            ? `${data.availableExpirations.length} expirations available`
            : 'no data'
        );

        if (data.calls && data.puts && data.expirationTimestamp) {
          const expirations: OptionsExpiration[] = [];
          const now = Date.now() / 1000;

          // First expiration from initial response
          const expDate = new Date(data.expirationTimestamp * 1000);
          const dte = Math.ceil((data.expirationTimestamp - now) / 86400);

          const calls = data.calls.map((c) => ({
            strike: c.strike,
            openInterest: c.openInterest ?? 0,
            volume: c.volume ?? 0,
            iv: (c.impliedVolatility ?? 0) * 100,
          }));

          const puts = data.puts.map((p) => ({
            strike: p.strike,
            openInterest: p.openInterest ?? 0,
            volume: p.volume ?? 0,
            iv: (p.impliedVolatility ?? 0) * 100,
          }));

          const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
          const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);

          expirations.push({
            expiration: expDate,
            dte,
            calls,
            puts,
            totalCallOI,
            totalPutOI,
          });

          // Fetch additional expirations if needed
          if (
            data.availableExpirations &&
            data.availableExpirations.length > 1
          ) {
            // Parse available expirations and get future ones
            const futureExps = data.availableExpirations
              .map((d) => new Date(d).getTime() / 1000)
              .filter((ts) => ts > now && ts !== data.expirationTimestamp)
              .slice(0, maxExpirations - 1);

            for (const expTs of futureExps) {
              try {
                const addlUrl = `${proxyUrl}/options-chain/${ticker.toUpperCase()}?date=${Math.floor(expTs)}`;
                const addlResp = await fetch(addlUrl);
                if (addlResp.ok) {
                  const addlData = (await addlResp.json()) as typeof data;
                  if (
                    addlData.calls &&
                    addlData.puts &&
                    addlData.expirationTimestamp
                  ) {
                    const addlExpDate = new Date(
                      addlData.expirationTimestamp * 1000
                    );
                    const addlDte = Math.ceil(
                      (addlData.expirationTimestamp - now) / 86400
                    );

                    const addlCalls = addlData.calls.map((c) => ({
                      strike: c.strike,
                      openInterest: c.openInterest ?? 0,
                      volume: c.volume ?? 0,
                      iv: (c.impliedVolatility ?? 0) * 100,
                    }));

                    const addlPuts = addlData.puts.map((p) => ({
                      strike: p.strike,
                      openInterest: p.openInterest ?? 0,
                      volume: p.volume ?? 0,
                      iv: (p.impliedVolatility ?? 0) * 100,
                    }));

                    expirations.push({
                      expiration: addlExpDate,
                      dte: addlDte,
                      calls: addlCalls,
                      puts: addlPuts,
                      totalCallOI: addlCalls.reduce(
                        (sum, c) => sum + c.openInterest,
                        0
                      ),
                      totalPutOI: addlPuts.reduce(
                        (sum, p) => sum + p.openInterest,
                        0
                      ),
                    });
                  }
                }
              } catch {
                // Skip failed additional expirations
              }
            }
          }

          log.debug(
            `[PFV] Got ${expirations.length} expirations from proxy for ${ticker}`
          );
          return expirations;
        }
      }
    } catch (e) {
      log.debug(`[PFV] Proxy options failed for ${ticker}, trying direct:`, e);
    }
  } else {
    log.debug(`[PFV] No YAHOO_PROXY_URL set, using direct yahoo-finance2`);
  }

  // Fallback to direct yahoo-finance2
  log.debug(`[PFV] Using direct yahoo-finance2 for ${ticker} options`);

  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    // Get available expiration dates
    const optionsResult = await yahooFinance.options(ticker);
    if (!optionsResult?.expirationDates?.length) {
      return [];
    }

    const expirations: OptionsExpiration[] = [];
    const now = new Date();

    // Get first N expirations that are in the future
    const validExpirations = optionsResult.expirationDates
      .filter((d) => d > now)
      .slice(0, maxExpirations);

    for (const expDate of validExpirations) {
      try {
        const chain = await yahooFinance.options(ticker, { date: expDate });
        if (!chain?.options?.[0]) continue;

        const opts = chain.options[0];
        const dte = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Map calls
        const calls = (opts.calls ?? []).map(
          (c: {
            strike: number;
            openInterest?: number;
            volume?: number;
            impliedVolatility?: number;
          }) => ({
            strike: c.strike,
            openInterest: c.openInterest ?? 0,
            volume: c.volume ?? 0,
            iv: (c.impliedVolatility ?? 0) * 100,
          })
        );

        // Map puts
        const puts = (opts.puts ?? []).map(
          (p: {
            strike: number;
            openInterest?: number;
            volume?: number;
            impliedVolatility?: number;
          }) => ({
            strike: p.strike,
            openInterest: p.openInterest ?? 0,
            volume: p.volume ?? 0,
            iv: (p.impliedVolatility ?? 0) * 100,
          })
        );

        // Calculate total OI for the expiration
        const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
        const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);

        expirations.push({
          expiration: expDate, // Field name must match OptionsExpiration interface
          dte,
          calls,
          puts,
          totalCallOI,
          totalPutOI,
        });
      } catch {
        // Skip this expiration if it fails
        continue;
      }
    }

    return expirations;
  } catch (error) {
    console.error(`[PFV] Failed to fetch options for ${ticker}:`, error);
    return [];
  }
}

/**
 * Fetch technical data for PFV calculation
 * Uses proxy to avoid rate limiting
 */
async function fetchTechnicalDataForPFV(
  ticker: string
): Promise<TechnicalData | null> {
  const proxyUrl = process.env.YAHOO_PROXY_URL;

  // Try proxy first
  if (proxyUrl) {
    try {
      // Fetch quote and chart in parallel via proxy
      log.debug(`[PFV] Fetching technical data via proxy for ${ticker}...`);
      const [quoteResp, chartResp] = await Promise.all([
        fetch(`${proxyUrl}/quote/${ticker.toUpperCase()}`),
        fetch(
          `${proxyUrl}/chart/${ticker.toUpperCase()}?range=1mo&interval=1d`
        ),
      ]);

      if (quoteResp.ok) {
        // Proxy returns cleaned QuoteData directly (not wrapped)
        const quote = (await quoteResp.json()) as {
          price?: number;
          fiftyDayAverage?: number;
          twoHundredDayAverage?: number;
          fiftyTwoWeekHigh?: number;
          fiftyTwoWeekLow?: number;
        };
        if (quote?.price) {
          let recentSwingHigh: number | undefined;
          let recentSwingLow: number | undefined;
          let vwap: number | undefined;

          // Process chart data if available
          if (chartResp.ok) {
            const chartData = (await chartResp.json()) as {
              chart?: {
                result?: Array<{
                  indicators?: {
                    quote?: Array<{
                      high?: (number | null)[];
                      low?: (number | null)[];
                      close?: (number | null)[];
                      volume?: (number | null)[];
                    }>;
                  };
                }>;
              };
            };
            const chart = chartData.chart?.result?.[0];
            if (chart?.indicators?.quote?.[0]) {
              const q = chart.indicators.quote[0];
              const highs = (q.high ?? []).filter(
                (h: number | null) => h !== null
              );
              const lows = (q.low ?? []).filter(
                (l: number | null) => l !== null
              );
              const closes = (q.close ?? []).filter(
                (c: number | null) => c !== null
              );
              const volumes = (q.volume ?? []).filter(
                (v: number | null) => v !== null
              );

              if (highs.length > 0) recentSwingHigh = Math.max(...highs);
              if (lows.length > 0) recentSwingLow = Math.min(...lows);

              // Simple VWAP approximation
              if (closes.length > 0 && volumes.length > 0) {
                let vwapSum = 0;
                let volumeSum = 0;
                for (
                  let i = 0;
                  i < Math.min(closes.length, volumes.length);
                  i++
                ) {
                  vwapSum += closes[i] * volumes[i];
                  volumeSum += volumes[i];
                }
                if (volumeSum > 0) {
                  vwap = vwapSum / volumeSum;
                }
              }
            }
          }

          log.debug(
            `[PFV] Got technical data from proxy for ${ticker}: $${quote.price}`
          );
          return {
            currentPrice: quote.price,
            ma50: quote.fiftyDayAverage,
            ma200: quote.twoHundredDayAverage,
            fiftyTwoWeekHigh:
              quote.fiftyTwoWeekHigh ?? recentSwingHigh ?? quote.price,
            fiftyTwoWeekLow:
              quote.fiftyTwoWeekLow ?? recentSwingLow ?? quote.price,
            vwap,
            recentSwingHigh,
            recentSwingLow,
          };
        } else {
          log.debug(`[PFV] Proxy quote returned no data for ${ticker}`);
        }
      } else {
        log.debug(
          `[PFV] Proxy quote returned ${quoteResp.status} for ${ticker}`
        );
      }
    } catch (e) {
      log.debug(
        `[PFV] Proxy technical data failed for ${ticker}, trying direct:`,
        e
      );
    }
  } else {
    log.debug(`[PFV] No YAHOO_PROXY_URL set for technical data`);
  }

  // Fallback to direct yahoo-finance2
  log.debug(`[PFV] Using direct yahoo-finance2 for ${ticker} technical data`);
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    });

    const quote = await yahooFinance.quote(ticker);
    if (!quote?.regularMarketPrice) return null;

    // Get historical data for swing points and VWAP approximation
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    let recentSwingHigh: number | undefined;
    let recentSwingLow: number | undefined;
    let vwap: number | undefined;

    try {
      const history = await yahooFinance.chart(ticker, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      if (history?.quotes && history.quotes.length > 0) {
        const highs = history.quotes
          .map((q) => q.high)
          .filter((h): h is number => h !== null && h !== undefined);
        const lows = history.quotes
          .map((q) => q.low)
          .filter((l): l is number => l !== null && l !== undefined);
        const closes = history.quotes
          .map((q) => q.close)
          .filter((c): c is number => c !== null && c !== undefined);
        const volumes = history.quotes
          .map((q) => q.volume)
          .filter((v): v is number => v !== null && v !== undefined);

        if (highs.length > 0) recentSwingHigh = Math.max(...highs);
        if (lows.length > 0) recentSwingLow = Math.min(...lows);

        // Simple VWAP approximation
        if (closes.length > 0 && volumes.length > 0) {
          let vwapSum = 0;
          let volumeSum = 0;
          for (let i = 0; i < Math.min(closes.length, volumes.length); i++) {
            vwapSum += closes[i] * volumes[i];
            volumeSum += volumes[i];
          }
          if (volumeSum > 0) {
            vwap = vwapSum / volumeSum;
          }
        }
      }
    } catch {
      // Historical data optional
    }

    return {
      currentPrice: quote.regularMarketPrice,
      ma20: quote.fiftyDayAverage, // Approximation
      ma50: quote.fiftyDayAverage,
      ma200: quote.twoHundredDayAverage,
      fiftyTwoWeekHigh:
        quote.fiftyTwoWeekHigh ?? quote.regularMarketPrice * 1.2,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? quote.regularMarketPrice * 0.8,
      vwap,
      recentSwingHigh,
      recentSwingLow,
    };
  } catch (error) {
    console.error(`[PFV] Failed to fetch technical data for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN PFV SERVICE
// ============================================================================

export interface PFVServiceOptions {
  maxExpirations?: number;
  profileOverride?: TickerProfileType;
  calculatorOptions?: PFVCalculatorOptions;
}

/**
 * Calculate Psychological Fair Value for a ticker
 *
 * This is the SAME function used by CLI - now shared with Frontend.
 *
 * Uses 5-minute caching since PFV requires 4+ options chain fetches.
 * This is the most expensive calculation in the system.
 */
export async function getPsychologicalFairValue(
  ticker: string,
  options: PFVServiceOptions = {}
): Promise<PsychologicalFairValue | null> {
  const cacheKey = CacheKeys.pfv(ticker);

  // CHECK CACHE FIRST - PFV is the most expensive calculation
  const cached = sessionCache.get<PsychologicalFairValue>(cacheKey);
  if (cached) {
    const age = sessionCache.getAge(cacheKey);
    log.debug(
      `[PFV] Cache HIT for ${ticker} (age: ${age ? Math.round(age / 1000) : 0}s)`
    );
    return cached;
  }

  const {
    maxExpirations = 4,
    profileOverride,
    calculatorOptions = {},
  } = options;

  log.debug(`[PFV] Cache MISS for ${ticker}, calculating...`);

  // Fetch data in parallel
  const [technicalData, expirations] = await Promise.all([
    fetchTechnicalDataForPFV(ticker),
    fetchOptionsExpirations(ticker, maxExpirations),
  ]);

  if (!technicalData) {
    log.debug(`[PFV] No technical data for ${ticker}`);
    return null;
  }

  log.debug(`[PFV] Got ${expirations.length} expirations for ${ticker}`);

  // Build input
  const input: PFVInput = {
    ticker: ticker.toUpperCase(),
    technicalData,
    expirations,
    profileOverride,
  };

  try {
    const result = calculatePsychologicalFairValue(input, calculatorOptions);
    log.debug(
      `[PFV] Fair value for ${ticker}: $${result.fairValue.toFixed(2)} (${result.bias})`
    );

    // Cache the result - PFV is expensive, cache for 5 minutes
    sessionCache.set(cacheKey, result, CACHE_TTL.PFV);
    log.debug(`[PFV] Cached ${ticker} (TTL: ${CACHE_TTL.PFV / 1000 / 60} min)`);

    return result;
  } catch (error) {
    console.error(`[PFV] Calculation failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Get key magnetic levels (put/call walls) from PFV result
 * Used for spread context
 */
export function getKeyMagneticLevels(
  pfv: PsychologicalFairValue,
  maxLevels: number = 5
): Array<{ price: number; type: string; strength: number }> {
  if (!pfv.magneticLevels) return [];

  return pfv.magneticLevels
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxLevels)
    .map((l) => ({
      price: l.price,
      type: l.type,
      strength: l.strength,
    }));
}

/**
 * Extract put walls and call walls for spread context
 */
export function extractWallsFromPFV(pfv: PsychologicalFairValue): {
  putWalls: number[];
  callWalls: number[];
} {
  const putWalls: number[] = [];
  const callWalls: number[] = [];

  if (pfv.magneticLevels) {
    for (const level of pfv.magneticLevels) {
      if (level.type === 'PUT_WALL') {
        putWalls.push(level.price);
      } else if (level.type === 'CALL_WALL' || level.type === 'GAMMA_WALL') {
        callWalls.push(level.price);
      }
    }
  }

  return { putWalls, callWalls };
}

// Re-export types
export type { PsychologicalFairValue, TickerProfileType };
export { formatPFVResult };
