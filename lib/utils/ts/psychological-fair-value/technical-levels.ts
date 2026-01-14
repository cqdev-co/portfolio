/**
 * Technical Levels Analysis
 *
 * Identifies key support/resistance levels from technical analysis
 * that traders psychologically anchor to.
 */

import type {
  TechnicalData,
  TechnicalLevel,
  TechnicalLevelsResult,
} from './types';

// ============================================================================
// TECHNICAL LEVEL DETECTION
// ============================================================================

/**
 * Analyze technical data to identify key psychological levels
 */
export function analyzeTechnicalLevels(
  data: TechnicalData
): TechnicalLevelsResult {
  const { currentPrice } = data;
  const levels: TechnicalLevel[] = [];

  // Moving Averages
  if (data.ma20) {
    levels.push(createLevel(data.ma20, 'MA20', 'WEAK', currentPrice));
  }

  if (data.ma50) {
    levels.push(createLevel(data.ma50, 'MA50', 'MODERATE', currentPrice));
  }

  if (data.ma200) {
    levels.push(createLevel(data.ma200, 'MA200', 'STRONG', currentPrice));
  }

  // 52-Week Extremes
  levels.push(
    createLevel(data.fiftyTwoWeekHigh, '52W_HIGH', 'STRONG', currentPrice)
  );

  levels.push(
    createLevel(data.fiftyTwoWeekLow, '52W_LOW', 'STRONG', currentPrice)
  );

  // Recent Swing Points
  if (data.recentSwingHigh) {
    levels.push(
      createLevel(data.recentSwingHigh, 'SWING_HIGH', 'MODERATE', currentPrice)
    );
  }

  if (data.recentSwingLow) {
    levels.push(
      createLevel(data.recentSwingLow, 'SWING_LOW', 'MODERATE', currentPrice)
    );
  }

  // VWAP
  if (data.vwap) {
    levels.push(createLevel(data.vwap, 'VWAP', 'MODERATE', currentPrice));
  }

  // Previous Close
  if (data.previousClose) {
    levels.push(
      createLevel(data.previousClose, 'PREV_CLOSE', 'WEAK', currentPrice)
    );
  }

  // Sort by distance from current price
  levels.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  // Find nearest support and resistance
  const nearestSupport =
    levels
      .filter((l) => l.isSupport)
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0] || null;

  const nearestResistance =
    levels
      .filter((l) => l.isResistance)
      .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0] || null;

  // Calculate weighted center
  const weightedCenter = calculateWeightedCenter(levels, currentPrice);

  return {
    levels,
    weightedCenter,
    nearestSupport,
    nearestResistance,
  };
}

/**
 * Create a technical level with calculated properties
 */
function createLevel(
  price: number,
  type: TechnicalLevel['type'],
  strength: TechnicalLevel['strength'],
  currentPrice: number
): TechnicalLevel {
  const distance = ((price - currentPrice) / currentPrice) * 100;

  return {
    price,
    type,
    strength,
    distance,
    isSupport: price < currentPrice,
    isResistance: price > currentPrice,
  };
}

/**
 * Calculate weighted center of technical levels
 *
 * Stronger levels have more influence
 * Closer levels have more immediate relevance
 */
function calculateWeightedCenter(
  levels: TechnicalLevel[],
  currentPrice: number
): number {
  if (levels.length === 0) return currentPrice;

  const strengthWeights: Record<TechnicalLevel['strength'], number> = {
    STRONG: 3,
    MODERATE: 2,
    WEAK: 1,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const level of levels) {
    // Base weight from strength
    const baseWeight = strengthWeights[level.strength];

    // Distance decay (closer = more relevant)
    const distanceWeight = 1 / (1 + Math.abs(level.distance) / 10);

    const weight = baseWeight * distanceWeight;
    weightedSum += level.price * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : currentPrice;
}

/**
 * Check if current price is near a key technical level
 */
export function isNearKeyLevel(
  currentPrice: number,
  levels: TechnicalLevel[],
  tolerancePercent: number = 1.0
): { isNear: boolean; level: TechnicalLevel | null } {
  for (const level of levels) {
    if (Math.abs(level.distance) <= tolerancePercent) {
      return { isNear: true, level };
    }
  }
  return { isNear: false, level: null };
}

/**
 * Find confluence zones where multiple levels cluster
 *
 * Confluence = stronger support/resistance
 */
export function findConfluenceZones(
  levels: TechnicalLevel[],
  currentPrice: number,
  clusterThresholdPercent: number = 2.0
): {
  zone: { low: number; high: number };
  levels: TechnicalLevel[];
  isSupport: boolean;
  strength: number;
}[] {
  if (levels.length < 2) return [];

  // Sort levels by price
  const sortedLevels = [...levels].sort((a, b) => a.price - b.price);
  const zones: ReturnType<typeof findConfluenceZones> = [];

  let currentZone: TechnicalLevel[] = [sortedLevels[0]];
  let zoneLow = sortedLevels[0].price;

  for (let i = 1; i < sortedLevels.length; i++) {
    const level = sortedLevels[i];
    const lastInZone = currentZone[currentZone.length - 1];

    // Check if this level is within cluster threshold of the zone
    const gapPercent =
      ((level.price - lastInZone.price) / lastInZone.price) * 100;

    if (gapPercent <= clusterThresholdPercent) {
      // Add to current zone
      currentZone.push(level);
    } else {
      // Finish current zone if it has 2+ levels
      if (currentZone.length >= 2) {
        const zoneHigh = currentZone[currentZone.length - 1].price;
        const zoneMid = (zoneLow + zoneHigh) / 2;
        const isSupport = zoneMid < currentPrice;

        // Calculate zone strength
        const strength =
          currentZone.reduce((sum, l) => {
            const strengthVal =
              l.strength === 'STRONG' ? 3 : l.strength === 'MODERATE' ? 2 : 1;
            return sum + strengthVal;
          }, 0) / currentZone.length;

        zones.push({
          zone: { low: zoneLow, high: zoneHigh },
          levels: [...currentZone],
          isSupport,
          strength,
        });
      }

      // Start new zone
      currentZone = [level];
      zoneLow = level.price;
    }
  }

  // Don't forget the last zone
  if (currentZone.length >= 2) {
    const zoneHigh = currentZone[currentZone.length - 1].price;
    const zoneMid = (zoneLow + zoneHigh) / 2;
    const isSupport = zoneMid < currentPrice;

    const strength =
      currentZone.reduce((sum, l) => {
        const strengthVal =
          l.strength === 'STRONG' ? 3 : l.strength === 'MODERATE' ? 2 : 1;
        return sum + strengthVal;
      }, 0) / currentZone.length;

    zones.push({
      zone: { low: zoneLow, high: zoneHigh },
      levels: [...currentZone],
      isSupport,
      strength,
    });
  }

  return zones.sort((a, b) => b.strength - a.strength);
}

/**
 * Determine trend bias based on price position vs key MAs
 */
export function determineTrendBias(
  data: TechnicalData
): 'BULLISH' | 'NEUTRAL' | 'BEARISH' {
  const { currentPrice, ma20, ma50, ma200 } = data;

  let bullishSignals = 0;
  let totalSignals = 0;

  if (ma200) {
    totalSignals += 2; // MA200 counts double
    if (currentPrice > ma200) bullishSignals += 2;
  }

  if (ma50) {
    totalSignals += 1;
    if (currentPrice > ma50) bullishSignals += 1;
  }

  if (ma20) {
    totalSignals += 1;
    if (currentPrice > ma20) bullishSignals += 1;
  }

  // Check MA alignment (MA20 > MA50 > MA200 = bullish)
  if (ma20 && ma50 && ma200) {
    totalSignals += 1;
    if (ma20 > ma50 && ma50 > ma200) {
      bullishSignals += 1;
    }
    // Bearish alignment (ma20 < ma50 < ma200) implicitly gives 0 bullish points
  }

  if (totalSignals === 0) return 'NEUTRAL';

  const bullishRatio = bullishSignals / totalSignals;

  if (bullishRatio >= 0.7) return 'BULLISH';
  if (bullishRatio <= 0.3) return 'BEARISH';
  return 'NEUTRAL';
}

/**
 * Calculate distance to key technical milestones
 */
export function calculateMilestones(
  data: TechnicalData
): { name: string; price: number; distance: number; direction: string }[] {
  const { currentPrice, fiftyTwoWeekHigh, fiftyTwoWeekLow, ma200 } = data;
  const milestones: ReturnType<typeof calculateMilestones> = [];

  // 52-week high
  const distToHigh = ((fiftyTwoWeekHigh - currentPrice) / currentPrice) * 100;
  milestones.push({
    name: '52-Week High',
    price: fiftyTwoWeekHigh,
    distance: distToHigh,
    direction: 'up',
  });

  // 52-week low
  const distToLow = ((fiftyTwoWeekLow - currentPrice) / currentPrice) * 100;
  milestones.push({
    name: '52-Week Low',
    price: fiftyTwoWeekLow,
    distance: distToLow,
    direction: 'down',
  });

  // MA200
  if (ma200) {
    const distToMA200 = ((ma200 - currentPrice) / currentPrice) * 100;
    milestones.push({
      name: '200 MA',
      price: ma200,
      distance: distToMA200,
      direction: distToMA200 > 0 ? 'up' : 'down',
    });
  }

  return milestones.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
}

/**
 * Format technical levels for display
 */
export function formatTechnicalLevels(result: TechnicalLevelsResult): string {
  const lines: string[] = [
    'Technical Level Analysis',
    `Weighted Center: $${result.weightedCenter.toFixed(2)}`,
    '',
  ];

  if (result.nearestResistance) {
    const r = result.nearestResistance;
    lines.push(
      `🔴 Nearest Resistance: $${r.price.toFixed(2)} ` +
        `(${r.type}, ${r.distance.toFixed(1)}% away)`
    );
  }

  if (result.nearestSupport) {
    const s = result.nearestSupport;
    lines.push(
      `🟢 Nearest Support: $${s.price.toFixed(2)} ` +
        `(${s.type}, ${Math.abs(s.distance).toFixed(1)}% away)`
    );
  }

  lines.push('', 'All Levels:');
  for (const level of result.levels) {
    const icon = level.isResistance ? '↑' : '↓';
    const distStr =
      level.distance > 0
        ? `+${level.distance.toFixed(1)}%`
        : `${level.distance.toFixed(1)}%`;
    lines.push(
      `  ${icon} $${level.price.toFixed(2)} - ${level.type} ` +
        `(${level.strength}, ${distStr})`
    );
  }

  return lines.join('\n');
}
