import YahooFinance from "yahoo-finance2";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { 
  QuoteData, 
  QuoteSummary, 
  HistoricalData 
} from "../types/index.ts";
import { logger } from "../utils/logger.ts";

// Instantiate yahoo-finance2 (required in v3+)
// Suppress validation errors and notices for cleaner output during batch scans
const yahooFinance = new YahooFinance({ 
  suppressNotices: ["yahooSurvey", "rippiReport"],
  validation: {
    logErrors: false,  // Don't spam console with validation errors
    logOptionsErrors: false,
  }
});

const CACHE_DIR = join(process.cwd(), "cache");
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YahooQuote = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YahooSummary = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type YahooChart = any;

/**
 * Rate limiting configuration
 */
const RATE_LIMIT = {
  baseDelay: 500,           // Base delay between requests (ms)
  maxRetries: 3,            // Max retry attempts per request
  backoffMultiplier: 2,     // Exponential backoff multiplier
  rateLimitCooldown: 5000,  // Cooldown after hitting rate limit (ms)
  burstLimit: 5,            // Requests before forcing a longer pause
  burstPause: 2000,         // Pause after burst limit (ms)
};

/**
 * Yahoo Finance data provider with caching and rate limiting
 */
export class YahooProvider {
  private lastRequest = 0;
  private requestCount = 0;
  private rateLimitHit = false;
  private rateLimitCooldownUntil = 0;

  constructor() {
    if (!existsSync(CACHE_DIR)) {
      Bun.spawnSync(["mkdir", "-p", CACHE_DIR]);
    }
  }

  /**
   * Rate limit requests with exponential backoff
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();

    // If we're in a rate limit cooldown, wait
    if (now < this.rateLimitCooldownUntil) {
      const waitTime = this.rateLimitCooldownUntil - now;
      logger.debug(`Rate limit cooldown: waiting ${waitTime}ms`);
      await new Promise((r) => setTimeout(r, waitTime));
    }

    // Burst control - pause after every N requests
    this.requestCount++;
    if (this.requestCount >= RATE_LIMIT.burstLimit) {
      this.requestCount = 0;
      await new Promise((r) => setTimeout(r, RATE_LIMIT.burstPause));
    }

    // Standard rate limiting
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < RATE_LIMIT.baseDelay) {
      await new Promise((r) => 
        setTimeout(r, RATE_LIMIT.baseDelay - elapsed)
      );
    }
    this.lastRequest = Date.now();
  }

  /**
   * Handle rate limit error
   */
  private handleRateLimit(): void {
    this.rateLimitHit = true;
    this.rateLimitCooldownUntil = Date.now() + RATE_LIMIT.rateLimitCooldown;
    logger.debug(
      `Rate limited - cooling down for ${RATE_LIMIT.rateLimitCooldown}ms`
    );
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    const errorStr = String(error);
    return (
      errorStr.includes("Too Many Requests") ||
      errorStr.includes("429") ||
      errorStr.includes("rate limit")
    );
  }

  /**
   * Check if error is a validation error (expected for some edge-case tickers)
   * These don't need to be logged as warnings - just skip the ticker
   */
  private isValidationError(error: unknown): boolean {
    const errorStr = String(error);
    return (
      errorStr.includes("FailedYahooValidationError") ||
      errorStr.includes("Failed Yahoo Schema validation") ||
      errorStr.includes("validation") ||
      errorStr.includes("internal-error")
    );
  }

  /**
   * Execute request with retry logic
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    symbol: string,
    requestType: string
  ): Promise<T | null> {
    let lastError: unknown;

    for (let attempt = 0; attempt < RATE_LIMIT.maxRetries; attempt++) {
      try {
        await this.rateLimit();
        return await fn();
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error)) {
          this.handleRateLimit();
          
          // Exponential backoff
          const backoff = RATE_LIMIT.baseDelay * 
            Math.pow(RATE_LIMIT.backoffMultiplier, attempt + 1);
          
          logger.debug(
            `Retry ${attempt + 1}/${RATE_LIMIT.maxRetries} ` +
            `for ${symbol} ${requestType} after ${backoff}ms`
          );
          
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          // Non-rate-limit error, don't retry
          break;
        }
      }
    }

    // Only log errors that aren't expected (rate limits, validation errors)
    // Validation errors are common for edge-case tickers - just skip silently
    if (!this.isRateLimitError(lastError) && !this.isValidationError(lastError)) {
      logger.warn(`Failed ${requestType} for ${symbol}: ${lastError}`);
    }
    return null;
  }

  /**
   * Get cached data if valid, otherwise return null
   */
  private getCache<T>(key: string): T | null {
    const cachePath = join(CACHE_DIR, `${key}.json`);
    if (!existsSync(cachePath)) return null;

    try {
      const content = readFileSync(cachePath, "utf-8");
      const entry = JSON.parse(content) as CacheEntry<T>;
      
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    } catch {
      // Cache read failed, return null
    }
    return null;
  }

  /**
   * Write data to cache
   */
  private setCache<T>(key: string, data: T): void {
    const cachePath = join(CACHE_DIR, `${key}.json`);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    try {
      writeFileSync(cachePath, JSON.stringify(entry));
    } catch {
      // Cache write failed, continue without caching
    }
  }

  /**
   * Fetch basic quote data for a ticker
   */
  async getQuote(symbol: string): Promise<QuoteData | null> {
    const cacheKey = `quote_${symbol}`;
    const cached = this.getCache<QuoteData>(cacheKey);
    if (cached) {
      return cached;
    }

    const quote: YahooQuote = await this.withRetry(
      () => yahooFinance.quote(symbol),
      symbol,
      "quote"
    );

    if (!quote) return null;
    
    const data: QuoteData = {
      symbol: quote.symbol ?? symbol,
      shortName: quote.shortName ?? undefined,
      regularMarketPrice: quote.regularMarketPrice ?? undefined,
      regularMarketVolume: quote.regularMarketVolume ?? undefined,
      averageDailyVolume10Day: quote.averageDailyVolume10Day ?? undefined,
      fiftyDayAverage: quote.fiftyDayAverage ?? undefined,
      twoHundredDayAverage: quote.twoHundredDayAverage ?? undefined,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
      marketCap: quote.marketCap ?? undefined,
    };
    
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Fetch detailed quote summary with fundamentals and analyst data
   */
  async getQuoteSummary(symbol: string): Promise<QuoteSummary | null> {
    const cacheKey = `summary_${symbol}`;
    const cached = this.getCache<QuoteSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const summary: YahooSummary = await this.withRetry(
      () => yahooFinance.quoteSummary(symbol, {
        modules: [
          "price",
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
          "earningsTrend",
          "recommendationTrend",
          "upgradeDowngradeHistory",
          "calendarEvents",
          "assetProfile",
          "majorHoldersBreakdown",
          "netSharePurchaseActivity",
          "earnings",
          "earningsHistory",
        ],
      }, {
        // Skip validation to avoid verbose errors for edge-case tickers
        // with non-standard analyst ratings or missing fields
        validateResult: false,
      }),
      symbol,
      "summary"
    );

    if (!summary) return null;
    
    // Map to our QuoteSummary type
    const data: QuoteSummary = {
      price: summary.price ? {
        regularMarketPrice: summary.price.regularMarketPrice 
          ? { raw: summary.price.regularMarketPrice } 
          : undefined,
        shortName: summary.price.shortName,
      } : undefined,
      summaryDetail: summary.summaryDetail ? {
        forwardPE: summary.summaryDetail.forwardPE 
          ? { raw: summary.summaryDetail.forwardPE } 
          : undefined,
        trailingPE: summary.summaryDetail.trailingPE 
          ? { raw: summary.summaryDetail.trailingPE } 
          : undefined,
        pegRatio: summary.summaryDetail.pegRatio 
          ? { raw: summary.summaryDetail.pegRatio } 
          : undefined,
        priceToBook: summary.summaryDetail.priceToBook 
          ? { raw: summary.summaryDetail.priceToBook } 
          : undefined,
      } : undefined,
      defaultKeyStatistics: summary.defaultKeyStatistics ? {
        enterpriseToEbitda: summary.defaultKeyStatistics.enterpriseToEbitda 
          ? { raw: summary.defaultKeyStatistics.enterpriseToEbitda } 
          : undefined,
        pegRatio: summary.defaultKeyStatistics.pegRatio 
          ? { raw: summary.defaultKeyStatistics.pegRatio } 
          : undefined,
        shortPercentOfFloat: summary.defaultKeyStatistics.shortPercentOfFloat 
          ? { raw: summary.defaultKeyStatistics.shortPercentOfFloat } 
          : undefined,
        sharesShort: summary.defaultKeyStatistics.sharesShort 
          ? { raw: summary.defaultKeyStatistics.sharesShort } 
          : undefined,
        shortRatio: summary.defaultKeyStatistics.shortRatio 
          ? { raw: summary.defaultKeyStatistics.shortRatio } 
          : undefined,
        beta: summary.defaultKeyStatistics.beta 
          ? { raw: summary.defaultKeyStatistics.beta } 
          : undefined,
        fiftyTwoWeekChange: summary.defaultKeyStatistics["52WeekChange"] 
          ? { raw: summary.defaultKeyStatistics["52WeekChange"] } 
          : undefined,
        floatShares: summary.defaultKeyStatistics.floatShares 
          ? { raw: summary.defaultKeyStatistics.floatShares } 
          : undefined,
        sharesOutstanding: summary.defaultKeyStatistics.sharesOutstanding 
          ? { raw: summary.defaultKeyStatistics.sharesOutstanding } 
          : undefined,
      } : undefined,
      financialData: summary.financialData ? {
        freeCashflow: summary.financialData.freeCashflow 
          ? { raw: summary.financialData.freeCashflow } 
          : undefined,
        currentPrice: summary.financialData.currentPrice 
          ? { raw: summary.financialData.currentPrice } 
          : undefined,
        targetMeanPrice: summary.financialData.targetMeanPrice 
          ? { raw: summary.financialData.targetMeanPrice } 
          : undefined,
        recommendationMean: summary.financialData.recommendationMean 
          ? { raw: summary.financialData.recommendationMean } 
          : undefined,
        numberOfAnalystOpinions: summary.financialData.numberOfAnalystOpinions 
          ? { raw: summary.financialData.numberOfAnalystOpinions } 
          : undefined,
        revenueGrowth: summary.financialData.revenueGrowth 
          ? { raw: summary.financialData.revenueGrowth } 
          : undefined,
        earningsGrowth: summary.financialData.earningsGrowth 
          ? { raw: summary.financialData.earningsGrowth } 
          : undefined,
        profitMargins: summary.financialData.profitMargins 
          ? { raw: summary.financialData.profitMargins } 
          : undefined,
        operatingMargins: summary.financialData.operatingMargins 
          ? { raw: summary.financialData.operatingMargins } 
          : undefined,
        returnOnEquity: summary.financialData.returnOnEquity 
          ? { raw: summary.financialData.returnOnEquity } 
          : undefined,
        financialCurrency: summary.financialData.financialCurrency,
        // v1.7.0: Balance sheet health metrics
        debtToEquity: summary.financialData.debtToEquity 
          ? { raw: summary.financialData.debtToEquity } 
          : undefined,
        currentRatio: summary.financialData.currentRatio 
          ? { raw: summary.financialData.currentRatio } 
          : undefined,
        quickRatio: summary.financialData.quickRatio 
          ? { raw: summary.financialData.quickRatio } 
          : undefined,
        totalCash: summary.financialData.totalCash 
          ? { raw: summary.financialData.totalCash } 
          : undefined,
        totalDebt: summary.financialData.totalDebt 
          ? { raw: summary.financialData.totalDebt } 
          : undefined,
      } : undefined,
      earningsTrend: summary.earningsTrend ? {
        trend: summary.earningsTrend.trend?.map((t: {
          period?: string;
          growth?: number;
          epsTrend?: {
            current?: number;
            "7daysAgo"?: number;
            "30daysAgo"?: number;
            "60daysAgo"?: number;
            "90daysAgo"?: number;
          };
          epsRevisions?: {
            upLast7days?: number;
            upLast30days?: number;
            downLast7days?: number;
            downLast30days?: number;
          };
        }) => ({
          period: t.period,
          growth: t.growth ? { raw: t.growth } : undefined,
          epsTrend: t.epsTrend ? {
            current: t.epsTrend.current,
            sevenDaysAgo: t.epsTrend["7daysAgo"],
            thirtyDaysAgo: t.epsTrend["30daysAgo"],
            sixtyDaysAgo: t.epsTrend["60daysAgo"],
            ninetyDaysAgo: t.epsTrend["90daysAgo"],
          } : undefined,
          epsRevisions: t.epsRevisions ? {
            upLast7days: t.epsRevisions.upLast7days,
            upLast30days: t.epsRevisions.upLast30days,
            downLast7days: t.epsRevisions.downLast7days,
            downLast30days: t.epsRevisions.downLast30days,
          } : undefined,
        })),
      } : undefined,
      recommendationTrend: summary.recommendationTrend ? {
        trend: summary.recommendationTrend.trend?.map((t: {
          period?: string;
          strongBuy?: number;
          buy?: number;
          hold?: number;
          sell?: number;
          strongSell?: number;
        }) => ({
          period: t.period,
          strongBuy: t.strongBuy,
          buy: t.buy,
          hold: t.hold,
          sell: t.sell,
          strongSell: t.strongSell,
        })),
      } : undefined,
      upgradeDowngradeHistory: summary.upgradeDowngradeHistory ? {
        history: summary.upgradeDowngradeHistory.history?.map((h: {
          epochGradeDate?: Date;
          firm?: string;
          toGrade?: string;
          fromGrade?: string;
          action?: string;
        }) => ({
          epochGradeDate: h.epochGradeDate 
            ? h.epochGradeDate.getTime() / 1000 
            : undefined,
          firm: h.firm,
          toGrade: h.toGrade,
          fromGrade: h.fromGrade,
          action: h.action,
        })),
      } : undefined,
      calendarEvents: summary.calendarEvents ? {
        earnings: summary.calendarEvents.earnings ? {
          earningsDate: summary.calendarEvents.earnings.earningsDate?.map(
            (d: Date) => new Date(d)
          ),
        } : undefined,
      } : undefined,
      assetProfile: summary.assetProfile ? {
        sector: summary.assetProfile.sector,
        industry: summary.assetProfile.industry,
        country: summary.assetProfile.country,
        website: summary.assetProfile.website,
      } : undefined,
      majorHoldersBreakdown: summary.majorHoldersBreakdown ? {
        insidersPercentHeld: summary.majorHoldersBreakdown.insidersPercentHeld,
        institutionsPercentHeld: summary.majorHoldersBreakdown.institutionsPercentHeld,
        institutionsCount: summary.majorHoldersBreakdown.institutionsCount,
      } : undefined,
      netSharePurchaseActivity: summary.netSharePurchaseActivity ? {
        period: summary.netSharePurchaseActivity.period,
        buyInfoCount: summary.netSharePurchaseActivity.buyInfoCount,
        buyInfoShares: summary.netSharePurchaseActivity.buyInfoShares,
        sellInfoCount: summary.netSharePurchaseActivity.sellInfoCount,
        sellInfoShares: summary.netSharePurchaseActivity.sellInfoShares,
        netInfoCount: summary.netSharePurchaseActivity.netInfoCount,
        netInfoShares: summary.netSharePurchaseActivity.netInfoShares,
      } : undefined,
      earnings: summary.earnings ? {
        financialsChart: summary.earnings.financialsChart ? {
          quarterly: summary.earnings.financialsChart.quarterly?.map((q: {
            date?: string;
            revenue?: number;
            earnings?: number;
          }) => ({
            date: q.date,
            revenue: q.revenue,
            earnings: q.earnings,
          })),
        } : undefined,
      } : undefined,
      earningsHistory: summary.earningsHistory ? {
        history: summary.earningsHistory.history?.map((h: {
          quarter?: Date;
          epsActual?: number;
          epsEstimate?: number;
          epsDifference?: number;
          surprisePercent?: number;
        }) => ({
          quarter: h.quarter,
          epsActual: h.epsActual,
          epsEstimate: h.epsEstimate,
          epsDifference: h.epsDifference,
          surprisePercent: h.surprisePercent,
        })),
      } : undefined,
    };
    
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Fetch historical price data
   */
  async getHistorical(
    symbol: string,
    days = 365  // Need 365 calendar days to get ~252 trading days for MA200
  ): Promise<HistoricalData[]> {
    const cacheKey = `historical_${symbol}_${days}`;
    const cached = this.getCache<HistoricalData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result: YahooChart = await this.withRetry(
      () => yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      }),
      symbol,
      "historical"
    );

    if (!result || !result.quotes) {
      return [];
    }

    const data: HistoricalData[] = result.quotes.map((q: {
      date: Date;
      open?: number | null;
      high?: number | null;
      low?: number | null;
      close?: number | null;
      volume?: number | null;
      adjclose?: number | null;
    }) => ({
      date: new Date(q.date),
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close ?? 0,
      volume: q.volume ?? 0,
      adjClose: q.adjclose ?? undefined,
    }));
    
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Fetch options chain for a symbol
   * Returns calls and puts for the nearest monthly expiration
   */
  async getOptionsChain(
    symbol: string, 
    targetDTE: number = 30
  ): Promise<{
    calls: Array<{
      strike: number;
      expiration: Date;
      bid: number;
      ask: number;
      openInterest: number;
      volume: number;
      impliedVolatility: number;
    }>;
    puts: Array<{
      strike: number;
      expiration: Date;
      bid: number;
      ask: number;
      openInterest: number;
      volume: number;
      impliedVolatility: number;
    }>;
    expiration: Date;
  } | null> {
    const cacheKey = `options_${symbol}_${targetDTE}`;
    const cached = this.getCache<{
      calls: Array<{
        strike: number;
        expiration: Date;
        bid: number;
        ask: number;
        openInterest: number;
        volume: number;
        impliedVolatility: number;
      }>;
      puts: Array<{
        strike: number;
        expiration: Date;
        bid: number;
        ask: number;
        openInterest: number;
        volume: number;
        impliedVolatility: number;
      }>;
      expiration: Date;
    }>(cacheKey);
    
    if (cached) return cached;

    try {
      await this.rateLimit();

      // First get available expiration dates
      const expirations = await yahooFinance.options(symbol);
      
      if (!expirations?.expirationDates?.length) {
        return null;
      }

      // Find expiration closest to target DTE
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + targetDTE);
      
      let closestExp = expirations.expirationDates[0];
      let closestDiff = Math.abs(
        closestExp.getTime() - targetDate.getTime()
      );
      
      for (const exp of expirations.expirationDates) {
        const diff = Math.abs(exp.getTime() - targetDate.getTime());
        if (diff < closestDiff) {
          closestDiff = diff;
          closestExp = exp;
        }
      }

      // Fetch options for that expiration
      await this.rateLimit();
      const chain = await yahooFinance.options(symbol, { 
        date: closestExp 
      });

      if (!chain?.options?.[0]) {
        return null;
      }

      const opts = chain.options[0];
      
      const calls = (opts.calls ?? []).map((c: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
      }) => ({
        strike: c.strike,
        expiration: closestExp,
        bid: c.bid ?? 0,
        ask: c.ask ?? 0,
        openInterest: c.openInterest ?? 0,
        volume: c.volume ?? 0,
        impliedVolatility: c.impliedVolatility ?? 0,
      }));

      const puts = (opts.puts ?? []).map((p: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
      }) => ({
        strike: p.strike,
        expiration: closestExp,
        bid: p.bid ?? 0,
        ask: p.ask ?? 0,
        openInterest: p.openInterest ?? 0,
        volume: p.volume ?? 0,
        impliedVolatility: p.impliedVolatility ?? 0,
      }));

      const result = { calls, puts, expiration: closestExp };
      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      logger.warn(`Failed to fetch options for ${symbol}: ${error}`);
      return null;
    }
  }

  /**
   * Fetch all data for a symbol sequentially (not parallel)
   * to reduce rate limit pressure
   */
  async getAllData(symbol: string): Promise<{
    quote: QuoteData | null;
    summary: QuoteSummary | null;
    historical: HistoricalData[];
  }> {
    // Sequential fetching to reduce rate limit pressure
    const quote = await this.getQuote(symbol);
    const summary = await this.getQuoteSummary(symbol);
    const historical = await this.getHistorical(symbol);

    return { quote, summary, historical };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    const files = Bun.spawnSync(["rm", "-rf", `${CACHE_DIR}/*`]);
    if (files.success) {
      logger.info("Cache cleared");
    }
  }

  /**
   * Get rate limit status for debugging
   */
  getRateLimitStatus(): { 
    rateLimitHit: boolean; 
    cooldownRemaining: number 
  } {
    return {
      rateLimitHit: this.rateLimitHit,
      cooldownRemaining: Math.max(0, this.rateLimitCooldownUntil - Date.now()),
    };
  }
}

export const yahooProvider = new YahooProvider();
