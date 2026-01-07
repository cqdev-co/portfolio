/**
 * Max Pain Calculation
 *
 * Max Pain is the strike price where the most options
 * expire worthless, maximizing pain for option buyers
 * and profit for market makers.
 */

import type { OptionsExpiration, MaxPainResult, OptionContract } from './types';

// ============================================================================
// MAX PAIN CALCULATION
// ============================================================================

/**
 * Calculate max pain for a single expiration
 *
 * Algorithm:
 * 1. For each strike price, calculate total "pain"
 *    (intrinsic value) for all options if stock closes there
 * 2. Max pain = strike with minimum total pain
 */
export function calculateMaxPain(
  expiration: OptionsExpiration,
  currentPrice: number
): MaxPainResult {
  const { calls, puts, dte } = expiration;

  // Filter strikes to reasonable range (40% below to 40% above)
  // This prevents pre-split strikes and LEAPS from skewing results
  const minStrike = currentPrice * 0.6;
  const maxStrike = currentPrice * 1.4;

  const filteredCalls = calls.filter(
    (c) => c.strike >= minStrike && c.strike <= maxStrike && c.openInterest > 0
  );
  const filteredPuts = puts.filter(
    (p) => p.strike >= minStrike && p.strike <= maxStrike && p.openInterest > 0
  );

  // Get all unique strikes from filtered data
  const allStrikes = new Set<number>();
  filteredCalls.forEach((c) => allStrikes.add(c.strike));
  filteredPuts.forEach((p) => allStrikes.add(p.strike));

  const strikes = Array.from(allStrikes).sort((a, b) => a - b);

  if (strikes.length === 0) {
    return {
      price: currentPrice,
      expiration: expiration.expiration,
      dte,
      totalPainAtMaxPain: 0,
      callPain: 0,
      putPain: 0,
      confidence: 0,
    };
  }

  // Create lookup maps for OI (using filtered data)
  const callOI = new Map<number, number>();
  const putOI = new Map<number, number>();

  filteredCalls.forEach((c) => {
    callOI.set(c.strike, (callOI.get(c.strike) || 0) + c.openInterest);
  });

  filteredPuts.forEach((p) => {
    putOI.set(p.strike, (putOI.get(p.strike) || 0) + p.openInterest);
  });

  // Calculate pain at each strike
  let minPain = Infinity;
  let maxPainStrike = currentPrice;
  let bestCallPain = 0;
  let bestPutPain = 0;

  for (const testPrice of strikes) {
    let callPain = 0;
    let putPain = 0;

    // Calculate call pain (calls are ITM if stock > strike)
    for (const [strike, oi] of callOI) {
      if (testPrice > strike) {
        // Call is ITM, pain = (stock price - strike) * OI * 100
        callPain += (testPrice - strike) * oi * 100;
      }
    }

    // Calculate put pain (puts are ITM if stock < strike)
    for (const [strike, oi] of putOI) {
      if (testPrice < strike) {
        // Put is ITM, pain = (strike - stock price) * OI * 100
        putPain += (strike - testPrice) * oi * 100;
      }
    }

    const totalPain = callPain + putPain;

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = testPrice;
      bestCallPain = callPain;
      bestPutPain = putPain;
    }
  }

  // Calculate confidence based on OI concentration (using filtered data)
  const filteredCallOI = filteredCalls.reduce(
    (sum, c) => sum + c.openInterest,
    0
  );
  const filteredPutOI = filteredPuts.reduce(
    (sum, p) => sum + p.openInterest,
    0
  );
  const totalOI = filteredCallOI + filteredPutOI;

  const confidence = calculateMaxPainConfidence(
    strikes,
    callOI,
    putOI,
    maxPainStrike,
    totalOI
  );

  return {
    price: maxPainStrike,
    expiration: expiration.expiration,
    dte,
    totalPainAtMaxPain: minPain,
    callPain: bestCallPain,
    putPain: bestPutPain,
    confidence,
  };
}

/**
 * Calculate confidence in max pain prediction
 *
 * Higher confidence when:
 * - High total OI (more hedging activity)
 * - Clear minimum (not flat pain curve)
 * - OI concentrated near max pain strike
 */
function calculateMaxPainConfidence(
  strikes: number[],
  callOI: Map<number, number>,
  putOI: Map<number, number>,
  maxPainStrike: number,
  totalOI: number
): number {
  if (totalOI === 0) return 0;

  let confidence = 0;

  // Factor 1: Total OI (more OI = more reliable)
  // 10k OI = 0.2, 50k = 0.5, 100k+ = max 0.4 contribution
  const oiFactor = Math.min(0.4, totalOI / 250000);
  confidence += oiFactor;

  // Factor 2: OI concentration near max pain
  // Calculate what % of OI is within 5% of max pain strike
  let nearbyOI = 0;
  const range = maxPainStrike * 0.05;

  for (const [strike, oi] of callOI) {
    if (Math.abs(strike - maxPainStrike) <= range) {
      nearbyOI += oi;
    }
  }
  for (const [strike, oi] of putOI) {
    if (Math.abs(strike - maxPainStrike) <= range) {
      nearbyOI += oi;
    }
  }

  const concentrationFactor = Math.min(0.3, (nearbyOI / totalOI) * 0.5);
  confidence += concentrationFactor;

  // Factor 3: Strike density (more strikes = more precise)
  const densityFactor = Math.min(0.3, strikes.length / 50);
  confidence += densityFactor;

  return Math.min(1, confidence);
}

/**
 * Calculate max pain for multiple expirations
 * Returns weighted average based on DTE and OI
 */
export function calculateWeightedMaxPain(
  expirations: OptionsExpiration[],
  currentPrice: number
): {
  weightedPrice: number;
  results: MaxPainResult[];
  weights: number[];
} {
  const results: MaxPainResult[] = [];
  const weights: number[] = [];

  for (const exp of expirations) {
    const result = calculateMaxPain(exp, currentPrice);
    results.push(result);

    // Weight calculation:
    // - Closer expirations have more immediate gravity
    // - Higher OI has more influence
    const totalOI = exp.totalCallOI + exp.totalPutOI;
    const timeWeight = Math.max(0.1, 1 - exp.dte / 60);
    const oiWeight = Math.log10(Math.max(1, totalOI)) / 6; // Normalize

    // Monthly OPEX gets a boost (3rd Friday effect)
    const opexBoost = isMonthlyOpex(exp.expiration) ? 1.3 : 1.0;

    weights.push(timeWeight * oiWeight * opexBoost);
  }

  // Normalize weights
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights =
    totalWeight > 0
      ? weights.map((w) => w / totalWeight)
      : weights.map(() => 1 / weights.length);

  // Calculate weighted average
  const weightedPrice = results.reduce(
    (sum, result, i) => sum + result.price * normalizedWeights[i],
    0
  );

  return {
    weightedPrice,
    results,
    weights: normalizedWeights,
  };
}

/**
 * Check if expiration is monthly OPEX (3rd Friday)
 */
export function isMonthlyOpex(date: Date | undefined): boolean {
  // Guard against undefined date
  if (!date || !(date instanceof Date)) return false;

  // Must be a Friday
  if (date.getDay() !== 5) return false;

  // Must be between 15th and 21st (3rd week)
  const dayOfMonth = date.getDate();
  return dayOfMonth >= 15 && dayOfMonth <= 21;
}

/**
 * Check if expiration is weekly OPEX (any Friday, not monthly)
 */
export function isWeeklyOpex(date: Date | undefined): boolean {
  // Guard against undefined date
  if (!date || !(date instanceof Date)) return false;

  return date.getDay() === 5 && !isMonthlyOpex(date);
}

/**
 * Format max pain result for display
 */
export function formatMaxPainResult(result: MaxPainResult): string {
  const confidenceLabel =
    result.confidence > 0.7
      ? 'HIGH'
      : result.confidence > 0.4
        ? 'MEDIUM'
        : 'LOW';

  return [
    `Max Pain: $${result.price.toFixed(2)}`,
    `Expiration: ${result.expiration.toISOString().split('T')[0]}`,
    `DTE: ${result.dte}`,
    `Confidence: ${confidenceLabel} (${(result.confidence * 100).toFixed(0)}%)`,
    `Call Pain at MP: $${(result.callPain / 1000000).toFixed(2)}M`,
    `Put Pain at MP: $${(result.putPain / 1000000).toFixed(2)}M`,
  ].join('\n');
}
