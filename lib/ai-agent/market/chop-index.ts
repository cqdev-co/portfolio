/**
 * Chop Index Calculator
 *
 * The Chop Index is a volatility indicator that determines whether
 * the market is trending or trading sideways (choppy/consolidating).
 *
 * Formula: 100 * LOG10(SUM(ATR, n) / (Highest High - Lowest Low)) / LOG10(n)
 *
 * Interpretation:
 * - > 61.8: Choppy/consolidating market - AVOID trading
 * - < 38.2: Trending market - GOOD for trading
 * - 38.2-61.8: Transitional - CAUTION
 *
 * The 61.8 and 38.2 thresholds are derived from Fibonacci ratios.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ChopAnalysis {
  /** Chop Index value (0-100) */
  value: number;
  /** Interpretation of the value */
  level: 'TRENDING' | 'TRANSITIONAL' | 'CHOPPY';
  /** Human-readable description */
  description: string;
  /** Whether conditions favor trading */
  favorsTrending: boolean;
}

export interface ATRData {
  /** Current ATR value */
  current: number;
  /** ATR as percentage of price */
  percent: number;
  /** Whether ATR is expanding (volatility increasing) */
  expanding: boolean;
}

// ============================================================================
// ATR CALCULATION
// ============================================================================

/**
 * Calculate True Range for a single bar
 */
function calculateTrueRange(
  high: number,
  low: number,
  prevClose: number
): number {
  return Math.max(
    high - low,
    Math.abs(high - prevClose),
    Math.abs(low - prevClose)
  );
}

/**
 * Calculate Average True Range (ATR)
 *
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of close prices
 * @param period - Lookback period (default 14)
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number | null {
  if (
    highs.length < period + 1 ||
    lows.length < period + 1 ||
    closes.length < period + 1
  ) {
    return null;
  }

  const trueRanges: number[] = [];

  // Calculate True Range for each bar (starting from index 1)
  for (let i = 1; i < closes.length; i++) {
    const tr = calculateTrueRange(highs[i], lows[i], closes[i - 1]);
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return null;

  // Use Wilder's smoothing method for ATR
  // First ATR is simple average
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Subsequent values use smoothing
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return Math.round(atr * 100) / 100;
}

/**
 * Get ATR analysis with context
 */
export function getATRAnalysis(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ATRData | null {
  const currentATR = calculateATR(highs, lows, closes, period);
  if (!currentATR) return null;

  const currentPrice = closes[closes.length - 1];
  const atrPercent = (currentATR / currentPrice) * 100;

  // Calculate ATR from 5 bars ago to check if expanding
  const olderCloses = closes.slice(0, -5);
  const olderHighs = highs.slice(0, -5);
  const olderLows = lows.slice(0, -5);
  const olderATR = calculateATR(olderHighs, olderLows, olderCloses, period);

  const expanding = olderATR ? currentATR > olderATR * 1.1 : false;

  return {
    current: currentATR,
    percent: Math.round(atrPercent * 100) / 100,
    expanding,
  };
}

// ============================================================================
// CHOP INDEX CALCULATION
// ============================================================================

/**
 * Calculate Chop Index
 *
 * Formula: 100 * LOG10(SUM(ATR, n) / (HH - LL)) / LOG10(n)
 *
 * Where:
 * - SUM(ATR, n) = Sum of ATR over n periods
 * - HH = Highest High over n periods
 * - LL = Lowest Low over n periods
 *
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of close prices
 * @param period - Lookback period (default 14)
 */
export function calculateChopIndex(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number | null {
  if (
    highs.length < period + 1 ||
    lows.length < period + 1 ||
    closes.length < period + 1
  ) {
    return null;
  }

  // Get recent data for the period
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);

  // Calculate True Ranges
  const trueRanges: number[] = [];
  for (let i = 1; i <= period; i++) {
    const idx = closes.length - period - 1 + i;
    if (idx > 0 && idx < closes.length) {
      const tr = calculateTrueRange(highs[idx], lows[idx], closes[idx - 1]);
      trueRanges.push(tr);
    }
  }

  if (trueRanges.length < period - 1) return null;

  // Sum of ATR over period
  const atrSum = trueRanges.reduce((a, b) => a + b, 0);

  // Highest High and Lowest Low over period
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const range = highestHigh - lowestLow;

  // Avoid division by zero
  if (range === 0) return 50;

  // Chop Index formula
  const chopIndex = (100 * Math.log10(atrSum / range)) / Math.log10(period);

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, Math.round(chopIndex * 10) / 10));
}

/**
 * Get full Chop Index analysis with interpretation
 */
export function getChopAnalysis(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ChopAnalysis | null {
  const value = calculateChopIndex(highs, lows, closes, period);
  if (value === null) return null;

  // Fibonacci-based thresholds
  const TRENDING_THRESHOLD = 38.2;
  const CHOPPY_THRESHOLD = 61.8;

  let level: ChopAnalysis['level'];
  let description: string;
  let favorsTrending: boolean;

  if (value < TRENDING_THRESHOLD) {
    level = 'TRENDING';
    description = 'Strong trend in progress - favorable for momentum trades';
    favorsTrending = true;
  } else if (value > CHOPPY_THRESHOLD) {
    level = 'CHOPPY';
    description = 'Consolidating/sideways market - avoid trend-following';
    favorsTrending = false;
  } else {
    level = 'TRANSITIONAL';
    description = 'Market transitioning - wait for confirmation';
    favorsTrending = false;
  }

  return {
    value,
    level,
    description,
    favorsTrending,
  };
}

// ============================================================================
// DIRECTION REVERSAL DETECTION
// ============================================================================

/**
 * Count direction reversals in recent price action
 * Used to detect whipsaw/choppy conditions
 *
 * @param closes - Array of close prices
 * @param period - Lookback period (default 5)
 * @returns Number of direction changes
 */
export function countDirectionReversals(
  closes: number[],
  period: number = 5
): number {
  if (closes.length < period + 1) return 0;

  const recentCloses = closes.slice(-period - 1);
  let reversals = 0;
  let lastDirection: 'up' | 'down' | null = null;

  for (let i = 1; i < recentCloses.length; i++) {
    const change = recentCloses[i] - recentCloses[i - 1];
    const direction: 'up' | 'down' = change >= 0 ? 'up' : 'down';

    if (lastDirection !== null && direction !== lastDirection) {
      reversals++;
    }
    lastDirection = direction;
  }

  return reversals;
}

/**
 * Check if market is in whipsaw conditions
 * Whipsaw = high reversals + expanding ATR + flat price
 */
export function isWhipsawCondition(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 5
): boolean {
  const reversals = countDirectionReversals(closes, period);
  const atrData = getATRAnalysis(highs, lows, closes);

  // Calculate price range over period
  const recentCloses = closes.slice(-period);
  const priceRange = Math.max(...recentCloses) - Math.min(...recentCloses);
  const avgPrice =
    recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const rangePercent = (priceRange / avgPrice) * 100;

  // Whipsaw: 3+ reversals, ATR expanding, but price range < 3%
  return reversals >= 3 && (atrData?.expanding ?? false) && rangePercent < 3;
}

// ============================================================================
// ADX (AVERAGE DIRECTIONAL INDEX) CALCULATION
// ============================================================================

/**
 * ADX Analysis Result
 */
export interface ADXAnalysis {
  /** ADX value (0-100) */
  adx: number;
  /** +DI (Positive Directional Indicator) */
  plusDI: number;
  /** -DI (Negative Directional Indicator) */
  minusDI: number;
  /** Trend strength interpretation */
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  /** Trend direction based on DI crossover */
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  /** Human-readable description */
  description: string;
  /** Whether ADX is rising (trend strengthening) */
  rising: boolean;
}

/**
 * Calculate ADX (Average Directional Index)
 *
 * ADX measures trend STRENGTH, not direction.
 * - ADX < 20: Weak/no trend (choppy market)
 * - ADX 20-25: Emerging trend
 * - ADX 25-50: Strong trend
 * - ADX 50-75: Very strong trend
 * - ADX > 75: Extremely strong (rare, often precedes reversal)
 *
 * +DI > -DI = Bullish trend
 * -DI > +DI = Bearish trend
 *
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of close prices
 * @param period - Lookback period (default 14)
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): { adx: number; plusDI: number; minusDI: number } | null {
  const minLength = period * 2 + 1;
  if (
    highs.length < minLength ||
    lows.length < minLength ||
    closes.length < minLength
  ) {
    return null;
  }

  // Calculate True Range and Directional Movement for each bar
  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];

    // True Range
    const tr = calculateTrueRange(high, low, prevClose);
    trueRanges.push(tr);

    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    let plusDM = 0;
    let minusDM = 0;

    if (upMove > downMove && upMove > 0) {
      plusDM = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      minusDM = downMove;
    }

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  // Apply Wilder's smoothing to get ATR, +DM, -DM
  // First value is simple average
  let smoothedTR = trueRanges.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedPlusDM = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothedMinusDM = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  // Smooth subsequent values using Wilder's method
  const dxValues: number[] = [];

  for (let i = period; i < trueRanges.length; i++) {
    // Wilder's smoothing: smoothed = prior - (prior/period) + current
    smoothedTR = smoothedTR - smoothedTR / period + trueRanges[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[i];

    // Calculate +DI and -DI
    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

    // Calculate DX
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;

    dxValues.push(dx);
  }

  if (dxValues.length < period) return null;

  // Calculate ADX as smoothed average of DX
  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  // Get final +DI and -DI values
  const finalPlusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
  const finalMinusDI =
    smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

  return {
    adx: Math.round(adx * 10) / 10,
    plusDI: Math.round(finalPlusDI * 10) / 10,
    minusDI: Math.round(finalMinusDI * 10) / 10,
  };
}

/**
 * Get full ADX analysis with interpretation
 */
export function getADXAnalysis(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXAnalysis | null {
  const result = calculateADX(highs, lows, closes, period);
  if (!result) return null;

  const { adx, plusDI, minusDI } = result;

  // Determine trend strength
  let strength: ADXAnalysis['strength'];
  if (adx < 20) {
    strength = 'WEAK';
  } else if (adx < 25) {
    strength = 'MODERATE';
  } else if (adx < 50) {
    strength = 'STRONG';
  } else {
    strength = 'VERY_STRONG';
  }

  // Determine trend direction from DI crossover
  let direction: ADXAnalysis['direction'];
  const diDiff = plusDI - minusDI;
  if (diDiff > 5) {
    direction = 'BULLISH';
  } else if (diDiff < -5) {
    direction = 'BEARISH';
  } else {
    direction = 'NEUTRAL';
  }

  // Check if ADX is rising (calculate from recent values)
  // We'd need historical ADX values for this, so estimate from recent data
  const olderHighs = highs.slice(0, -5);
  const olderLows = lows.slice(0, -5);
  const olderCloses = closes.slice(0, -5);
  const olderResult = calculateADX(olderHighs, olderLows, olderCloses, period);
  const rising = olderResult ? adx > olderResult.adx : false;

  // Generate description
  let description: string;
  if (strength === 'WEAK') {
    description = 'No clear trend - market is choppy/ranging';
  } else if (strength === 'MODERATE') {
    description = `Emerging ${direction.toLowerCase()} trend - wait for confirmation`;
  } else if (strength === 'STRONG') {
    description = `Strong ${direction.toLowerCase()} trend in progress`;
  } else {
    description = `Very strong ${direction.toLowerCase()} trend - watch for exhaustion`;
  }

  if (rising && adx >= 20) {
    description += ' (strengthening)';
  } else if (!rising && adx >= 25) {
    description += ' (weakening)';
  }

  return {
    adx,
    plusDI,
    minusDI,
    strength,
    direction,
    description,
    rising,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  calculateATR,
  getATRAnalysis,
  calculateChopIndex,
  getChopAnalysis,
  countDirectionReversals,
  isWhipsawCondition,
  calculateADX,
  getADXAnalysis,
};
