/**
 * Spread Recommendation Engine
 * 
 * Calculates REAL spread recommendations from options chain.
 * Uses actual bid/ask prices for accurate debit and cushion.
 * This is the same logic used by the CLI (ai-analyst).
 */

import type { 
  SpreadRecommendation, 
  SpreadAlternatives,
  SpreadSelectionContext,
  OptionContract,
  OptionsChain,
} from './types';
import { getOptionsChain } from './chain';

// ============================================================================
// PROBABILITY HELPERS
// ============================================================================

/**
 * Cumulative Normal Distribution Function (CDF)
 * Approximation using Abramowitz and Stegun formula 26.2.17
 * Accurate to ~1.5 x 10^-7
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate Probability of Profit for a call debit spread
 * Uses Black-Scholes-inspired approximation with IV
 *
 * @param currentPrice - Current underlying price
 * @param breakeven - Breakeven price (need price > this for profit)
 * @param iv - Implied volatility as decimal (e.g., 0.35 for 35%)
 * @param dte - Days to expiration
 * @returns Probability of profit as percentage (0-100)
 */
function calculatePoP(
  currentPrice: number,
  breakeven: number,
  iv: number,
  dte: number
): number {
  if (iv <= 0 || dte <= 0) {
    // If no IV or DTE, use simple cushion-based estimate
    return currentPrice > breakeven ? 75 : 25;
  }

  // Convert DTE to years
  const T = dte / 365;

  // Z-score: how many standard deviations is breakeven from current price
  const z = Math.log(currentPrice / breakeven) / (iv * Math.sqrt(T));

  // Probability that price will be above breakeven at expiration
  const pop = normalCDF(z) * 100;

  // Clamp between reasonable bounds
  return Math.min(95, Math.max(5, Math.round(pop)));
}

// ============================================================================
// SPREAD FINDING
// ============================================================================

/**
 * Find optimal deep ITM call debit spread
 *
 * Strategy:
 * - Long strike: 6-12% ITM
 * - Short strike: $5 higher than long
 * - Target DTE: 21-45 days
 *
 * @param symbol - Ticker symbol
 * @param targetDTE - Target days to expiration
 * @returns Spread recommendation or null
 */
export async function findOptimalSpread(
  symbol: string,
  targetDTE: number = 30
): Promise<SpreadRecommendation | null> {
  const chain = await getOptionsChain(symbol, targetDTE);
  if (!chain || chain.calls.length === 0) return null;

  const { calls, underlyingPrice, expiration, dte } = chain;

  // Sort calls by strike
  const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

  // Find strikes that are 6-12% ITM
  const minITM = underlyingPrice * 0.88; // 12% ITM
  const maxITM = underlyingPrice * 0.94; // 6% ITM

  // Find long strike in the ITM range
  let longCall: OptionContract | null = null;
  for (const call of sortedCalls) {
    if (call.strike >= minITM && call.strike <= maxITM) {
      longCall = call;
      break;
    }
  }

  // If no call in ideal range, find closest ITM call
  if (!longCall) {
    for (const call of sortedCalls) {
      if (call.strike < underlyingPrice) {
        longCall = call;
      }
    }
  }

  if (!longCall) return null;

  // Find short strike ($5 above long)
  const targetShortStrike = longCall.strike + 5;
  let shortCall: OptionContract | null = null;
  for (const call of sortedCalls) {
    if (call.strike >= targetShortStrike) {
      shortCall = call;
      break;
    }
  }

  if (!shortCall) return null;

  // Calculate spread metrics
  const spreadWidth = shortCall.strike - longCall.strike;
  
  // Calculate BOTH market and mid prices to assess viability
  const marketDebit = longCall.ask - shortCall.bid;  // What you'd actually pay
  const midDebit = longCall.mid - shortCall.mid;     // Theoretical mid
  
  // Sweet spot for $5 spread: $3.00-$4.00 debit (60-80% of width)
  // This gives 25-67% return on risk - good risk/reward
  const minDebitRatio = 0.55;  // Below this = suspicious data or illiquid
  const maxDebitRatio = 0.80;  // Above this = not enough profit margin
  
  let estimatedDebit: number;
  
  // Use market prices if valid and in the sweet spot
  if (isFinite(marketDebit) && marketDebit > 0) {
    const marketRatio = marketDebit / spreadWidth;
    
    if (marketRatio > maxDebitRatio) {
      return null; // Too expensive - not enough profit
    }
    if (marketRatio >= minDebitRatio && marketRatio <= maxDebitRatio) {
      estimatedDebit = marketDebit; // Market price is in sweet spot
    } else if (marketRatio < minDebitRatio) {
      // Suspiciously cheap - use mid + slippage instead
      if (midDebit > 0 && midDebit / spreadWidth <= maxDebitRatio - 0.10) {
        estimatedDebit = midDebit * 1.10; // Add 10% slippage
        if (estimatedDebit / spreadWidth > maxDebitRatio) return null;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } else if (midDebit > 0 && midDebit / spreadWidth <= maxDebitRatio - 0.10) {
    // No valid market price - use mid + slippage buffer
    estimatedDebit = midDebit * 1.10;
    if (estimatedDebit / spreadWidth > maxDebitRatio) return null;
  } else {
    return null;
  }

  const maxProfit = spreadWidth - estimatedDebit;
  const breakeven = longCall.strike + estimatedDebit;
  const cushion = ((underlyingPrice - breakeven) / underlyingPrice) * 100;

  // Require minimum 20% return on risk (80% debit = 25% return)
  const returnOnRisk = maxProfit / estimatedDebit;
  if (returnOnRisk < 0.20) {
    return null;
  }
  
  // Require minimum 5% cushion - need room for the stock to move
  if (cushion < 5) {
    return null;
  }

  // Approximate delta based on how deep ITM
  const itmPercent = 
    (underlyingPrice - longCall.strike) / underlyingPrice;
  const longDelta = Math.min(0.95, 0.5 + itmPercent * 3);

  // Calculate PoP using IV from the long call
  const iv = longCall.impliedVolatility || 0.3;
  const pop = calculatePoP(underlyingPrice, breakeven, iv, dte);
  
  // Require minimum 70% probability of profit for conservative strategy
  if (pop < 70) {
    return null;
  }

  return {
    longStrike: longCall.strike,
    shortStrike: shortCall.strike,
    expiration,
    dte,
    estimatedDebit: Math.round(estimatedDebit * 100) / 100,
    maxProfit: Math.round(maxProfit * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    cushion: Math.round(cushion * 10) / 10,
    longDelta: Math.round(longDelta * 100) / 100,
    returnOnRisk: Math.round(returnOnRisk * 1000) / 10,
    spreadWidth,
    pop,
  };
}

/**
 * Find spread with alternatives and smart selection
 * 
 * Uses technical context (MAs, support levels) to choose
 * the best spread strikes.
 * 
 * @param symbol - Ticker symbol
 * @param targetDTE - Target days to expiration
 * @param maxDebit - Maximum debit to pay (optional)
 * @param context - Technical context for smart selection
 * @param preloadedChain - Pre-fetched options chain to avoid extra API call
 */
export async function findSpreadWithAlternatives(
  symbol: string,
  targetDTE: number = 30,
  maxDebit?: number,
  context?: SpreadSelectionContext,
  preloadedChain?: OptionsChain | null
): Promise<SpreadAlternatives> {
  // Use preloaded chain if provided, otherwise fetch
  const chain = preloadedChain ?? await getOptionsChain(symbol, targetDTE);
  if (!chain || chain.calls.length === 0) {
    return { primary: null, alternatives: [] };
  }

  const { calls, underlyingPrice, expiration, dte } = chain;
  const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

  // Define ITM range (wider for more alternatives)
  const minITM = underlyingPrice * 0.85; // 15% ITM
  const maxITM = underlyingPrice * 0.98; // 2% ITM

  // Find all viable long calls
  const viableLongs = sortedCalls.filter(
    c => c.strike >= minITM && c.strike <= maxITM && c.openInterest > 10
  );

  if (viableLongs.length === 0) {
    return { primary: null, alternatives: [] };
  }

  // Build all possible spreads
  const allSpreads: SpreadRecommendation[] = [];

  for (const longCall of viableLongs) {
    // Try $5 and $10 wide spreads
    for (const width of [5, 10]) {
      const targetShort = longCall.strike + width;
      const shortCall = sortedCalls.find(c => c.strike === targetShort);

      if (!shortCall || shortCall.openInterest < 5) continue;

      const spreadWidth = shortCall.strike - longCall.strike;
      
      // Calculate BOTH market and mid prices
      const marketDebit = longCall.ask - shortCall.bid;
      const midDebit = longCall.mid - shortCall.mid;

      // Sweet spot: 60-80% of width ($3-$4 for $5 spread)
      const minDebitRatio = 0.55;
      const maxDebitRatio = 0.80;
      
      let estimatedDebit: number;
      
      if (isFinite(marketDebit) && marketDebit > 0) {
        const marketRatio = marketDebit / spreadWidth;
        
        if (marketRatio > maxDebitRatio) continue; // Too expensive
        if (marketRatio >= minDebitRatio && marketRatio <= maxDebitRatio) {
          estimatedDebit = marketDebit;
        } else if (marketRatio < minDebitRatio && midDebit > 0 && midDebit / spreadWidth <= maxDebitRatio - 0.10) {
          estimatedDebit = midDebit * 1.10;
          if (estimatedDebit / spreadWidth > maxDebitRatio) continue;
        } else {
          continue;
        }
      } else if (midDebit > 0 && midDebit / spreadWidth <= maxDebitRatio - 0.10) {
        estimatedDebit = midDebit * 1.10;
        if (estimatedDebit / spreadWidth > maxDebitRatio) continue;
      } else {
        continue;
      }

      const maxProfit = spreadWidth - estimatedDebit;
      const breakeven = longCall.strike + estimatedDebit;
      const cushion = 
        ((underlyingPrice - breakeven) / underlyingPrice) * 100;

      const returnOnRisk = maxProfit / estimatedDebit;
      if (returnOnRisk < 0.20) continue;
      
      // Require minimum 5% cushion for conservative strategy
      if (cushion < 5) continue;

      // Score based on liquidity
      const liquidityScore =
        Math.min(100, Math.log10((longCall.openInterest + 1) * 
          (shortCall.openInterest + 1)) * 20);

      // Score based on bid-ask spread
      const longSpread = longCall.ask - longCall.bid;
      const shortSpread = shortCall.ask - shortCall.bid;
      const avgSpread = (longSpread + shortSpread) / 2;
      const bidAskScore = Math.max(0, 100 - avgSpread * 200);

      // Context-aware scoring
      let contextScore = 50;
      if (context) {
        // Prefer breakeven above key support
        if (context.supportLevels?.some(s => breakeven < s)) {
          contextScore += 15;
        }
        if (context.putWalls?.some(
          p => Math.abs(breakeven - p) / breakeven < 0.02
        )) {
          contextScore += 10;
        }
        // Prefer breakeven below MA200
        if (context.ma200 && breakeven < context.ma200) {
          contextScore += 10;
        }
      }

      // Cushion score (higher cushion = better)
      const cushionScore = Math.min(100, cushion * 15);

      const totalScore =
        cushionScore * 0.4 +
        liquidityScore * 0.25 +
        bidAskScore * 0.2 +
        contextScore * 0.15;

      const itmPct = 
        (underlyingPrice - longCall.strike) / underlyingPrice;
      const longDelta = Math.min(0.95, 0.5 + itmPct * 3);
      const iv = longCall.impliedVolatility || 0.3;
      const pop = calculatePoP(underlyingPrice, breakeven, iv, dte);
      
      // Require minimum 70% probability of profit for conservative strategy
      if (pop < 70) continue;

      allSpreads.push({
        longStrike: longCall.strike,
        shortStrike: shortCall.strike,
        expiration,
        dte,
        estimatedDebit: Math.round(estimatedDebit * 100) / 100,
        maxProfit: Math.round(maxProfit * 100) / 100,
        breakeven: Math.round(breakeven * 100) / 100,
        cushion: Math.round(cushion * 10) / 10,
        longDelta: Math.round(longDelta * 100) / 100,
        returnOnRisk: Math.round(returnOnRisk * 1000) / 10,
        spreadWidth,
        pop,
        liquidityScore: Math.round(liquidityScore),
        bidAskScore: Math.round(bidAskScore),
        totalScore: Math.round(totalScore),
      });
    }
  }

  if (allSpreads.length === 0) {
    return { primary: null, alternatives: [] };
  }

  // Sort by total score
  allSpreads.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));

  // Find primary ($5 width preferred)
  let primary =
    allSpreads.find(
      s =>
        s.spreadWidth === 5 &&
        (s.totalScore ?? 0) >= (allSpreads[0].totalScore ?? 0) - 10
    ) ?? allSpreads[0];

  let reason: string | undefined;

  // If maxDebit specified, find affordable alternative
  if (maxDebit && primary.estimatedDebit * 100 > maxDebit) {
    const affordable = allSpreads.filter(
      s => s.estimatedDebit * 100 <= maxDebit
    );
    if (affordable.length > 0) {
      const newPrimary = affordable[0];
      reason =
        `$${primary.longStrike}/$${primary.shortStrike} costs ` +
        `$${(primary.estimatedDebit * 100).toFixed(0)} (exceeds ` +
        `$${maxDebit} limit). Suggesting $${newPrimary.spreadWidth} ` +
        `wide spread instead.`;
      primary = newPrimary;
    } else {
      reason =
        `All spreads exceed $${maxDebit} budget. Consider ` +
        `waiting for pullback or reducing DTE.`;
    }
  }

  // Get alternatives
  const alternatives = allSpreads
    .filter(
      s =>
        s.longStrike !== primary.longStrike ||
        s.spreadWidth !== primary.spreadWidth
    )
    .slice(0, 2);

  return { primary, alternatives, reason };
}

