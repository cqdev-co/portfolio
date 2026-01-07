/**
 * Shared Yahoo Finance Data Provider
 *
 * Uses the shared lib/ai-agent/data/yahoo-proxy for efficient data fetching:
 * - Cloudflare Worker proxy bypasses IP rate limits
 * - Combined endpoint fetches all data in 1 request (5x more efficient)
 * - Built-in fallback to Polygon.io
 * - Automatic retry with exponential backoff
 *
 * This replaces direct yahoo-finance2 calls to reduce duplication
 * and leverage the shared infrastructure.
 */

import type {
  HistoricalData,
  QuoteSummary,
  QuoteData,
} from '../types/index.ts';
import { logger } from '../utils/logger.ts';

// Import shared proxy functions from lib
// Note: These paths assume the lib is accessible from screen-ticker
// In practice, you may need to adjust based on your monorepo setup

// ============================================================================
// TYPES
// ============================================================================

interface ProxyQuote {
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  beta: number | null;
  dividendYield: number;
  fiftyDayAverage: number;
  twoHundredDayAverage: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
}

interface ProxyChart {
  dataPoints: number;
  quotes: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

interface ProxyAnalysts {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  total: number;
  bullishPct: number;
}

interface ProxyShortInterest {
  shortRatio: number;
  shortPctFloat: number;
}

interface ProxyEarnings {
  date: string;
  daysUntil: number;
}

interface ProxyOptions {
  expirations: number;
  nearestExpiry: string;
  callCount: number;
  putCount: number;
  atmIV: number | null;
  callVolume: number;
  putVolume: number;
  callOI: number;
  putOI: number;
  pcRatioVol: number | null;
  pcRatioOI: number | null;
}

// v4.1: Expanded proxy types
interface ProxyFundamentals {
  pegRatio: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  freeCashFlow: number | null;
  fcfYield: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  targetMeanPrice: number | null;
  recommendationMean: number | null;
  numberOfAnalystOpinions: number | null;
}

interface ProxyEPSTrend {
  current: number | null;
  sevenDaysAgo: number | null;
  thirtyDaysAgo: number | null;
  sixtyDaysAgo: number | null;
  ninetyDaysAgo: number | null;
  upLast7days: number;
  upLast30days: number;
  downLast7days: number;
  downLast30days: number;
}

interface ProxyEarningsHistory {
  quarters: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprise: number | null;
    beat: boolean | null;
  }>;
  beatCount: number;
  missCount: number;
}

interface ProxyInsiderActivity {
  buyCount: number;
  buyShares: number;
  sellCount: number;
  sellShares: number;
  netShares: number;
  period: string;
}

interface ProxyProfile {
  sector: string | null;
  industry: string | null;
  country: string | null;
  employees: number | null;
}

interface CombinedTickerResponse {
  ticker: string;
  timestamp: string;
  elapsed_ms: number;
  quote?: ProxyQuote;
  chart?: ProxyChart;
  earnings?: ProxyEarnings;
  analysts?: ProxyAnalysts;
  shortInterest?: ProxyShortInterest;
  // v4.1: Expanded data
  fundamentals?: ProxyFundamentals;
  epsTrend?: ProxyEPSTrend;
  earningsHistory?: ProxyEarningsHistory;
  insiderActivity?: ProxyInsiderActivity;
  profile?: ProxyProfile;
  options?: ProxyOptions;
  news?: Array<{
    title: string;
    source: string;
    link: string;
    date: string;
  }>;
  errors?: string[];
}

interface HoldingsResponse {
  ticker: string;
  insidersPercent: number | null;
  institutionsPercent: number | null;
  institutionsFloatPercent: number | null;
  institutionsCount: number | null;
  topHolders: Array<{
    name: string;
    pctHeld: number;
    value: number;
    reportDate: string | null;
  }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function getProxyUrl(): string | null {
  return process.env.YAHOO_PROXY_URL || null;
}

export function isProxyConfigured(): boolean {
  const configured = !!getProxyUrl();
  return configured;
}

// ============================================================================
// STATISTICS TRACKING
// ============================================================================

interface ProxyStats {
  proxyHits: number;
  proxyMisses: number;
  proxyErrors: number;
  fallbackCalls: number;
  cacheHits: number;
  lastError: string | null;
  lastErrorTime: Date | null;
}

const stats: ProxyStats = {
  proxyHits: 0,
  proxyMisses: 0,
  proxyErrors: 0,
  fallbackCalls: 0,
  cacheHits: 0,
  lastError: null,
  lastErrorTime: null,
};

/**
 * Get proxy statistics for debugging
 */
export function getProxyStats(): ProxyStats & {
  proxyUrl: string | null;
  configured: boolean;
  hitRate: string;
} {
  const total = stats.proxyHits + stats.proxyMisses + stats.proxyErrors;
  const hitRate =
    total > 0 ? `${((stats.proxyHits / total) * 100).toFixed(1)}%` : 'N/A';

  return {
    ...stats,
    proxyUrl: getProxyUrl(),
    configured: isProxyConfigured(),
    hitRate,
  };
}

/**
 * Reset proxy statistics
 */
export function resetProxyStats(): void {
  stats.proxyHits = 0;
  stats.proxyMisses = 0;
  stats.proxyErrors = 0;
  stats.fallbackCalls = 0;
  stats.cacheHits = 0;
  stats.lastError = null;
  stats.lastErrorTime = null;
}

// ============================================================================
// PROXY FETCH HELPERS
// ============================================================================

// Timeout for proxy requests (proxy takes ~500ms, so 10s is generous)
const PROXY_TIMEOUT_MS = 10_000;

async function proxyFetch<T>(endpoint: string): Promise<T> {
  const baseUrl = getProxyUrl();
  if (!baseUrl) {
    throw new Error('YAHOO_PROXY_URL not configured');
  }

  const url = `${baseUrl}${endpoint}`;
  logger.debug(`[Proxy] Fetching: ${endpoint}`);

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.warn(`[Proxy] ⏰ Request timed out after ${PROXY_TIMEOUT_MS}ms`);
  }, PROXY_TIMEOUT_MS);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Proxy error ${response.status}: ${text}`);
    }

    return response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// MAIN DATA FETCHING
// ============================================================================

/**
 * Fetch all ticker data via the shared proxy (1 request = 5x efficient)
 */
export async function fetchTickerViaProxy(
  ticker: string
): Promise<CombinedTickerResponse | null> {
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) {
    stats.proxyMisses++;
    return null;
  }

  try {
    const startTime = Date.now();
    // Yahoo Finance uses hyphens for share classes (BRK.B -> BRK-B)
    const normalizedTicker = ticker.toUpperCase().replace(/\./g, '-');
    const data = await proxyFetch<CombinedTickerResponse>(
      `/ticker/${normalizedTicker}`
    );
    const elapsed = Date.now() - startTime;

    if (!data.quote) {
      stats.proxyMisses++;
      logger.debug(`[Proxy] No quote for ${ticker} (${elapsed}ms)`);
      return null;
    }

    stats.proxyHits++;
    logger.debug(
      `[Proxy] ${ticker}: $${data.quote.price?.toFixed(2)} (${elapsed}ms)`
    );

    return data;
  } catch (error) {
    stats.proxyErrors++;
    stats.lastError = String(error);
    stats.lastErrorTime = new Date();

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Only log errors, not expected failures
    if (errorMsg.includes('429')) {
      logger.warn(`[Proxy] Rate limited on ${ticker}`);
    } else if (errorMsg.includes('abort')) {
      logger.warn(`[Proxy] Timeout on ${ticker}`);
    } else {
      logger.debug(`[Proxy] Failed ${ticker}: ${errorMsg.slice(0, 50)}`);
    }

    return null;
  }
}

/**
 * Fetch institutional holdings (for insider activity signal)
 */
export async function fetchHoldingsViaProxy(
  ticker: string
): Promise<HoldingsResponse | null> {
  if (!isProxyConfigured()) {
    logger.debug(`[Proxy] Holdings: proxy not configured`);
    return null;
  }

  try {
    // Yahoo Finance uses hyphens for share classes (BRK.B -> BRK-B)
    const normalizedTicker = ticker.toUpperCase().replace(/\./g, '-');
    const data = await proxyFetch<HoldingsResponse>(
      `/holdings/${normalizedTicker}`
    );
    logger.debug(`[Proxy] Got holdings for ${ticker}`);
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug(`[Proxy] Holdings fetch failed for ${ticker}: ${errorMsg}`);
    return null;
  }
}

/**
 * Convert proxy response to our internal QuoteData format
 */
export function convertToQuoteData(
  proxyData: CombinedTickerResponse
): QuoteData | null {
  const { quote } = proxyData;
  if (!quote) return null;

  return {
    symbol: proxyData.ticker,
    shortName: proxyData.ticker,
    regularMarketPrice: quote.price,
    regularMarketVolume: quote.volume,
    averageDailyVolume10Day: quote.avgVolume,
    marketCap: quote.marketCap,
    fiftyDayAverage: quote.fiftyDayAverage,
    twoHundredDayAverage: quote.twoHundredDayAverage,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
  };
}

/**
 * Convert proxy chart data to our internal HistoricalData format
 */
export function convertToHistoricalData(
  proxyData: CombinedTickerResponse
): HistoricalData[] {
  const { chart } = proxyData;
  if (!chart?.quotes) return [];

  return chart.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({
      date: new Date(q.date),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
    }));
}

/**
 * Convert proxy data to our internal QuoteSummary format
 * v4.1: Includes expanded fundamentals, EPS trends, earnings history
 */
export function convertToQuoteSummary(
  proxyData: CombinedTickerResponse
): QuoteSummary {
  const {
    quote,
    earnings,
    analysts,
    shortInterest,
    fundamentals,
    epsTrend,
    earningsHistory,
    insiderActivity,
    profile,
  } = proxyData;

  const summary: QuoteSummary = {
    price: {
      regularMarketPrice: quote ? { raw: quote.price } : undefined,
      shortName: proxyData.ticker,
    },
    summaryDetail: quote
      ? {
          trailingPE: quote.peRatio ? { raw: quote.peRatio } : undefined,
          forwardPE: quote.forwardPE ? { raw: quote.forwardPE } : undefined,
          pegRatio: fundamentals?.pegRatio
            ? { raw: fundamentals.pegRatio }
            : undefined,
          priceToBook: fundamentals?.priceToBook
            ? { raw: fundamentals.priceToBook }
            : undefined,
        }
      : undefined,
    defaultKeyStatistics: {},
    calendarEvents: {},
    recommendationTrend: {},
    earningsTrend: {},
    earningsHistory: {},
    netSharePurchaseActivity: {},
    assetProfile: {},
  };

  // Add short interest and other key stats
  if (shortInterest || fundamentals || quote) {
    summary.defaultKeyStatistics = {
      shortRatio: shortInterest ? { raw: shortInterest.shortRatio } : undefined,
      shortPercentOfFloat: shortInterest
        ? { raw: shortInterest.shortPctFloat / 100 }
        : undefined,
      beta: quote?.beta ? { raw: quote.beta } : undefined,
      enterpriseToEbitda: fundamentals?.evToEbitda
        ? { raw: fundamentals.evToEbitda }
        : undefined,
      pegRatio: fundamentals?.pegRatio
        ? { raw: fundamentals.pegRatio }
        : undefined,
    };
  }

  // Add financial data (FCF, margins, growth)
  if (fundamentals || quote) {
    summary.financialData = {
      currentPrice: quote ? { raw: quote.price } : undefined,
      freeCashflow: fundamentals?.freeCashFlow
        ? { raw: fundamentals.freeCashFlow }
        : undefined,
      revenueGrowth: fundamentals?.revenueGrowth
        ? { raw: fundamentals.revenueGrowth / 100 }
        : undefined,
      earningsGrowth: fundamentals?.earningsGrowth
        ? { raw: fundamentals.earningsGrowth / 100 }
        : undefined,
      profitMargins: fundamentals?.profitMargins
        ? { raw: fundamentals.profitMargins / 100 }
        : undefined,
      operatingMargins: fundamentals?.operatingMargins
        ? { raw: fundamentals.operatingMargins / 100 }
        : undefined,
      returnOnEquity: fundamentals?.returnOnEquity
        ? { raw: fundamentals.returnOnEquity / 100 }
        : undefined,
      debtToEquity: fundamentals?.debtToEquity
        ? { raw: fundamentals.debtToEquity }
        : undefined,
      currentRatio: fundamentals?.currentRatio
        ? { raw: fundamentals.currentRatio }
        : undefined,
      totalCash: fundamentals?.totalCash
        ? { raw: fundamentals.totalCash }
        : undefined,
      totalDebt: fundamentals?.totalDebt
        ? { raw: fundamentals.totalDebt }
        : undefined,
      targetMeanPrice: fundamentals?.targetMeanPrice
        ? { raw: fundamentals.targetMeanPrice }
        : undefined,
      recommendationMean: fundamentals?.recommendationMean
        ? { raw: fundamentals.recommendationMean }
        : undefined,
      numberOfAnalystOpinions: fundamentals?.numberOfAnalystOpinions
        ? { raw: fundamentals.numberOfAnalystOpinions }
        : undefined,
    };
  }

  // Add analyst recommendations
  if (analysts && analysts.total > 0) {
    summary.recommendationTrend = {
      trend: [
        {
          strongBuy: analysts.strongBuy,
          buy: analysts.buy,
          hold: analysts.hold,
          sell: analysts.sell,
          strongSell: analysts.strongSell,
        },
      ],
    };
  }

  // Add earnings date
  if (earnings?.date) {
    const earningsDate = new Date(earnings.date);
    summary.calendarEvents = {
      earnings: {
        earningsDate: [earningsDate],
      },
    };
  }

  // v4.1: Add EPS trend and revisions
  if (epsTrend) {
    summary.earningsTrend = {
      trend: [
        {
          period: '0q',
          epsTrend: {
            current: epsTrend.current ?? undefined,
            sevenDaysAgo: epsTrend.sevenDaysAgo ?? undefined,
            thirtyDaysAgo: epsTrend.thirtyDaysAgo ?? undefined,
            sixtyDaysAgo: epsTrend.sixtyDaysAgo ?? undefined,
            ninetyDaysAgo: epsTrend.ninetyDaysAgo ?? undefined,
          },
          epsRevisions: {
            upLast7days: epsTrend.upLast7days,
            upLast30days: epsTrend.upLast30days,
            downLast7days: epsTrend.downLast7days,
            downLast30days: epsTrend.downLast30days,
          },
        },
      ],
    };
  }

  // v4.1: Add earnings history (beat/miss)
  if (earningsHistory && earningsHistory.quarters.length > 0) {
    summary.earningsHistory = {
      history: earningsHistory.quarters.map((q) => ({
        quarter: undefined, // Will be parsed from string
        epsActual: q.epsActual ?? undefined,
        epsEstimate: q.epsEstimate ?? undefined,
        surprisePercent: q.surprise ?? undefined,
      })),
    };
  }

  // v4.1: Add insider activity
  if (insiderActivity) {
    summary.netSharePurchaseActivity = {
      period: insiderActivity.period,
      buyInfoCount: insiderActivity.buyCount,
      buyInfoShares: insiderActivity.buyShares,
      sellInfoCount: insiderActivity.sellCount,
      sellInfoShares: insiderActivity.sellShares,
      netInfoShares: insiderActivity.netShares,
    };
  }

  // v4.1: Add profile (sector/industry)
  if (profile) {
    summary.assetProfile = {
      sector: profile.sector ?? undefined,
      industry: profile.industry ?? undefined,
      country: profile.country ?? undefined,
    };
  }

  return summary;
}

// ============================================================================
// LOCAL CACHING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = {
  ticker: 60_000, // 1 minute for full ticker data
  holdings: 3600_000, // 1 hour for holdings (changes slowly)
  historical: 3600_000, // 1 hour for historical data
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Fetch ticker with caching
 */
export async function fetchTickerCached(
  ticker: string
): Promise<CombinedTickerResponse | null> {
  const cacheKey = `ticker:${ticker.toUpperCase()}`;

  // Check cache first
  const cached = getCached<CombinedTickerResponse>(cacheKey);
  if (cached) {
    stats.cacheHits++;
    return cached;
  }

  // Fetch fresh data
  const data = await fetchTickerViaProxy(ticker);

  if (data) {
    setCache(cacheKey, data, CACHE_TTL.ticker);
  }

  return data;
}

/**
 * Fetch holdings with caching
 */
export async function fetchHoldingsCached(
  ticker: string
): Promise<HoldingsResponse | null> {
  const cacheKey = `holdings:${ticker.toUpperCase()}`;

  const cached = getCached<HoldingsResponse>(cacheKey);
  if (cached) {
    stats.cacheHits++;
    logger.debug(`[Cache] Holdings HIT for ${ticker}`);
    return cached;
  }

  const data = await fetchHoldingsViaProxy(ticker);

  if (data) {
    setCache(cacheKey, data, CACHE_TTL.holdings);
  }

  return data;
}

/**
 * Clear cache (useful for testing or forced refresh)
 */
export function clearCache(): void {
  cache.clear();
  logger.info('[Cache] 🗑️  Cleared all entries');
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  entries: number;
  keys: string[];
  ttls: Record<string, number>;
} {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
    ttls: CACHE_TTL,
  };
}
