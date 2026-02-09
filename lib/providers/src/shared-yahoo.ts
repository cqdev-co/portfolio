/**
 * Shared Yahoo Finance Proxy Provider
 *
 * Uses Cloudflare Worker proxy for efficient data fetching:
 * - Bypasses IP rate limits
 * - Combined endpoint fetches all data in 1 request
 * - Built-in fallback and retry
 */

import type { HistoricalData, QuoteSummary, QuoteData } from './types.ts';
import { logger } from './logger.ts';

// ============================================================================
// PROXY RESPONSE TYPES
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

export interface CombinedTickerResponse {
  ticker: string;
  timestamp: string;
  elapsed_ms: number;
  quote?: ProxyQuote;
  chart?: ProxyChart;
  earnings?: { date: string; daysUntil: number };
  analysts?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    total: number;
    bullishPct: number;
  };
  shortInterest?: { shortRatio: number; shortPctFloat: number };
  fundamentals?: ProxyFundamentals;
  epsTrend?: ProxyEPSTrend;
  earningsHistory?: ProxyEarningsHistory;
  insiderActivity?: ProxyInsiderActivity;
  profile?: ProxyProfile;
  options?: {
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
  };
  errors?: string[];
}

export interface HoldingsResponse {
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
// OPTIONS CHAIN PROXY TYPES
// ============================================================================

export interface ProxyOptionsChainResponse {
  underlying: string;
  underlyingPrice: number;
  expirationDate: string;
  expirationTimestamp: number;
  requestedExpiration?: string;
  availableExpirations: string[];
  calls: Array<{
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
  }>;
  puts: Array<{
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    inTheMoney: boolean;
  }>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function getProxyUrl(): string | null {
  return process.env.YAHOO_PROXY_URL || null;
}

export function isProxyConfigured(): boolean {
  return !!getProxyUrl();
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

const PROXY_TIMEOUT_MS = 10_000;

async function proxyFetch<T>(endpoint: string): Promise<T> {
  const baseUrl = getProxyUrl();
  if (!baseUrl) {
    throw new Error('YAHOO_PROXY_URL not configured');
  }

  const url = `${baseUrl}${endpoint}`;
  logger.debug(`[Proxy] Fetching: ${endpoint}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.warn(`[Proxy] Request timed out after ${PROXY_TIMEOUT_MS}ms`);
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

export async function fetchTickerViaProxy(
  ticker: string
): Promise<CombinedTickerResponse | null> {
  if (!getProxyUrl()) {
    stats.proxyMisses++;
    return null;
  }

  try {
    const startTime = Date.now();
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

export async function fetchHoldingsViaProxy(
  ticker: string
): Promise<HoldingsResponse | null> {
  if (!isProxyConfigured()) return null;

  try {
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

export async function fetchOptionsChainViaProxy(
  ticker: string,
  targetDTE: number = 30
): Promise<ProxyOptionsChainResponse | null> {
  if (!isProxyConfigured()) return null;

  try {
    const startTime = Date.now();
    const normalizedTicker = ticker.toUpperCase().replace(/\./g, '-');
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + targetDTE);
    const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

    const data = await proxyFetch<ProxyOptionsChainResponse>(
      `/options-chain/${normalizedTicker}?date=${targetTimestamp}`
    );
    const elapsed = Date.now() - startTime;

    if (!data.calls || !data.puts) {
      logger.debug(`[Proxy] No options chain data for ${ticker}`);
      return null;
    }

    stats.proxyHits++;
    logger.debug(
      `[Proxy] Options chain ${ticker}: ${data.calls.length} calls, ` +
        `${data.puts.length} puts, exp ${data.expirationDate} (${elapsed}ms)`
    );
    return data;
  } catch (error) {
    stats.proxyErrors++;
    stats.lastError = String(error);
    stats.lastErrorTime = new Date();
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug(`[Proxy] Options chain failed for ${ticker}: ${errorMsg}`);
    return null;
  }
}

// ============================================================================
// TYPE CONVERTERS
// ============================================================================

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

  if (earnings?.date) {
    summary.calendarEvents = {
      earnings: { earningsDate: [new Date(earnings.date)] },
    };
  }

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

  if (earningsHistory && earningsHistory.quarters.length > 0) {
    summary.earningsHistory = {
      history: earningsHistory.quarters.map((q) => ({
        quarter: undefined,
        epsActual: q.epsActual ?? undefined,
        epsEstimate: q.epsEstimate ?? undefined,
        surprisePercent: q.surprise ?? undefined,
      })),
    };
  }

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
  ticker: 60_000,
  holdings: 3600_000,
  historical: 3600_000,
  optionsChain: 60_000,
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

export async function fetchTickerCached(
  ticker: string
): Promise<CombinedTickerResponse | null> {
  const cacheKey = `ticker:${ticker.toUpperCase()}`;
  const cached = getCached<CombinedTickerResponse>(cacheKey);
  if (cached) {
    stats.cacheHits++;
    return cached;
  }
  const data = await fetchTickerViaProxy(ticker);
  if (data) setCache(cacheKey, data, CACHE_TTL.ticker);
  return data;
}

export async function fetchHoldingsCached(
  ticker: string
): Promise<HoldingsResponse | null> {
  const cacheKey = `holdings:${ticker.toUpperCase()}`;
  const cached = getCached<HoldingsResponse>(cacheKey);
  if (cached) {
    stats.cacheHits++;
    return cached;
  }
  const data = await fetchHoldingsViaProxy(ticker);
  if (data) setCache(cacheKey, data, CACHE_TTL.holdings);
  return data;
}

export async function fetchOptionsChainCached(
  ticker: string,
  targetDTE: number = 30
): Promise<ProxyOptionsChainResponse | null> {
  const cacheKey = `options-chain:${ticker.toUpperCase()}:${targetDTE}`;
  const cached = getCached<ProxyOptionsChainResponse>(cacheKey);
  if (cached) {
    stats.cacheHits++;
    return cached;
  }
  const data = await fetchOptionsChainViaProxy(ticker, targetDTE);
  if (data) setCache(cacheKey, data, CACHE_TTL.optionsChain);
  return data;
}

export function clearCache(): void {
  cache.clear();
}

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
