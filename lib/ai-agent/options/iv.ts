/**
 * IV (Implied Volatility) Analysis
 *
 * Calculates REAL IV from options chain ATM options.
 * This is the same logic used by the CLI (ai-analyst).
 */

import type { IVAnalysis } from './types';
import { getOptionsChain } from './chain';

/**
 * Analyze implied volatility from options chain
 *
 * Gets ATM (at-the-money) options and calculates average IV.
 * This is REAL IV from the options market, not an approximation.
 *
 * @param symbol - Ticker symbol
 * @returns IV analysis or null if options unavailable
 */
export async function getIVAnalysis(
  symbol: string
): Promise<IVAnalysis | null> {
  try {
    const chain = await getOptionsChain(symbol, 30);
    if (!chain || chain.calls.length === 0) return null;

    const { calls, underlyingPrice } = chain;

    // Find ATM options (within 5% of current price)
    const atmCalls = calls
      .filter(
        (c) => Math.abs(c.strike - underlyingPrice) / underlyingPrice < 0.05
      )
      .sort(
        (a, b) =>
          Math.abs(a.strike - underlyingPrice) -
          Math.abs(b.strike - underlyingPrice)
      );

    if (atmCalls.length === 0) return null;

    // Average IV of ATM options (filter out zero IV - bad data)
    const validIVCalls = atmCalls.filter((c) => c.impliedVolatility > 0.01);
    if (validIVCalls.length === 0) {
      // No valid IV data (weekend or illiquid options)
      return null;
    }

    const avgIV =
      validIVCalls
        .slice(0, 3)
        .reduce((sum, c) => sum + c.impliedVolatility, 0) /
      Math.min(3, validIVCalls.length);

    const currentIV = avgIV * 100; // Convert to percentage

    // Estimate IV percentile based on typical ranges
    // Low: < 20%, Normal: 20-35%, Elevated: 35-50%, High: > 50%
    let ivPercentile: number;
    let ivLevel: IVAnalysis['ivLevel'];
    let recommendation: string;

    if (currentIV < 20) {
      ivPercentile = currentIV * 2; // 0-40 percentile
      ivLevel = 'LOW';
      recommendation = 'IV is low - good for buying spreads (cheaper premium)';
    } else if (currentIV < 35) {
      ivPercentile = 30 + (currentIV - 20) * 2; // 30-60 percentile
      ivLevel = 'NORMAL';
      recommendation = 'IV is normal - standard entry conditions';
    } else if (currentIV < 50) {
      ivPercentile = 60 + (currentIV - 35) * 1.5; // 60-82 percentile
      ivLevel = 'ELEVATED';
      recommendation = 'IV is elevated - consider smaller position or wait';
    } else {
      ivPercentile = Math.min(99, 80 + (currentIV - 50) * 0.4);
      ivLevel = 'HIGH';
      recommendation = 'IV is high - spreads are expensive, consider waiting';
    }

    return {
      currentIV: Math.round(currentIV * 10) / 10,
      ivPercentile: Math.round(ivPercentile),
      ivLevel,
      recommendation,
    };
  } catch (error) {
    console.error(`[Options] IV analysis failed for ${symbol}:`, error);
    return null;
  }
}
