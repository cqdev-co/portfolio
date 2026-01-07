/**
 * Quarterly Earnings Analysis (v1.4.0)
 *
 * Analyzes quarter-over-quarter actual performance:
 * - Revenue and earnings trends
 * - Beat/miss history
 * - Sequential margin improvement
 * - Earnings surprise consistency
 */

import type {
  QuoteSummary,
  QuarterlyResult,
  QuarterlyPerformance,
} from '../types/index.ts';

/**
 * Extract quarterly data from Yahoo Finance summary
 * Combines financialsChart (revenue/earnings) with earningsHistory (EPS)
 */
export function extractQuarterlyData(summary: QuoteSummary): QuarterlyResult[] {
  const quarters: QuarterlyResult[] = [];

  // Get financials chart data (revenue + earnings by quarter)
  const financials = summary.earnings?.financialsChart?.quarterly ?? [];

  // Get EPS history (actual vs estimate)
  const epsHistory = summary.earningsHistory?.history ?? [];

  // Build quarters from financials data
  for (const q of financials) {
    if (!q.date) continue;

    // Find matching EPS data by quarter date
    const matchingEps = epsHistory.find((e) => {
      if (!e.quarter) return false;
      const epsDate = new Date(e.quarter);
      const finDate = parseQuarterDate(q.date);
      if (!finDate) return false;

      // Match by quarter (within 45 days)
      const diffMs = Math.abs(epsDate.getTime() - finDate.getTime());
      return diffMs < 45 * 24 * 60 * 60 * 1000;
    });

    quarters.push({
      quarter: q.date,
      revenue: q.revenue ?? null,
      earnings: q.earnings ?? null,
      epsActual: matchingEps?.epsActual ?? null,
      epsEstimate: matchingEps?.epsEstimate ?? null,
      epsSurprise: matchingEps?.surprisePercent ?? null,
      beat:
        matchingEps?.surprisePercent !== undefined
          ? matchingEps.surprisePercent > 0
          : null,
    });
  }

  // If no financials but EPS history exists, use that
  if (quarters.length === 0 && epsHistory.length > 0) {
    for (const e of epsHistory) {
      if (!e.quarter) continue;

      const qDate = new Date(e.quarter);
      const qLabel = formatQuarterLabel(qDate);

      quarters.push({
        quarter: qLabel,
        revenue: null,
        earnings: null,
        epsActual: e.epsActual ?? null,
        epsEstimate: e.epsEstimate ?? null,
        epsSurprise: e.surprisePercent ?? null,
        beat: e.surprisePercent !== undefined ? e.surprisePercent > 0 : null,
      });
    }
  }

  return quarters;
}

/**
 * Parse quarter date string (e.g., "3Q2024") to Date
 */
function parseQuarterDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  // Handle "3Q2024" format
  const match = dateStr.match(/^(\d)Q(\d{4})$/);
  if (match) {
    const quarter = parseInt(match[1] ?? '1', 10);
    const year = parseInt(match[2] ?? '2024', 10);
    // Map quarter to month: Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
    const month = (quarter - 1) * 3;
    return new Date(year, month, 15);
  }

  // Try ISO date parsing
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a Date to quarter label (e.g., "3Q2024")
 */
function formatQuarterLabel(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  const year = date.getFullYear();
  return `${quarter}Q${year}`;
}

/**
 * Analyze revenue trend across quarters
 */
function analyzeRevenueTrend(
  quarters: QuarterlyResult[]
): QuarterlyPerformance['revenueTrend'] {
  const revenues = quarters
    .map((q) => q.revenue)
    .filter((r): r is number => r !== null);

  if (revenues.length < 2) return 'insufficient_data';

  // Count increases vs decreases
  let increases = 0;
  let decreases = 0;

  for (let i = 1; i < revenues.length; i++) {
    const prev = revenues[i - 1];
    const curr = revenues[i];
    if (prev === undefined || curr === undefined) continue;

    if (curr > prev) increases++;
    else if (curr < prev) decreases++;
  }

  if (increases >= 2 && decreases === 0) return 'growing';
  if (decreases >= 2 && increases === 0) return 'declining';
  return 'mixed';
}

/**
 * Analyze earnings trend across quarters
 */
function analyzeEarningsTrend(
  quarters: QuarterlyResult[]
): QuarterlyPerformance['earningsTrend'] {
  const earnings = quarters
    .map((q) => q.earnings)
    .filter((e): e is number => e !== null);

  if (earnings.length < 2) return 'insufficient_data';

  let increases = 0;
  let decreases = 0;

  for (let i = 1; i < earnings.length; i++) {
    const prev = earnings[i - 1];
    const curr = earnings[i];
    if (prev === undefined || curr === undefined) continue;

    if (curr > prev) increases++;
    else if (curr < prev) decreases++;
  }

  if (increases >= 2 && decreases === 0) return 'improving';
  if (decreases >= 2 && increases === 0) return 'declining';
  return 'mixed';
}

/**
 * Calculate beat/miss record
 */
function calculateBeatMissRecord(
  quarters: QuarterlyResult[]
): QuarterlyPerformance['beatMissRecord'] {
  const withData = quarters.filter((q) => q.beat !== null);

  const beats = withData.filter((q) => q.beat === true).length;
  const misses = withData.filter((q) => q.beat === false).length;
  const total = withData.length;

  let summary: string;
  if (total === 0) {
    summary = 'No EPS data available';
  } else if (beats === total) {
    summary = `Beat all ${total} quarters`;
  } else if (misses === total) {
    summary = `Missed all ${total} quarters`;
  } else if (beats > misses) {
    summary = `Beat ${beats} of last ${total} quarters`;
  } else if (misses > beats) {
    summary = `Missed ${misses} of last ${total} quarters`;
  } else {
    summary = `Mixed: ${beats} beats, ${misses} misses`;
  }

  return { beats, misses, total, summary };
}

/**
 * Check for sequential margin improvement
 * (unprofitable quarters improving toward profitability)
 */
function checkSequentialImprovement(quarters: QuarterlyResult[]): boolean {
  const earnings = quarters
    .map((q) => q.earnings)
    .filter((e): e is number => e !== null);

  if (earnings.length < 3) return false;

  // Check if losses are shrinking or profits are growing
  // Look at last 3 quarters
  const recent = earnings.slice(-3);

  let improving = true;
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];
    if (prev === undefined || curr === undefined) continue;

    // Improving means: less negative OR more positive
    if (curr <= prev) {
      improving = false;
      break;
    }
  }

  return improving;
}

/**
 * Analyze earnings surprise trend
 */
function analyzeSurpriseTrend(
  quarters: QuarterlyResult[]
): QuarterlyPerformance['surpriseTrend'] {
  const surprises = quarters
    .map((q) => q.epsSurprise)
    .filter((s): s is number => s !== null);

  if (surprises.length < 2) return 'insufficient_data';

  const beats = surprises.filter((s) => s > 0).length;
  const misses = surprises.filter((s) => s < 0).length;

  // Consistently beating = 75%+ beats
  if (beats >= surprises.length * 0.75) return 'consistently_beating';

  // Consistently missing = 75%+ misses
  if (misses >= surprises.length * 0.75) return 'consistently_missing';

  return 'mixed';
}

/**
 * Calculate complete quarterly performance analysis
 */
export function analyzeQuarterlyPerformance(
  summary: QuoteSummary
): QuarterlyPerformance | null {
  const quarters = extractQuarterlyData(summary);

  if (quarters.length === 0) {
    return null;
  }

  // Count profitable quarters
  const profitableQuarters = quarters.filter(
    (q) => q.earnings !== null && q.earnings > 0
  ).length;

  return {
    quarters,
    revenueTrend: analyzeRevenueTrend(quarters),
    earningsTrend: analyzeEarningsTrend(quarters),
    beatMissRecord: calculateBeatMissRecord(quarters),
    profitableQuarters,
    totalQuarters: quarters.length,
    sequentialImprovement: checkSequentialImprovement(quarters),
    surpriseTrend: analyzeSurpriseTrend(quarters),
  };
}

/**
 * Format revenue for display - always use B for consistency when any value is >= 1B
 * v1.4.1: Consistent formatting across all quarters
 */
export function formatRevenue(
  revenue: number | null,
  forceUnit?: 'B' | 'M'
): string {
  if (revenue === null) return 'N/A';

  if (forceUnit === 'B' || Math.abs(revenue) >= 1_000_000_000) {
    return `$${(revenue / 1_000_000_000).toFixed(2)}B`;
  } else if (forceUnit === 'M' || Math.abs(revenue) >= 1_000_000) {
    return `$${(revenue / 1_000_000).toFixed(0)}M`;
  }
  return `$${revenue.toLocaleString()}`;
}

/**
 * Format earnings for display - always use B for consistency when any value is >= 1B
 * v1.4.1: Consistent formatting across all quarters
 */
export function formatEarnings(
  earnings: number | null,
  forceUnit?: 'B' | 'M'
): string {
  if (earnings === null) return 'N/A';

  if (forceUnit === 'B' || Math.abs(earnings) >= 1_000_000_000) {
    return `$${(earnings / 1_000_000_000).toFixed(2)}B`;
  } else if (forceUnit === 'M' || Math.abs(earnings) >= 1_000_000) {
    return `$${(earnings / 1_000_000).toFixed(0)}M`;
  }
  return `$${earnings.toLocaleString()}`;
}

/**
 * Determine the best unit (B or M) for consistent display across quarters
 */
export function determineDisplayUnit(
  values: (number | null)[]
): 'B' | 'M' | null {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;

  const maxAbs = Math.max(...validValues.map(Math.abs));
  return maxAbs >= 1_000_000_000 ? 'B' : 'M';
}

/**
 * Format quarter label for display (e.g., "1Q24" from "1Q2024")
 * v1.4.1: Shorter labels for cleaner output
 */
export function formatQuarterShort(quarter: string): string {
  // Convert "1Q2024" to "Q1'24"
  const match = quarter.match(/^(\d)Q(\d{4})$/);
  if (match) {
    const q = match[1];
    const year = match[2]?.slice(-2);
    return `Q${q}'${year}`;
  }
  return quarter;
}

/**
 * Calculate QoQ growth percentage
 * v1.4.1: Sequential growth between quarters
 */
export function calculateQoQGrowth(
  current: number | null,
  previous: number | null
): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Format growth percentage with sign
 */
export function formatGrowth(growth: number | null): string {
  if (growth === null) return '';
  const sign = growth >= 0 ? '+' : '';
  return `${sign}${growth.toFixed(0)}%`;
}

/**
 * Build formatted revenue row with quarter labels and growth
 * v1.4.1: Enhanced display with labels and sequential growth
 */
export function buildRevenueDisplay(quarters: QuarterlyResult[]): {
  formatted: string;
  withGrowth: string;
  labels: string[];
} {
  const revenues = quarters.map((q) => q.revenue);
  const unit = determineDisplayUnit(revenues);

  const labels = quarters.map((q) => formatQuarterShort(q.quarter));
  const formatted = quarters
    .map((q) => formatRevenue(q.revenue, unit ?? undefined))
    .join(' → ');

  // Build with growth percentages
  const parts: string[] = [];
  for (let i = 0; i < quarters.length; i++) {
    const rev = formatRevenue(quarters[i]?.revenue ?? null, unit ?? undefined);
    if (i === 0) {
      parts.push(rev);
    } else {
      const growth = calculateQoQGrowth(
        quarters[i]?.revenue ?? null,
        quarters[i - 1]?.revenue ?? null
      );
      const growthStr = growth !== null ? ` (${formatGrowth(growth)})` : '';
      parts.push(`${rev}${growthStr}`);
    }
  }

  return {
    formatted,
    withGrowth: parts.join(' → '),
    labels,
  };
}

/**
 * Build formatted earnings row with quarter labels and growth
 * v1.4.1: Enhanced display with labels and sequential growth
 */
export function buildEarningsDisplay(quarters: QuarterlyResult[]): {
  formatted: string;
  withGrowth: string;
  labels: string[];
} {
  const earnings = quarters.map((q) => q.earnings);
  const unit = determineDisplayUnit(earnings);

  const labels = quarters.map((q) => formatQuarterShort(q.quarter));
  const formatted = quarters
    .map((q) => formatEarnings(q.earnings, unit ?? undefined))
    .join(' → ');

  // Build with growth percentages
  const parts: string[] = [];
  for (let i = 0; i < quarters.length; i++) {
    const earn = formatEarnings(
      quarters[i]?.earnings ?? null,
      unit ?? undefined
    );
    if (i === 0) {
      parts.push(earn);
    } else {
      const growth = calculateQoQGrowth(
        quarters[i]?.earnings ?? null,
        quarters[i - 1]?.earnings ?? null
      );
      const growthStr = growth !== null ? ` (${formatGrowth(growth)})` : '';
      parts.push(`${earn}${growthStr}`);
    }
  }

  return {
    formatted,
    withGrowth: parts.join(' → '),
    labels,
  };
}

/**
 * Get beat/miss emoji and color info
 */
export function getBeatMissDisplay(
  beat: boolean | null,
  surprise: number | null
): { emoji: string; text: string; type: 'beat' | 'miss' | 'neutral' } {
  if (beat === null || surprise === null) {
    return { emoji: '—', text: 'N/A', type: 'neutral' };
  }

  const surprisePct = (surprise * 100).toFixed(1);

  if (beat) {
    return {
      emoji: '✅',
      text: `Beat (+${surprisePct}%)`,
      type: 'beat',
    };
  } else {
    return {
      emoji: '❌',
      text: `Miss (${surprisePct}%)`,
      type: 'miss',
    };
  }
}
