/**
 * Round Number Magnetism
 * 
 * Humans have cognitive bias toward round numbers.
 * Stocks tend to gravitate toward and respect round price levels.
 */

import type { RoundNumberLevel, RoundNumbersResult } from './types';

// ============================================================================
// ROUND NUMBER DETECTION
// ============================================================================

/**
 * Analyze round number levels near current price
 */
export function analyzeRoundNumbers(
  currentPrice: number,
  range: number = 0.20 // Look 20% above and below
): RoundNumbersResult {
  const minPrice = currentPrice * (1 - range);
  const maxPrice = currentPrice * (1 + range);
  
  const levels: RoundNumberLevel[] = [];

  // Determine appropriate intervals based on price magnitude
  const intervals = getIntervals(currentPrice);

  // Generate round number levels
  for (const { interval, significance } of intervals) {
    // Find first round number below minPrice
    const startLevel = Math.floor(minPrice / interval) * interval;
    
    for (let price = startLevel; price <= maxPrice; price += interval) {
      if (price <= 0) continue;
      if (price < minPrice) continue;

      const distance = ((price - currentPrice) / currentPrice) * 100;
      const magneticPull = calculateMagneticPull(
        price, 
        currentPrice, 
        significance
      );

      levels.push({
        price,
        significance,
        distance,
        magneticPull,
      });
    }
  }

  // Remove duplicates (a $100 level is also a $50 and $10 level)
  const uniqueLevels = deduplicateLevels(levels);

  // Sort by magnetic pull (strongest first)
  uniqueLevels.sort((a, b) => b.magneticPull - a.magneticPull);

  // Find nearest major level
  const nearestMajor = uniqueLevels
    .filter(l => l.significance === 'MAJOR')
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0] || null;

  // Calculate magnetic center (weighted average of nearby round numbers)
  const magneticCenter = calculateMagneticCenter(uniqueLevels, currentPrice);

  return {
    levels: uniqueLevels,
    nearestMajor,
    magneticCenter,
  };
}

/**
 * Get appropriate intervals based on stock price
 */
interface IntervalConfig {
  interval: number;
  significance: RoundNumberLevel['significance'];
}

function getIntervals(price: number): IntervalConfig[] {
  // Different interval sets based on price magnitude
  if (price >= 500) {
    return [
      { interval: 100, significance: 'MAJOR' },
      { interval: 50, significance: 'MODERATE' },
      { interval: 25, significance: 'MINOR' },
    ];
  }

  if (price >= 100) {
    return [
      { interval: 50, significance: 'MAJOR' },
      { interval: 25, significance: 'MODERATE' },
      { interval: 10, significance: 'MINOR' },
    ];
  }

  if (price >= 50) {
    return [
      { interval: 25, significance: 'MAJOR' },
      { interval: 10, significance: 'MODERATE' },
      { interval: 5, significance: 'MINOR' },
    ];
  }

  if (price >= 20) {
    return [
      { interval: 10, significance: 'MAJOR' },
      { interval: 5, significance: 'MODERATE' },
      { interval: 2.5, significance: 'MINOR' },
    ];
  }

  if (price >= 10) {
    return [
      { interval: 5, significance: 'MAJOR' },
      { interval: 2.5, significance: 'MODERATE' },
      { interval: 1, significance: 'MINOR' },
    ];
  }

  // Low-priced stocks
  return [
    { interval: 1, significance: 'MAJOR' },
    { interval: 0.5, significance: 'MODERATE' },
    { interval: 0.25, significance: 'MINOR' },
  ];
}

/**
 * Calculate magnetic pull of a round number
 * 
 * Factors:
 * - Significance (major > moderate > minor)
 * - Distance (closer = stronger pull)
 * - Roundness (100 is rounder than 50)
 */
function calculateMagneticPull(
  levelPrice: number,
  currentPrice: number,
  significance: RoundNumberLevel['significance']
): number {
  // Base strength from significance
  const significanceWeight: Record<RoundNumberLevel['significance'], number> = {
    MAJOR: 1.0,
    MODERATE: 0.6,
    MINOR: 0.3,
  };
  const baseStrength = significanceWeight[significance];

  // Distance decay (exponential)
  const distancePercent = Math.abs((levelPrice - currentPrice) / currentPrice);
  const distanceFactor = Math.exp(-distancePercent * 5);

  // Extra "roundness" bonus
  // $100 is rounder than $50 which is rounder than $25
  let roundnessBonus = 0;
  if (levelPrice % 100 === 0) roundnessBonus = 0.2;
  else if (levelPrice % 50 === 0) roundnessBonus = 0.1;
  else if (levelPrice % 25 === 0) roundnessBonus = 0.05;

  const pull = (baseStrength + roundnessBonus) * distanceFactor;
  return Math.min(1, pull);
}

/**
 * Remove duplicate levels, keeping the most significant version
 */
function deduplicateLevels(levels: RoundNumberLevel[]): RoundNumberLevel[] {
  const priceMap = new Map<number, RoundNumberLevel>();

  for (const level of levels) {
    const existing = priceMap.get(level.price);
    if (!existing || getSignificanceRank(level) > getSignificanceRank(existing)) {
      priceMap.set(level.price, level);
    }
  }

  return Array.from(priceMap.values());
}

function getSignificanceRank(level: RoundNumberLevel): number {
  const ranks: Record<RoundNumberLevel['significance'], number> = {
    MAJOR: 3,
    MODERATE: 2,
    MINOR: 1,
  };
  return ranks[level.significance];
}

/**
 * Calculate weighted magnetic center of round numbers
 */
function calculateMagneticCenter(
  levels: RoundNumberLevel[],
  currentPrice: number
): number {
  if (levels.length === 0) return currentPrice;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const level of levels) {
    weightedSum += level.price * level.magneticPull;
    totalWeight += level.magneticPull;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : currentPrice;
}

/**
 * Find the most likely "magnet" price
 * This is the round number with the strongest pull
 */
export function findStrongestMagnet(
  currentPrice: number,
  maxDistancePercent: number = 5.0
): RoundNumberLevel | null {
  const result = analyzeRoundNumbers(currentPrice, maxDistancePercent / 100);
  
  // Filter to only levels within max distance
  const nearbyLevels = result.levels.filter(
    l => Math.abs(l.distance) <= maxDistancePercent
  );

  if (nearbyLevels.length === 0) return null;

  // Return the one with highest magnetic pull
  return nearbyLevels.reduce((best, current) => 
    current.magneticPull > best.magneticPull ? current : best
  );
}

/**
 * Check if price is at or very near a round number
 */
export function isAtRoundNumber(
  currentPrice: number,
  tolerancePercent: number = 0.5
): { isRound: boolean; level: RoundNumberLevel | null } {
  const result = analyzeRoundNumbers(currentPrice, 0.05);
  
  for (const level of result.levels) {
    if (Math.abs(level.distance) <= tolerancePercent) {
      return { isRound: true, level };
    }
  }

  return { isRound: false, level: null };
}

/**
 * Get the "halfway" levels between major round numbers
 * These often act as pivot points
 */
export function getMidpointLevels(currentPrice: number): number[] {
  const intervals = getIntervals(currentPrice);
  const majorInterval = intervals.find(i => i.significance === 'MAJOR')!.interval;
  
  const midpoints: number[] = [];
  const baseMajor = Math.floor(currentPrice / majorInterval) * majorInterval;
  
  // Get midpoints around current price
  for (let i = -2; i <= 2; i++) {
    const major = baseMajor + (i * majorInterval);
    const midpoint = major + (majorInterval / 2);
    if (midpoint > 0) {
      midpoints.push(midpoint);
    }
  }

  return midpoints;
}

/**
 * Determine bias based on position relative to round numbers
 * 
 * If just above a major round number → bullish (support below)
 * If just below a major round number → bearish (resistance above)
 */
export function getRoundNumberBias(
  currentPrice: number
): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  const result = analyzeRoundNumbers(currentPrice, 0.05);
  const majorLevels = result.levels.filter(l => l.significance === 'MAJOR');

  if (majorLevels.length === 0) return 'NEUTRAL';

  // Find nearest above and below
  const below = majorLevels
    .filter(l => l.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0];
  const above = majorLevels
    .filter(l => l.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0];

  if (!below && !above) return 'NEUTRAL';

  const distBelow = below 
    ? Math.abs((currentPrice - below.price) / currentPrice) 
    : Infinity;
  const distAbove = above 
    ? Math.abs((above.price - currentPrice) / currentPrice) 
    : Infinity;

  // If much closer to level below → bullish (just broke above)
  // If much closer to level above → bearish (resistance approaching)
  if (distBelow < distAbove * 0.5) return 'BULLISH';
  if (distAbove < distBelow * 0.5) return 'BEARISH';

  return 'NEUTRAL';
}

/**
 * Format round numbers for display
 */
export function formatRoundNumbers(
  result: RoundNumbersResult,
  currentPrice: number
): string {
  const lines: string[] = [
    `Round Number Analysis (Current: $${currentPrice.toFixed(2)})`,
    `Magnetic Center: $${result.magneticCenter.toFixed(2)}`,
    '',
  ];

  if (result.nearestMajor) {
    const m = result.nearestMajor;
    const direction = m.price > currentPrice ? '↑' : '↓';
    lines.push(
      `🧲 Nearest Major: $${m.price.toFixed(2)} ` +
      `(${direction} ${Math.abs(m.distance).toFixed(1)}%)`
    );
  }

  lines.push('', 'Significant Levels:');
  
  // Show top levels by pull
  const topLevels = result.levels.slice(0, 10);
  for (const level of topLevels) {
    const icon = level.significance === 'MAJOR' ? '●' :
                 level.significance === 'MODERATE' ? '◐' : '○';
    const distStr = level.distance > 0 
      ? `+${level.distance.toFixed(1)}%` 
      : `${level.distance.toFixed(1)}%`;
    const pullStr = `${(level.magneticPull * 100).toFixed(0)}%`;
    
    lines.push(
      `  ${icon} $${level.price.toFixed(2)} - ${level.significance} ` +
      `(${distStr}, pull: ${pullStr})`
    );
  }

  return lines.join('\n');
}

