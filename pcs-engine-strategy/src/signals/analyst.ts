/**
 * PCS Analyst Signal Detection
 *
 * Uses shared analyst check functions from @portfolio/providers.
 * Slightly lower weight than CDS (15 pts max vs 20).
 * PCS doesn't need strong directional conviction from analysts.
 */

import type { Signal, QuoteSummary } from '../types/index.ts';
import { defaultThresholds } from '../config/thresholds.ts';
import {
  checkPriceTargetUpside,
  checkRecommendationTrend,
  checkEarningsRevisions,
} from '@portfolio/providers';

interface AnalystResult {
  score: number;
  signals: Signal[];
}

export function calculateAnalystSignals(
  summary: QuoteSummary | null
): AnalystResult {
  const signals: Signal[] = [];

  if (!summary) return { score: 0, signals: [] };

  // PCS-specific weights (lower than CDS)
  const thresholds = {
    minUpsidePercent: defaultThresholds.analyst.minUpsidePercent,
    recentUpgradesMin: defaultThresholds.analyst.recentUpgradesMin,
    revisionsTrendDays: defaultThresholds.analyst.revisionsTrendDays,
  };

  const weights = {
    highUpside: 6,
    recentUpgrades: 5,
    positiveRevisions: 4,
  };

  // Price target upside (shared)
  const { signal: upsideSignal } = checkPriceTargetUpside(
    summary,
    thresholds,
    weights
  );
  if (upsideSignal) signals.push(upsideSignal);

  // Recommendation trend (shared)
  const trendSignal = checkRecommendationTrend(summary);
  if (trendSignal) signals.push(trendSignal);

  // Earnings revisions (shared)
  const revisionsSignal = checkEarningsRevisions(summary, weights);
  if (revisionsSignal) signals.push(revisionsSignal);

  const totalScore = signals.reduce((sum, s) => sum + s.points, 0);
  return {
    score: Math.min(totalScore, 15),
    signals,
  };
}
