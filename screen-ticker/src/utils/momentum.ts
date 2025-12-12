/**
 * Momentum Analysis
 * Tracks whether key metrics are improving or deteriorating over time
 */

import type { QuoteSummary, HistoricalData } from "../types/index.ts";

export type MomentumDirection = "improving" | "stable" | "deteriorating";

export interface MomentumSignal {
  name: string;
  direction: MomentumDirection;
  description: string;
  value?: number;
}

export interface MomentumAnalysis {
  signals: MomentumSignal[];
  overallTrend: MomentumDirection;
  summary: string;
}

/**
 * Analyze analyst sentiment momentum
 * Compares current month ratings to 2 months ago
 */
function analyzeAnalystMomentum(summary: QuoteSummary): MomentumSignal | null {
  const trend = summary.recommendationTrend?.trend;
  if (!trend || trend.length < 3) return null;
  
  const current = trend.find(t => t.period === "0m");
  const twoMonthsAgo = trend.find(t => t.period === "-2m");
  
  if (!current || !twoMonthsAgo) return null;
  
  // Calculate bullish ratio (strongBuy + buy) / total
  const currentBulls = (current.strongBuy ?? 0) + (current.buy ?? 0);
  const currentTotal = currentBulls + (current.hold ?? 0) + 
                       (current.sell ?? 0) + (current.strongSell ?? 0);
  
  const pastBulls = (twoMonthsAgo.strongBuy ?? 0) + (twoMonthsAgo.buy ?? 0);
  const pastTotal = pastBulls + (twoMonthsAgo.hold ?? 0) + 
                    (twoMonthsAgo.sell ?? 0) + (twoMonthsAgo.strongSell ?? 0);
  
  if (currentTotal === 0 || pastTotal === 0) return null;
  
  const currentRatio = currentBulls / currentTotal;
  const pastRatio = pastBulls / pastTotal;
  const change = currentRatio - pastRatio;
  
  let direction: MomentumDirection;
  let description: string;
  
  if (change > 0.10) {
    direction = "improving";
    description = `Analyst sentiment improving — ` +
      `${currentBulls} bulls now vs ${pastBulls} two months ago`;
  } else if (change < -0.10) {
    direction = "deteriorating";
    description = `Analyst sentiment weakening — ` +
      `${currentBulls} bulls now vs ${pastBulls} two months ago`;
  } else {
    direction = "stable";
    description = `Analyst sentiment stable — ${currentBulls}/${currentTotal} bullish`;
  }
  
  return {
    name: "Analyst Sentiment",
    direction,
    description,
    value: change,
  };
}

/**
 * Analyze recent upgrade/downgrade momentum
 * Counts upgrades vs downgrades in last 90 days
 */
function analyzeUpgradesMomentum(summary: QuoteSummary): MomentumSignal | null {
  const history = summary.upgradeDowngradeHistory?.history;
  if (!history || history.length === 0) return null;
  
  const cutoffDate = Date.now() - (90 * 24 * 60 * 60 * 1000); // 90 days ago
  
  let upgrades = 0;
  let downgrades = 0;
  let initiations = 0;
  
  for (const h of history) {
    const gradeDate = typeof h.epochGradeDate === 'number' 
      ? h.epochGradeDate * 1000 
      : new Date(h.epochGradeDate).getTime();
    
    if (gradeDate < cutoffDate) break;
    
    if (h.action === "up") upgrades++;
    else if (h.action === "down") downgrades++;
    else if (h.action === "init" || h.action === "initiated") initiations++;
  }
  
  const net = upgrades - downgrades;
  
  let direction: MomentumDirection;
  let description: string;
  
  if (net >= 2) {
    direction = "improving";
    description = `${upgrades} upgrades vs ${downgrades} downgrades (90 days)`;
  } else if (net <= -2) {
    direction = "deteriorating";
    description = `${downgrades} downgrades vs ${upgrades} upgrades (90 days)`;
  } else {
    direction = "stable";
    const initStr = initiations > 0 ? `, ${initiations} initiations` : "";
    description = `${upgrades} up, ${downgrades} down${initStr} (90 days)`;
  }
  
  return {
    name: "Rating Changes",
    direction,
    description,
    value: net,
  };
}

/**
 * Analyze price momentum using rate of change
 * Note: historical data is sorted oldest-first, so we index from the end
 */
function analyzePriceMomentum(
  historical: HistoricalData[],
  currentPrice: number
): MomentumSignal | null {
  if (historical.length < 20) return null;
  
  const len = historical.length;
  
  // 20-day rate of change (index from end: len-20 is 20 days ago)
  const price20dAgo = historical[len - 20]?.close;
  if (!price20dAgo) return null;
  
  const roc20 = ((currentPrice - price20dAgo) / price20dAgo) * 100;
  
  // 50-day rate of change (if available)
  const price50dAgo = len >= 50 ? historical[len - 50]?.close : undefined;
  const roc50 = price50dAgo 
    ? ((currentPrice - price50dAgo) / price50dAgo) * 100 
    : null;
  
  let direction: MomentumDirection;
  let description: string;
  
  // Strong momentum: both 20d and 50d positive/negative
  if (roc20 > 5) {
    direction = "improving";
    description = `20-day: +${roc20.toFixed(1)}%` + 
      (roc50 !== null ? `, 50-day: ${roc50 > 0 ? "+" : ""}${roc50.toFixed(1)}%` : "");
  } else if (roc20 < -5) {
    direction = "deteriorating";
    description = `20-day: ${roc20.toFixed(1)}%` +
      (roc50 !== null ? `, 50-day: ${roc50 > 0 ? "+" : ""}${roc50.toFixed(1)}%` : "");
  } else {
    direction = "stable";
    description = `20-day: ${roc20 > 0 ? "+" : ""}${roc20.toFixed(1)}% (range-bound)`;
  }
  
  return {
    name: "Price Momentum",
    direction,
    description,
    value: roc20,
  };
}

/**
 * Analyze EPS estimate revisions using detailed trend data
 */
function analyzeEPSTrend(summary: QuoteSummary): MomentumSignal | null {
  const trend = summary.earningsTrend?.trend;
  if (!trend) return null;
  
  const currentQ = trend.find(t => t.period === "0q");
  if (!currentQ?.epsTrend) return null;
  
  const { current, thirtyDaysAgo, ninetyDaysAgo } = currentQ.epsTrend;
  
  if (current === undefined || thirtyDaysAgo === undefined) return null;
  
  // Calculate % change in EPS estimates
  const change30d = thirtyDaysAgo !== 0 
    ? ((current - thirtyDaysAgo) / Math.abs(thirtyDaysAgo)) * 100 
    : 0;
  const change90d = ninetyDaysAgo !== undefined && ninetyDaysAgo !== 0
    ? ((current - ninetyDaysAgo) / Math.abs(ninetyDaysAgo)) * 100
    : null;
  
  let direction: MomentumDirection;
  let description: string;
  
  if (change30d > 3) {
    direction = "improving";
    description = `EPS estimate raised ${change30d.toFixed(1)}% (30 days)`;
  } else if (change30d < -3) {
    direction = "deteriorating";
    description = `EPS estimate cut ${Math.abs(change30d).toFixed(1)}% (30 days)`;
  } else {
    direction = "stable";
    description = `EPS estimate stable at $${current.toFixed(2)}`;
  }
  
  // Add 90-day context if significant
  if (change90d !== null && Math.abs(change90d) > 5) {
    description += change90d > 0 
      ? ` (+${change90d.toFixed(0)}% vs 90d ago)` 
      : ` (${change90d.toFixed(0)}% vs 90d ago)`;
  }
  
  return {
    name: "EPS Estimates",
    direction,
    description,
    value: change30d,
  };
}

/**
 * Analyze analyst EPS revisions (up vs down)
 */
function analyzeEPSRevisions(summary: QuoteSummary): MomentumSignal | null {
  const trend = summary.earningsTrend?.trend;
  if (!trend) return null;
  
  const currentQ = trend.find(t => t.period === "0q");
  if (!currentQ?.epsRevisions) return null;
  
  const { upLast30days, downLast30days, upLast7days, downLast7days } = currentQ.epsRevisions;
  
  if (upLast30days === undefined && downLast30days === undefined) return null;
  
  const up = (upLast30days ?? 0);
  const down = (downLast30days ?? 0);
  const net = up - down;
  
  let direction: MomentumDirection;
  let description: string;
  
  if (net >= 3) {
    direction = "improving";
    description = `${up} analysts raised, ${down} cut estimates (30d)`;
  } else if (net <= -3) {
    direction = "deteriorating";
    description = `${down} analysts cut, ${up} raised estimates (30d)`;
  } else {
    direction = "stable";
    description = `${up} raised, ${down} cut (30d)`;
  }
  
  return {
    name: "Analyst Revisions",
    direction,
    description,
    value: net,
  };
}

/**
 * Analyze insider activity (net buying/selling)
 */
function analyzeInsiderActivity(summary: QuoteSummary): MomentumSignal | null {
  const activity = summary.netSharePurchaseActivity;
  if (!activity) return null;
  
  const { buyInfoCount, sellInfoCount, netInfoShares, period } = activity;
  
  if (buyInfoCount === undefined && sellInfoCount === undefined) return null;
  
  const buys = buyInfoCount ?? 0;
  const sells = sellInfoCount ?? 0;
  const netShares = netInfoShares ?? 0;
  const periodStr = period ?? "6m";
  
  let direction: MomentumDirection;
  let description: string;
  
  if (netShares > 0 && buys > sells) {
    direction = "improving";
    description = `Insiders net buying — ${buys} buys vs ${sells} sells (${periodStr})`;
  } else if (netShares < 0 && sells > buys) {
    direction = "deteriorating";
    description = `Insiders net selling — ${sells} sells vs ${buys} buys (${periodStr})`;
  } else {
    direction = "stable";
    description = `Insider activity balanced — ${buys} buys, ${sells} sells (${periodStr})`;
  }
  
  return {
    name: "Insider Activity",
    direction,
    description,
    value: netShares,
  };
}

/**
 * Analyze institutional ownership
 */
function analyzeInstitutionalOwnership(summary: QuoteSummary): MomentumSignal | null {
  const holders = summary.majorHoldersBreakdown;
  if (!holders) return null;
  
  const instPct = holders.institutionsPercentHeld;
  const insiderPct = holders.insidersPercentHeld;
  const instCount = holders.institutionsCount;
  
  if (instPct === undefined) return null;
  
  let direction: MomentumDirection = "stable";
  let description: string;
  
  // High institutional ownership is generally positive (validation)
  // Very low might indicate speculative or overlooked
  if (instPct >= 0.70) {
    description = `${(instPct * 100).toFixed(0)}% institutional — widely held`;
  } else if (instPct >= 0.40) {
    description = `${(instPct * 100).toFixed(0)}% institutional ownership`;
  } else if (instPct >= 0.10) {
    description = `${(instPct * 100).toFixed(0)}% institutional — limited coverage`;
  } else {
    description = `${(instPct * 100).toFixed(0)}% institutional — speculative`;
  }
  
  if (instCount !== undefined && instCount > 0) {
    description += ` (${instCount} holders)`;
  }
  
  return {
    name: "Institutional",
    direction,
    description,
    value: instPct,
  };
}

/**
 * Analyze profitability trend for unprofitable companies
 * Shows if the company is moving toward or away from profitability
 */
function analyzeProfitabilityTrend(summary: QuoteSummary): MomentumSignal | null {
  const profitMargin = summary.financialData?.profitMargins?.raw;
  
  // Only relevant for unprofitable or marginally profitable companies
  if (profitMargin === undefined || profitMargin > 0.05) return null;
  
  // Get expected earnings growth from earnings trend
  const trend = summary.earningsTrend?.trend;
  const currentYearGrowth = trend?.find(t => t.period === "0y")?.growth?.raw;
  const nextYearGrowth = trend?.find(t => t.period === "+1y")?.growth?.raw;
  
  const marginPct = (profitMargin * 100).toFixed(1);
  
  let direction: MomentumDirection;
  let description: string;
  
  // If we have growth expectations
  if (currentYearGrowth !== undefined && currentYearGrowth > 0.50) {
    // Strong expected improvement
    direction = "improving";
    description = `Margin ${marginPct}% but +${(currentYearGrowth * 100).toFixed(0)}% earnings growth expected`;
  } else if (currentYearGrowth !== undefined && currentYearGrowth > 0) {
    // Modest improvement expected
    direction = "improving";
    description = `Margin ${marginPct}%, improving (+${(currentYearGrowth * 100).toFixed(0)}% growth expected)`;
  } else if (currentYearGrowth !== undefined && currentYearGrowth < -0.20) {
    // Deteriorating
    direction = "deteriorating";
    description = `Margin ${marginPct}% and worsening (${(currentYearGrowth * 100).toFixed(0)}% decline expected)`;
  } else {
    // Stable or no data
    direction = "stable";
    description = `Margin ${marginPct}% — path to profitability unclear`;
  }
  
  return {
    name: "Profitability",
    direction,
    description,
    value: profitMargin,
  };
}

/**
 * Analyze quarterly revenue/earnings trend
 * Shows if the company is improving quarter over quarter
 */
function analyzeQuarterlyTrend(summary: QuoteSummary): MomentumSignal | null {
  const quarterly = summary.earnings?.financialsChart?.quarterly;
  if (!quarterly || quarterly.length < 2) return null;
  
  // Get most recent quarters (data is chronological)
  const recent = quarterly.slice(-4); // Last 4 quarters
  if (recent.length < 2) return null;
  
  // Calculate revenue and earnings trends
  const revenues = recent.map(q => q.revenue).filter((r): r is number => r !== undefined);
  const earnings = recent.map(q => q.earnings).filter((e): e is number => e !== undefined);
  
  if (revenues.length < 2 || earnings.length < 2) return null;
  
  // Check if revenue is growing (compare most recent to oldest in window)
  const oldestRev = revenues[0];
  const newestRev = revenues[revenues.length - 1];
  const revGrowth = oldestRev !== 0 ? ((newestRev - oldestRev) / Math.abs(oldestRev)) * 100 : 0;
  
  // Check earnings trend
  const oldestEarn = earnings[0];
  const newestEarn = earnings[earnings.length - 1];
  const earnGrowth = oldestEarn !== 0 ? ((newestEarn - oldestEarn) / Math.abs(oldestEarn)) * 100 : 0;
  
  // Count positive vs negative earnings quarters
  const profitableQtrs = earnings.filter(e => e > 0).length;
  const totalQtrs = earnings.length;
  
  let direction: MomentumDirection;
  let description: string;
  
  // Assess overall quarterly trend
  if (revGrowth > 10 && earnGrowth > 20) {
    direction = "improving";
    description = `Rev +${revGrowth.toFixed(0)}%, Earn +${earnGrowth.toFixed(0)}% (${totalQtrs}Q trend)`;
  } else if (revGrowth > 5 || earnGrowth > 10) {
    direction = "improving";
    description = `${profitableQtrs}/${totalQtrs} profitable quarters, revenue ${revGrowth > 0 ? "growing" : "flat"}`;
  } else if (revGrowth < -10 || earnGrowth < -20) {
    direction = "deteriorating";
    description = `Rev ${revGrowth.toFixed(0)}%, Earn ${earnGrowth.toFixed(0)}% (${totalQtrs}Q trend)`;
  } else {
    direction = "stable";
    description = `${profitableQtrs}/${totalQtrs} profitable quarters`;
  }
  
  return {
    name: "Quarterly Trend",
    direction,
    description,
    value: earnGrowth,
  };
}

/**
 * Analyze earnings beat/miss history
 * Shows consistency in meeting/exceeding expectations
 */
function analyzeEarningsBeatMiss(summary: QuoteSummary): MomentumSignal | null {
  const history = summary.earningsHistory?.history;
  if (!history || history.length < 2) return null;
  
  // Count beats and misses from last 4 quarters
  const recent = history.slice(0, 4);
  let beats = 0;
  let misses = 0;
  let avgSurprise = 0;
  
  for (const q of recent) {
    if (q.epsDifference === undefined) continue;
    
    if (q.epsDifference > 0) beats++;
    else if (q.epsDifference < 0) misses++;
    
    if (q.surprisePercent !== undefined) {
      avgSurprise += q.surprisePercent;
    }
  }
  
  avgSurprise = recent.length > 0 ? avgSurprise / recent.length : 0;
  const total = beats + misses;
  
  if (total === 0) return null;
  
  let direction: MomentumDirection;
  let description: string;
  
  if (beats >= 3 && avgSurprise > 5) {
    direction = "improving";
    description = `Beat ${beats}/${total} quarters (avg +${avgSurprise.toFixed(0)}% surprise)`;
  } else if (beats > misses) {
    direction = "stable";
    description = `Beat ${beats}/${total} quarters`;
  } else if (misses > beats) {
    direction = "deteriorating";
    description = `Missed ${misses}/${total} quarters`;
  } else {
    direction = "stable";
    description = `Beat ${beats}, missed ${misses} of last ${total} quarters`;
  }
  
  return {
    name: "Earnings History",
    direction,
    description,
    value: avgSurprise,
  };
}

/**
 * Calculate overall momentum analysis
 * v1.3.5: Added quarterly trend and beat/miss history
 */
export function calculateMomentum(
  summary: QuoteSummary,
  historical: HistoricalData[],
  currentPrice: number
): MomentumAnalysis {
  const signals: MomentumSignal[] = [];
  
  // EPS estimate trend (current vs 30d/90d ago)
  const epsTrendSignal = analyzeEPSTrend(summary);
  if (epsTrendSignal) signals.push(epsTrendSignal);
  
  // Analyst EPS revisions (up vs down count)
  const epsRevisionsSignal = analyzeEPSRevisions(summary);
  if (epsRevisionsSignal) signals.push(epsRevisionsSignal);
  
  // Analyst sentiment momentum (bull/bear ratio change)
  const analystSignal = analyzeAnalystMomentum(summary);
  if (analystSignal) signals.push(analystSignal);
  
  // Upgrade/downgrade momentum
  const upgradesSignal = analyzeUpgradesMomentum(summary);
  if (upgradesSignal) signals.push(upgradesSignal);
  
  // Insider activity (net buying/selling)
  const insiderSignal = analyzeInsiderActivity(summary);
  if (insiderSignal) signals.push(insiderSignal);
  
  // Price momentum
  const priceSignal = analyzePriceMomentum(historical, currentPrice);
  if (priceSignal) signals.push(priceSignal);
  
  // Institutional ownership (context, not momentum per se)
  const instSignal = analyzeInstitutionalOwnership(summary);
  if (instSignal) signals.push(instSignal);
  
  // Profitability trend (for unprofitable companies)
  const profitSignal = analyzeProfitabilityTrend(summary);
  if (profitSignal) signals.push(profitSignal);
  
  // Quarterly earnings trend
  const quarterlySignal = analyzeQuarterlyTrend(summary);
  if (quarterlySignal) signals.push(quarterlySignal);
  
  // Earnings beat/miss history
  const beatMissSignal = analyzeEarningsBeatMiss(summary);
  if (beatMissSignal) signals.push(beatMissSignal);
  
  // Calculate overall trend
  let improvingCount = 0;
  let deterioratingCount = 0;
  
  // Check for severe price deterioration
  const priceMomentumSignal = signals.find(s => s.name === "Price Momentum");
  const severePriceDrop = priceMomentumSignal && 
    priceMomentumSignal.direction === "deteriorating" && 
    (priceMomentumSignal.value ?? 0) < -20;
  
  for (const signal of signals) {
    if (signal.direction === "improving") improvingCount++;
    else if (signal.direction === "deteriorating") deterioratingCount++;
  }
  
  let overallTrend: MomentumDirection;
  let summary_text: string;
  
  // If price is down severely, always show mixed or deteriorating
  if (severePriceDrop) {
    if (improvingCount > deterioratingCount) {
      overallTrend = "stable";
      summary_text = "Mixed — analyst sentiment improving but price weak";
    } else {
      overallTrend = "deteriorating";
      summary_text = "Weak — price declining with mixed signals";
    }
  } else if (improvingCount > deterioratingCount && improvingCount >= 2) {
    overallTrend = "improving";
    summary_text = "Multiple metrics improving — positive momentum";
  } else if (deterioratingCount > improvingCount && deterioratingCount >= 2) {
    overallTrend = "deteriorating";
    summary_text = "Multiple metrics weakening — negative momentum";
  } else if (improvingCount > 0 && deterioratingCount > 0) {
    overallTrend = "stable";
    summary_text = "Mixed signals — some improving, some weakening";
  } else {
    overallTrend = "stable";
    summary_text = "Metrics largely stable";
  }
  
  return {
    signals,
    overallTrend,
    summary: summary_text,
  };
}

