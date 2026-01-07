/**
 * Relative Strength Analysis
 * Compares stock performance against SPY (S&P 500 benchmark)
 */

import type { HistoricalData } from '../types/index.ts';

export interface RelativeStrengthResult {
  // Performance over period
  stockReturn: number;
  spyReturn: number;
  outperformance: number;

  // Relative strength line trend
  rsLineTrend: 'up' | 'down' | 'flat';
  rsTrendStrength: number; // 0-100

  // Labels
  period: string;
  isOutperforming: boolean;
}

/**
 * Calculate performance return over a period
 * v1.4.2: Added bounds checking to prevent -100% bugs
 */
function calculateReturn(data: HistoricalData[]): number {
  if (data.length < 2) return 0;

  const startPrice = data[0]?.close ?? 0;
  const endPrice = data[data.length - 1]?.close ?? 0;

  // Validate prices to prevent calculation errors
  if (startPrice <= 0 || endPrice <= 0) return 0;
  if (!isFinite(startPrice) || !isFinite(endPrice)) return 0;

  const returnVal = (endPrice - startPrice) / startPrice;

  // Sanity check: returns > 1000% or < -99% are likely data errors
  if (returnVal > 10 || returnVal < -0.99) {
    return 0; // Return 0 for clearly bad data
  }

  return returnVal;
}

/**
 * Calculate relative strength line (stock/SPY ratio) trend
 */
function analyzeRSLineTrend(
  stockData: HistoricalData[],
  spyData: HistoricalData[]
): { trend: 'up' | 'down' | 'flat'; strength: number } {
  if (stockData.length < 10 || spyData.length < 10) {
    return { trend: 'flat', strength: 0 };
  }

  // Calculate RS line (stock/SPY ratio) for each day
  const rsLine: number[] = [];
  const minLength = Math.min(stockData.length, spyData.length);

  for (let i = 0; i < minLength; i++) {
    const stockClose = stockData[i]?.close ?? 0;
    const spyClose = spyData[i]?.close ?? 0;

    if (spyClose > 0) {
      rsLine.push(stockClose / spyClose);
    }
  }

  if (rsLine.length < 10) {
    return { trend: 'flat', strength: 0 };
  }

  // Compare recent RS line to earlier RS line
  const recentPeriod = rsLine.slice(-5);
  const earlierPeriod = rsLine.slice(-20, -10);

  if (recentPeriod.length === 0 || earlierPeriod.length === 0) {
    return { trend: 'flat', strength: 0 };
  }

  const recentAvg =
    recentPeriod.reduce((a, b) => a + b, 0) / recentPeriod.length;
  const earlierAvg =
    earlierPeriod.reduce((a, b) => a + b, 0) / earlierPeriod.length;

  const change = (recentAvg - earlierAvg) / earlierAvg;

  // Determine trend and strength
  if (change > 0.02) {
    return { trend: 'up', strength: Math.min(100, change * 500) };
  } else if (change < -0.02) {
    return { trend: 'down', strength: Math.min(100, Math.abs(change) * 500) };
  }

  return { trend: 'flat', strength: 0 };
}

/**
 * Calculate relative strength vs SPY for a given period
 */
export function calculateRelativeStrength(
  stockData: HistoricalData[],
  spyData: HistoricalData[],
  period: number = 20
): RelativeStrengthResult | null {
  // Get data for the period
  const stockPeriod = stockData.slice(-period);
  const spyPeriod = spyData.slice(-period);

  if (stockPeriod.length < period * 0.8 || spyPeriod.length < period * 0.8) {
    return null;
  }

  const stockReturn = calculateReturn(stockPeriod);
  const spyReturn = calculateReturn(spyPeriod);
  const outperformance = stockReturn - spyReturn;

  const { trend, strength } = analyzeRSLineTrend(stockData, spyData);

  const periodLabel =
    period <= 5
      ? '1W'
      : period <= 21
        ? `${Math.round(period / 5)}W`
        : `${Math.round(period / 21)}M`;

  return {
    stockReturn,
    spyReturn,
    outperformance,
    rsLineTrend: trend,
    rsTrendStrength: strength,
    period: periodLabel,
    isOutperforming: outperformance > 0.01, // > 1% outperformance
  };
}

/**
 * Calculate relative strength for multiple periods
 */
export function calculateMultiPeriodRS(
  stockData: HistoricalData[],
  spyData: HistoricalData[]
): {
  rs20: RelativeStrengthResult | null;
  rs50: RelativeStrengthResult | null;
  rs200: RelativeStrengthResult | null;
  overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';
} {
  const rs20 = calculateRelativeStrength(stockData, spyData, 20);
  const rs50 = calculateRelativeStrength(stockData, spyData, 50);
  const rs200 = calculateRelativeStrength(stockData, spyData, 200);

  // Determine overall trend
  const outperformingCount = [rs20, rs50, rs200].filter(
    (rs) => rs?.isOutperforming
  ).length;

  let overallTrend: 'strong' | 'moderate' | 'weak' | 'underperforming';

  if (outperformingCount === 3) {
    overallTrend = 'strong';
  } else if (outperformingCount === 2) {
    overallTrend = 'moderate';
  } else if (outperformingCount === 1) {
    overallTrend = 'weak';
  } else {
    overallTrend = 'underperforming';
  }

  return { rs20, rs50, rs200, overallTrend };
}

/**
 * Format relative strength for display
 */
export function formatRelativeStrength(rs: RelativeStrengthResult): string {
  const sign = rs.outperformance >= 0 ? '+' : '';
  const outperformPct = (rs.outperformance * 100).toFixed(1);
  const stockPct = (rs.stockReturn * 100).toFixed(1);
  const spyPct = (rs.spyReturn * 100).toFixed(1);

  return `${rs.period}: Stock ${stockPct}% vs SPY ${spyPct}% → ${sign}${outperformPct}%`;
}
