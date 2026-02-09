/**
 * PCS Fundamental Signal Detection
 *
 * Uses shared fundamental check functions from @portfolio/providers,
 * with PCS-specific thresholds/weights. Slightly lower weight than CDS
 * (25 pts max vs 30) because PCS relies more on IV and technical stability.
 */

import type { Signal, QuoteSummary } from '../types/index.ts';
import { defaultThresholds } from '../config/thresholds.ts';
import {
  checkPEGRatio,
  checkFCFYield,
  checkForwardPE,
  checkEVEBITDA,
  checkProfitMargins,
  checkRevenueGrowth,
} from '@portfolio/providers';

interface FundamentalResult {
  score: number;
  signals: Signal[];
}

export function calculateFundamentalSignals(
  summary: QuoteSummary | null
): FundamentalResult {
  const signals: Signal[] = [];

  if (!summary) return { score: 0, signals: [] };

  // PCS-specific thresholds (same structure, different caps)
  const thresholds = {
    pegRatioMax: defaultThresholds.fundamental.pegRatioMax,
    pegRatioGood: defaultThresholds.fundamental.pegRatioGood,
    fcfYieldMin: defaultThresholds.fundamental.fcfYieldMin,
    fcfYieldHigh: defaultThresholds.fundamental.fcfYieldHigh,
    forwardPEDiscountPercent:
      defaultThresholds.fundamental.forwardPEDiscountPercent,
    evEbitdaMax: defaultThresholds.fundamental.evEbitdaMax,
    evEbitdaGood: defaultThresholds.fundamental.evEbitdaGood,
  };

  // PCS-specific weights (lower than CDS)
  const weights = {
    pegUnderOne: 8,
    fcfYieldHigh: 7,
    forwardPELow: 5,
    evEbitdaLow: 5,
  };

  // Use shared check functions
  const pegSignal = checkPEGRatio(summary, thresholds, weights);
  if (pegSignal) signals.push(pegSignal);

  // FCF Yield - calculate marketCap from available data
  const price = summary.financialData?.currentPrice?.raw;
  const sharesOutstanding =
    summary.defaultKeyStatistics?.sharesOutstanding?.raw;
  const marketCap =
    sharesOutstanding && price ? sharesOutstanding * price : undefined;
  const fcfSignal = checkFCFYield(summary, marketCap, thresholds, weights);
  if (fcfSignal) signals.push(fcfSignal);

  // Forward PE
  const forwardPESignal = checkForwardPE(summary, thresholds, weights);
  if (forwardPESignal) signals.push(forwardPESignal);

  // EV/EBITDA
  const evEbitdaSignal = checkEVEBITDA(summary, thresholds, weights);
  if (evEbitdaSignal) signals.push(evEbitdaSignal);

  // Profit margins (shared, same thresholds)
  const marginSignal = checkProfitMargins(summary);
  if (marginSignal) signals.push(marginSignal);

  // Revenue growth (shared, same thresholds)
  const revenueSignal = checkRevenueGrowth(summary);
  if (revenueSignal) signals.push(revenueSignal);

  // Calculate total (cap at 25 for PCS)
  const totalScore = signals.reduce((sum, s) => sum + s.points, 0);

  return {
    score: Math.min(totalScore, 25),
    signals,
  };
}
