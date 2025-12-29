/**
 * Gamma Wall Detection
 * 
 * Gamma walls are strikes with abnormally high open interest
 * where market maker delta-hedging creates support/resistance.
 */

import type { 
  OptionsExpiration,
  GammaWall,
  GammaWallsResult,
  OptionContract,
} from './types';

// ============================================================================
// GAMMA WALL DETECTION
// ============================================================================

/**
 * Detect gamma walls in an options chain
 * 
 * A gamma wall is a strike where:
 * - OI is significantly above median (2x+)
 * - Creates hedging pressure from market makers
 */
export function detectGammaWalls(
  expiration: OptionsExpiration,
  currentPrice: number,
  thresholdMultiplier: number = 2.0
): GammaWallsResult {
  const { calls, puts } = expiration;
  
  // Filter to strikes within reasonable range (30% below to 30% above)
  // This ensures we only consider relevant gamma walls
  const minStrike = currentPrice * 0.70;
  const maxStrike = currentPrice * 1.30;
  
  const filteredCalls = calls.filter(c => 
    c.strike >= minStrike && c.strike <= maxStrike && c.openInterest > 0
  );
  const filteredPuts = puts.filter(p => 
    p.strike >= minStrike && p.strike <= maxStrike && p.openInterest > 0
  );
  
  // Aggregate OI by strike
  const strikeData = aggregateByStrike(filteredCalls, filteredPuts);
  
  if (strikeData.length === 0) {
    return {
      walls: [],
      strongestSupport: null,
      strongestResistance: null,
      center: currentPrice,
    };
  }

  // Calculate median OI for calls and puts separately
  const callOIs = strikeData
    .map(s => s.callOI)
    .filter(oi => oi > 0)
    .sort((a, b) => a - b);
  const putOIs = strikeData
    .map(s => s.putOI)
    .filter(oi => oi > 0)
    .sort((a, b) => a - b);

  const medianCallOI = callOIs.length > 0 
    ? callOIs[Math.floor(callOIs.length / 2)] 
    : 0;
  const medianPutOI = putOIs.length > 0 
    ? putOIs[Math.floor(putOIs.length / 2)] 
    : 0;

  // Identify walls
  const walls: GammaWall[] = [];

  for (const strike of strikeData) {
    const callStrength = medianCallOI > 0 
      ? strike.callOI / medianCallOI 
      : 0;
    const putStrength = medianPutOI > 0 
      ? strike.putOI / medianPutOI 
      : 0;

    // Check for call wall (resistance above price)
    if (callStrength >= thresholdMultiplier && strike.strike > currentPrice) {
      walls.push({
        strike: strike.strike,
        type: 'CALL_WALL',
        openInterest: strike.callOI,
        relativeStrength: callStrength,
        isSupport: false,
        isResistance: true,
      });
    }

    // Check for put wall (support below price)
    if (putStrength >= thresholdMultiplier && strike.strike < currentPrice) {
      walls.push({
        strike: strike.strike,
        type: 'PUT_WALL',
        openInterest: strike.putOI,
        relativeStrength: putStrength,
        isSupport: true,
        isResistance: false,
      });
    }

    // Check for combined wall (both high)
    if (
      callStrength >= thresholdMultiplier && 
      putStrength >= thresholdMultiplier
    ) {
      // Already added separately, but mark the combined nature
      const combinedOI = strike.callOI + strike.putOI;
      const avgStrength = (callStrength + putStrength) / 2;
      
      walls.push({
        strike: strike.strike,
        type: 'COMBINED',
        openInterest: combinedOI,
        relativeStrength: avgStrength,
        isSupport: strike.strike < currentPrice,
        isResistance: strike.strike > currentPrice,
      });
    }
  }

  // Sort by strength
  walls.sort((a, b) => b.relativeStrength - a.relativeStrength);

  // Find strongest support and resistance
  const strongestSupport = walls
    .filter(w => w.isSupport)
    .sort((a, b) => b.relativeStrength - a.relativeStrength)[0] || null;

  const strongestResistance = walls
    .filter(w => w.isResistance)
    .sort((a, b) => b.relativeStrength - a.relativeStrength)[0] || null;

  // Calculate weighted center of gamma walls
  const center = calculateGammaCenter(walls, currentPrice);

  return {
    walls,
    strongestSupport,
    strongestResistance,
    center,
  };
}

/**
 * Aggregate options data by strike price
 */
interface StrikeAggregate {
  strike: number;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
}

function aggregateByStrike(
  calls: OptionContract[],
  puts: OptionContract[]
): StrikeAggregate[] {
  const strikeMap = new Map<number, StrikeAggregate>();

  for (const call of calls) {
    const existing = strikeMap.get(call.strike) || {
      strike: call.strike,
      callOI: 0,
      putOI: 0,
      callVolume: 0,
      putVolume: 0,
    };
    existing.callOI += call.openInterest;
    existing.callVolume += call.volume;
    strikeMap.set(call.strike, existing);
  }

  for (const put of puts) {
    const existing = strikeMap.get(put.strike) || {
      strike: put.strike,
      callOI: 0,
      putOI: 0,
      callVolume: 0,
      putVolume: 0,
    };
    existing.putOI += put.openInterest;
    existing.putVolume += put.volume;
    strikeMap.set(put.strike, existing);
  }

  return Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
}

/**
 * Calculate the weighted center of gamma walls
 * This represents the "gravitational center" of options activity
 */
function calculateGammaCenter(
  walls: GammaWall[],
  currentPrice: number
): number {
  if (walls.length === 0) return currentPrice;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const wall of walls) {
    // Weight by both OI and relative strength
    const weight = wall.openInterest * wall.relativeStrength;
    weightedSum += wall.strike * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : currentPrice;
}

/**
 * Calculate gamma exposure (GEX) estimate at each strike
 * 
 * Simplified GEX = Gamma * OI * 100 * spotPrice^2 / 100
 * 
 * Positive GEX (from calls) = MM hedging stabilizes price
 * Negative GEX (from puts) = MM hedging amplifies moves
 */
export function estimateGammaExposure(
  expiration: OptionsExpiration,
  currentPrice: number
): Map<number, { callGEX: number; putGEX: number; netGEX: number }> {
  const gexMap = new Map<number, { 
    callGEX: number; 
    putGEX: number; 
    netGEX: number;
  }>();

  const { calls, puts } = expiration;

  // Process calls (positive gamma for MMs who are short)
  for (const call of calls) {
    const gamma = call.gamma || estimateGamma(
      call.strike, 
      currentPrice, 
      expiration.dte
    );
    // MMs are typically short calls → they have negative gamma
    // To hedge, they buy stock when price rises (stabilizing)
    const gex = gamma * call.openInterest * 100 * currentPrice;
    
    const existing = gexMap.get(call.strike) || { 
      callGEX: 0, 
      putGEX: 0, 
      netGEX: 0,
    };
    existing.callGEX += gex;
    existing.netGEX = existing.callGEX - existing.putGEX;
    gexMap.set(call.strike, existing);
  }

  // Process puts (negative gamma for MMs who are short)
  for (const put of puts) {
    const gamma = put.gamma || estimateGamma(
      put.strike, 
      currentPrice, 
      expiration.dte
    );
    // MMs are typically short puts → they have negative gamma
    // To hedge, they sell stock when price falls (destabilizing)
    const gex = gamma * put.openInterest * 100 * currentPrice;
    
    const existing = gexMap.get(put.strike) || { 
      callGEX: 0, 
      putGEX: 0, 
      netGEX: 0,
    };
    existing.putGEX += gex;
    existing.netGEX = existing.callGEX - existing.putGEX;
    gexMap.set(put.strike, existing);
  }

  return gexMap;
}

/**
 * Estimate gamma when not provided
 * Uses simplified approximation based on moneyness and DTE
 */
function estimateGamma(
  strike: number,
  spot: number,
  dte: number
): number {
  // Gamma is highest ATM and decreases as you move away
  const moneyness = Math.abs(spot - strike) / spot;
  const timeDecay = Math.sqrt(dte / 365);
  
  // Peak gamma ≈ 0.05 for ATM, decays with moneyness
  const peakGamma = 0.05;
  const gamma = peakGamma * Math.exp(-moneyness * 10) * timeDecay;
  
  return gamma;
}

/**
 * Find the "gamma flip" point
 * Where net GEX changes from positive to negative
 */
export function findGammaFlip(
  gexMap: Map<number, { callGEX: number; putGEX: number; netGEX: number }>,
  currentPrice: number
): number | null {
  const strikes = Array.from(gexMap.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < strikes.length - 1; i++) {
    const current = gexMap.get(strikes[i])!;
    const next = gexMap.get(strikes[i + 1])!;
    
    // Check for sign change
    if (
      (current.netGEX > 0 && next.netGEX < 0) ||
      (current.netGEX < 0 && next.netGEX > 0)
    ) {
      // Linear interpolation to find flip point
      const ratio = Math.abs(current.netGEX) / 
        (Math.abs(current.netGEX) + Math.abs(next.netGEX));
      return strikes[i] + ratio * (strikes[i + 1] - strikes[i]);
    }
  }

  return null;
}

/**
 * Format gamma walls result for display
 */
export function formatGammaWalls(
  result: GammaWallsResult,
  currentPrice: number
): string {
  const lines: string[] = [
    `Gamma Wall Analysis (Current: $${currentPrice.toFixed(2)})`,
    `Center of Gravity: $${result.center.toFixed(2)}`,
    '',
  ];

  if (result.strongestResistance) {
    const r = result.strongestResistance;
    lines.push(
      `🔴 Strongest Resistance: $${r.strike} ` +
      `(${r.relativeStrength.toFixed(1)}x median OI)`
    );
  }

  if (result.strongestSupport) {
    const s = result.strongestSupport;
    lines.push(
      `🟢 Strongest Support: $${s.strike} ` +
      `(${s.relativeStrength.toFixed(1)}x median OI)`
    );
  }

  if (result.walls.length > 0) {
    lines.push('', 'All Gamma Walls:');
    for (const wall of result.walls.slice(0, 10)) {
      const icon = wall.isResistance ? '🔴' : '🟢';
      const label = wall.type.replace('_', ' ');
      lines.push(
        `  ${icon} $${wall.strike} - ${label} ` +
        `(${wall.relativeStrength.toFixed(1)}x, ` +
        `OI: ${wall.openInterest.toLocaleString()})`
      );
    }
  }

  return lines.join('\n');
}

