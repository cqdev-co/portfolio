/**
 * Psychological Fair Value (PFV) Service
 * 
 * Shared PFV service for CLI and Frontend.
 * Fetches data and calculates psychological fair value
 * including put/call walls that affect spread selection.
 * 
 * This is the SAME logic used by the CLI.
 */

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
// DATA FETCHING
// ============================================================================

/**
 * Fetch options chain for PFV calculation
 * Gets multiple expirations for multi-expiry analysis
 */
async function fetchOptionsExpirations(
  ticker: string,
  maxExpirations: number = 4
): Promise<OptionsExpiration[]> {
  try {
    const YahooFinance = (await import('yahoo-finance2')).default;
    const yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey', 'rippiReport'],
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
      .filter(d => d > now)
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
        const calls = (opts.calls ?? []).map((c: {
          strike: number;
          openInterest?: number;
          volume?: number;
          impliedVolatility?: number;
        }) => ({
          strike: c.strike,
          openInterest: c.openInterest ?? 0,
          volume: c.volume ?? 0,
          iv: (c.impliedVolatility ?? 0) * 100,
        }));

        // Map puts
        const puts = (opts.puts ?? []).map((p: {
          strike: number;
          openInterest?: number;
          volume?: number;
          impliedVolatility?: number;
        }) => ({
          strike: p.strike,
          openInterest: p.openInterest ?? 0,
          volume: p.volume ?? 0,
          iv: (p.impliedVolatility ?? 0) * 100,
        }));

        // Calculate total OI for the expiration
        const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
        const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);

        expirations.push({
          expiration: expDate,  // Field name must match OptionsExpiration interface
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
 */
async function fetchTechnicalDataForPFV(
  ticker: string
): Promise<TechnicalData | null> {
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
          .map(q => q.high)
          .filter((h): h is number => h !== null && h !== undefined);
        const lows = history.quotes
          .map(q => q.low)
          .filter((l): l is number => l !== null && l !== undefined);
        const closes = history.quotes
          .map(q => q.close)
          .filter((c): c is number => c !== null && c !== undefined);
        const volumes = history.quotes
          .map(q => q.volume)
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
 */
export async function getPsychologicalFairValue(
  ticker: string,
  options: PFVServiceOptions = {}
): Promise<PsychologicalFairValue | null> {
  const { 
    maxExpirations = 4, 
    profileOverride,
    calculatorOptions = {},
  } = options;

  console.log(`[PFV] Calculating for ${ticker}...`);

  // Fetch data in parallel
  const [technicalData, expirations] = await Promise.all([
    fetchTechnicalDataForPFV(ticker),
    fetchOptionsExpirations(ticker, maxExpirations),
  ]);

  if (!technicalData) {
    console.log(`[PFV] No technical data for ${ticker}`);
    return null;
  }

  console.log(`[PFV] Got ${expirations.length} expirations for ${ticker}`);

  // Build input
  const input: PFVInput = {
    ticker: ticker.toUpperCase(),
    technicalData,
    expirations,
    profileOverride,
  };

  try {
    const result = calculatePsychologicalFairValue(input, calculatorOptions);
    console.log(`[PFV] Fair value for ${ticker}: $${result.fairValue.toFixed(2)} (${result.bias})`);
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
    .map(l => ({
      price: l.price,
      type: l.type,
      strength: l.strength,
    }));
}

/**
 * Extract put walls and call walls for spread context
 */
export function extractWallsFromPFV(
  pfv: PsychologicalFairValue
): { putWalls: number[]; callWalls: number[] } {
  const putWalls: number[] = [];
  const callWalls: number[] = [];

  if (pfv.magneticLevels) {
    for (const level of pfv.magneticLevels) {
      if (level.type === 'PUT_WALL' || level.type === 'GAMMA_PUT') {
        putWalls.push(level.price);
      } else if (level.type === 'CALL_WALL' || level.type === 'GAMMA_CALL') {
        callWalls.push(level.price);
      }
    }
  }

  return { putWalls, callWalls };
}

// Re-export types
export type { PsychologicalFairValue, TickerProfileType };
export { formatPFVResult };

