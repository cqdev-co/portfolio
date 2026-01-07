/**
 * Psychological Fair Value Calculator
 *
 * Main entry point that combines all components to calculate
 * where price gravitates based on behavioral biases and market mechanics.
 */

import type {
  PFVInput,
  PFVCalculatorOptions,
  PsychologicalFairValue,
  MagneticLevel,
  PFVComponentBreakdown,
  ConfidenceLevel,
  BiasSentiment,
  ExpirationAnalysis,
  TickerProfile,
} from './types';

import { detectProfile, normalizeWeights } from './profiles';
import { calculateMaxPain } from './max-pain';
import { detectGammaWalls } from './gamma-walls';
import {
  analyzeTechnicalLevels,
  findConfluenceZones,
  determineTrendBias,
} from './technical-levels';
import { analyzeRoundNumbers } from './round-numbers';
import {
  analyzeMultipleExpirations,
  getWeightedMaxPain,
  getWeightedGammaCenter,
  aggregateGammaWalls,
  getPrimaryExpiration,
} from './multi-expiry';

// ============================================================================
// MAIN CALCULATOR
// ============================================================================

/**
 * Calculate Psychological Fair Value for a ticker
 *
 * This is the main entry point for the PFV calculation.
 */
export function calculatePsychologicalFairValue(
  input: PFVInput,
  options: PFVCalculatorOptions = {}
): PsychologicalFairValue {
  const {
    maxDTE = 60,
    minDTE = 0,
    customWeights,
    includeAllLevels = false,
    maxMagneticLevels = 15,
  } = options;

  const { ticker, technicalData, expirations } = input;
  const currentPrice = technicalData.currentPrice;

  // 1. Detect or use specified profile
  const profile = input.profileOverride
    ? detectProfile(input.profileOverride)
    : detectProfile(ticker, technicalData, expirations);

  // Apply custom weight overrides if provided
  const weights = customWeights
    ? normalizeWeights({ ...profile.weights, ...customWeights })
    : profile.weights;

  // 2. Analyze multiple expirations
  const expirationAnalysis = analyzeMultipleExpirations(
    expirations,
    currentPrice,
    maxDTE,
    minDTE
  );

  // 3. Calculate component values
  const weightedMaxPain =
    expirationAnalysis.length > 0
      ? getWeightedMaxPain(expirationAnalysis)
      : currentPrice;

  const weightedGammaCenter =
    expirationAnalysis.length > 0
      ? getWeightedGammaCenter(expirationAnalysis)
      : currentPrice;

  const technicalResult = analyzeTechnicalLevels(technicalData);
  const roundNumberResult = analyzeRoundNumbers(currentPrice);

  // Volume anchor (use VWAP if available, else technical center)
  const volumeAnchor = technicalData.vwap || technicalResult.weightedCenter;

  // 4. Calculate weighted fair value
  const components: PFVComponentBreakdown[] = [
    {
      name: 'Max Pain',
      value: weightedMaxPain,
      weight: weights.maxPain,
      contribution: weightedMaxPain * weights.maxPain,
    },
    {
      name: 'Gamma Walls',
      value: weightedGammaCenter,
      weight: weights.gammaWalls,
      contribution: weightedGammaCenter * weights.gammaWalls,
    },
    {
      name: 'Technical Levels',
      value: technicalResult.weightedCenter,
      weight: weights.technical,
      contribution: technicalResult.weightedCenter * weights.technical,
    },
    {
      name: 'Volume Anchor',
      value: volumeAnchor,
      weight: weights.volume,
      contribution: volumeAnchor * weights.volume,
    },
    {
      name: 'Round Numbers',
      value: roundNumberResult.magneticCenter,
      weight: weights.roundNumber,
      contribution: roundNumberResult.magneticCenter * weights.roundNumber,
    },
  ];

  const fairValue = components.reduce((sum, c) => sum + c.contribution, 0);

  // 5. Calculate deviation and bias
  const deviationDollars = fairValue - currentPrice;
  const deviationPercent = (deviationDollars / currentPrice) * 100;
  const bias = determineBias(deviationPercent, technicalData);

  // 6. Calculate confidence
  const confidence = calculateConfidence(
    components,
    currentPrice,
    expirationAnalysis
  );

  // 7. Collect magnetic levels
  const magneticLevels = collectMagneticLevels(
    expirationAnalysis,
    technicalResult.levels,
    roundNumberResult.levels,
    currentPrice,
    includeAllLevels,
    maxMagneticLevels
  );

  // 8. Identify support/resistance zones
  const confluenceZones = findConfluenceZones(
    technicalResult.levels,
    currentPrice
  );

  const supportZone =
    confluenceZones
      .filter((z) => z.isSupport)
      .sort((a, b) => b.strength - a.strength)[0]?.zone || null;

  const resistanceZone =
    confluenceZones
      .filter((z) => !z.isSupport)
      .sort((a, b) => b.strength - a.strength)[0]?.zone || null;

  // 9. Generate AI context and interpretation
  const aiContext = generateAIContext(
    ticker,
    fairValue,
    currentPrice,
    deviationPercent,
    bias,
    confidence,
    components,
    magneticLevels,
    expirationAnalysis
  );

  const interpretation = generateInterpretation(
    fairValue,
    currentPrice,
    deviationPercent,
    bias,
    confidence,
    profile,
    expirationAnalysis
  );

  // 10. Determine data freshness
  const dataFreshness = determineDataFreshness();

  return {
    ticker,
    fairValue: roundPrice(fairValue),
    currentPrice,
    confidence,
    deviationPercent: roundPercent(deviationPercent),
    deviationDollars: roundPrice(deviationDollars),
    bias,
    profile: { ...profile, weights },
    components,
    expirationAnalysis,
    primaryExpiration: getPrimaryExpiration(expirationAnalysis),
    magneticLevels,
    supportZone: supportZone
      ? {
          low: roundPrice(supportZone.low),
          high: roundPrice(supportZone.high),
        }
      : null,
    resistanceZone: resistanceZone
      ? {
          low: roundPrice(resistanceZone.low),
          high: roundPrice(resistanceZone.high),
        }
      : null,
    calculatedAt: new Date(),
    dataFreshness,
    aiContext,
    interpretation,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine bias based on deviation and trend
 */
function determineBias(
  deviationPercent: number,
  technicalData: { currentPrice: number; ma200?: number }
): BiasSentiment {
  const trendBias = determineTrendBias({
    currentPrice: technicalData.currentPrice,
    ma200: technicalData.ma200,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
  });

  // If fair value is significantly above current price = bullish
  // If fair value is significantly below current price = bearish
  if (deviationPercent > 2) return 'BULLISH';
  if (deviationPercent < -2) return 'BEARISH';

  // Small deviation: use trend bias
  return trendBias;
}

/**
 * Calculate confidence in PFV estimate
 */
function calculateConfidence(
  components: PFVComponentBreakdown[],
  currentPrice: number,
  expirationAnalysis: ExpirationAnalysis[]
): ConfidenceLevel {
  // Factor 1: Component convergence
  // If all components point to similar prices, high confidence
  const values = components.map((c) => c.value);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow((v - avgValue) / avgValue, 2), 0) /
    values.length;
  const convergenceFactor = Math.max(0, 1 - variance * 10);

  // Factor 2: Options data quality
  // More expirations with good OI = higher confidence
  const optionsQuality =
    expirationAnalysis.length > 0
      ? Math.min(
          1,
          expirationAnalysis.reduce((sum, e) => sum + e.maxPain.confidence, 0) /
            Math.max(1, expirationAnalysis.length)
        )
      : 0.3;

  // Factor 3: Distance from current price
  // Very far PFV = less confident
  const fairValue = components.reduce((sum, c) => sum + c.contribution, 0);
  const distancePercent = Math.abs((fairValue - currentPrice) / currentPrice);
  const distanceFactor = Math.max(0.3, 1 - distancePercent * 3);

  // Combined confidence
  const confidence =
    convergenceFactor * 0.4 + optionsQuality * 0.4 + distanceFactor * 0.2;

  if (confidence >= 0.7) return 'HIGH';
  if (confidence >= 0.4) return 'MEDIUM';
  return 'LOW';
}

/**
 * Collect and sort magnetic levels from all sources
 */
function collectMagneticLevels(
  expirationAnalysis: ExpirationAnalysis[],
  technicalLevels: {
    price: number;
    type: string;
    strength: string;
    distance: number;
  }[],
  roundLevels: {
    price: number;
    significance: string;
    magneticPull: number;
    distance: number;
  }[],
  currentPrice: number,
  includeAll: boolean,
  maxLevels: number
): MagneticLevel[] {
  const levels: MagneticLevel[] = [];

  // Add max pain levels from expirations
  for (const exp of expirationAnalysis) {
    levels.push({
      price: exp.maxPain.price,
      type: 'MAX_PAIN',
      strength: exp.maxPain.confidence,
      distance: ((exp.maxPain.price - currentPrice) / currentPrice) * 100,
      expiration: exp.expiration,
    });

    // Add gamma walls
    for (const wall of exp.gammaWalls.walls.slice(0, 3)) {
      const type: MagneticLevel['type'] =
        wall.type === 'CALL_WALL'
          ? 'CALL_WALL'
          : wall.type === 'PUT_WALL'
            ? 'PUT_WALL'
            : 'GAMMA_WALL';

      levels.push({
        price: wall.strike,
        type,
        strength: Math.min(1, wall.relativeStrength / 5),
        distance: ((wall.strike - currentPrice) / currentPrice) * 100,
        expiration: exp.expiration,
      });
    }
  }

  // Add technical levels
  for (const level of technicalLevels) {
    const type = mapTechnicalType(level.type);
    if (!type) continue;

    const strengthMap: Record<string, number> = {
      STRONG: 0.9,
      MODERATE: 0.6,
      WEAK: 0.3,
    };

    levels.push({
      price: level.price,
      type,
      strength: strengthMap[level.strength] || 0.5,
      distance: level.distance,
    });
  }

  // Add round number levels
  for (const level of roundLevels.slice(0, 5)) {
    const type: MagneticLevel['type'] =
      level.significance === 'MAJOR' ? 'ROUND_MAJOR' : 'ROUND_MODERATE';

    levels.push({
      price: level.price,
      type,
      strength: level.magneticPull,
      distance: level.distance,
    });
  }

  // Deduplicate by price (keep strongest)
  const priceMap = new Map<number, MagneticLevel>();
  for (const level of levels) {
    const roundedPrice = roundPrice(level.price);
    const existing = priceMap.get(roundedPrice);
    if (!existing || level.strength > existing.strength) {
      priceMap.set(roundedPrice, { ...level, price: roundedPrice });
    }
  }

  // Filter and sort
  let result = Array.from(priceMap.values());

  if (!includeAll) {
    // Filter to only significant levels
    result = result.filter((l) => l.strength >= 0.3);
  }

  // Sort by strength (strongest first)
  result.sort((a, b) => b.strength - a.strength);

  return result.slice(0, maxLevels);
}

/**
 * Map technical level types to magnetic level types
 */
function mapTechnicalType(type: string): MagneticLevel['type'] | null {
  const mapping: Record<string, MagneticLevel['type']> = {
    MA200: 'MA200',
    MA50: 'MA50',
    MA20: 'MA20',
    VWAP: 'VWAP',
    '52W_HIGH': '52W_HIGH',
    '52W_LOW': '52W_LOW',
  };
  return mapping[type] || null;
}

/**
 * Determine data freshness based on current time
 */
function determineDataFreshness(): 'FRESH' | 'STALE' | 'WEEKEND' {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'WEEKEND';
  }

  // After hours (before 9:30 AM or after 4 PM ET)
  // This is simplified - should use proper timezone handling
  if (hour < 9 || hour >= 16) {
    return 'STALE';
  }

  return 'FRESH';
}

/**
 * Generate AI-ready context string
 */
function generateAIContext(
  ticker: string,
  fairValue: number,
  currentPrice: number,
  deviationPercent: number,
  bias: BiasSentiment,
  confidence: ConfidenceLevel,
  components: PFVComponentBreakdown[],
  magneticLevels: MagneticLevel[],
  expirationAnalysis: ExpirationAnalysis[]
): string {
  const lines: string[] = [
    `=== PSYCHOLOGICAL FAIR VALUE: ${ticker} ===`,
    '',
    `Current Price: $${currentPrice.toFixed(2)}`,
    `Fair Value: $${fairValue.toFixed(2)}`,
    `Deviation: ${deviationPercent > 0 ? '+' : ''}${deviationPercent.toFixed(1)}%`,
    `Bias: ${bias}`,
    `Confidence: ${confidence}`,
    '',
    'COMPONENT BREAKDOWN:',
  ];

  for (const c of components) {
    lines.push(
      `  ${c.name}: $${c.value.toFixed(2)} ` +
        `(${(c.weight * 100).toFixed(0)}% weight)`
    );
  }

  lines.push('', 'KEY MAGNETIC LEVELS:');
  for (const level of magneticLevels.slice(0, 8)) {
    const distStr =
      level.distance > 0
        ? `+${level.distance.toFixed(1)}%`
        : `${level.distance.toFixed(1)}%`;
    lines.push(`  $${level.price.toFixed(2)} - ${level.type} (${distStr})`);
  }

  if (expirationAnalysis.length > 0) {
    lines.push('', 'OPTIONS EXPIRATIONS ANALYZED:');
    for (const exp of expirationAnalysis.slice(0, 3)) {
      const dateStr = exp.expiration.toISOString().split('T')[0];
      const opexNote = exp.isMonthlyOpex ? ' [MONTHLY OPEX]' : '';
      lines.push(
        `  ${dateStr} (${exp.dte} DTE)${opexNote}: ` +
          `Max Pain $${exp.maxPain.price.toFixed(2)}`
      );
    }
  }

  lines.push('', '=== END PFV ===');

  return lines.join('\n');
}

/**
 * Generate human-readable interpretation
 */
function generateInterpretation(
  fairValue: number,
  currentPrice: number,
  deviationPercent: number,
  bias: BiasSentiment,
  confidence: ConfidenceLevel,
  profile: TickerProfile,
  expirationAnalysis: ExpirationAnalysis[]
): string {
  const direction = fairValue > currentPrice ? 'above' : 'below';
  const absDeviation = Math.abs(deviationPercent);

  let interpretation = '';

  // Main interpretation
  if (absDeviation < 1) {
    interpretation =
      `Price is trading very close to psychological fair value. ` +
      `The market appears efficiently priced at current levels.`;
  } else if (absDeviation < 3) {
    interpretation =
      `Price is trading ${absDeviation.toFixed(1)}% ${direction} fair value ` +
      `($${fairValue.toFixed(2)}). `;

    if (bias === 'BULLISH') {
      interpretation +=
        `Options mechanics and technical levels suggest ` +
        `gravitational pull upward.`;
    } else if (bias === 'BEARISH') {
      interpretation +=
        `Options mechanics and technical levels suggest ` +
        `gravitational pull downward.`;
    } else {
      interpretation += `The bias is neutral with no strong directional pull.`;
    }
  } else {
    interpretation =
      `Price is trading significantly ${direction} fair value ` +
      `(${absDeviation.toFixed(1)}% deviation). `;

    if (direction === 'below') {
      interpretation += `Mean reversion suggests potential upside toward $${fairValue.toFixed(2)}.`;
    } else {
      interpretation += `Price may be extended; watch for pullback toward $${fairValue.toFixed(2)}.`;
    }
  }

  // Add confidence context
  if (confidence === 'LOW') {
    interpretation += ` Note: Confidence is LOW due to limited data or divergent signals.`;
  }

  // Add profile context
  interpretation += ` (Profile: ${profile.name})`;

  // Add expiration context
  if (expirationAnalysis.length > 0) {
    const primary = expirationAnalysis[0];
    if (primary.isMonthlyOpex && primary.dte <= 7) {
      interpretation += ` Monthly OPEX in ${primary.dte} days - max pain magnetism strongest.`;
    }
  }

  return interpretation;
}

/**
 * Round price to appropriate precision
 */
function roundPrice(price: number): number {
  if (price >= 100) return Math.round(price * 100) / 100;
  if (price >= 10) return Math.round(price * 100) / 100;
  return Math.round(price * 1000) / 1000;
}

/**
 * Round percentage to 1 decimal
 */
function roundPercent(pct: number): number {
  return Math.round(pct * 10) / 10;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick PFV calculation with minimal configuration
 */
export function quickPFV(
  ticker: string,
  currentPrice: number,
  ma200?: number,
  expirations?: {
    dte: number;
    maxPain: number;
    totalOI: number;
  }[]
): { fairValue: number; bias: BiasSentiment } {
  // Simplified calculation without full analysis
  let sum = currentPrice;
  let weights = 1;

  if (ma200) {
    sum += ma200 * 0.3;
    weights += 0.3;
  }

  if (expirations && expirations.length > 0) {
    const nearestExp = expirations.sort((a, b) => a.dte - b.dte)[0];
    sum += nearestExp.maxPain * 0.4;
    weights += 0.4;
  }

  const fairValue = sum / weights;
  const deviation = (fairValue - currentPrice) / currentPrice;

  const bias: BiasSentiment =
    deviation > 0.02 ? 'BULLISH' : deviation < -0.02 ? 'BEARISH' : 'NEUTRAL';

  return { fairValue, bias };
}

/**
 * Format PFV result for console output
 */
export function formatPFVResult(result: PsychologicalFairValue): string {
  const lines: string[] = [
    '═'.repeat(50),
    `📊 PSYCHOLOGICAL FAIR VALUE: ${result.ticker}`,
    '═'.repeat(50),
    '',
    `Current Price:  $${result.currentPrice.toFixed(2)}`,
    `Fair Value:     $${result.fairValue.toFixed(2)}`,
    `Deviation:      ${result.deviationPercent > 0 ? '+' : ''}` +
      `${result.deviationPercent.toFixed(1)}% (${result.bias})`,
    `Confidence:     ${result.confidence}`,
    `Profile:        ${result.profile.name}`,
    '',
    '┌─────────────────────────────────────────────────┐',
    '│ COMPONENT BREAKDOWN                              │',
    '├─────────────────────────────────────────────────┤',
  ];

  for (const c of result.components) {
    const line =
      `│ ${c.name.padEnd(20)} $${c.value.toFixed(2).padStart(8)} ` +
      `(${(c.weight * 100).toFixed(0)}%)`.padStart(6) +
      ' │';
    lines.push(line);
  }

  lines.push('└─────────────────────────────────────────────────┘');
  lines.push('');
  lines.push('MAGNETIC LEVELS:');

  for (const level of result.magneticLevels.slice(0, 8)) {
    const icon = level.distance < 0 ? '🟢' : '🔴';
    const distStr =
      level.distance > 0
        ? `+${level.distance.toFixed(1)}%`
        : `${level.distance.toFixed(1)}%`;
    lines.push(
      `  ${icon} $${level.price.toFixed(2).padStart(8)} - ` +
        `${level.type.padEnd(12)} (${distStr})`
    );
  }

  if (result.supportZone) {
    lines.push('');
    lines.push(
      `Support Zone: $${result.supportZone.low.toFixed(2)} - ` +
        `$${result.supportZone.high.toFixed(2)}`
    );
  }

  if (result.resistanceZone) {
    lines.push(
      `Resistance Zone: $${result.resistanceZone.low.toFixed(2)} - ` +
        `$${result.resistanceZone.high.toFixed(2)}`
    );
  }

  lines.push('');
  lines.push('INTERPRETATION:');
  lines.push(result.interpretation);
  lines.push('');
  lines.push('═'.repeat(50));

  return lines.join('\n');
}
