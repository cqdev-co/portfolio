/**
 * Centralized Yahoo Finance Client for AI Analyst
 *
 * Routes ALL Yahoo Finance requests through:
 * 1. Cloudflare Worker proxy (if YAHOO_PROXY_URL configured)
 * 2. Direct Yahoo Finance with retry logic (fallback)
 *
 * IMPORTANT: All Yahoo Finance calls in ai-analyst should use this module
 * to avoid 429 rate limit errors.
 */

import YahooFinance from 'yahoo-finance2';
import {
  isProxyConfigured,
  fetchAllViaProxy,
  fetchQuoteViaProxy,
  fetchChartViaProxy,
  fetchOptionsViaProxy,
  fetchSummaryViaProxy,
  fetchNewsViaProxy,
} from '../../../lib/ai-agent/data/yahoo-proxy';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Track rate limit state
let isRateLimited = false;
let rateLimitResetTime = 0;

// Lazy-loaded Yahoo Finance instance
let _yahooFinance: InstanceType<typeof YahooFinance> | null = null;

function getYahooFinance(): InstanceType<typeof YahooFinance> {
  if (!_yahooFinance) {
    _yahooFinance = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
      validation: {
        logErrors: false,
        logOptionsErrors: false,
      },
    });
  }
  return _yahooFinance;
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if currently rate limited
 */
export function isYahooRateLimited(): boolean {
  if (!isRateLimited) return false;
  if (Date.now() > rateLimitResetTime) {
    isRateLimited = false;
    return false;
  }
  return true;
}

/**
 * Mark Yahoo as rate limited
 */
function markRateLimited(retryAfterSeconds: number = 60): void {
  isRateLimited = true;
  rateLimitResetTime = Date.now() + retryAfterSeconds * 1000;
  console.warn(`[Yahoo] Rate limited. Will retry after ${retryAfterSeconds}s`);
}

/**
 * Execute a function with exponential backoff retry on 429 errors
 */
async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();

      // Check for rate limit (429)
      if (msg.includes('429') || msg.includes('too many requests')) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Yahoo] ${context}: Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), ` +
            `retrying in ${delay}ms...`
        );
        markRateLimited(60);
        await sleep(delay);
        continue;
      }

      // Non-retryable error
      throw lastError;
    }
  }

  // All retries exhausted
  throw lastError ?? new Error(`${context}: All retries exhausted`);
}

// ============================================================================
// PUBLIC API - QUOTE
// ============================================================================

export interface QuoteResult {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume?: number;
  avgVolume?: number;
  marketCap?: number;
  peRatio?: number | null;
  forwardPE?: number | null;
  eps?: number | null;
  beta?: number | null;
  dividendYield?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
}

/**
 * Fetch stock quote data
 * Uses proxy if configured, falls back to direct with retry
 */
export async function fetchQuote(ticker: string): Promise<QuoteResult | null> {
  const symbol = ticker.toUpperCase();

  // Priority 1: Use proxy if configured
  if (isProxyConfigured()) {
    const proxyResult = await fetchQuoteViaProxy(symbol);
    if (proxyResult) {
      return {
        symbol: proxyResult.symbol,
        price: proxyResult.regularMarketPrice,
        change: proxyResult.regularMarketChange,
        changePct: proxyResult.regularMarketChangePercent,
        marketCap: proxyResult.marketCap,
        peRatio: proxyResult.trailingPE,
        forwardPE: proxyResult.forwardPE,
        eps: proxyResult.trailingEps,
        beta: proxyResult.beta,
        dividendYield: proxyResult.dividendYield,
        fiftyDayAverage: proxyResult.fiftyDayAverage,
        twoHundredDayAverage: proxyResult.twoHundredDayAverage,
        fiftyTwoWeekLow: proxyResult.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: proxyResult.fiftyTwoWeekHigh,
      };
    }
  }

  // Priority 2: Check if rate limited
  if (isYahooRateLimited()) {
    console.warn(
      `[Yahoo] Currently rate limited, skipping quote for ${symbol}`
    );
    return null;
  }

  // Priority 3: Direct call with retry
  return withRetry(async () => {
    const yf = getYahooFinance();
    const quote = await yf.quote(symbol);

    if (!quote?.regularMarketPrice) return null;

    return {
      symbol: quote.symbol ?? symbol,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange ?? 0,
      changePct: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume,
      avgVolume: quote.averageDailyVolume3Month,
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      forwardPE: quote.forwardPE,
      eps: quote.trailingEps,
      beta: quote.beta,
      dividendYield: quote.dividendYield,
      fiftyDayAverage: quote.fiftyDayAverage,
      twoHundredDayAverage: quote.twoHundredDayAverage,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
    };
  }, `quote(${symbol})`);
}

// ============================================================================
// PUBLIC API - CHART/HISTORICAL
// ============================================================================

export interface ChartResult {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

/**
 * Fetch historical chart data
 */
export async function fetchChart(
  ticker: string,
  range: string = '3mo',
  interval: string = '1d'
): Promise<ChartResult | null> {
  const symbol = ticker.toUpperCase();

  // Priority 1: Use proxy if configured
  if (isProxyConfigured()) {
    const proxyResult = await fetchChartViaProxy(symbol, range, interval);
    if (proxyResult) {
      return {
        timestamps: proxyResult.timestamps,
        opens: proxyResult.closes, // Proxy doesn't return opens separately
        highs: proxyResult.highs,
        lows: proxyResult.lows,
        closes: proxyResult.closes,
        volumes: proxyResult.volumes,
      };
    }
  }

  // Priority 2: Check if rate limited
  if (isYahooRateLimited()) {
    console.warn(
      `[Yahoo] Currently rate limited, skipping chart for ${symbol}`
    );
    return null;
  }

  // Priority 3: Direct call with retry
  return withRetry(async () => {
    const yf = getYahooFinance();
    const history = await yf.chart(symbol, {
      period1: getStartDate(range),
      interval: interval as '1d' | '1wk' | '1mo',
    });

    if (!history?.quotes?.length) return null;

    type ChartQuote = {
      date?: Date;
      open?: number | null;
      high?: number | null;
      low?: number | null;
      close?: number | null;
      volume?: number | null;
    };

    const validQuotes = (history.quotes as ChartQuote[]).filter(
      (q: ChartQuote) => q.close !== null && q.close !== undefined
    );

    return {
      timestamps: validQuotes.map((q: ChartQuote) =>
        q.date ? new Date(q.date).getTime() / 1000 : 0
      ),
      opens: validQuotes.map((q: ChartQuote) => q.open ?? 0),
      highs: validQuotes.map((q: ChartQuote) => q.high ?? 0),
      lows: validQuotes.map((q: ChartQuote) => q.low ?? 0),
      closes: validQuotes.map((q: ChartQuote) => q.close ?? 0),
      volumes: validQuotes.map((q: ChartQuote) => q.volume ?? 0),
    };
  }, `chart(${symbol})`);
}

/**
 * Convert range string to start date
 */
function getStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1mo':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3mo':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6mo':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setMonth(now.getMonth() - 3));
  }
}

// ============================================================================
// PUBLIC API - OPTIONS
// ============================================================================

export interface OptionContractResult {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsChainResult {
  expirationDates: Date[];
  underlyingPrice: number;
  options: Array<{
    expirationDate: Date;
    calls: OptionContractResult[];
    puts: OptionContractResult[];
  }>;
}

/**
 * Fetch options chain data
 */
export async function fetchOptions(
  ticker: string,
  expirationDate?: Date
): Promise<OptionsChainResult | null> {
  const symbol = ticker.toUpperCase();

  // Priority 1: Use proxy if configured
  if (isProxyConfigured()) {
    const proxyResult = await fetchOptionsViaProxy(
      symbol,
      expirationDate ? Math.floor(expirationDate.getTime() / 1000) : undefined
    );
    if (proxyResult) {
      return {
        expirationDates: proxyResult.expirationDates.map(
          (ts) => new Date(ts * 1000)
        ),
        underlyingPrice: proxyResult.quote.regularMarketPrice,
        options: proxyResult.options.map((opt) => ({
          expirationDate: new Date(opt.expirationDate * 1000),
          calls: opt.calls.map((c) => ({
            strike: c.strike,
            lastPrice: c.lastPrice,
            bid: c.bid,
            ask: c.ask,
            volume: c.volume,
            openInterest: c.openInterest,
            impliedVolatility: c.impliedVolatility,
            inTheMoney: c.inTheMoney,
          })),
          puts: opt.puts.map((p) => ({
            strike: p.strike,
            lastPrice: p.lastPrice,
            bid: p.bid,
            ask: p.ask,
            volume: p.volume,
            openInterest: p.openInterest,
            impliedVolatility: p.impliedVolatility,
            inTheMoney: p.inTheMoney,
          })),
        })),
      };
    }
  }

  // Priority 2: Check if rate limited
  if (isYahooRateLimited()) {
    console.warn(
      `[Yahoo] Currently rate limited, skipping options for ${symbol}`
    );
    return null;
  }

  // Priority 3: Direct call with retry
  return withRetry(async () => {
    const yf = getYahooFinance();
    const options = await yf.options(symbol, {
      date: expirationDate,
    });

    if (!options) return null;

    type YFOption = {
      expirationDate: number | Date;
      calls?: Array<{
        strike: number;
        lastPrice?: number;
        bid?: number;
        ask?: number;
        volume?: number;
        openInterest?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }>;
      puts?: Array<{
        strike: number;
        lastPrice?: number;
        bid?: number;
        ask?: number;
        volume?: number;
        openInterest?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }>;
    };

    return {
      expirationDates: (options.expirationDates ?? []).map(
        (d: Date | number) => new Date(d)
      ),
      underlyingPrice: options.underlyingSymbol
        ? ((await fetchQuote(options.underlyingSymbol))?.price ?? 0)
        : 0,
      options: ((options.options ?? []) as YFOption[]).map((opt: YFOption) => ({
        expirationDate: new Date(opt.expirationDate),
        calls: (opt.calls ?? []).map((c) => ({
          strike: c.strike,
          lastPrice: c.lastPrice ?? 0,
          bid: c.bid ?? 0,
          ask: c.ask ?? 0,
          volume: c.volume ?? 0,
          openInterest: c.openInterest ?? 0,
          impliedVolatility: c.impliedVolatility ?? 0,
          inTheMoney: c.inTheMoney ?? false,
        })),
        puts: (opt.puts ?? []).map((p) => ({
          strike: p.strike,
          lastPrice: p.lastPrice ?? 0,
          bid: p.bid ?? 0,
          ask: p.ask ?? 0,
          volume: p.volume ?? 0,
          openInterest: p.openInterest ?? 0,
          impliedVolatility: p.impliedVolatility ?? 0,
          inTheMoney: p.inTheMoney ?? false,
        })),
      })),
    };
  }, `options(${symbol})`);
}

// ============================================================================
// PUBLIC API - QUOTE SUMMARY
// ============================================================================

export interface QuoteSummaryResult {
  earningsDate?: Date;
  revenueGrowth?: number;
  earningsGrowth?: number;
  currentRatio?: number;
  debtToEquity?: number;
  shortRatio?: number;
  shortPercentOfFloat?: number;
  analystRatings?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  };
  insidersPercent?: number;
  institutionsPercent?: number;
}

/**
 * Fetch detailed quote summary data
 */
export async function fetchQuoteSummary(
  ticker: string,
  modules: string[] = [
    'calendarEvents',
    'financialData',
    'defaultKeyStatistics',
    'recommendationTrend',
    'majorHoldersBreakdown',
  ]
): Promise<QuoteSummaryResult | null> {
  const symbol = ticker.toUpperCase();

  // Priority 1: Use proxy if configured
  if (isProxyConfigured()) {
    const proxyResult = await fetchSummaryViaProxy(symbol, modules);
    if (proxyResult) {
      const result: QuoteSummaryResult = {};

      // Calendar events
      const earningsDateRaw =
        proxyResult.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
      if (earningsDateRaw) {
        result.earningsDate = new Date(earningsDateRaw * 1000);
      }

      // Financial data
      if (proxyResult.financialData) {
        result.revenueGrowth = proxyResult.financialData.revenueGrowth?.raw;
        result.earningsGrowth = proxyResult.financialData.earningsGrowth?.raw;
        result.currentRatio = proxyResult.financialData.currentRatio?.raw;
        result.debtToEquity = proxyResult.financialData.debtToEquity?.raw;
      }

      // Key statistics
      if (proxyResult.defaultKeyStatistics) {
        result.shortRatio = proxyResult.defaultKeyStatistics.shortRatio?.raw;
        result.shortPercentOfFloat =
          proxyResult.defaultKeyStatistics.shortPercentOfFloat?.raw;
      }

      // Analyst ratings
      const trend = proxyResult.recommendationTrend?.trend?.[0];
      if (trend) {
        result.analystRatings = {
          strongBuy: trend.strongBuy ?? 0,
          buy: trend.buy ?? 0,
          hold: trend.hold ?? 0,
          sell: trend.sell ?? 0,
          strongSell: trend.strongSell ?? 0,
        };
      }

      // Holdings
      if (proxyResult.majorHoldersBreakdown) {
        result.insidersPercent =
          (proxyResult.majorHoldersBreakdown.insidersPercentHeld?.raw ?? 0) *
          100;
        result.institutionsPercent =
          (proxyResult.majorHoldersBreakdown.institutionsPercentHeld?.raw ??
            0) * 100;
      }

      return result;
    }
  }

  // Priority 2: Check if rate limited
  if (isYahooRateLimited()) {
    console.warn(
      `[Yahoo] Currently rate limited, skipping summary for ${symbol}`
    );
    return null;
  }

  // Priority 3: Direct call with retry
  return withRetry(async () => {
    const yf = getYahooFinance();
    const summary = await yf.quoteSummary(symbol, {
      modules: modules as (
        | 'calendarEvents'
        | 'financialData'
        | 'defaultKeyStatistics'
        | 'recommendationTrend'
        | 'majorHoldersBreakdown'
      )[],
    });

    if (!summary) return null;

    const result: QuoteSummaryResult = {};

    // Calendar events
    const earningsDates = summary.calendarEvents?.earnings?.earningsDate;
    if (earningsDates && earningsDates.length > 0) {
      result.earningsDate = new Date(earningsDates[0]);
    }

    // Financial data
    if (summary.financialData) {
      result.revenueGrowth = summary.financialData.revenueGrowth ?? undefined;
      result.earningsGrowth = summary.financialData.earningsGrowth ?? undefined;
      result.currentRatio = summary.financialData.currentRatio ?? undefined;
      result.debtToEquity = summary.financialData.debtToEquity ?? undefined;
    }

    // Key statistics
    if (summary.defaultKeyStatistics) {
      result.shortRatio = summary.defaultKeyStatistics.shortRatio ?? undefined;
      result.shortPercentOfFloat =
        summary.defaultKeyStatistics.shortPercentOfFloat ?? undefined;
    }

    // Analyst ratings
    const trend = summary.recommendationTrend?.trend?.[0];
    if (trend) {
      result.analystRatings = {
        strongBuy: trend.strongBuy ?? 0,
        buy: trend.buy ?? 0,
        hold: trend.hold ?? 0,
        sell: trend.sell ?? 0,
        strongSell: trend.strongSell ?? 0,
      };
    }

    // Holdings
    if (summary.majorHoldersBreakdown) {
      result.insidersPercent =
        (summary.majorHoldersBreakdown.insidersPercentHeld ?? 0) * 100;
      result.institutionsPercent =
        (summary.majorHoldersBreakdown.institutionsPercentHeld ?? 0) * 100;
    }

    return result;
  }, `quoteSummary(${symbol})`);
}

// ============================================================================
// PUBLIC API - NEWS
// ============================================================================

export interface NewsResult {
  title: string;
  url: string;
  source: string;
  date: string;
}

/**
 * Fetch recent news for a ticker
 */
export async function fetchNews(
  ticker: string,
  count: number = 5
): Promise<NewsResult[]> {
  const symbol = ticker.toUpperCase();

  // Priority 1: Use proxy if configured
  if (isProxyConfigured()) {
    const proxyNews = await fetchNewsViaProxy(symbol, count);
    return proxyNews.map((n) => ({
      title: n.title,
      url: n.url ?? '',
      source: n.source ?? 'Unknown',
      date: n.date ?? new Date().toISOString(),
    }));
  }

  // Priority 2: Check if rate limited
  if (isYahooRateLimited()) {
    console.warn(`[Yahoo] Currently rate limited, skipping news for ${symbol}`);
    return [];
  }

  // Priority 3: Direct call with retry
  return withRetry(async () => {
    const yf = getYahooFinance();
    const search = await yf.search(symbol, {
      newsCount: count,
      quotesCount: 0,
    });

    if (!search?.news?.length) return [];

    type YFNewsItem = {
      title: string;
      link?: string;
      publisher?: string;
      providerPublishTime?: Date | number;
    };

    return (search.news as YFNewsItem[])
      .slice(0, count)
      .map((n: YFNewsItem) => ({
        title: n.title,
        url: n.link ?? '',
        source: n.publisher ?? 'Unknown',
        date: n.providerPublishTime
          ? new Date(n.providerPublishTime).toISOString()
          : new Date().toISOString(),
      }));
  }, `news(${symbol})`);
}

// ============================================================================
// PUBLIC API - COMBINED (MOST EFFICIENT)
// ============================================================================

/**
 * Fetch ALL ticker data in ONE request (most efficient)
 * Only works when proxy is configured
 */
export async function fetchAllTickerData(
  ticker: string
): Promise<Awaited<ReturnType<typeof fetchAllViaProxy>> | null> {
  if (!isProxyConfigured()) {
    return null;
  }
  return await fetchAllViaProxy(ticker);
}

// ============================================================================
// UTILITY - IV BY STRIKE
// ============================================================================

export interface StrikeIVResult {
  strike: number;
  callIV: number | null;
  putIV: number | null;
  dte: number;
  expirationDate: Date;
}

/**
 * Get IV for a specific strike and target DTE
 * This is the new tool for Victor to verify IV claims
 */
export async function getIVByStrike(
  ticker: string,
  strike: number,
  targetDTE: number = 30
): Promise<StrikeIVResult | null> {
  const options = await fetchOptions(ticker);
  if (!options) return null;

  // Find expiration closest to target DTE
  const now = new Date();
  let closestExp: { date: Date; dte: number } | null = null;
  let minDiff = Infinity;

  for (const expDate of options.expirationDates) {
    const dte = Math.ceil(
      (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const diff = Math.abs(dte - targetDTE);
    if (diff < minDiff) {
      minDiff = diff;
      closestExp = { date: expDate, dte };
    }
  }

  if (!closestExp) return null;

  // Find the option chain for this expiration
  const chain = options.options.find(
    (o) => o.expirationDate.getTime() === closestExp!.date.getTime()
  );
  if (!chain) return null;

  // Find call and put at the specified strike
  const call = chain.calls.find((c) => Math.abs(c.strike - strike) < 0.5);
  const put = chain.puts.find((p) => Math.abs(p.strike - strike) < 0.5);

  return {
    strike,
    callIV: call ? call.impliedVolatility * 100 : null,
    putIV: put ? put.impliedVolatility * 100 : null,
    dte: closestExp.dte,
    expirationDate: closestExp.date,
  };
}

// ============================================================================
// UTILITY - SPREAD CALCULATOR
// ============================================================================

export interface SpreadCalculationResult {
  longStrike: number;
  shortStrike: number;
  dte: number;
  expirationDate: Date;
  underlyingPrice: number;
  longBid: number;
  longAsk: number;
  longMid: number;
  shortBid: number;
  shortAsk: number;
  shortMid: number;
  estimatedDebit: number;
  maxProfit: number;
  breakeven: number;
  cushion: number;
  longIV: number | null;
  shortIV: number | null;
  longOI: number;
  shortOI: number;
}

/**
 * Calculate exact pricing for user-specified spread
 * This is the new tool for Victor to calculate specific spreads
 */
export async function calculateSpread(
  ticker: string,
  longStrike: number,
  shortStrike: number,
  targetDTE: number = 30
): Promise<SpreadCalculationResult | null> {
  const options = await fetchOptions(ticker);
  const quote = await fetchQuote(ticker);

  if (!options || !quote) return null;

  const underlyingPrice = quote.price;

  // Find expiration closest to target DTE
  const now = new Date();
  let closestExp: { date: Date; dte: number } | null = null;
  let minDiff = Infinity;

  for (const expDate of options.expirationDates) {
    const dte = Math.ceil(
      (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const diff = Math.abs(dte - targetDTE);
    if (diff < minDiff) {
      minDiff = diff;
      closestExp = { date: expDate, dte };
    }
  }

  if (!closestExp) return null;

  // Find the option chain for this expiration
  const chain = options.options.find(
    (o) => o.expirationDate.getTime() === closestExp!.date.getTime()
  );
  if (!chain) return null;

  // Find calls at the specified strikes
  const longCall = chain.calls.find(
    (c) => Math.abs(c.strike - longStrike) < 0.5
  );
  const shortCall = chain.calls.find(
    (c) => Math.abs(c.strike - shortStrike) < 0.5
  );

  if (!longCall || !shortCall) return null;

  // Calculate spread metrics
  const longMid = (longCall.bid + longCall.ask) / 2 || longCall.lastPrice;
  const shortMid = (shortCall.bid + shortCall.ask) / 2 || shortCall.lastPrice;

  // Use worst-case fills: buy at ask, sell at bid
  const longAsk = longCall.ask || longMid;
  const shortBid = shortCall.bid || shortMid;
  let estimatedDebit = longAsk - shortBid;

  const spreadWidth = shortStrike - longStrike;

  // Validate debit makes sense
  if (estimatedDebit <= 0 || estimatedDebit >= spreadWidth) {
    estimatedDebit = longMid - shortMid;
  }

  const maxProfit = spreadWidth - estimatedDebit;
  const breakeven = longStrike + estimatedDebit;
  const cushion = ((underlyingPrice - breakeven) / underlyingPrice) * 100;

  return {
    longStrike,
    shortStrike,
    dte: closestExp.dte,
    expirationDate: closestExp.date,
    underlyingPrice,
    longBid: longCall.bid,
    longAsk: longCall.ask,
    longMid,
    shortBid: shortCall.bid,
    shortAsk: shortCall.ask,
    shortMid,
    estimatedDebit: Math.round(estimatedDebit * 100) / 100,
    maxProfit: Math.round(maxProfit * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    cushion: Math.round(cushion * 100) / 100,
    longIV: longCall.impliedVolatility
      ? longCall.impliedVolatility * 100
      : null,
    shortIV: shortCall.impliedVolatility
      ? shortCall.impliedVolatility * 100
      : null,
    longOI: longCall.openInterest,
    shortOI: shortCall.openInterest,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isProxyConfigured };
