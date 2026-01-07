/**
 * Signal Conflict Detection
 *
 * Analyzes multiple market signals to detect conflicting conditions
 * that cancel each other out, making high-confidence trades impossible.
 *
 * When bullish and bearish signals are roughly balanced, the market
 * is in a "conflicted" state where trading should be avoided.
 *
 * Example conflicts:
 * - RSI oversold BUT below MA200 (bullish momentum, bearish trend)
 * - VIX calm BUT SPY downtrend (low fear, but selling)
 * - Bullish options flow BUT earnings imminent (flow vs risk)
 * - Above support BUT sector rotation bearish (stock vs sector)
 */

import type { VIXLevel, SPYTrend } from './index';

// ============================================================================
// TYPES
// ============================================================================

export type SignalDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface Signal {
  /** Signal identifier */
  name: string;
  /** Current direction */
  direction: SignalDirection;
  /** Weight in overall calculation (0-1, sum to 1) */
  weight: number;
  /** Human-readable value */
  value: string;
  /** Optional explanation */
  reason?: string;
}

export interface ConflictAnalysis {
  /** Overall conflict score (0-100, higher = more conflict) */
  conflictScore: number;
  /** Net direction after weighing all signals */
  netDirection: SignalDirection;
  /** Net strength (-100 to +100, 0 = perfectly conflicted) */
  netStrength: number;
  /** All analyzed signals */
  signals: Signal[];
  /** Pairs of conflicting signals */
  conflicts: ConflictPair[];
  /** Whether conflict level is too high to trade */
  isTooConflicted: boolean;
  /** Summary message */
  summary: string;
}

export interface ConflictPair {
  bullishSignal: string;
  bearishSignal: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ============================================================================
// SIGNAL INPUT TYPES
// ============================================================================

export interface SignalInputs {
  // Market-level signals
  vixLevel?: VIXLevel;
  vixValue?: number;
  spyTrend?: SPYTrend['trend'];
  spyAboveMA200?: boolean;
  spyAboveMA50?: boolean;

  // Trend/momentum signals (Real ADX - Quick Win #1)
  adx?: number; // Legacy - use adxValue instead
  adxValue?: number; // Real ADX value from calculation
  adxDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi?: number;

  // Flow/sentiment signals
  pcRatio?: number; // Put/call ratio (< 0.7 bullish, > 1.0 bearish)
  sectorMomentum?: 'LEADING' | 'LAGGING' | 'NEUTRAL';

  // Risk signals
  daysToEarnings?: number;
  chopIndex?: number;
}

// ============================================================================
// SIGNAL WEIGHTS
// ============================================================================

/**
 * Signal weights - must sum to 1.0
 * Higher weight = more important in conflict calculation
 */
const SIGNAL_WEIGHTS = {
  VIX: 0.18,
  SPY_TREND: 0.18,
  SPY_MA200: 0.12,
  ADX: 0.12,
  RSI: 0.1,
  OPTIONS_FLOW: 0.1,
  SECTOR: 0.08,
  EARNINGS: 0.07,
  CHOP: 0.05,
} as const;

// ============================================================================
// SIGNAL EXTRACTION
// ============================================================================

/**
 * Extract VIX signal direction
 */
function getVIXSignal(level?: VIXLevel, value?: number): Signal | null {
  if (!level) return null;

  let direction: SignalDirection;
  let reason: string;

  switch (level) {
    case 'CALM':
      direction = 'BULLISH';
      reason = 'Low fear environment';
      break;
    case 'NORMAL':
      direction = 'NEUTRAL';
      reason = 'Standard volatility';
      break;
    case 'ELEVATED':
      direction = 'BEARISH';
      reason = 'Elevated fear';
      break;
    case 'HIGH':
    case 'EXTREME':
      direction = 'BEARISH';
      reason = 'High fear - risk-off';
      break;
    default:
      direction = 'NEUTRAL';
      reason = 'Unknown VIX level';
  }

  return {
    name: 'VIX',
    direction,
    weight: SIGNAL_WEIGHTS.VIX,
    value: value ? `${value} (${level})` : level,
    reason,
  };
}

/**
 * Extract SPY trend signal
 */
function getSPYTrendSignal(trend?: SPYTrend['trend']): Signal | null {
  if (!trend) return null;

  const directionMap: Record<string, SignalDirection> = {
    BULLISH: 'BULLISH',
    BEARISH: 'BEARISH',
    NEUTRAL: 'NEUTRAL',
  };

  return {
    name: 'SPY_TREND',
    direction: directionMap[trend] ?? 'NEUTRAL',
    weight: SIGNAL_WEIGHTS.SPY_TREND,
    value: trend,
    reason:
      trend === 'BULLISH'
        ? 'Market uptrend'
        : trend === 'BEARISH'
          ? 'Market downtrend'
          : 'Sideways market',
  };
}

/**
 * Extract SPY MA200 signal
 */
function getSPYMA200Signal(aboveMA200?: boolean): Signal | null {
  if (aboveMA200 === undefined) return null;

  return {
    name: 'SPY_MA200',
    direction: aboveMA200 ? 'BULLISH' : 'BEARISH',
    weight: SIGNAL_WEIGHTS.SPY_MA200,
    value: aboveMA200 ? 'Above MA200' : 'Below MA200',
    reason: aboveMA200 ? 'Long-term uptrend intact' : 'Long-term downtrend',
  };
}

/**
 * Extract ADX (trend strength) signal
 */
function getADXSignal(
  adxValue?: number,
  adxDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  legacyAdx?: number
): Signal | null {
  // Prefer real ADX value, fall back to legacy
  const adx = adxValue ?? legacyAdx;
  if (adx === undefined) return null;

  let direction: SignalDirection;
  let reason: string;

  if (adx >= 25) {
    // Strong trend - use direction if available
    if (adxDirection) {
      direction = adxDirection;
      reason =
        adxDirection === 'BULLISH'
          ? 'Strong bullish trend - favorable for longs'
          : adxDirection === 'BEARISH'
            ? 'Strong bearish trend - favorable for shorts/hedges'
            : 'Strong trend - favorable for entries';
    } else {
      direction = 'BULLISH'; // Strong trend = good for trading
      reason = 'Strong trend - favorable for entries';
    }
  } else if (adx >= 20) {
    direction = 'NEUTRAL';
    reason = 'Moderate trend strength';
  } else {
    direction = 'BEARISH'; // Weak trend = choppy
    reason = 'Weak/no trend - avoid trend-following';
  }

  return {
    name: 'ADX',
    direction,
    weight: SIGNAL_WEIGHTS.ADX,
    value: `${adx.toFixed(1)}`,
    reason,
  };
}

/**
 * Extract RSI signal
 */
function getRSISignal(rsi?: number): Signal | null {
  if (rsi === undefined) return null;

  let direction: SignalDirection;
  let reason: string;

  if (rsi < 30) {
    direction = 'BULLISH';
    reason = 'Oversold - potential bounce';
  } else if (rsi > 70) {
    direction = 'BEARISH';
    reason = 'Overbought - potential pullback';
  } else if (rsi >= 40 && rsi <= 60) {
    direction = 'NEUTRAL';
    reason = 'RSI neutral';
  } else if (rsi < 40) {
    direction = 'BULLISH';
    reason = 'RSI recovering from oversold';
  } else {
    direction = 'BEARISH';
    reason = 'RSI elevated';
  }

  return {
    name: 'RSI',
    direction,
    weight: SIGNAL_WEIGHTS.RSI,
    value: `${Math.round(rsi)}`,
    reason,
  };
}

/**
 * Extract options flow signal (put/call ratio)
 */
function getOptionsFlowSignal(pcRatio?: number): Signal | null {
  if (pcRatio === undefined) return null;

  let direction: SignalDirection;
  let reason: string;

  if (pcRatio < 0.7) {
    direction = 'BULLISH';
    reason = 'Call-heavy flow';
  } else if (pcRatio > 1.0) {
    direction = 'BEARISH';
    reason = 'Put-heavy flow';
  } else {
    direction = 'NEUTRAL';
    reason = 'Balanced options flow';
  }

  return {
    name: 'OPTIONS_FLOW',
    direction,
    weight: SIGNAL_WEIGHTS.OPTIONS_FLOW,
    value: `P/C ${pcRatio.toFixed(2)}`,
    reason,
  };
}

/**
 * Extract sector momentum signal
 */
function getSectorSignal(
  momentum?: 'LEADING' | 'LAGGING' | 'NEUTRAL'
): Signal | null {
  if (!momentum) return null;

  const directionMap: Record<string, SignalDirection> = {
    LEADING: 'BULLISH',
    LAGGING: 'BEARISH',
    NEUTRAL: 'NEUTRAL',
  };

  return {
    name: 'SECTOR',
    direction: directionMap[momentum] ?? 'NEUTRAL',
    weight: SIGNAL_WEIGHTS.SECTOR,
    value: momentum,
    reason:
      momentum === 'LEADING'
        ? 'Sector outperforming'
        : momentum === 'LAGGING'
          ? 'Sector underperforming'
          : 'Sector inline',
  };
}

/**
 * Extract earnings proximity signal
 */
function getEarningsSignal(daysToEarnings?: number): Signal | null {
  if (daysToEarnings === undefined) return null;

  let direction: SignalDirection;
  let reason: string;

  if (daysToEarnings <= 7) {
    direction = 'BEARISH'; // High risk
    reason = 'Earnings imminent - high event risk';
  } else if (daysToEarnings <= 14) {
    direction = 'BEARISH';
    reason = 'Earnings within 2 weeks';
  } else if (daysToEarnings <= 30) {
    direction = 'NEUTRAL';
    reason = 'Earnings approaching';
  } else {
    direction = 'BULLISH';
    reason = 'Earnings clear';
  }

  return {
    name: 'EARNINGS',
    direction,
    weight: SIGNAL_WEIGHTS.EARNINGS,
    value: `${daysToEarnings} days`,
    reason,
  };
}

/**
 * Extract chop index signal
 */
function getChopSignal(chopIndex?: number): Signal | null {
  if (chopIndex === undefined) return null;

  let direction: SignalDirection;
  let reason: string;

  if (chopIndex < 38.2) {
    direction = 'BULLISH';
    reason = 'Trending market';
  } else if (chopIndex > 61.8) {
    direction = 'BEARISH';
    reason = 'Choppy/consolidating';
  } else {
    direction = 'NEUTRAL';
    reason = 'Transitional market';
  }

  return {
    name: 'CHOP',
    direction,
    weight: SIGNAL_WEIGHTS.CHOP,
    value: `${chopIndex.toFixed(1)}`,
    reason,
  };
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Find pairs of conflicting signals
 */
function findConflictPairs(signals: Signal[]): ConflictPair[] {
  const bullishSignals = signals.filter((s) => s.direction === 'BULLISH');
  const bearishSignals = signals.filter((s) => s.direction === 'BEARISH');
  const conflicts: ConflictPair[] = [];

  for (const bull of bullishSignals) {
    for (const bear of bearishSignals) {
      // Calculate severity based on combined weight
      const combinedWeight = bull.weight + bear.weight;
      let severity: ConflictPair['severity'];

      if (combinedWeight >= 0.3) {
        severity = 'HIGH';
      } else if (combinedWeight >= 0.2) {
        severity = 'MEDIUM';
      } else {
        severity = 'LOW';
      }

      conflicts.push({
        bullishSignal: `${bull.name}: ${bull.value}`,
        bearishSignal: `${bear.name}: ${bear.value}`,
        severity,
      });
    }
  }

  // Sort by severity (HIGH first)
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  conflicts.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  return conflicts;
}

/**
 * Calculate conflict score from signals
 */
function calculateConflictScore(signals: Signal[]): number {
  let bullishWeight = 0;
  let bearishWeight = 0;

  for (const signal of signals) {
    if (signal.direction === 'BULLISH') {
      bullishWeight += signal.weight;
    } else if (signal.direction === 'BEARISH') {
      bearishWeight += signal.weight;
    }
  }

  // Conflict score is based on how balanced bull/bear are
  // Max conflict (100) when perfectly balanced
  // Min conflict (0) when completely one-sided
  const totalDirectional = bullishWeight + bearishWeight;
  if (totalDirectional === 0) return 50; // All neutral = moderate conflict

  const smaller = Math.min(bullishWeight, bearishWeight);
  const larger = Math.max(bullishWeight, bearishWeight);

  // Conflict ratio: 0 = one-sided, 1 = perfectly balanced
  const conflictRatio = smaller / larger;

  // Scale to 0-100
  return Math.round(conflictRatio * 100);
}

/**
 * Calculate net strength from signals
 * Returns -100 (fully bearish) to +100 (fully bullish)
 */
function calculateNetStrength(signals: Signal[]): number {
  let netStrength = 0;

  for (const signal of signals) {
    if (signal.direction === 'BULLISH') {
      netStrength += signal.weight * 100;
    } else if (signal.direction === 'BEARISH') {
      netStrength -= signal.weight * 100;
    }
    // NEUTRAL doesn't affect net strength
  }

  return Math.round(netStrength);
}

/**
 * Determine net direction from strength
 */
function getNetDirection(netStrength: number): SignalDirection {
  if (netStrength > 15) return 'BULLISH';
  if (netStrength < -15) return 'BEARISH';
  return 'NEUTRAL';
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze all signals and detect conflicts
 *
 * @param inputs - Market signal inputs
 * @returns Conflict analysis with scores and recommendations
 */
export function analyzeSignalConflicts(inputs: SignalInputs): ConflictAnalysis {
  // Extract all signals
  const signals: Signal[] = [
    getVIXSignal(inputs.vixLevel, inputs.vixValue),
    getSPYTrendSignal(inputs.spyTrend),
    getSPYMA200Signal(inputs.spyAboveMA200),
    getADXSignal(inputs.adxValue, inputs.adxDirection, inputs.adx),
    getRSISignal(inputs.rsi),
    getOptionsFlowSignal(inputs.pcRatio),
    getSectorSignal(inputs.sectorMomentum),
    getEarningsSignal(inputs.daysToEarnings),
    getChopSignal(inputs.chopIndex),
  ].filter((s): s is Signal => s !== null);

  // Calculate metrics
  const conflictScore = calculateConflictScore(signals);
  const netStrength = calculateNetStrength(signals);
  const netDirection = getNetDirection(netStrength);
  const conflicts = findConflictPairs(signals);

  // Determine if too conflicted to trade
  // High conflict (> 60) OR many high-severity conflicts
  const highSeverityConflicts = conflicts.filter((c) => c.severity === 'HIGH');
  const isTooConflicted =
    conflictScore > 60 || highSeverityConflicts.length >= 2;

  // Generate summary
  let summary: string;
  if (isTooConflicted) {
    summary =
      `High signal conflict (${conflictScore}%). ` +
      `${highSeverityConflicts.length} major conflicts detected. ` +
      `Avoid new entries.`;
  } else if (conflictScore > 40) {
    summary =
      `Moderate conflict (${conflictScore}%). ` +
      `Net ${netDirection.toLowerCase()} bias (${netStrength > 0 ? '+' : ''}${netStrength}). ` +
      `Reduce position size.`;
  } else {
    summary =
      `Low conflict (${conflictScore}%). ` +
      `Clear ${netDirection.toLowerCase()} signal (${netStrength > 0 ? '+' : ''}${netStrength}). ` +
      `Normal trading conditions.`;
  }

  return {
    conflictScore,
    netDirection,
    netStrength,
    signals,
    conflicts,
    isTooConflicted,
    summary,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  analyzeSignalConflicts,
  SIGNAL_WEIGHTS,
};
