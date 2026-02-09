/**
 * CDS Fundamental Signal Detection
 *
 * Uses shared fundamental check functions from @portfolio/providers,
 * combined with CDS-specific thresholds/weights and sector comparison.
 *
 * Max: 30 points
 */

import type { Signal, QuoteSummary } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';
import {
  compareToBenchmark,
  type SectorComparison,
} from '../config/sectors.ts';
import {
  checkPEGRatio,
  checkFCFYield,
  checkForwardPE,
  checkEVEBITDA,
  checkEarningsGrowth,
  checkRevenueGrowth,
  checkProfitMargins,
  checkROE,
  checkPriceToBook,
  checkShortInterest,
  checkBalanceSheetHealth,
} from '@portfolio/providers';
// Re-export ownership functions from shared (unchanged)
export {
  checkInsiderOwnership,
  checkInstitutionalOwnership,
} from '@portfolio/providers';

interface FundamentalResult {
  score: number;
  signals: Signal[];
  warnings: Signal[];
  sectorComparison?: SectorComparison[];
  dataQuality: 'good' | 'partial' | 'poor';
}

/**
 * Check for fundamental warnings (negative signals that don't subtract points)
 */
function checkFundamentalWarnings(summary: QuoteSummary): Signal[] {
  const warnings: Signal[] = [];

  const profitMargin = summary.financialData?.profitMargins?.raw;
  if (profitMargin !== undefined && profitMargin < 0) {
    warnings.push({
      name: 'Unprofitable Company',
      category: 'fundamental',
      points: 0,
      description: `Negative profit margin (${(profitMargin * 100).toFixed(1)}%) — company is losing money`,
      value: profitMargin,
    });
  }

  const earningsGrowth = summary.financialData?.earningsGrowth?.raw;
  if (earningsGrowth !== undefined && earningsGrowth < -0.2) {
    warnings.push({
      name: 'Declining Earnings',
      category: 'fundamental',
      points: 0,
      description: `Earnings down ${Math.abs(earningsGrowth * 100).toFixed(0)}% — significant deterioration`,
      value: earningsGrowth,
    });
  }

  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  if (evEbitda !== undefined && evEbitda < 0) {
    warnings.push({
      name: 'Negative EBITDA',
      category: 'fundamental',
      points: 0,
      description: `Negative EV/EBITDA (${evEbitda.toFixed(1)}) — cash flow negative`,
      value: evEbitda,
    });
  }

  const pe = summary.summaryDetail?.trailingPE?.raw;
  const forwardPE = summary.summaryDetail?.forwardPE?.raw;
  if (
    pe === undefined &&
    forwardPE === undefined &&
    profitMargin !== undefined &&
    profitMargin < 0
  ) {
    warnings.push({
      name: 'No Earnings to Value',
      category: 'fundamental',
      points: 0,
      description: 'No P/E ratio — cannot value based on earnings',
      value: undefined,
    });
  }

  return warnings;
}

/**
 * Assess data quality based on available metrics
 */
function assessDataQuality(summary: QuoteSummary): 'good' | 'partial' | 'poor' {
  let availableMetrics = 0;
  const keyMetrics = [
    summary.summaryDetail?.trailingPE?.raw,
    summary.summaryDetail?.forwardPE?.raw,
    summary.defaultKeyStatistics?.pegRatio?.raw,
    summary.defaultKeyStatistics?.enterpriseToEbitda?.raw,
    summary.financialData?.freeCashflow?.raw,
    summary.financialData?.profitMargins?.raw,
    summary.financialData?.returnOnEquity?.raw,
  ];

  for (const metric of keyMetrics) {
    if (metric !== undefined) availableMetrics++;
  }

  if (availableMetrics >= 5) return 'good';
  if (availableMetrics >= 3) return 'partial';
  return 'poor';
}

/**
 * Calculate all fundamental signals for a stock
 * Uses shared check functions with CDS-specific thresholds
 */
export function calculateFundamentalSignals(
  summary: QuoteSummary,
  marketCap?: number
): FundamentalResult {
  const signals: Signal[] = [];
  const warnings: Signal[] = [];
  let score = 0;

  // Build CDS-specific thresholds and weights
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

  const weights = {
    pegUnderOne: defaultWeights.fundamental.pegUnderOne,
    fcfYieldHigh: defaultWeights.fundamental.fcfYieldHigh,
    forwardPELow: defaultWeights.fundamental.forwardPELow,
    evEbitdaLow: defaultWeights.fundamental.evEbitdaLow,
  };

  // Value signals (shared)
  const pegSignal = checkPEGRatio(summary, thresholds, weights);
  if (pegSignal) {
    signals.push(pegSignal);
    score += pegSignal.points;
  }

  const fcfSignal = checkFCFYield(summary, marketCap, thresholds, weights);
  if (fcfSignal) {
    signals.push(fcfSignal);
    score += fcfSignal.points;
  }

  const forwardPESignal = checkForwardPE(summary, thresholds, weights);
  if (forwardPESignal) {
    signals.push(forwardPESignal);
    score += forwardPESignal.points;
  }

  const evEbitdaSignal = checkEVEBITDA(summary, thresholds, weights);
  if (evEbitdaSignal) {
    signals.push(evEbitdaSignal);
    score += evEbitdaSignal.points;
  }

  const pbSignal = checkPriceToBook(summary);
  if (pbSignal) {
    signals.push(pbSignal);
    score += pbSignal.points;
  }

  // Growth signals (shared)
  const earningsSignal = checkEarningsGrowth(summary);
  if (earningsSignal) {
    signals.push(earningsSignal);
    score += earningsSignal.points;
  }

  const revenueSignal = checkRevenueGrowth(summary);
  if (revenueSignal) {
    signals.push(revenueSignal);
    score += revenueSignal.points;
  }

  // Quality signals (shared)
  const marginSignal = checkProfitMargins(summary);
  if (marginSignal) {
    signals.push(marginSignal);
    score += marginSignal.points;
  }

  const roeSignal = checkROE(summary);
  if (roeSignal) {
    signals.push(roeSignal);
    score += roeSignal.points;
  }

  // Short interest (shared)
  const shortResult = checkShortInterest(summary);
  if (shortResult.signal) {
    signals.push(shortResult.signal);
    score += shortResult.signal.points;
  }
  if (shortResult.warning) {
    warnings.push(shortResult.warning);
  }

  // Balance sheet health (shared)
  const balanceSheetResult = checkBalanceSheetHealth(summary);
  if (balanceSheetResult.signal) {
    signals.push(balanceSheetResult.signal);
    score += balanceSheetResult.signal.points;
  }
  if (balanceSheetResult.warning) {
    warnings.push(balanceSheetResult.warning);
  }

  // Sector comparison (CDS-specific)
  const sector = summary.assetProfile?.sector;
  const pe = summary.summaryDetail?.trailingPE?.raw;
  const peg = summary.defaultKeyStatistics?.pegRatio?.raw;
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  const sectorComparison = compareToBenchmark(sector, pe, peg, evEbitda);

  // Warnings and data quality (CDS-specific)
  const fundamentalWarnings = checkFundamentalWarnings(summary);
  warnings.push(...fundamentalWarnings);
  const dataQuality = assessDataQuality(summary);

  // Cap at 30 points
  return {
    score: Math.min(score, 30),
    signals,
    warnings,
    sectorComparison,
    dataQuality,
  };
}
