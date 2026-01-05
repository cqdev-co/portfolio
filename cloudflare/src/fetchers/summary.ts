/**
 * Summary Fetcher
 * 
 * Fetches earnings, analyst ratings, and short interest data
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import { fetchYahooAPI } from '../auth/crumb';
import type { 
  YahooAuth, 
  SummaryData, 
  EarningsData, 
  AnalystsData, 
  ShortInterestData,
  YahooSummaryResponse,
} from '../types';

/**
 * Fetch summary data (earnings, analysts, short interest)
 */
export async function fetchSummary(
  ticker: string,
  auth: YahooAuth
): Promise<SummaryData> {
  const cacheKey = getCacheKey('summary', ticker);
  const cached = await getFromCache<SummaryData>(cacheKey);
  
  if (cached) {
    console.log(`[Cache] HIT summary/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }
  
  const modules = [
    'calendarEvents',
    'recommendationTrend',
    'defaultKeyStatistics',
    'summaryDetail',
  ].join(',');
  
  const data = await withRetry(
    () => fetchYahooAPI<YahooSummaryResponse>(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/` +
      `${ticker.toUpperCase()}?modules=${modules}`,
      auth
    ),
    `summary/${ticker}`
  );
  
  const summary = data.quoteSummary?.result?.[0];
  
  // Extract earnings
  const earnings = extractEarnings(summary);
  
  // Extract analyst ratings
  const analysts = extractAnalysts(summary);
  
  // Extract short interest
  const shortInterest = extractShortInterest(summary);
  
  // Extract beta and EPS from defaultKeyStatistics
  const ks = summary?.defaultKeyStatistics;
  const beta = ks?.beta?.raw ?? null;
  const eps = ks?.trailingEps?.raw ?? null;
  
  const result: SummaryData = { 
    earnings, 
    analysts, 
    shortInterest, 
    beta, 
    eps 
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
    bullishPct: total > 0 
      ? Math.round((strongBuy + buy) / total * 100) 
      : 0,
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

