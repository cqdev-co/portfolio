import type { Signal, QuoteSummary } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';

interface AnalystResult {
  score: number;
  signals: Signal[];
  upsidePotential: number;
}

/**
 * Check price target upside with GRADUATED scoring
 * >= 25% upside: full points (8)
 * >= 15% upside: partial points (5)
 * >= 10% upside: small points (3)
 */
function checkPriceTargetUpside(
  summary: QuoteSummary,
  thresholds = defaultThresholds.analyst
): { signal: Signal | null; upside: number } {
  const currentPrice = summary.financialData?.currentPrice?.raw;
  const targetPrice = summary.financialData?.targetMeanPrice?.raw;

  if (!currentPrice || !targetPrice || currentPrice <= 0) {
    return { signal: null, upside: 0 };
  }

  const upside = (targetPrice - currentPrice) / currentPrice;

  // High upside: >= 25% (full points)
  if (upside >= thresholds.minUpsidePercent) {
    return {
      signal: {
        name: 'High Upside Potential',
        category: 'analyst',
        points: defaultWeights.analyst.highUpside,
        description:
          `Target $${targetPrice.toFixed(0)} ` +
          `(+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  // Moderate upside: >= 15% (partial points)
  if (upside >= 0.15) {
    return {
      signal: {
        name: 'Moderate Upside',
        category: 'analyst',
        points: 5,
        description:
          `Target $${targetPrice.toFixed(0)} ` +
          `(+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  // Small upside: >= 10% (small points)
  if (upside >= 0.1) {
    return {
      signal: {
        name: 'Some Upside',
        category: 'analyst',
        points: 3,
        description:
          `Target $${targetPrice.toFixed(0)} ` +
          `(+${(upside * 100).toFixed(0)}% upside)`,
        value: upside,
      },
      upside,
    };
  }

  return { signal: null, upside };
}

/**
 * Check recent analyst upgrades
 */
function checkRecentUpgrades(
  summary: QuoteSummary,
  thresholds = defaultThresholds.analyst
): Signal | null {
  const history = summary.upgradeDowngradeHistory?.history;

  if (!history || history.length === 0) return null;

  // epochGradeDate can be a Date object or epoch number
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - thresholds.revisionsTrendDays);
  const cutoffMs = cutoffDate.getTime();

  // Helper to check if a grade date is recent
  const isRecent = (epochGradeDate: Date | number | undefined): boolean => {
    if (!epochGradeDate) return false;
    // Handle Date object or epoch number (seconds or ms)
    const dateMs =
      epochGradeDate instanceof Date
        ? epochGradeDate.getTime()
        : epochGradeDate > 1e12
          ? epochGradeDate
          : epochGradeDate * 1000;
    return dateMs > cutoffMs;
  };

  // Count upgrades in the last N days
  // Yahoo Finance action values: "up", "down", "init", "main", "reit"
  const recentUpgrades = history.filter((h) => {
    return (
      isRecent(h.epochGradeDate) &&
      (h.action === 'up' || h.action === 'upgrade')
    );
  });

  const recentDowngrades = history.filter((h) => {
    return (
      isRecent(h.epochGradeDate) &&
      (h.action === 'down' || h.action === 'downgrade')
    );
  });

  // Also count initiations separately (new coverage is generally bullish)
  const recentInitiations = history.filter((h) => {
    return (
      isRecent(h.epochGradeDate) &&
      (h.action === 'init' || h.action === 'initiated')
    );
  });

  const netUpgrades = recentUpgrades.length - recentDowngrades.length;

  // Strong upgrade momentum
  if (netUpgrades >= thresholds.recentUpgradesMin) {
    return {
      name: 'Recent Upgrades',
      category: 'analyst',
      points: defaultWeights.analyst.recentUpgrades,
      description: `${recentUpgrades.length} up vs ${recentDowngrades.length} down (net +${netUpgrades})`,
      value: netUpgrades,
    };
  }

  // New analyst coverage (initiations indicate interest)
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

/**
 * Check recommendation trend (buy/sell ratio)
 * v1.7.1: Relaxed thresholds to catch more valid consensus signals
 */
function checkRecommendationTrend(summary: QuoteSummary): Signal | null {
  const trends = summary.recommendationTrend?.trend;

  if (!trends || trends.length === 0) return null;

  // Get most recent period
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

  // Strong buy consensus (relaxed: 70%+ bullish with at least 3 analysts)
  // Old: bullish > bearish * 3 AND bullish >= 5 (too strict)
  // New: 70%+ bullish AND at least 3 bullish ratings
  if (bullishRatio >= 0.7 && bullish >= 3) {
    return {
      name: 'Strong Buy Consensus',
      category: 'analyst',
      points: 5,
      description: `${bullish} Buy vs ${bearish} Sell (${(bullishRatio * 100).toFixed(0)}% bullish)`,
      value: bullishRatio,
    };
  }

  // Moderate buy consensus (60%+ bullish with at least 4 analysts)
  if (bullishRatio >= 0.6 && bullish >= 4) {
    return {
      name: 'Buy Consensus',
      category: 'analyst',
      points: 3,
      description: `${bullish} Buy vs ${bearish} Sell (${(bullishRatio * 100).toFixed(0)}% bullish)`,
      value: bullishRatio,
    };
  }

  // Mixed but leaning bullish (more buys than sells with decent coverage)
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

/**
 * Check earnings estimate revisions trend
 */
function checkEarningsRevisions(summary: QuoteSummary): Signal | null {
  const trends = summary.earningsTrend?.trend;

  if (!trends || trends.length === 0) return null;

  // Look for positive growth estimates
  const currentQuarter = trends.find((t) => t.period === '0q');
  const nextQuarter = trends.find((t) => t.period === '+1q');

  if (!currentQuarter?.growth?.raw && !nextQuarter?.growth?.raw) {
    return null;
  }

  const currentGrowth = currentQuarter?.growth?.raw ?? 0;
  const nextGrowth = nextQuarter?.growth?.raw ?? 0;

  // Positive earnings growth expected
  if (currentGrowth > 0.05 || nextGrowth > 0.05) {
    return {
      name: 'Positive Earnings Outlook',
      category: 'analyst',
      points: defaultWeights.analyst.positiveRevisions,
      description:
        `Expected EPS growth: ` +
        `${(Math.max(currentGrowth, nextGrowth) * 100).toFixed(0)}%`,
      value: Math.max(currentGrowth, nextGrowth),
    };
  }

  return null;
}

/**
 * Check analyst coverage (more coverage = more reliable signals)
 */
function checkAnalystCoverage(summary: QuoteSummary): Signal | null {
  const numAnalysts = summary.financialData?.numberOfAnalystOpinions?.raw;

  if (!numAnalysts) return null;

  // High analyst coverage
  if (numAnalysts >= 20) {
    return {
      name: 'High Analyst Coverage',
      category: 'analyst',
      points: 2, // Small bonus
      description: `${numAnalysts} analysts covering`,
      value: numAnalysts,
    };
  }

  return null;
}

/**
 * Calculate all analyst signals for a stock
 */
export function calculateAnalystSignals(summary: QuoteSummary): AnalystResult {
  const signals: Signal[] = [];
  let score = 0;
  let upsidePotential = 0;

  // Check price target upside (also captures upside potential)
  const { signal: upsideSignal, upside } = checkPriceTargetUpside(summary);
  upsidePotential = upside;
  if (upsideSignal) {
    signals.push(upsideSignal);
    score += upsideSignal.points;
  }

  // Check recent upgrades
  const upgradesSignal = checkRecentUpgrades(summary);
  if (upgradesSignal) {
    signals.push(upgradesSignal);
    score += upgradesSignal.points;
  }

  // Check recommendation trend
  const trendSignal = checkRecommendationTrend(summary);
  if (trendSignal) {
    signals.push(trendSignal);
    score += trendSignal.points;
  }

  // Check earnings revisions
  const revisionsSignal = checkEarningsRevisions(summary);
  if (revisionsSignal) {
    signals.push(revisionsSignal);
    score += revisionsSignal.points;
  }

  // Check analyst coverage
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
