/**
 * CDS Analyst Signal Detection
 *
 * Uses shared analyst check functions from @portfolio/providers,
 * combined with CDS-specific thresholds/weights.
 *
 * Max: 20 points
 */

import type { QuoteSummary } from '../types/index.ts';
import type { Signal } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';
import {
  checkPriceTargetUpside,
  checkRecentUpgrades,
  checkRecommendationTrend,
  checkEarningsRevisions,
  checkAnalystCoverage,
} from '@portfolio/providers';

interface AnalystResult {
  score: number;
  signals: Signal[];
  upsidePotential: number;
}

/**
 * Calculate all analyst signals for a stock
 * Uses shared check functions with CDS-specific thresholds
 */
export function calculateAnalystSignals(summary: QuoteSummary): AnalystResult {
  const signals: Signal[] = [];
  let score = 0;
  let upsidePotential = 0;

  // Build CDS-specific thresholds and weights
  const thresholds = {
    minUpsidePercent: defaultThresholds.analyst.minUpsidePercent,
    recentUpgradesMin: defaultThresholds.analyst.recentUpgradesMin,
    revisionsTrendDays: defaultThresholds.analyst.revisionsTrendDays,
  };

  const weights = {
    highUpside: defaultWeights.analyst.highUpside,
    recentUpgrades: defaultWeights.analyst.recentUpgrades,
    positiveRevisions: defaultWeights.analyst.positiveRevisions,
  };

  // Price target upside (shared)
  const { signal: upsideSignal, upside } = checkPriceTargetUpside(
    summary,
    thresholds,
    weights
  );
  upsidePotential = upside;
  if (upsideSignal) {
    signals.push(upsideSignal);
    score += upsideSignal.points;
  }

  // Recent upgrades (shared)
  const upgradesSignal = checkRecentUpgrades(summary, thresholds, weights);
  if (upgradesSignal) {
    signals.push(upgradesSignal);
    score += upgradesSignal.points;
  }

  // Recommendation trend (shared)
  const trendSignal = checkRecommendationTrend(summary);
  if (trendSignal) {
    signals.push(trendSignal);
    score += trendSignal.points;
  }

  // Earnings revisions (shared)
  const revisionsSignal = checkEarningsRevisions(summary, weights);
  if (revisionsSignal) {
    signals.push(revisionsSignal);
    score += revisionsSignal.points;
  }

  // Analyst coverage (shared)
  const coverageSignal = checkAnalystCoverage(summary);
  if (coverageSignal) {
    signals.push(coverageSignal);
    score += coverageSignal.points;
  }

  // Cap at 20 points
  return {
    score: Math.min(score, 20),
    signals,
    upsidePotential,
  };
}
