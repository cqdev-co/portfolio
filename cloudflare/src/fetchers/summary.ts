/**
 * Summary Fetcher v4.1
 *
 * Fetches comprehensive data: earnings, analysts, fundamentals,
 * EPS trends, earnings history, insider activity, and profile.
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import { fetchYahooAPI } from '../auth/crumb';
import { logger } from '../utils/logger';
import type {
  YahooAuth,
  SummaryData,
  EarningsData,
  AnalystsData,
  ShortInterestData,
  FundamentalsData,
  EPSTrendData,
  EarningsHistoryData,
  InsiderActivityData,
  ProfileData,
  YahooSummaryResponse,
} from '../types';

/**
 * Fetch comprehensive summary data
 * v4.1: Expanded with fundamentals, EPS trends, earnings history, insider
 */
export async function fetchSummary(
  ticker: string,
  auth: YahooAuth
): Promise<SummaryData> {
  const cacheKey = getCacheKey('summary', ticker);
  const cached = await getFromCache<SummaryData>(cacheKey);

  if (cached) {
    logger.debug(`[Cache] HIT summary/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }

  // v4.1: Request all modules needed for scoring
  const modules = [
    'calendarEvents',
    'recommendationTrend',
    'defaultKeyStatistics',
    'financialData',
    'earningsTrend',
    'earningsHistory',
    'netSharePurchaseActivity',
    'assetProfile',
  ].join(',');

  // URL-encode ticker to handle symbols with periods (BRK.B -> BRK%2EB)
  const encodedTicker = encodeURIComponent(ticker.toUpperCase());
  const data = await withRetry(
    () =>
      fetchYahooAPI<YahooSummaryResponse>(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/` +
          `${encodedTicker}?modules=${modules}`,
        auth
      ),
    `summary/${ticker}`
  );

  const summary = data.quoteSummary?.result?.[0];

  // Extract all data components
  const earnings = extractEarnings(summary);
  const analysts = extractAnalysts(summary);
  const shortInterest = extractShortInterest(summary);
  const fundamentals = extractFundamentals(summary);
  const epsTrend = extractEPSTrend(summary);
  const earningsHistory = extractEarningsHistory(summary);
  const insiderActivity = extractInsiderActivity(summary);
  const profile = extractProfile(summary);

  // Extract beta and EPS from defaultKeyStatistics
  const ks = summary?.defaultKeyStatistics;
  const beta = ks?.beta?.raw ?? null;
  const eps = ks?.trailingEps?.raw ?? null;

  const result: SummaryData = {
    earnings,
    analysts,
    shortInterest,
    beta,
    eps,
    // v4.1: New fields
    fundamentals,
    epsTrend,
    earningsHistory,
    insiderActivity,
    profile,
  };

  await storeInCache(cacheKey, result, CONFIG.cache.summary);
  return result;
}

// Type for quoteSummary result item
type SummaryResult = NonNullable<
  NonNullable<YahooSummaryResponse['quoteSummary']>['result']
>[number];

/**
 * Extract earnings data from summary
 */
function extractEarnings(
  summary: SummaryResult | undefined
): EarningsData | null {
  const earningsDate = summary?.calendarEvents?.earnings?.earningsDate?.[0];

  if (!earningsDate?.raw) return null;

  const date = new Date(earningsDate.raw * 1000);
  const daysUntil = Math.ceil(
    (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return {
    date: date.toISOString().split('T')[0],
    daysUntil,
  };
}

/**
 * Extract analyst ratings from summary
 */
function extractAnalysts(
  summary: SummaryResult | undefined
): AnalystsData | null {
  const trend = summary?.recommendationTrend?.trend?.[0];

  if (!trend) return null;

  const strongBuy = trend.strongBuy ?? 0;
  const buy = trend.buy ?? 0;
  const hold = trend.hold ?? 0;
  const sell = trend.sell ?? 0;
  const strongSell = trend.strongSell ?? 0;
  const total = strongBuy + buy + hold + sell + strongSell;

  return {
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    total,
    bullishPct: total > 0 ? Math.round(((strongBuy + buy) / total) * 100) : 0,
  };
}

/**
 * Extract short interest data from summary
 */
function extractShortInterest(
  summary: SummaryResult | undefined
): ShortInterestData | null {
  const ks = summary?.defaultKeyStatistics;

  if (!ks?.shortRatio?.raw && !ks?.shortPercentOfFloat?.raw) {
    return null;
  }

  return {
    shortRatio: ks.shortRatio?.raw ?? 0,
    shortPctFloat: ks.shortPercentOfFloat?.raw
      ? Math.round(ks.shortPercentOfFloat.raw * 10000) / 100
      : 0,
  };
}

/**
 * v4.1: Extract fundamental metrics for scoring
 */
function extractFundamentals(
  summary: SummaryResult | undefined
): FundamentalsData | null {
  const fd = summary?.financialData;
  const ks = summary?.defaultKeyStatistics;

  if (!fd && !ks) return null;

  return {
    pegRatio: ks?.pegRatio?.raw ?? null,
    priceToBook: ks?.priceToBook?.raw ?? null,
    evToEbitda: ks?.enterpriseToEbitda?.raw ?? null,
    freeCashFlow: fd?.freeCashflow?.raw ?? null,
    fcfYield: null, // Calculated by client with market cap
    revenueGrowth: fd?.revenueGrowth?.raw
      ? Math.round(fd.revenueGrowth.raw * 1000) / 10
      : null,
    earningsGrowth: fd?.earningsGrowth?.raw
      ? Math.round(fd.earningsGrowth.raw * 1000) / 10
      : null,
    profitMargins: fd?.profitMargins?.raw
      ? Math.round(fd.profitMargins.raw * 1000) / 10
      : null,
    operatingMargins: fd?.operatingMargins?.raw
      ? Math.round(fd.operatingMargins.raw * 1000) / 10
      : null,
    returnOnEquity: fd?.returnOnEquity?.raw
      ? Math.round(fd.returnOnEquity.raw * 1000) / 10
      : null,
    debtToEquity: fd?.debtToEquity?.raw ?? null,
    currentRatio: fd?.currentRatio?.raw ?? null,
    totalCash: fd?.totalCash?.raw ?? null,
    totalDebt: fd?.totalDebt?.raw ?? null,
    targetMeanPrice: fd?.targetMeanPrice?.raw ?? null,
    recommendationMean: fd?.recommendationMean?.raw ?? null,
    numberOfAnalystOpinions: fd?.numberOfAnalystOpinions?.raw ?? null,
  };
}

/**
 * v4.1: Extract EPS trend and revisions
 */
function extractEPSTrend(
  summary: SummaryResult | undefined
): EPSTrendData | null {
  const trend = summary?.earningsTrend?.trend?.[0];

  if (!trend) return null;

  const et = trend.epsTrend;
  const er = trend.epsRevisions;

  return {
    current: et?.current?.raw ?? null,
    sevenDaysAgo: et?.['7daysAgo']?.raw ?? null,
    thirtyDaysAgo: et?.['30daysAgo']?.raw ?? null,
    sixtyDaysAgo: et?.['60daysAgo']?.raw ?? null,
    ninetyDaysAgo: et?.['90daysAgo']?.raw ?? null,
    upLast7days: er?.upLast7days?.raw ?? 0,
    upLast30days: er?.upLast30days?.raw ?? 0,
    downLast7days: er?.downLast7days?.raw ?? 0,
    downLast30days: er?.downLast30days?.raw ?? 0,
  };
}

/**
 * v4.1: Extract earnings beat/miss history
 */
function extractEarningsHistory(
  summary: SummaryResult | undefined
): EarningsHistoryData | null {
  const history = summary?.earningsHistory?.history;

  if (!history || history.length === 0) return null;

  let beatCount = 0;
  let missCount = 0;

  const quarters = history.slice(0, 4).map((h) => {
    const actual = h.epsActual?.raw ?? null;
    const estimate = h.epsEstimate?.raw ?? null;
    const surprise = h.surprisePercent?.raw ?? null;
    const beat =
      actual !== null && estimate !== null ? actual > estimate : null;

    if (beat === true) beatCount++;
    if (beat === false) missCount++;

    // Format quarter from timestamp
    const quarterDate = h.quarter?.raw ? new Date(h.quarter.raw * 1000) : null;
    const quarter = quarterDate
      ? `${Math.ceil((quarterDate.getMonth() + 1) / 3)}Q${quarterDate.getFullYear()}`
      : 'N/A';

    return {
      quarter,
      epsActual: actual,
      epsEstimate: estimate,
      surprise: surprise ? Math.round(surprise * 100) / 100 : null,
      beat,
    };
  });

  return { quarters, beatCount, missCount };
}

/**
 * v4.1: Extract insider buying/selling activity
 */
function extractInsiderActivity(
  summary: SummaryResult | undefined
): InsiderActivityData | null {
  const nsp = summary?.netSharePurchaseActivity;

  if (!nsp) return null;

  return {
    buyCount: nsp.buyInfoCount?.raw ?? 0,
    buyShares: nsp.buyInfoShares?.raw ?? 0,
    sellCount: nsp.sellInfoCount?.raw ?? 0,
    sellShares: nsp.sellInfoShares?.raw ?? 0,
    netShares: nsp.netInfoShares?.raw ?? 0,
    period: nsp.period ?? '6M',
  };
}

/**
 * v4.1: Extract company profile (sector/industry)
 */
function extractProfile(
  summary: SummaryResult | undefined
): ProfileData | null {
  const ap = summary?.assetProfile;

  if (!ap) return null;

  return {
    sector: ap.sector ?? null,
    industry: ap.industry ?? null,
    country: ap.country ?? null,
    employees: ap.fullTimeEmployees ?? null,
  };
}
