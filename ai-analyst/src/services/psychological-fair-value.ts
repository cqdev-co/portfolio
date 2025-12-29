/**
 * Psychological Fair Value Service
 * 
 * Integrates the PFV utility with AI Analyst's data fetching
 */

import YahooFinance from "yahoo-finance2";
import type { 
  PFVInput,
  TechnicalData,
  OptionsExpiration,
  OptionContract,
  PsychologicalFairValue,
  PFVCalculatorOptions,
  TickerProfileType,
} from "../../../lib/utils/ts/psychological-fair-value/types.js";
import { 
  calculatePsychologicalFairValue,
  formatPFVResult,
} from "../../../lib/utils/ts/psychological-fair-value/calculator.js";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "rippiReport"],
  validation: { logErrors: false, logOptionsErrors: false },
});

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
    // Get available expiration dates
    const optionsResult = await yahooFinance.options(ticker);
    if (!optionsResult?.expirationDates?.length) {
      return [];
    }

    const quote = await yahooFinance.quote(ticker);
    const underlyingPrice = quote?.regularMarketPrice;
    if (!underlyingPrice) return [];

    const expirations: OptionsExpiration[] = [];
    const now = new Date();

    // Define realistic strike range (50% below to 50% above current price)
    // This filters out pre-split strikes and LEAPS with weird ranges
    const minStrike = underlyingPrice * 0.50;
    const maxStrike = underlyingPrice * 1.50;

    // Get first N expirations
    const targetExpirations = optionsResult.expirationDates
      .slice(0, maxExpirations);

    for (const expDate of targetExpirations) {
      try {
        const chain = await yahooFinance.options(ticker, { date: expDate });
        if (!chain?.options?.[0]) continue;

        const opts = chain.options[0];
        const dte = Math.ceil(
          (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Skip if DTE is too far out
        if (dte > 60) continue;

        // Filter calls to realistic strikes with OI
        const calls: OptionContract[] = (opts.calls ?? [])
          .filter(c => 
            c.strike >= minStrike && 
            c.strike <= maxStrike &&
            (c.openInterest ?? 0) > 0
          )
          .map(c => ({
            strike: c.strike,
            openInterest: c.openInterest ?? 0,
            volume: c.volume ?? 0,
            impliedVolatility: c.impliedVolatility,
            delta: undefined,
            gamma: undefined,
          }));

        // Filter puts to realistic strikes with OI
        const puts: OptionContract[] = (opts.puts ?? [])
          .filter(p => 
            p.strike >= minStrike && 
            p.strike <= maxStrike &&
            (p.openInterest ?? 0) > 0
          )
          .map(p => ({
            strike: p.strike,
            openInterest: p.openInterest ?? 0,
            volume: p.volume ?? 0,
            impliedVolatility: p.impliedVolatility,
            delta: undefined,
            gamma: undefined,
          }));

        const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
        const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);

        // Skip expirations with insufficient data
        if (calls.length < 5 || puts.length < 5 || totalCallOI + totalPutOI < 1000) {
          continue;
        }

        expirations.push({
          expiration: expDate,
          dte,
          calls,
          puts,
          totalCallOI,
          totalPutOI,
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch {
        // Skip failed expirations
        continue;
      }
    }

    return expirations;
  } catch (error) {
    console.error(`Failed to fetch options for ${ticker}:`, error);
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
        interval: "1d",
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

        // Simple VWAP approximation (volume-weighted average price)
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

    // Get MA20 from a longer period
    let ma20: number | undefined;
    try {
      const ma20Start = new Date();
      ma20Start.setDate(ma20Start.getDate() - 40);
      
      const history20 = await yahooFinance.chart(ticker, {
        period1: ma20Start,
        period2: endDate,
        interval: "1d",
      });

      if (history20?.quotes && history20.quotes.length >= 20) {
        const closes = history20.quotes
          .map(q => q.close)
          .filter((c): c is number => c !== null && c !== undefined);
        
        if (closes.length >= 20) {
          const last20 = closes.slice(-20);
          ma20 = last20.reduce((a, b) => a + b, 0) / 20;
        }
      }
    } catch {
      // MA20 optional
    }

    return {
      currentPrice: quote.regularMarketPrice,
      ma20,
      ma50: quote.fiftyDayAverage ?? undefined,
      ma200: quote.twoHundredDayAverage ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? quote.regularMarketPrice * 1.2,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? quote.regularMarketPrice * 0.8,
      recentSwingHigh,
      recentSwingLow,
      previousClose: quote.regularMarketPreviousClose ?? undefined,
      vwap,
      avgVolume: quote.averageDailyVolume10Day ?? undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch technical data for ${ticker}:`, error);
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
 * This is the main entry point for the AI Analyst integration.
 * It fetches all required data and calculates PFV.
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

  // Fetch data in parallel
  const [technicalData, expirations] = await Promise.all([
    fetchTechnicalDataForPFV(ticker),
    fetchOptionsExpirations(ticker, maxExpirations),
  ]);

  if (!technicalData) {
    return null;
  }

  // If no options data, we can still calculate with technical levels only
  // but confidence will be lower
  const input: PFVInput = {
    ticker: ticker.toUpperCase(),
    technicalData,
    expirations,
    profileOverride,
  };

  try {
    const result = calculatePsychologicalFairValue(input, calculatorOptions);
    return result;
  } catch (error) {
    console.error(`PFV calculation failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Get PFV summary for quick display
 */
export function getPFVSummary(pfv: PsychologicalFairValue): string {
  const direction = pfv.deviationPercent > 0 ? '↑' : 
                   pfv.deviationPercent < 0 ? '↓' : '→';
  const absDeviation = Math.abs(pfv.deviationPercent);
  
  return `$${pfv.fairValue.toFixed(2)} (${direction}${absDeviation.toFixed(1)}% ${pfv.bias})`;
}

/**
 * Get PFV context for AI analysis
 */
export function getPFVContextForAI(pfv: PsychologicalFairValue): string {
  return pfv.aiContext;
}

/**
 * Format PFV for CLI display
 */
export function formatPFVForCLI(pfv: PsychologicalFairValue): string {
  return formatPFVResult(pfv);
}

/**
 * Get key magnetic levels as a simple list
 */
export function getKeyMagneticLevels(
  pfv: PsychologicalFairValue,
  limit: number = 5
): { price: number; type: string; distance: string }[] {
  return pfv.magneticLevels.slice(0, limit).map(level => ({
    price: level.price,
    type: level.type.replace(/_/g, ' '),
    distance: `${level.distance > 0 ? '+' : ''}${level.distance.toFixed(1)}%`,
  }));
}

/**
 * Check if PFV suggests a mean reversion opportunity
 */
export function hasMeanReversionSignal(
  pfv: PsychologicalFairValue
): { signal: boolean; direction: 'LONG' | 'SHORT' | null; strength: number } {
  const absDeviation = Math.abs(pfv.deviationPercent);
  
  // No signal if deviation is small or confidence is low
  if (absDeviation < 2 || pfv.confidence === 'LOW') {
    return { signal: false, direction: null, strength: 0 };
  }

  // Strong signal if price is significantly away from PFV
  const strength = Math.min(100, absDeviation * 10);
  
  if (pfv.deviationPercent > 2) {
    // PFV above current price = potential upside
    return { signal: true, direction: 'LONG', strength };
  } else if (pfv.deviationPercent < -2) {
    // PFV below current price = potential downside
    return { signal: true, direction: 'SHORT', strength };
  }

  return { signal: false, direction: null, strength: 0 };
}

// Re-export types for convenience
export type { PsychologicalFairValue, MagneticLevel } from 
  "../../../lib/utils/ts/psychological-fair-value/types.js";

