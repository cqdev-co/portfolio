/**
 * IV (Implied Volatility) Analysis Signal
 *
 * NEW for PCS - Critical signal that doesn't exist in CDS.
 * For credit selling, elevated IV means more premium collected.
 *
 * IV Rank measures current IV relative to its range over the past year:
 * - IV Rank > 30: +5 pts (premium is elevated)
 * - IV Rank > 50: +12 pts (very favorable for selling)
 * - IV Rank > 70: +8 pts (extreme IV may signal danger)
 *
 * Also tracks ATM IV from options chain for absolute IV assessment.
 */

import type { Signal } from '../types/index.ts';
import { defaultWeights } from '../config/thresholds.ts';

interface IVAnalysisResult {
  score: number;
  signals: Signal[];
  ivRank: number | null;
  atmIV: number | null;
}

/**
 * Calculate IV Rank from historical volatility data
 *
 * IV Rank = (Current IV - 52-week Low IV) / (52-week High IV - 52-week Low IV)
 *
 * When we don't have historical IV data, we estimate from:
 * - ATM option IV from the options chain
 * - Historical realized volatility as a proxy
 */
export function estimateIVRank(
  atmIV: number | null,
  historicalCloses: number[]
): number | null {
  if (atmIV === null || atmIV === undefined) return null;

  // Calculate 30-day realized volatility as a baseline
  if (historicalCloses.length < 60) return null;

  const returns: number[] = [];
  for (let i = 1; i < historicalCloses.length; i++) {
    const prev = historicalCloses[i - 1];
    const curr = historicalCloses[i];
    if (prev && curr && prev > 0) {
      returns.push(Math.log(curr / prev));
    }
  }

  if (returns.length < 30) return null;

  // Calculate rolling 30-day realized vol over past year
  const rollingVols: number[] = [];
  for (let i = 29; i < returns.length; i++) {
    const window = returns.slice(i - 29, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance =
      window.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (window.length - 1);
    const annualizedVol = Math.sqrt(variance * 252);
    rollingVols.push(annualizedVol);
  }

  if (rollingVols.length < 10) return null;

  const minVol = Math.min(...rollingVols);
  const maxVol = Math.max(...rollingVols);

  if (maxVol - minVol < 0.01) return 50; // Flat vol = middle rank

  // IV Rank: where does current ATM IV fall in the historical range?
  const ivRank = ((atmIV - minVol) / (maxVol - minVol)) * 100;
  return Math.max(0, Math.min(100, Math.round(ivRank)));
}

/**
 * Score IV conditions for PCS strategy
 */
export function calculateIVSignals(
  ivRank: number | null,
  atmIV: number | null
): IVAnalysisResult {
  const signals: Signal[] = [];
  let score = 0;

  if (ivRank === null) {
    return { score: 0, signals: [], ivRank: null, atmIV };
  }

  // IV Rank scoring (INVERTED from CDS - higher = better for PCS)
  if (ivRank >= 50) {
    // Sweet spot: IV elevated enough for good premium
    const pts = defaultWeights.iv.elevatedIV;
    score += pts;
    signals.push({
      name: 'IV Rank Elevated',
      category: 'technical',
      points: pts,
      description: `IV Rank ${ivRank}% — excellent premium for selling`,
      value: ivRank,
    });
  } else if (ivRank >= 30) {
    // Acceptable: decent premium
    const pts = defaultWeights.iv.highIV;
    score += pts;
    signals.push({
      name: 'IV Rank Moderate',
      category: 'technical',
      points: pts,
      description: `IV Rank ${ivRank}% — decent premium for selling`,
      value: ivRank,
    });
  } else if (ivRank >= 15) {
    // Low IV: minimal premium, not ideal
    score += 3;
    signals.push({
      name: 'IV Rank Low',
      category: 'technical',
      points: 3,
      description: `IV Rank ${ivRank}% — low premium, consider waiting`,
      value: ivRank,
    });
  } else {
    // Very low IV: poor for credit selling
    signals.push({
      name: 'IV Rank Very Low',
      category: 'technical',
      points: 0,
      description: `IV Rank ${ivRank}% — insufficient premium for PCS`,
      value: ivRank,
    });
  }

  // Warning for extreme IV (>80) - may signal upcoming event
  if (ivRank > 80) {
    signals.push({
      name: 'IV Extreme Warning',
      category: 'technical',
      points: 0,
      description: `IV Rank ${ivRank}% — extreme IV, check for upcoming events`,
      value: ivRank,
    });
  }

  // ATM IV absolute level assessment
  if (atmIV !== null) {
    if (atmIV > 0.5) {
      signals.push({
        name: 'High ATM IV',
        category: 'technical',
        points: 3,
        description: `ATM IV ${(atmIV * 100).toFixed(0)}% — rich premium`,
        value: atmIV,
      });
      score += 3;
    } else if (atmIV > 0.3) {
      signals.push({
        name: 'Moderate ATM IV',
        category: 'technical',
        points: 2,
        description: `ATM IV ${(atmIV * 100).toFixed(0)}% — adequate premium`,
        value: atmIV,
      });
      score += 2;
    }
  }

  // Cap IV score at 20
  return {
    score: Math.min(score, 20),
    signals,
    ivRank,
    atmIV,
  };
}
