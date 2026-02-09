/**
 * Shared Technical Signal Helpers
 *
 * Strategy-agnostic technical analysis functions used by both CDS and PCS engines.
 * Each engine imports these and combines them with its own strategy-specific signals.
 */

import { SMA, MACD, OBV } from 'technicalindicators';
import type { Signal, QuoteData } from '../types.ts';

// ============================================================================
// GENERIC TECHNICAL SIGNAL FUNCTIONS
// ============================================================================

/**
 * Check for Golden Cross (50 SMA > 200 SMA)
 * Bullish structure signal used by all engines.
 */
export function checkGoldenCross(
  closes: number[],
  points: number = 10
): Signal | null {
  if (closes.length < 200) return null;

  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const sma200 = SMA.calculate({ values: closes, period: 200 });

  const currentSMA50 = sma50[sma50.length - 1];
  const currentSMA200 = sma200[sma200.length - 1];
  const prevSMA50 = sma50[sma50.length - 2];
  const prevSMA200 = sma200[sma200.length - 2];

  if (
    currentSMA50 === undefined ||
    currentSMA200 === undefined ||
    prevSMA50 === undefined ||
    prevSMA200 === undefined
  )
    return null;

  // Recent golden cross (within last few days)
  if (currentSMA50 > currentSMA200 && prevSMA50 <= prevSMA200) {
    return {
      name: 'Golden Cross',
      category: 'technical',
      points,
      description: '50 SMA crossed above 200 SMA',
      value: true,
    };
  }

  // Already in golden cross territory
  if (currentSMA50 > currentSMA200) {
    return {
      name: 'Golden Cross Active',
      category: 'technical',
      points: Math.floor(points * 0.6),
      description: '50 SMA above 200 SMA (bullish structure)',
      value: currentSMA200,
    };
  }

  return null;
}

/**
 * Check for volume surge relative to 10-day average.
 */
export function checkVolumeSurge(
  quote: QuoteData,
  multiplierThreshold: number = 1.5,
  points: number = 5
): Signal | null {
  if (!quote.regularMarketVolume || !quote.averageDailyVolume10Day) return null;

  const ratio = quote.regularMarketVolume / quote.averageDailyVolume10Day;
  if (ratio >= multiplierThreshold) {
    return {
      name: 'Volume Surge',
      category: 'technical',
      points,
      description: `Volume ${ratio.toFixed(1)}x avg (${(quote.regularMarketVolume / 1_000_000).toFixed(1)}M)`,
      value: ratio,
    };
  }

  return null;
}

/**
 * Check OBV (On-Balance Volume) trend.
 */
export function checkOBVTrend(
  closes: number[],
  volumes: number[],
  points: number = 5
): Signal | null {
  if (closes.length < 20 || volumes.length < 20) return null;

  const obvResult = OBV.calculate({ close: closes, volume: volumes });
  if (obvResult.length < 10) return null;

  const recent = obvResult.slice(-5);
  const previous = obvResult.slice(-10, -5);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;

  if (recentAvg > prevAvg * 1.05) {
    return {
      name: 'OBV Uptrend',
      category: 'technical',
      points,
      description: 'On-Balance Volume trending higher',
      value: true,
    };
  }

  return null;
}

/**
 * Check MACD for bullish signals.
 */
export function checkMACD(closes: number[]): Signal | null {
  if (closes.length < 35) return null;

  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  if (macdResult.length < 2) return null;

  const current = macdResult[macdResult.length - 1];
  const previous = macdResult[macdResult.length - 2];

  if (
    !current?.MACD ||
    !current?.signal ||
    !previous?.MACD ||
    !previous?.signal
  )
    return null;

  // Bullish crossover
  if (current.MACD > current.signal && previous.MACD <= previous.signal) {
    return {
      name: 'MACD Bullish',
      category: 'technical',
      points: 5,
      description: 'MACD crossed above signal line',
      value: true,
    };
  }

  // MACD above signal (continuation)
  if (current.MACD > current.signal && current.MACD > 0) {
    return {
      name: 'MACD Positive',
      category: 'technical',
      points: 3,
      description: 'MACD above signal and positive',
      value: current.MACD,
    };
  }

  return null;
}

/**
 * Signal group caps to prevent excessive scoring from related signals.
 * Shared across all engines.
 */
export const SIGNAL_GROUP_CAPS: Record<
  string,
  { keywords: string[]; maxPoints: number }
> = {
  movingAverage: {
    keywords: ['ma', 'golden', 'sma', 'moving average'],
    maxPoints: 15,
  },
  momentum: {
    keywords: ['rsi', 'macd', 'obv'],
    maxPoints: 12,
  },
  pricePosition: {
    keywords: ['52-week', 'support', 'bollinger', 'bb'],
    maxPoints: 12,
  },
  pullback: {
    keywords: ['pullback', 'pulled back'],
    maxPoints: 15,
  },
  recovery: {
    keywords: ['reclaim', 'recovery', 'recovering'],
    maxPoints: 10,
  },
};

/**
 * Apply signal group caps to prevent related signals from stacking excessively.
 */
export function applySignalGroupCaps(
  signals: Signal[],
  groupCaps: Record<
    string,
    { keywords: string[]; maxPoints: number }
  > = SIGNAL_GROUP_CAPS
): number {
  let totalScore = 0;
  const groupScores: Record<string, number> = {};

  for (const group of Object.keys(groupCaps)) {
    groupScores[group] = 0;
  }

  for (const signal of signals) {
    const signalNameLower = signal.name.toLowerCase();
    let assignedToGroup = false;

    for (const [groupName, config] of Object.entries(groupCaps)) {
      const belongsToGroup = config.keywords.some((kw) =>
        signalNameLower.includes(kw)
      );

      if (belongsToGroup) {
        const currentGroupScore = groupScores[groupName] ?? 0;
        const pointsToAdd = Math.min(
          signal.points,
          config.maxPoints - currentGroupScore
        );
        groupScores[groupName] = currentGroupScore + pointsToAdd;
        totalScore += pointsToAdd;
        assignedToGroup = true;
        break;
      }
    }

    if (!assignedToGroup) {
      totalScore += signal.points;
    }
  }

  return totalScore;
}
