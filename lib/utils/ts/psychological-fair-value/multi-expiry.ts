/**
 * Multi-Expiration Analysis
 *
 * Combines analysis from multiple option expirations,
 * weighting by time, OI, and OPEX significance.
 */

import type {
  OptionsExpiration,
  ExpirationAnalysis,
  MaxPainResult,
  GammaWallsResult,
} from './types';
import { calculateMaxPain, isMonthlyOpex, isWeeklyOpex } from './max-pain';
import { detectGammaWalls } from './gamma-walls';

// ============================================================================
// MULTI-EXPIRATION ANALYSIS
// ============================================================================

/**
 * Analyze multiple expirations and calculate weights
 */
export function analyzeMultipleExpirations(
  expirations: OptionsExpiration[],
  currentPrice: number,
  maxDTE: number = 60,
  minDTE: number = 0
): ExpirationAnalysis[] {
  // Filter to relevant DTE range
  const filtered = expirations.filter(
    (exp) => exp.dte >= minDTE && exp.dte <= maxDTE
  );

  if (filtered.length === 0) return [];

  // Analyze each expiration
  const analyses: ExpirationAnalysis[] = filtered.map((exp) => {
    const maxPain = calculateMaxPain(exp, currentPrice);
    const gammaWalls = detectGammaWalls(exp, currentPrice);
    const isMonthly = isMonthlyOpex(exp.expiration);
    const isWeekly = isWeeklyOpex(exp.expiration);

    return {
      expiration: exp.expiration,
      dte: exp.dte,
      maxPain,
      gammaWalls,
      weight: 0, // Will be calculated below
      isMonthlyOpex: isMonthly,
      isWeeklyOpex: isWeekly,
    };
  });

  // Calculate weights
  const weights = calculateExpirationWeights(analyses, filtered);

  // Apply weights
  for (let i = 0; i < analyses.length; i++) {
    analyses[i].weight = weights[i];
  }

  // Sort by weight (most influential first)
  analyses.sort((a, b) => b.weight - a.weight);

  return analyses;
}

/**
 * Calculate weight for each expiration
 *
 * Factors:
 * - Time proximity (closer = more immediate gravity)
 * - Open Interest (higher OI = more hedging activity)
 * - OPEX significance (monthly > weekly > regular)
 */
function calculateExpirationWeights(
  analyses: ExpirationAnalysis[],
  expirations: OptionsExpiration[]
): number[] {
  const weights: number[] = [];

  // Find max OI for normalization
  const maxOI = Math.max(
    ...expirations.map((e) => e.totalCallOI + e.totalPutOI)
  );

  for (let i = 0; i < analyses.length; i++) {
    const analysis = analyses[i];
    const expiration = expirations[i];

    // Time weight: closer expirations have more immediate pull
    // Use inverse exponential: weight = e^(-dte/30)
    // At 0 DTE: ~1.0, at 30 DTE: ~0.37, at 60 DTE: ~0.14
    const timeWeight = Math.exp(-analysis.dte / 30);

    // OI weight: higher OI = more market maker hedging
    const totalOI = expiration.totalCallOI + expiration.totalPutOI;
    const oiWeight = maxOI > 0 ? Math.sqrt(totalOI / maxOI) : 0.5;

    // OPEX weight: monthly OPEX has stronger pinning effect
    let opexMultiplier = 1.0;
    if (analysis.isMonthlyOpex) {
      opexMultiplier = 1.5; // 50% boost for monthly OPEX
    } else if (analysis.isWeeklyOpex) {
      opexMultiplier = 1.2; // 20% boost for weekly OPEX
    }

    // Max pain confidence factor
    const confidenceWeight = 0.5 + analysis.maxPain.confidence * 0.5;

    // Combined weight
    const weight = timeWeight * oiWeight * opexMultiplier * confidenceWeight;
    weights.push(weight);
  }

  // Normalize weights to sum to 1
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight > 0) {
    return weights.map((w) => w / totalWeight);
  }

  // Fallback to equal weights
  return weights.map(() => 1 / weights.length);
}

/**
 * Calculate weighted max pain across multiple expirations
 */
export function getWeightedMaxPain(analyses: ExpirationAnalysis[]): number {
  if (analyses.length === 0) return 0;

  let weightedSum = 0;

  for (const analysis of analyses) {
    weightedSum += analysis.maxPain.price * analysis.weight;
  }

  return weightedSum;
}

/**
 * Calculate weighted gamma center across multiple expirations
 */
export function getWeightedGammaCenter(analyses: ExpirationAnalysis[]): number {
  if (analyses.length === 0) return 0;

  let weightedSum = 0;

  for (const analysis of analyses) {
    weightedSum += analysis.gammaWalls.center * analysis.weight;
  }

  return weightedSum;
}

/**
 * Aggregate gamma walls across all expirations
 *
 * Combines walls from multiple expirations,
 * weighting by expiration importance
 */
export function aggregateGammaWalls(
  analyses: ExpirationAnalysis[]
): GammaWallsResult {
  if (analyses.length === 0) {
    return {
      walls: [],
      strongestSupport: null,
      strongestResistance: null,
      center: 0,
    };
  }

  // Collect all walls with their expiration weights
  interface WeightedWall {
    strike: number;
    type: 'CALL_WALL' | 'PUT_WALL' | 'COMBINED';
    openInterest: number;
    relativeStrength: number;
    isSupport: boolean;
    isResistance: boolean;
    expirationWeight: number;
  }

  const allWalls: WeightedWall[] = [];

  for (const analysis of analyses) {
    for (const wall of analysis.gammaWalls.walls) {
      allWalls.push({
        ...wall,
        expirationWeight: analysis.weight,
      });
    }
  }

  // Aggregate walls at same strike
  const strikeMap = new Map<
    number,
    {
      totalOI: number;
      totalStrength: number;
      totalWeight: number;
      isSupport: boolean;
      isResistance: boolean;
      types: Set<string>;
    }
  >();

  for (const wall of allWalls) {
    const existing = strikeMap.get(wall.strike) || {
      totalOI: 0,
      totalStrength: 0,
      totalWeight: 0,
      isSupport: false,
      isResistance: false,
      types: new Set<string>(),
    };

    existing.totalOI += wall.openInterest * wall.expirationWeight;
    existing.totalStrength += wall.relativeStrength * wall.expirationWeight;
    existing.totalWeight += wall.expirationWeight;
    existing.isSupport = existing.isSupport || wall.isSupport;
    existing.isResistance = existing.isResistance || wall.isResistance;
    existing.types.add(wall.type);

    strikeMap.set(wall.strike, existing);
  }

  // Convert back to wall format
  const aggregatedWalls = Array.from(strikeMap.entries()).map(
    ([strike, data]) => {
      const avgStrength =
        data.totalWeight > 0 ? data.totalStrength / data.totalWeight : 0;

      // Determine type based on what types were present
      let type: 'CALL_WALL' | 'PUT_WALL' | 'COMBINED';
      if (
        data.types.has('COMBINED') ||
        (data.types.has('CALL_WALL') && data.types.has('PUT_WALL'))
      ) {
        type = 'COMBINED';
      } else if (data.types.has('CALL_WALL')) {
        type = 'CALL_WALL';
      } else {
        type = 'PUT_WALL';
      }

      return {
        strike,
        type,
        openInterest: Math.round(data.totalOI),
        relativeStrength: avgStrength,
        isSupport: data.isSupport,
        isResistance: data.isResistance,
      };
    }
  );

  // Sort by strength
  aggregatedWalls.sort((a, b) => b.relativeStrength - a.relativeStrength);

  // Find strongest support/resistance
  const strongestSupport =
    aggregatedWalls
      .filter((w) => w.isSupport)
      .sort((a, b) => b.relativeStrength - a.relativeStrength)[0] || null;

  const strongestResistance =
    aggregatedWalls
      .filter((w) => w.isResistance)
      .sort((a, b) => b.relativeStrength - a.relativeStrength)[0] || null;

  // Calculate weighted center
  let weightedCenter = 0;
  let totalWeight = 0;
  for (const wall of aggregatedWalls) {
    const weight = wall.openInterest * wall.relativeStrength;
    weightedCenter += wall.strike * weight;
    totalWeight += weight;
  }
  const center = totalWeight > 0 ? weightedCenter / totalWeight : 0;

  return {
    walls: aggregatedWalls,
    strongestSupport,
    strongestResistance,
    center,
  };
}

/**
 * Find the primary (most influential) expiration
 */
export function getPrimaryExpiration(
  analyses: ExpirationAnalysis[]
): ExpirationAnalysis | null {
  if (analyses.length === 0) return null;

  // Already sorted by weight, so first is primary
  return analyses[0];
}

/**
 * Get expirations by type (monthly, weekly, etc.)
 */
export function getExpirationsByType(analyses: ExpirationAnalysis[]): {
  monthly: ExpirationAnalysis[];
  weekly: ExpirationAnalysis[];
  other: ExpirationAnalysis[];
} {
  return {
    monthly: analyses.filter((a) => a.isMonthlyOpex),
    weekly: analyses.filter((a) => a.isWeeklyOpex),
    other: analyses.filter((a) => !a.isMonthlyOpex && !a.isWeeklyOpex),
  };
}

/**
 * Calculate time-based gravity adjustment
 *
 * Options gravity is strongest right before expiration
 * and weakens as expiration is further out
 */
export function calculateTimeGravity(dte: number): number {
  // Exponential decay: full gravity at 0 DTE, ~37% at 30 DTE
  return Math.exp(-dte / 30);
}

/**
 * Format multi-expiration analysis for display
 */
export function formatMultiExpirationAnalysis(
  analyses: ExpirationAnalysis[]
): string {
  if (analyses.length === 0) {
    return 'No expiration data available.';
  }

  const lines: string[] = ['Multi-Expiration Analysis', ''];

  for (const analysis of analyses.slice(0, 5)) {
    const dateStr = analysis.expiration.toISOString().split('T')[0];
    const opexLabel = analysis.isMonthlyOpex
      ? ' [MONTHLY OPEX]'
      : analysis.isWeeklyOpex
        ? ' [WEEKLY]'
        : '';

    lines.push(`📅 ${dateStr} (${analysis.dte} DTE)${opexLabel}`);
    lines.push(`   Weight: ${(analysis.weight * 100).toFixed(1)}%`);
    lines.push(
      `   Max Pain: $${analysis.maxPain.price.toFixed(2)} ` +
        `(conf: ${(analysis.maxPain.confidence * 100).toFixed(0)}%)`
    );
    lines.push(`   Gamma Center: $${analysis.gammaWalls.center.toFixed(2)}`);
    lines.push('');
  }

  // Summary
  const weightedMaxPain = getWeightedMaxPain(analyses);
  const weightedGamma = getWeightedGammaCenter(analyses);

  lines.push('─'.repeat(40));
  lines.push(`Weighted Max Pain: $${weightedMaxPain.toFixed(2)}`);
  lines.push(`Weighted Gamma Center: $${weightedGamma.toFixed(2)}`);

  return lines.join('\n');
}
