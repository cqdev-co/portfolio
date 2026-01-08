import type { Signal, QuoteSummary } from '../types/index.ts';
import { defaultThresholds, defaultWeights } from '../config/thresholds.ts';
import {
  compareToBenchmark,
  type SectorComparison,
} from '../config/sectors.ts';

interface FundamentalResult {
  score: number;
  signals: Signal[];
  warnings: Signal[];
  sectorComparison?: SectorComparison[];
  dataQuality: 'good' | 'partial' | 'poor';
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
      name: 'PEG Attractive',
      category: 'fundamental',
      points: defaultWeights.fundamental.pegUnderOne,
      description: `PEG Ratio = ${peg.toFixed(2)} (undervalued vs growth)`,
      value: peg,
    };
  }

  // Good: PEG < 2.0 (partial points)
  if (peg < thresholds.pegRatioGood) {
    return {
      name: 'PEG Reasonable',
      category: 'fundamental',
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
  if (currency && currency !== 'USD') {
    return null;
  }

  // Proper FCF Yield calculation: FCF / Market Cap
  const fcfYield = fcf / marketCap;

  // Sanity check: FCF yield > 20% is almost certainly a data error
  if (fcfYield > 0.2) {
    return null;
  }

  // Excellent: FCF Yield > 5% (full points)
  if (fcfYield > thresholds.fcfYieldHigh) {
    return {
      name: 'High FCF Yield',
      category: 'fundamental',
      points: defaultWeights.fundamental.fcfYieldHigh,
      description: `FCF Yield ${(fcfYield * 100).toFixed(1)}% (excellent cash generation)`,
      value: fcfYield,
    };
  }

  // Good: FCF Yield > 3% (partial points)
  if (fcfYield > thresholds.fcfYieldMin) {
    return {
      name: 'Positive FCF Yield',
      category: 'fundamental',
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
  if (
    trailingPE &&
    forwardPE < trailingPE * (1 - thresholds.forwardPEDiscountPercent)
  ) {
    return {
      name: 'Forward P/E Attractive',
      category: 'fundamental',
      points: defaultWeights.fundamental.forwardPELow,
      description:
        `Forward P/E (${forwardPE.toFixed(1)}) < ` +
        `Trailing (${trailingPE.toFixed(1)})`,
      value: forwardPE,
    };
  }

  // Low absolute forward P/E
  if (forwardPE < 15) {
    return {
      name: 'Low Forward P/E',
      category: 'fundamental',
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
      name: 'Low EV/EBITDA',
      category: 'fundamental',
      points: defaultWeights.fundamental.evEbitdaLow,
      description: `EV/EBITDA = ${evEbitda.toFixed(1)} (attractive valuation)`,
      value: evEbitda,
    };
  }

  // Good: EV/EBITDA < 20 (partial points)
  if (evEbitda < thresholds.evEbitdaGood) {
    return {
      name: 'Reasonable EV/EBITDA',
      category: 'fundamental',
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
      name: 'Strong Earnings Growth',
      category: 'fundamental',
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

  if (revenueGrowth > 0.1) {
    return {
      name: 'Revenue Growing',
      category: 'fundamental',
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
      name: 'Deep Value (P/B < 1)',
      category: 'fundamental',
      points: 5,
      description: `Price/Book = ${pb.toFixed(2)} (trading below book value)`,
      value: pb,
    };
  }

  // Partial credit for reasonable P/B
  if (pb < 3.0) {
    return {
      name: 'Reasonable P/B',
      category: 'fundamental',
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
  if (margin > 0.2) {
    return {
      name: 'Strong Profit Margins',
      category: 'fundamental',
      points: 5,
      description: `Profit margin ${(margin * 100).toFixed(0)}% (high profitability)`,
      value: margin,
    };
  }

  // Good margins > 10%
  if (margin > 0.1) {
    return {
      name: 'Healthy Margins',
      category: 'fundamental',
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
  if (roe > 0.2) {
    return {
      name: 'High ROE',
      category: 'fundamental',
      points: 5,
      description: `ROE ${(roe * 100).toFixed(0)}% (excellent capital efficiency)`,
      value: roe,
    };
  }

  // Good ROE > 12%
  if (roe > 0.12) {
    return {
      name: 'Solid ROE',
      category: 'fundamental',
      points: 3,
      description: `ROE ${(roe * 100).toFixed(0)}%`,
      value: roe,
    };
  }

  return null;
}

/**
 * v1.7.0: Check Short Interest (squeeze potential or risk)
 * v1.7.1: Fixed double signal issue - now chooses one interpretation based on context
 *
 * High short interest is ONLY bullish if:
 * - Days to cover is high (>5 days) - squeeze mechanics favorable
 * - Stock is fundamentally sound (we check this via price trend)
 *
 * Otherwise, high short = warning only (smart money betting against)
 */
function checkShortInterest(summary: QuoteSummary): {
  signal: Signal | null;
  warning: Signal | null;
} {
  const shortPct = summary.defaultKeyStatistics?.shortPercentOfFloat?.raw;
  const shortRatio = summary.defaultKeyStatistics?.shortRatio?.raw; // days to cover

  if (!shortPct) return { signal: null, warning: null };

  // Convert to percentage if needed (Yahoo returns as decimal)
  const shortPercent = shortPct > 1 ? shortPct : shortPct * 100;

  // Get price trend indicator - if stock is in uptrend, squeeze is more likely
  // We use 52-week change as a proxy for trend
  const yearChange = summary.defaultKeyStatistics?.fiftyTwoWeekChange?.raw;
  const isUptrend = yearChange !== undefined && yearChange > 0;

  // High short interest (>15%) - interpretation depends on context
  if (shortPercent > 15) {
    // Squeeze potential ONLY if:
    // 1. High days to cover (>5) - mechanical squeeze conditions
    // 2. Stock is in uptrend - suggests shorts are wrong
    if (shortRatio && shortRatio > 5 && isUptrend) {
      return {
        signal: {
          name: 'Short Squeeze Setup',
          category: 'fundamental',
          points: 5,
          description:
            `${shortPercent.toFixed(1)}% short, ` +
            `${shortRatio.toFixed(1)} days to cover, stock in uptrend`,
          value: shortPercent,
        },
        warning: null, // No warning - signal is clearly bullish
      };
    }

    // Otherwise, high short = bears have conviction (warning only)
    return {
      signal: null,
      warning: {
        name: 'High Short Interest',
        category: 'fundamental',
        points: 0,
        description:
          `⚠️ ${shortPercent.toFixed(1)}% of float short — ` +
          `institutional bears positioned${!isUptrend ? ', stock in downtrend' : ''}`,
        value: shortPercent,
      },
    };
  }

  // Moderate short interest (10-15%) - informational warning only
  if (shortPercent > 10) {
    return {
      signal: null,
      warning: {
        name: 'Elevated Short Interest',
        category: 'fundamental',
        points: 0,
        description: `${shortPercent.toFixed(1)}% of float short — monitor for changes`,
        value: shortPercent,
      },
    };
  }

  // Low short interest (<5%) is a positive signal (minimal bearish bets)
  if (shortPercent < 5) {
    return {
      signal: {
        name: 'Low Short Interest',
        category: 'fundamental',
        points: 2,
        description: `Only ${shortPercent.toFixed(1)}% short — limited bearish sentiment`,
        value: shortPercent,
      },
      warning: null,
    };
  }

  // 5-10% is neutral, no signal or warning
  return { signal: null, warning: null };
}

/**
 * v1.7.0: Check Balance Sheet Health (debt metrics)
 *
 * Note: Yahoo Finance returns debtToEquity as a percentage (e.g., 41.0 = 0.41 ratio)
 * We validate by cross-referencing with totalDebt/totalEquity when available.
 *
 * v1.7.1: Fixed normalization to avoid misclassifying highly leveraged companies
 */
function checkBalanceSheetHealth(summary: QuoteSummary): {
  signal: Signal | null;
  warning: Signal | null;
} {
  let debtToEquity = summary.financialData?.debtToEquity?.raw;
  const currentRatio = summary.financialData?.currentRatio?.raw;
  const totalCash = summary.financialData?.totalCash?.raw;
  const totalDebt = summary.financialData?.totalDebt?.raw;

  // Normalize D/E: Yahoo returns as percentage (41.0 = 41% = 0.41 ratio)
  // But we need to be careful not to misclassify truly leveraged companies
  //
  // Strategy:
  // 1. If totalDebt and market data available, calculate expected D/E
  // 2. Otherwise, use heuristic: D/E > 50 is almost certainly percentage format
  //    (Very few companies have actual D/E ratio > 50)
  if (debtToEquity !== undefined) {
    // Heuristic: D/E > 50 is almost certainly in percentage format
    // Real D/E > 50 would mean debt is 50x equity (extremely rare)
    if (debtToEquity > 50) {
      debtToEquity = debtToEquity / 100;
    } else if (debtToEquity > 10) {
      // For values 10-50, check if it seems reasonable as a ratio
      // Most healthy companies have D/E < 2, highly leveraged might be 3-5
      // D/E of 10+ as a ratio is very rare (would be bankrupt-level leverage)
      // So values 10-50 are likely percentages (10% - 50%)
      debtToEquity = debtToEquity / 100;
    }
    // Values 0-10 could be either:
    // - Actual ratios (0.5-10x leverage) - reasonable
    // - Percentages (0.5%-10%) - also possible but less common reporting
    // We keep them as-is since both interpretations give similar signals
  }

  let signal: Signal | null = null;
  let warning: Signal | null = null;

  // First check for net cash position - this overrides debt concerns
  const hasNetCash = totalCash && totalDebt && totalCash > totalDebt;

  if (hasNetCash) {
    const netCash = totalCash - totalDebt;
    const netCashStr =
      netCash >= 1e9
        ? `$${(netCash / 1e9).toFixed(1)}B`
        : `$${(netCash / 1e6).toFixed(0)}M`;
    signal = {
      name: 'Net Cash Position',
      category: 'fundamental',
      points: 5,
      description: `${netCashStr} net cash — no debt pressure`,
      value: netCash,
    };
    // Don't add debt warning if company has net cash
    return { signal, warning: null };
  }

  // Check for fortress balance sheet (low debt, high liquidity)
  if (
    debtToEquity !== undefined &&
    debtToEquity < 0.3 &&
    currentRatio &&
    currentRatio > 2
  ) {
    signal = {
      name: 'Fortress Balance Sheet',
      category: 'fundamental',
      points: 5,
      description: `D/E ${debtToEquity.toFixed(2)}, Current Ratio ${currentRatio.toFixed(1)} — very strong`,
      value: debtToEquity,
    };
  } else if (debtToEquity !== undefined && debtToEquity < 0.5) {
    signal = {
      name: 'Low Debt',
      category: 'fundamental',
      points: 3,
      description: `Debt/Equity ${debtToEquity.toFixed(2)} — conservative leverage`,
      value: debtToEquity,
    };
  } else if (
    debtToEquity !== undefined &&
    debtToEquity < 1.0 &&
    currentRatio &&
    currentRatio > 1.5
  ) {
    signal = {
      name: 'Healthy Balance Sheet',
      category: 'fundamental',
      points: 2,
      description: `D/E ${debtToEquity.toFixed(2)}, Current ${currentRatio.toFixed(1)}`,
      value: debtToEquity,
    };
  }

  // Check for warning signs (only if no net cash position)
  if (debtToEquity !== undefined && debtToEquity > 2.0) {
    warning = {
      name: 'High Debt Load',
      category: 'fundamental',
      points: 0,
      description: `⚠️ Debt/Equity ${debtToEquity.toFixed(2)} — elevated leverage risk`,
      value: debtToEquity,
    };
  } else if (currentRatio !== undefined && currentRatio < 1.0) {
    warning = {
      name: 'Liquidity Concern',
      category: 'fundamental',
      points: 0,
      description: `⚠️ Current Ratio ${currentRatio.toFixed(2)} — may struggle to cover short-term obligations`,
      value: currentRatio,
    };
  }

  return { signal, warning };
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
      name: 'Unprofitable Company',
      category: 'fundamental',
      points: 0,
      description: `Negative profit margin (${(profitMargin * 100).toFixed(1)}%) — company is losing money`,
      value: profitMargin,
    });
  }

  // Check for negative earnings growth
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

  // Check for negative EV/EBITDA (means EBITDA is negative)
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

  // Check for extremely high valuation without earnings
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
 * v1.8.0: Check insider ownership and activity
 *
 * High insider ownership (>5%) = aligned interests
 * Very high insider ownership (>15%) = strong conviction
 * Low insider ownership (<1%) = less skin in the game
 *
 * @param insidersPercent - Percentage of shares owned by insiders
 */
export function checkInsiderOwnership(
  insidersPercent: number | null | undefined
): { signal: Signal | null; warning: Signal | null } {
  if (insidersPercent === null || insidersPercent === undefined) {
    return { signal: null, warning: null };
  }

  // Very high insider ownership (>15%) - strong alignment
  if (insidersPercent > 15) {
    return {
      signal: {
        name: 'High Insider Ownership',
        category: 'fundamental',
        points: 5,
        description:
          `Insiders own ${insidersPercent.toFixed(1)}% — ` +
          `strong management alignment`,
        value: insidersPercent,
      },
      warning: null,
    };
  }

  // Good insider ownership (5-15%)
  if (insidersPercent > 5) {
    return {
      signal: {
        name: 'Insider Ownership',
        category: 'fundamental',
        points: 3,
        description:
          `Insiders own ${insidersPercent.toFixed(1)}% — ` +
          `management has skin in the game`,
        value: insidersPercent,
      },
      warning: null,
    };
  }

  // Moderate insider ownership (1-5%) - informational
  if (insidersPercent >= 1) {
    return {
      signal: {
        name: 'Moderate Insider Ownership',
        category: 'fundamental',
        points: 1,
        description: `Insiders own ${insidersPercent.toFixed(1)}%`,
        value: insidersPercent,
      },
      warning: null,
    };
  }

  // Very low insider ownership (<1%) - warning
  return {
    signal: null,
    warning: {
      name: 'Low Insider Ownership',
      category: 'fundamental',
      points: 0,
      description:
        `Insiders own only ${insidersPercent.toFixed(2)}% — ` +
        `limited management alignment`,
      value: insidersPercent,
    },
  };
}

/**
 * v1.8.0: Check institutional ownership levels
 *
 * High institutional ownership (>70%) = smart money interest
 * But very high (>90%) = crowded trade risk
 * Low institutional ownership (<30%) = under the radar (could be opportunity)
 *
 * @param institutionsPercent - Percentage of shares owned by institutions
 */
export function checkInstitutionalOwnership(
  institutionsPercent: number | null | undefined
): { signal: Signal | null; warning: Signal | null } {
  if (institutionsPercent === null || institutionsPercent === undefined) {
    return { signal: null, warning: null };
  }

  // Very high institutional ownership (>90%) - crowded trade warning
  if (institutionsPercent > 90) {
    return {
      signal: null,
      warning: {
        name: 'Crowded Institutional Trade',
        category: 'fundamental',
        points: 0,
        description:
          `Institutions own ${institutionsPercent.toFixed(0)}% — ` +
          `crowded trade, watch for selling pressure`,
        value: institutionsPercent,
      },
    };
  }

  // High institutional ownership (70-90%) - smart money interest
  if (institutionsPercent > 70) {
    return {
      signal: {
        name: 'Strong Institutional Support',
        category: 'fundamental',
        points: 3,
        description:
          `Institutions own ${institutionsPercent.toFixed(0)}% — ` +
          `smart money backing`,
        value: institutionsPercent,
      },
      warning: null,
    };
  }

  // Moderate institutional ownership (40-70%) - balanced
  if (institutionsPercent >= 40) {
    return {
      signal: {
        name: 'Institutional Interest',
        category: 'fundamental',
        points: 2,
        description: `Institutions own ${institutionsPercent.toFixed(0)}%`,
        value: institutionsPercent,
      },
      warning: null,
    };
  }

  // Low institutional ownership (<40%) - under the radar
  // This isn't necessarily bad - could be an undiscovered opportunity
  return { signal: null, warning: null };
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
 * v1.3.0: Added warnings for unprofitable/speculative stocks
 * v1.7.0: Added short interest and balance sheet health signals
 */
export function calculateFundamentalSignals(
  summary: QuoteSummary,
  marketCap?: number
): FundamentalResult {
  const signals: Signal[] = [];
  const warnings: Signal[] = [];
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

  // v1.7.0: Short interest signals
  const shortResult = checkShortInterest(summary);
  if (shortResult.signal) {
    signals.push(shortResult.signal);
    score += shortResult.signal.points;
  }
  if (shortResult.warning) {
    warnings.push(shortResult.warning);
  }

  // v1.7.0: Balance sheet health signals
  const balanceSheetResult = checkBalanceSheetHealth(summary);
  if (balanceSheetResult.signal) {
    signals.push(balanceSheetResult.signal);
    score += balanceSheetResult.signal.points;
  }
  if (balanceSheetResult.warning) {
    warnings.push(balanceSheetResult.warning);
  }

  // Sector comparison
  const sector = summary.assetProfile?.sector;
  const pe = summary.summaryDetail?.trailingPE?.raw;
  const peg = summary.defaultKeyStatistics?.pegRatio?.raw;
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  const sectorComparison = compareToBenchmark(sector, pe, peg, evEbitda);

  // v1.3.0: Check for warnings and data quality
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
