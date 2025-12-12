import type { Signal, QuoteSummary } from "../types/index.ts";
import { defaultThresholds, defaultWeights } from "../config/thresholds.ts";
import { compareToBenchmark, type SectorComparison } from "../config/sectors.ts";

interface FundamentalResult {
  score: number;
  signals: Signal[];
  warnings: Signal[];
  sectorComparison?: SectorComparison[];
  dataQuality: "good" | "partial" | "poor";
}

/**
 * Check PEG ratio (Price/Earnings to Growth)
 * PEG < 1.5 is excellent, < 2 is good
 */
function checkPEGRatio(
  summary: QuoteSummary,
  thresholds = defaultThresholds.fundamental
): Signal | null {
  const peg = 
    summary.defaultKeyStatistics?.pegRatio?.raw ??
    summary.summaryDetail?.pegRatio?.raw;

  if (peg === undefined || peg <= 0) return null;

  // Excellent: PEG < 1.5 (full points)
  if (peg < thresholds.pegRatioMax) {
    return {
      name: "PEG Attractive",
      category: "fundamental",
      points: defaultWeights.fundamental.pegUnderOne,
      description: `PEG Ratio = ${peg.toFixed(2)} (undervalued vs growth)`,
      value: peg,
    };
  }
  
  // Good: PEG < 2.0 (partial points)
  if (peg < thresholds.pegRatioGood) {
    return {
      name: "PEG Reasonable",
      category: "fundamental",
      points: Math.floor(defaultWeights.fundamental.pegUnderOne * 0.5),
      description: `PEG Ratio = ${peg.toFixed(2)} (fair value vs growth)`,
      value: peg,
    };
  }

  return null;
}

/**
 * Check Free Cash Flow Yield
 * FCF Yield calculated as FCF / Market Cap
 * > 5% is excellent, > 3% is good
 * 
 * NOTE: Only valid for USD-denominated stocks due to currency mismatch issues
 * with international stocks (e.g., TSM reports FCF in TWD but market cap in USD)
 */
function checkFCFYield(
  summary: QuoteSummary,
  marketCap: number | undefined,
  thresholds = defaultThresholds.fundamental
): Signal | null {
  const fcf = summary.financialData?.freeCashflow?.raw;
  const currency = summary.financialData?.financialCurrency;

  if (!fcf || fcf <= 0 || !marketCap || marketCap <= 0) return null;

  // Skip FCF yield calculation for non-USD stocks to avoid currency mismatch
  // (e.g., TSM reports FCF in TWD but market cap is in USD)
  if (currency && currency !== "USD") {
    return null;
  }

  // Proper FCF Yield calculation: FCF / Market Cap
  const fcfYield = fcf / marketCap;

  // Sanity check: FCF yield > 20% is almost certainly a data error
  if (fcfYield > 0.20) {
    return null;
  }

  // Excellent: FCF Yield > 5% (full points)
  if (fcfYield > thresholds.fcfYieldHigh) {
    return {
      name: "High FCF Yield",
      category: "fundamental",
      points: defaultWeights.fundamental.fcfYieldHigh,
      description: `FCF Yield ${(fcfYield * 100).toFixed(1)}% (excellent cash generation)`,
      value: fcfYield,
    };
  }
  
  // Good: FCF Yield > 3% (partial points)
  if (fcfYield > thresholds.fcfYieldMin) {
    return {
      name: "Positive FCF Yield",
      category: "fundamental",
      points: Math.floor(defaultWeights.fundamental.fcfYieldHigh * 0.6),
      description: `FCF Yield ${(fcfYield * 100).toFixed(1)}% (solid cash generation)`,
      value: fcfYield,
    };
  }

  return null;
}

/**
 * Check Forward P/E vs historical average
 * Lower forward P/E suggests better value
 */
function checkForwardPE(
  summary: QuoteSummary,
  thresholds = defaultThresholds.fundamental
): Signal | null {
  const forwardPE = summary.summaryDetail?.forwardPE?.raw;
  const trailingPE = summary.summaryDetail?.trailingPE?.raw;

  if (!forwardPE || forwardPE <= 0) return null;

  // Forward P/E lower than trailing suggests improving earnings
  if (trailingPE && forwardPE < trailingPE * (1 - thresholds.forwardPEDiscountPercent)) {
    return {
      name: "Forward P/E Attractive",
      category: "fundamental",
      points: defaultWeights.fundamental.forwardPELow,
      description: `Forward P/E (${forwardPE.toFixed(1)}) < ` +
        `Trailing (${trailingPE.toFixed(1)})`,
      value: forwardPE,
    };
  }

  // Low absolute forward P/E
  if (forwardPE < 15) {
    return {
      name: "Low Forward P/E",
      category: "fundamental",
      points: Math.floor(defaultWeights.fundamental.forwardPELow / 2),
      description: `Forward P/E = ${forwardPE.toFixed(1)}`,
      value: forwardPE,
    };
  }

  return null;
}

/**
 * Check EV/EBITDA ratio
 * < 15 is excellent, < 20 is good for growth stocks
 */
function checkEVEBITDA(
  summary: QuoteSummary,
  thresholds = defaultThresholds.fundamental
): Signal | null {
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;

  if (!evEbitda || evEbitda <= 0) return null;

  // Excellent: EV/EBITDA < 15 (full points)
  if (evEbitda < thresholds.evEbitdaMax) {
    return {
      name: "Low EV/EBITDA",
      category: "fundamental",
      points: defaultWeights.fundamental.evEbitdaLow,
      description: `EV/EBITDA = ${evEbitda.toFixed(1)} (attractive valuation)`,
      value: evEbitda,
    };
  }
  
  // Good: EV/EBITDA < 20 (partial points)
  if (evEbitda < thresholds.evEbitdaGood) {
    return {
      name: "Reasonable EV/EBITDA",
      category: "fundamental",
      points: Math.floor(defaultWeights.fundamental.evEbitdaLow * 0.5),
      description: `EV/EBITDA = ${evEbitda.toFixed(1)} (fair valuation)`,
      value: evEbitda,
    };
  }

  return null;
}

/**
 * Check earnings growth
 */
function checkEarningsGrowth(summary: QuoteSummary): Signal | null {
  const earningsGrowth = summary.financialData?.earningsGrowth?.raw;

  if (!earningsGrowth) return null;

  if (earningsGrowth > 0.15) {
    return {
      name: "Strong Earnings Growth",
      category: "fundamental",
      points: 5, // Bonus signal
      description: `Earnings growth ${(earningsGrowth * 100).toFixed(0)}%`,
      value: earningsGrowth,
    };
  }

  return null;
}

/**
 * Check revenue growth
 */
function checkRevenueGrowth(summary: QuoteSummary): Signal | null {
  const revenueGrowth = summary.financialData?.revenueGrowth?.raw;

  if (!revenueGrowth) return null;

  if (revenueGrowth > 0.10) {
    return {
      name: "Revenue Growing",
      category: "fundamental",
      points: 3, // Bonus signal
      description: `Revenue growth ${(revenueGrowth * 100).toFixed(0)}%`,
      value: revenueGrowth,
    };
  }

  return null;
}

/**
 * Check Price to Book ratio (deep value)
 */
function checkPriceToBook(summary: QuoteSummary): Signal | null {
  const pb = summary.summaryDetail?.priceToBook?.raw;

  if (!pb || pb <= 0) return null;

  if (pb < 1.0) {
    return {
      name: "Deep Value (P/B < 1)",
      category: "fundamental",
      points: 5,
      description: `Price/Book = ${pb.toFixed(2)} (trading below book value)`,
      value: pb,
    };
  }
  
  // Partial credit for reasonable P/B
  if (pb < 3.0) {
    return {
      name: "Reasonable P/B",
      category: "fundamental",
      points: 2,
      description: `Price/Book = ${pb.toFixed(2)}`,
      value: pb,
    };
  }

  return null;
}

/**
 * Check profit margins (growth signal)
 */
function checkProfitMargins(summary: QuoteSummary): Signal | null {
  const profitMargin = summary.financialData?.profitMargins?.raw;
  const operatingMargin = summary.financialData?.operatingMargins?.raw;

  // Use operating margin if profit margin not available
  const margin = profitMargin ?? operatingMargin;
  
  if (!margin) return null;

  // Excellent margins > 20%
  if (margin > 0.20) {
    return {
      name: "Strong Profit Margins",
      category: "fundamental",
      points: 5,
      description: `Profit margin ${(margin * 100).toFixed(0)}% (high profitability)`,
      value: margin,
    };
  }
  
  // Good margins > 10%
  if (margin > 0.10) {
    return {
      name: "Healthy Margins",
      category: "fundamental",
      points: 3,
      description: `Profit margin ${(margin * 100).toFixed(0)}%`,
      value: margin,
    };
  }

  return null;
}

/**
 * Check Return on Equity (growth signal)
 */
function checkROE(summary: QuoteSummary): Signal | null {
  const roe = summary.financialData?.returnOnEquity?.raw;

  if (!roe) return null;

  // Excellent ROE > 20%
  if (roe > 0.20) {
    return {
      name: "High ROE",
      category: "fundamental",
      points: 5,
      description: `ROE ${(roe * 100).toFixed(0)}% (excellent capital efficiency)`,
      value: roe,
    };
  }
  
  // Good ROE > 12%
  if (roe > 0.12) {
    return {
      name: "Solid ROE",
      category: "fundamental",
      points: 3,
      description: `ROE ${(roe * 100).toFixed(0)}%`,
      value: roe,
    };
  }

  return null;
}

/**
 * Check for fundamental warnings (negative signals that don't subtract points)
 * v1.3.0: Added warnings for unprofitable companies and missing data
 */
function checkFundamentalWarnings(summary: QuoteSummary): Signal[] {
  const warnings: Signal[] = [];
  
  // Check for unprofitable company
  const profitMargin = summary.financialData?.profitMargins?.raw;
  if (profitMargin !== undefined && profitMargin < 0) {
    warnings.push({
      name: "Unprofitable Company",
      category: "fundamental",
      points: 0,
      description: `Negative profit margin (${(profitMargin * 100).toFixed(1)}%) — company is losing money`,
      value: profitMargin,
    });
  }
  
  // Check for negative earnings growth
  const earningsGrowth = summary.financialData?.earningsGrowth?.raw;
  if (earningsGrowth !== undefined && earningsGrowth < -0.20) {
    warnings.push({
      name: "Declining Earnings",
      category: "fundamental",
      points: 0,
      description: `Earnings down ${Math.abs(earningsGrowth * 100).toFixed(0)}% — significant deterioration`,
      value: earningsGrowth,
    });
  }
  
  // Check for negative EV/EBITDA (means EBITDA is negative)
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  if (evEbitda !== undefined && evEbitda < 0) {
    warnings.push({
      name: "Negative EBITDA",
      category: "fundamental",
      points: 0,
      description: `Negative EV/EBITDA (${evEbitda.toFixed(1)}) — cash flow negative`,
      value: evEbitda,
    });
  }
  
  // Check for extremely high valuation without earnings
  const pe = summary.summaryDetail?.trailingPE?.raw;
  const forwardPE = summary.summaryDetail?.forwardPE?.raw;
  if (pe === undefined && forwardPE === undefined && profitMargin !== undefined && profitMargin < 0) {
    warnings.push({
      name: "No Earnings to Value",
      category: "fundamental",
      points: 0,
      description: "No P/E ratio — cannot value based on earnings",
      value: undefined,
    });
  }
  
  return warnings;
}

/**
 * Assess data quality based on available metrics
 */
function assessDataQuality(summary: QuoteSummary): "good" | "partial" | "poor" {
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
  
  if (availableMetrics >= 5) return "good";
  if (availableMetrics >= 3) return "partial";
  return "poor";
}

/**
 * Calculate all fundamental signals for a stock
 * v1.3.0: Added warnings for unprofitable/speculative stocks
 */
export function calculateFundamentalSignals(
  summary: QuoteSummary,
  marketCap?: number
): FundamentalResult {
  const signals: Signal[] = [];
  let score = 0;

  // Value signals
  const pegSignal = checkPEGRatio(summary);
  if (pegSignal) {
    signals.push(pegSignal);
    score += pegSignal.points;
  }

  const fcfSignal = checkFCFYield(summary, marketCap);
  if (fcfSignal) {
    signals.push(fcfSignal);
    score += fcfSignal.points;
  }

  const forwardPESignal = checkForwardPE(summary);
  if (forwardPESignal) {
    signals.push(forwardPESignal);
    score += forwardPESignal.points;
  }

  const evEbitdaSignal = checkEVEBITDA(summary);
  if (evEbitdaSignal) {
    signals.push(evEbitdaSignal);
    score += evEbitdaSignal.points;
  }

  const pbSignal = checkPriceToBook(summary);
  if (pbSignal) {
    signals.push(pbSignal);
    score += pbSignal.points;
  }

  // Growth signals
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

  // Quality signals (v1.1.2)
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

  // Sector comparison
  const sector = summary.assetProfile?.sector;
  const pe = summary.summaryDetail?.trailingPE?.raw;
  const peg = summary.defaultKeyStatistics?.pegRatio?.raw;
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  const sectorComparison = compareToBenchmark(sector, pe, peg, evEbitda);

  // v1.3.0: Check for warnings and data quality
  const warnings = checkFundamentalWarnings(summary);
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

