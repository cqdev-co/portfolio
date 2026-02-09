/**
 * Shared Fundamental Signal Detection
 *
 * Strategy-agnostic fundamental analysis functions.
 * Each engine calls these with its own score cap.
 */

import type { QuoteSummary, Signal } from '../types.ts';

// ============================================================================
// THRESHOLDS (defaults, can be overridden per engine)
// ============================================================================

export interface FundamentalThresholds {
  pegRatioMax: number;
  pegRatioGood: number;
  fcfYieldMin: number;
  fcfYieldHigh: number;
  forwardPEDiscountPercent: number;
  evEbitdaMax: number;
  evEbitdaGood: number;
}

export const DEFAULT_FUNDAMENTAL_THRESHOLDS: FundamentalThresholds = {
  pegRatioMax: 1.5,
  pegRatioGood: 2.0,
  fcfYieldMin: 0.03,
  fcfYieldHigh: 0.05,
  forwardPEDiscountPercent: 0.1,
  evEbitdaMax: 15,
  evEbitdaGood: 20,
};

export interface FundamentalWeights {
  pegUnderOne: number;
  fcfYieldHigh: number;
  forwardPELow: number;
  evEbitdaLow: number;
}

export const DEFAULT_FUNDAMENTAL_WEIGHTS: FundamentalWeights = {
  pegUnderOne: 10,
  fcfYieldHigh: 8,
  forwardPELow: 7,
  evEbitdaLow: 5,
};

// ============================================================================
// INDIVIDUAL CHECK FUNCTIONS
// ============================================================================

export function checkPEGRatio(
  summary: QuoteSummary,
  thresholds = DEFAULT_FUNDAMENTAL_THRESHOLDS,
  weights = DEFAULT_FUNDAMENTAL_WEIGHTS
): Signal | null {
  const peg =
    summary.defaultKeyStatistics?.pegRatio?.raw ??
    summary.summaryDetail?.pegRatio?.raw;

  if (peg === undefined || peg <= 0) return null;

  if (peg < thresholds.pegRatioMax) {
    return {
      name: 'PEG Attractive',
      category: 'fundamental',
      points: weights.pegUnderOne,
      description: `PEG Ratio = ${peg.toFixed(2)} (undervalued vs growth)`,
      value: peg,
    };
  }

  if (peg < thresholds.pegRatioGood) {
    return {
      name: 'PEG Reasonable',
      category: 'fundamental',
      points: Math.floor(weights.pegUnderOne * 0.5),
      description: `PEG Ratio = ${peg.toFixed(2)} (fair value vs growth)`,
      value: peg,
    };
  }

  return null;
}

export function checkFCFYield(
  summary: QuoteSummary,
  marketCap: number | undefined,
  thresholds = DEFAULT_FUNDAMENTAL_THRESHOLDS,
  weights = DEFAULT_FUNDAMENTAL_WEIGHTS
): Signal | null {
  const fcf = summary.financialData?.freeCashflow?.raw;
  const currency = summary.financialData?.financialCurrency;

  if (!fcf || fcf <= 0 || !marketCap || marketCap <= 0) return null;
  if (currency && currency !== 'USD') return null;

  const fcfYield = fcf / marketCap;
  if (fcfYield > 0.2) return null; // Sanity check

  if (fcfYield > thresholds.fcfYieldHigh) {
    return {
      name: 'High FCF Yield',
      category: 'fundamental',
      points: weights.fcfYieldHigh,
      description: `FCF Yield ${(fcfYield * 100).toFixed(1)}% (excellent cash generation)`,
      value: fcfYield,
    };
  }

  if (fcfYield > thresholds.fcfYieldMin) {
    return {
      name: 'Positive FCF Yield',
      category: 'fundamental',
      points: Math.floor(weights.fcfYieldHigh * 0.6),
      description: `FCF Yield ${(fcfYield * 100).toFixed(1)}% (solid cash generation)`,
      value: fcfYield,
    };
  }

  return null;
}

export function checkForwardPE(
  summary: QuoteSummary,
  thresholds = DEFAULT_FUNDAMENTAL_THRESHOLDS,
  weights = DEFAULT_FUNDAMENTAL_WEIGHTS
): Signal | null {
  const forwardPE = summary.summaryDetail?.forwardPE?.raw;
  const trailingPE = summary.summaryDetail?.trailingPE?.raw;

  if (!forwardPE || forwardPE <= 0) return null;

  if (
    trailingPE &&
    forwardPE < trailingPE * (1 - thresholds.forwardPEDiscountPercent)
  ) {
    return {
      name: 'Forward P/E Attractive',
      category: 'fundamental',
      points: weights.forwardPELow,
      description: `Forward P/E (${forwardPE.toFixed(1)}) < Trailing (${trailingPE.toFixed(1)})`,
      value: forwardPE,
    };
  }

  if (forwardPE < 15) {
    return {
      name: 'Low Forward P/E',
      category: 'fundamental',
      points: Math.floor(weights.forwardPELow / 2),
      description: `Forward P/E = ${forwardPE.toFixed(1)}`,
      value: forwardPE,
    };
  }

  return null;
}

export function checkEVEBITDA(
  summary: QuoteSummary,
  thresholds = DEFAULT_FUNDAMENTAL_THRESHOLDS,
  weights = DEFAULT_FUNDAMENTAL_WEIGHTS
): Signal | null {
  const evEbitda = summary.defaultKeyStatistics?.enterpriseToEbitda?.raw;
  if (!evEbitda || evEbitda <= 0) return null;

  if (evEbitda < thresholds.evEbitdaMax) {
    return {
      name: 'Low EV/EBITDA',
      category: 'fundamental',
      points: weights.evEbitdaLow,
      description: `EV/EBITDA = ${evEbitda.toFixed(1)} (attractive valuation)`,
      value: evEbitda,
    };
  }

  if (evEbitda < thresholds.evEbitdaGood) {
    return {
      name: 'Reasonable EV/EBITDA',
      category: 'fundamental',
      points: Math.floor(weights.evEbitdaLow * 0.5),
      description: `EV/EBITDA = ${evEbitda.toFixed(1)} (fair valuation)`,
      value: evEbitda,
    };
  }

  return null;
}

export function checkEarningsGrowth(summary: QuoteSummary): Signal | null {
  const earningsGrowth = summary.financialData?.earningsGrowth?.raw;
  if (!earningsGrowth) return null;
  if (earningsGrowth > 0.15) {
    return {
      name: 'Strong Earnings Growth',
      category: 'fundamental',
      points: 5,
      description: `Earnings growth ${(earningsGrowth * 100).toFixed(0)}%`,
      value: earningsGrowth,
    };
  }
  return null;
}

export function checkRevenueGrowth(summary: QuoteSummary): Signal | null {
  const revenueGrowth = summary.financialData?.revenueGrowth?.raw;
  if (!revenueGrowth) return null;
  if (revenueGrowth > 0.1) {
    return {
      name: 'Revenue Growing',
      category: 'fundamental',
      points: 3,
      description: `Revenue growth ${(revenueGrowth * 100).toFixed(0)}%`,
      value: revenueGrowth,
    };
  }
  return null;
}

export function checkProfitMargins(summary: QuoteSummary): Signal | null {
  const margin =
    summary.financialData?.profitMargins?.raw ??
    summary.financialData?.operatingMargins?.raw;

  if (!margin) return null;

  if (margin > 0.2) {
    return {
      name: 'Strong Profit Margins',
      category: 'fundamental',
      points: 5,
      description: `Profit margin ${(margin * 100).toFixed(0)}% (high profitability)`,
      value: margin,
    };
  }

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

export function checkROE(summary: QuoteSummary): Signal | null {
  const roe = summary.financialData?.returnOnEquity?.raw;
  if (!roe) return null;

  if (roe > 0.2) {
    return {
      name: 'High ROE',
      category: 'fundamental',
      points: 5,
      description: `ROE ${(roe * 100).toFixed(0)}% (excellent capital efficiency)`,
      value: roe,
    };
  }

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

export function checkPriceToBook(summary: QuoteSummary): Signal | null {
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

export function checkShortInterest(summary: QuoteSummary): {
  signal: Signal | null;
  warning: Signal | null;
} {
  const shortPct = summary.defaultKeyStatistics?.shortPercentOfFloat?.raw;
  const shortRatio = summary.defaultKeyStatistics?.shortRatio?.raw;

  if (!shortPct) return { signal: null, warning: null };

  const shortPercent = shortPct > 1 ? shortPct : shortPct * 100;
  const yearChange = summary.defaultKeyStatistics?.fiftyTwoWeekChange?.raw;
  const isUptrend = yearChange !== undefined && yearChange > 0;

  if (shortPercent > 15) {
    if (shortRatio && shortRatio > 5 && isUptrend) {
      return {
        signal: {
          name: 'Short Squeeze Setup',
          category: 'fundamental',
          points: 5,
          description: `${shortPercent.toFixed(1)}% short, ${shortRatio.toFixed(1)} days to cover, stock in uptrend`,
          value: shortPercent,
        },
        warning: null,
      };
    }
    return {
      signal: null,
      warning: {
        name: 'High Short Interest',
        category: 'fundamental',
        points: 0,
        description: `${shortPercent.toFixed(1)}% of float short — institutional bears positioned${!isUptrend ? ', stock in downtrend' : ''}`,
        value: shortPercent,
      },
    };
  }

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

  return { signal: null, warning: null };
}

export function checkBalanceSheetHealth(summary: QuoteSummary): {
  signal: Signal | null;
  warning: Signal | null;
} {
  let debtToEquity = summary.financialData?.debtToEquity?.raw;
  const currentRatio = summary.financialData?.currentRatio?.raw;
  const totalCash = summary.financialData?.totalCash?.raw;
  const totalDebt = summary.financialData?.totalDebt?.raw;

  if (debtToEquity !== undefined) {
    if (debtToEquity > 50) debtToEquity = debtToEquity / 100;
    else if (debtToEquity > 10) debtToEquity = debtToEquity / 100;
  }

  const hasNetCash = totalCash && totalDebt && totalCash > totalDebt;

  if (hasNetCash) {
    const netCash = totalCash - totalDebt;
    const netCashStr =
      netCash >= 1e9
        ? `$${(netCash / 1e9).toFixed(1)}B`
        : `$${(netCash / 1e6).toFixed(0)}M`;
    return {
      signal: {
        name: 'Net Cash Position',
        category: 'fundamental',
        points: 5,
        description: `${netCashStr} net cash — no debt pressure`,
        value: netCash,
      },
      warning: null,
    };
  }

  let signal: Signal | null = null;
  let warning: Signal | null = null;

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

  if (debtToEquity !== undefined && debtToEquity > 2.0) {
    warning = {
      name: 'High Debt Load',
      category: 'fundamental',
      points: 0,
      description: `Debt/Equity ${debtToEquity.toFixed(2)} — elevated leverage risk`,
      value: debtToEquity,
    };
  } else if (currentRatio !== undefined && currentRatio < 1.0) {
    warning = {
      name: 'Liquidity Concern',
      category: 'fundamental',
      points: 0,
      description: `Current Ratio ${currentRatio.toFixed(2)} — may struggle to cover short-term obligations`,
      value: currentRatio,
    };
  }

  return { signal, warning };
}

export function checkInsiderOwnership(
  insidersPercent: number | null | undefined
): { signal: Signal | null; warning: Signal | null } {
  if (insidersPercent === null || insidersPercent === undefined)
    return { signal: null, warning: null };

  if (insidersPercent > 15)
    return {
      signal: {
        name: 'High Insider Ownership',
        category: 'fundamental',
        points: 5,
        description: `Insiders own ${insidersPercent.toFixed(1)}% — strong management alignment`,
        value: insidersPercent,
      },
      warning: null,
    };

  if (insidersPercent > 5)
    return {
      signal: {
        name: 'Insider Ownership',
        category: 'fundamental',
        points: 3,
        description: `Insiders own ${insidersPercent.toFixed(1)}% — management has skin in the game`,
        value: insidersPercent,
      },
      warning: null,
    };

  if (insidersPercent >= 1)
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

  return {
    signal: null,
    warning: {
      name: 'Low Insider Ownership',
      category: 'fundamental',
      points: 0,
      description: `Insiders own only ${insidersPercent.toFixed(2)}% — limited management alignment`,
      value: insidersPercent,
    },
  };
}

export function checkInstitutionalOwnership(
  institutionsPercent: number | null | undefined
): { signal: Signal | null; warning: Signal | null } {
  if (institutionsPercent === null || institutionsPercent === undefined)
    return { signal: null, warning: null };

  if (institutionsPercent > 90)
    return {
      signal: null,
      warning: {
        name: 'Crowded Institutional Trade',
        category: 'fundamental',
        points: 0,
        description: `Institutions own ${institutionsPercent.toFixed(0)}% — crowded trade, watch for selling pressure`,
        value: institutionsPercent,
      },
    };

  if (institutionsPercent > 70)
    return {
      signal: {
        name: 'Strong Institutional Support',
        category: 'fundamental',
        points: 3,
        description: `Institutions own ${institutionsPercent.toFixed(0)}% — smart money backing`,
        value: institutionsPercent,
      },
      warning: null,
    };

  if (institutionsPercent >= 40)
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

  return { signal: null, warning: null };
}
