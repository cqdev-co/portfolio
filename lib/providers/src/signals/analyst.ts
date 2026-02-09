/**
 * Shared Analyst Signal Detection
 *
 * Strategy-agnostic analyst signal functions.
 * Each engine calls these with its own score cap and thresholds.
 */

import type { QuoteSummary, Signal } from '../types.ts';

// ============================================================================
// THRESHOLDS (defaults, can be overridden per engine)
// ============================================================================

export interface AnalystThresholds {
  minUpsidePercent: number;
  recentUpgradesMin: number;
  revisionsTrendDays: number;
}

export const DEFAULT_ANALYST_THRESHOLDS: AnalystThresholds = {
  minUpsidePercent: 0.25,
  recentUpgradesMin: 2,
  revisionsTrendDays: 90,
};

export interface AnalystWeights {
  highUpside: number;
  recentUpgrades: number;
  positiveRevisions: number;
}

export const DEFAULT_ANALYST_WEIGHTS: AnalystWeights = {
  highUpside: 8,
  recentUpgrades: 7,
  positiveRevisions: 5,
};

// ============================================================================
// INDIVIDUAL CHECK FUNCTIONS
// ============================================================================

export function checkPriceTargetUpside(
  summary: QuoteSummary,
  thresholds = DEFAULT_ANALYST_THRESHOLDS,
  weights = DEFAULT_ANALYST_WEIGHTS
): { signal: Signal | null; upside: number } {
  const currentPrice = summary.financialData?.currentPrice?.raw;
  const targetPrice = summary.financialData?.targetMeanPrice?.raw;

  if (!currentPrice || !targetPrice || currentPrice <= 0)
    return { signal: null, upside: 0 };

  const upside = (targetPrice - currentPrice) / currentPrice;

  if (upside >= thresholds.minUpsidePercent) {
    return {
      signal: {
        name: 'High Upside Potential',
        category: 'analyst',
        points: weights.highUpside,
        description: `Target $${targetPrice.toFixed(0)} (+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  if (upside >= 0.15) {
    return {
      signal: {
        name: 'Moderate Upside',
        category: 'analyst',
        points: 5,
        description: `Target $${targetPrice.toFixed(0)} (+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  if (upside >= 0.1) {
    return {
      signal: {
        name: 'Some Upside',
        category: 'analyst',
        points: 3,
        description: `Target $${targetPrice.toFixed(0)} (+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  return { signal: null, upside };
}

export function checkRecentUpgrades(
  summary: QuoteSummary,
  thresholds = DEFAULT_ANALYST_THRESHOLDS,
  weights = DEFAULT_ANALYST_WEIGHTS
): Signal | null {
  const history = summary.upgradeDowngradeHistory?.history;
  if (!history || history.length === 0) return null;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholds.revisionsTrendDays);
  const cutoffMs = cutoffDate.getTime();

  const isRecent = (epochGradeDate: Date | number | undefined): boolean => {
    if (!epochGradeDate) return false;
    const dateMs =
      epochGradeDate instanceof Date
        ? epochGradeDate.getTime()
        : epochGradeDate > 1e12
          ? epochGradeDate
          : epochGradeDate * 1000;
    return dateMs > cutoffMs;
  };

  const recentUpgrades = history.filter(
    (h) =>
      isRecent(h.epochGradeDate) &&
      (h.action === 'up' || h.action === 'upgrade')
  );
  const recentDowngrades = history.filter(
    (h) =>
      isRecent(h.epochGradeDate) &&
      (h.action === 'down' || h.action === 'downgrade')
  );
  const recentInitiations = history.filter(
    (h) =>
      isRecent(h.epochGradeDate) &&
      (h.action === 'init' || h.action === 'initiated')
  );

  const netUpgrades = recentUpgrades.length - recentDowngrades.length;

  if (netUpgrades >= thresholds.recentUpgradesMin) {
    return {
      name: 'Recent Upgrades',
      category: 'analyst',
      points: weights.recentUpgrades,
      description: `${recentUpgrades.length} up vs ${recentDowngrades.length} down (net +${netUpgrades})`,
      value: netUpgrades,
    };
  }

  if (recentInitiations.length >= 3) {
    return {
      name: 'New Analyst Coverage',
      category: 'analyst',
      points: 3,
      description: `${recentInitiations.length} analysts initiated coverage`,
      value: recentInitiations.length,
    };
  }

  return null;
}

export function checkRecommendationTrend(summary: QuoteSummary): Signal | null {
  const trends = summary.recommendationTrend?.trend;
  if (!trends || trends.length === 0) return null;

  const current = trends[0];
  if (!current) return null;

  const strongBuy = current.strongBuy ?? 0;
  const buy = current.buy ?? 0;
  const hold = current.hold ?? 0;
  const sell = current.sell ?? 0;
  const strongSell = current.strongSell ?? 0;
  const totalAnalysts = strongBuy + buy + hold + sell + strongSell;
  if (totalAnalysts === 0) return null;

  const bullish = strongBuy + buy;
  const bearish = sell + strongSell;
  const bullishRatio = bullish / totalAnalysts;

  if (bullishRatio >= 0.7 && bullish >= 3) {
    return {
      name: 'Strong Buy Consensus',
      category: 'analyst',
      points: 5,
      description: `${bullish} Buy vs ${bearish} Sell (${(bullishRatio * 100).toFixed(0)}% bullish)`,
      value: bullishRatio,
    };
  }

  if (bullishRatio >= 0.6 && bullish >= 4) {
    return {
      name: 'Buy Consensus',
      category: 'analyst',
      points: 3,
      description: `${bullish} Buy vs ${bearish} Sell (${(bullishRatio * 100).toFixed(0)}% bullish)`,
      value: bullishRatio,
    };
  }

  if (bullish > bearish && totalAnalysts >= 5 && bullishRatio >= 0.45) {
    return {
      name: 'Leaning Bullish',
      category: 'analyst',
      points: 2,
      description: `${bullish} Buy vs ${bearish} Sell, ${hold} Hold`,
      value: bullishRatio,
    };
  }

  return null;
}

export function checkEarningsRevisions(
  summary: QuoteSummary,
  weights = DEFAULT_ANALYST_WEIGHTS
): Signal | null {
  const trends = summary.earningsTrend?.trend;
  if (!trends || trends.length === 0) return null;

  const currentQuarter = trends.find((t) => t.period === '0q');
  const nextQuarter = trends.find((t) => t.period === '+1q');

  if (!currentQuarter?.growth?.raw && !nextQuarter?.growth?.raw) return null;

  const currentGrowth = currentQuarter?.growth?.raw ?? 0;
  const nextGrowth = nextQuarter?.growth?.raw ?? 0;

  if (currentGrowth > 0.05 || nextGrowth > 0.05) {
    return {
      name: 'Positive Earnings Outlook',
      category: 'analyst',
      points: weights.positiveRevisions,
      description: `Expected EPS growth: ${(Math.max(currentGrowth, nextGrowth) * 100).toFixed(0)}%`,
      value: Math.max(currentGrowth, nextGrowth),
    };
  }

  return null;
}

export function checkAnalystCoverage(summary: QuoteSummary): Signal | null {
  const numAnalysts = summary.financialData?.numberOfAnalystOpinions?.raw;
  if (!numAnalysts) return null;

  if (numAnalysts >= 20) {
    return {
      name: 'High Analyst Coverage',
      category: 'analyst',
      points: 2,
      description: `${numAnalysts} analysts covering`,
      value: numAnalysts,
    };
  }

  return null;
}
