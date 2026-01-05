/**
 * Yahoo Finance Data Fetching
 * 
 * Shared data fetching logic for CLI and Frontend.
 * Uses yahoo-finance2 which works in both Node.js and browser.
 * 
 * NOTE: This module now uses REAL options data for IV and spreads.
 * No more approximations!
 * 
 * PROXY SUPPORT: When YAHOO_PROXY_URL is set, routes requests through
 * Cloudflare Worker to bypass IP-based rate limiting.
 */

import type {
  TickerData,
  SpreadRecommendation,
  IVAnalysis,
  TradeGrade,
  NewsItem,
  DataQuality,
  AnalystRatings,
  TargetPrices,
  PricePerformance,
  SectorContext,
  OptionsFlow,
  RelativeStrength,
  EarningsHistory,
} from './types';

// Import REAL options functions (same as CLI uses)
import { getOptionsChain } from '../options/chain';
import type { OptionsChain, IVAnalysis as IVAnalysisType } from '../options/types';
import { findSpreadWithAlternatives } from '../options/spreads';
import { getPsychologicalFairValue, extractWallsFromPFV } from '../pfv';

// Polygon.io fallback
import { fetchTickerDataFromPolygon } from './polygon';

// Cloudflare Worker proxy (bypasses Yahoo rate limits)
import {
  isProxyConfigured,
  fetchAllViaProxy,  // Combined endpoint (5x more efficient)
  fetchQuoteViaProxy,
  fetchChartViaProxy,
  fetchOptionsViaProxy,
  fetchSummaryViaProxy,
  fetchNewsViaProxy,
} from './yahoo-proxy';

/**
 * Extract IV from an already-fetched options chain
 * Avoids extra API call since we already have the chain
 */
function getIVFromChain(chain: OptionsChain): IVAnalysisType | null {
  const { calls, underlyingPrice } = chain;
  
  // Find ATM options (within 5% of current price)
  const atmCalls = calls
    .filter(c => 
      Math.abs(c.strike - underlyingPrice) / underlyingPrice < 0.05
    )
    .sort((a, b) => 
      Math.abs(a.strike - underlyingPrice) - 
      Math.abs(b.strike - underlyingPrice)
    );

  if (atmCalls.length === 0) return null;

  // Average IV of ATM options (filter out zero IV)
  const validIVCalls = atmCalls.filter(c => c.impliedVolatility > 0.01);
  if (validIVCalls.length === 0) return null;

  const avgIV = validIVCalls
    .slice(0, 3)
    .reduce((sum, c) => sum + c.impliedVolatility, 0) /
    Math.min(3, validIVCalls.length);

  const currentIV = avgIV * 100;

  let ivPercentile: number;
  let ivLevel: IVAnalysisType['ivLevel'];

  if (currentIV < 20) {
    ivPercentile = currentIV * 2;
    ivLevel = 'LOW';
  } else if (currentIV < 35) {
    ivPercentile = 30 + (currentIV - 20) * 2;
    ivLevel = 'NORMAL';
  } else if (currentIV < 50) {
    ivPercentile = 60 + (currentIV - 35) * 1.5;
    ivLevel = 'ELEVATED';
  } else {
    ivPercentile = Math.min(99, 80 + (currentIV - 50) * 0.4);
    ivLevel = 'HIGH';
  }

  return {
    currentIV: Math.round(currentIV * 10) / 10,
    ivPercentile: Math.round(ivPercentile),
    ivLevel,
  };
}

// ============================================================================
// RATE LIMITING & RETRY LOGIC
// ============================================================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter to prevent 429 errors
 * Yahoo Finance has aggressive rate limits on their crumb system
 */
let lastRequestTime = 0;
let yahooRateLimited = false;  // Track if we've been rate limited
let rateLimitExpiry = 0;       // When to try Yahoo again
const MIN_REQUEST_DELAY_MS = 1500;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown after rate limit

/**
 * Check if Yahoo is currently rate limited
 */
export function isYahooRateLimited(): boolean {
  if (!yahooRateLimited) return false;
  if (Date.now() > rateLimitExpiry) {
    yahooRateLimited = false;
    console.log('[Yahoo] Rate limit cooldown expired, will try again');
    return false;
  }
  return true;
}

/**
 * Mark Yahoo as rate limited
 */
function setYahooRateLimited(): void {
  yahooRateLimited = true;
  rateLimitExpiry = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  console.log('[Yahoo] Rate limited - switching to Polygon fallback for 5 min');
}

async function rateLimitedRequest<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 2000
): Promise<T> {
  // Enforce minimum delay between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_DELAY_MS) {
    await sleep(MIN_REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = lastError.message.toLowerCase();
      
      // Check if it's a rate limit error (429) or crumb error
      const isRateLimit = errorMsg.includes('429') || 
                          errorMsg.includes('too many requests') ||
                          errorMsg.includes('rate limit') ||
                          errorMsg.includes('crumb');
      
      if (isRateLimit) {
        if (attempt < retries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(
            `[Yahoo] Rate limited, waiting ${Math.round(delay / 1000)}s ` +
            `(attempt ${attempt + 1}/${retries})...`
          );
          await sleep(delay);
          lastRequestTime = Date.now();
        } else {
          // All retries exhausted - mark as rate limited
          setYahooRateLimited();
        }
      } else {
        // Non-rate-limit error, don't retry
        throw lastError;
      }
    }
  }
  
  throw lastError ?? new Error('Unknown error after retries');
}

// ============================================================================
// YAHOO FINANCE WRAPPER
// ============================================================================

// Singleton instance to reuse crumb/cookies across requests
let yahooFinanceInstance: InstanceType<
  typeof import('yahoo-finance2').default
> | null = null;

async function getYahooFinance() {
  if (yahooFinanceInstance) return yahooFinanceInstance;
  
  const YahooFinance = (await import('yahoo-finance2')).default;
  yahooFinanceInstance = new YahooFinance({ 
    suppressNotices: ["yahooSurvey", "rippiReport"],
  });
  return yahooFinanceInstance;
}

/**
 * Clear Yahoo Finance cache (useful if rate limited)
 */
function clearYahooCache(): void {
  yahooFinanceInstance = null;
  lastRequestTime = 0;
  console.log('[Yahoo] Cache cleared');
}

// ============================================================================
// PROXY-BASED FETCHING (Cloudflare Worker)
// ============================================================================

/**
 * Fetch ticker data via Cloudflare Worker proxy
 * Bypasses Yahoo's IP-based rate limiting
 */
async function fetchTickerDataViaProxy(
  ticker: string
): Promise<TickerData | null> {
  const symbol = ticker.toUpperCase();
  console.log(`[Yahoo Proxy] Fetching ${symbol} via combined endpoint (1 request)...`);
  
  try {
    // Use combined endpoint - 5x more efficient (1 request vs 5)
    const combined = await fetchAllViaProxy(symbol);
    if (!combined?.quote) {
      console.log(`[Yahoo Proxy] No data for ${symbol}`);
      return null;
    }
    
    const { quote, chart, earnings, analysts, shortInterest, options, news } = combined;
    const price = quote.price;
    console.log(`[Yahoo Proxy] Got ${symbol}: $${price} (${combined.elapsed_ms}ms)`);
    
    // Debug: log what we got from proxy
    console.log(`[Yahoo Proxy] Raw quote data:`, {
      marketCap: quote.marketCap,
      peRatio: quote.peRatio,
      beta: quote.beta,
      eps: quote.eps,
    });
    console.log(`[Yahoo Proxy] Has analysts:`, !!analysts, analysts?.total);
    console.log(`[Yahoo Proxy] Has options:`, !!options, options?.atmIV);
    
    // Build ticker data from clean combined response
    // Convert null to undefined where needed (TickerData uses undefined for optional fields)
    const data: TickerData = {
      ticker: symbol,
      price,
      change: quote.change ?? 0,
      changePct: quote.changePct ?? 0,
      ma20: quote.fiftyDayAverage ?? undefined,
      ma50: quote.fiftyDayAverage ?? undefined,
      ma200: quote.twoHundredDayAverage ?? undefined,
      aboveMA200: quote.twoHundredDayAverage 
        ? price > quote.twoHundredDayAverage 
        : undefined,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
      marketCap: quote.marketCap ?? undefined,
      peRatio: quote.peRatio ?? undefined,
      forwardPE: quote.forwardPE ?? undefined,
      eps: quote.eps ?? undefined,
      dividendYield: quote.dividendYield ?? undefined,
      beta: quote.beta ?? undefined,
      dataQuality: {
        isStale: false,
        ageHours: 0,
      },
    };
    
    // Process chart data for RSI, support/resistance
    if (chart?.quotes && chart.quotes.length >= 14) {
      const validCloses = chart.quotes
        .map(q => q.close)
        .filter((c): c is number => c !== null && c !== undefined);
      const validHighs = chart.quotes
        .map(q => q.high)
        .filter((h): h is number => h !== null && h !== undefined);
      const validLows = chart.quotes
        .map(q => q.low)
        .filter((l): l is number => l !== null && l !== undefined);
      
      if (validCloses.length >= 14) {
        data.rsi = calculateRSI(validCloses);
        data.hv20 = calculateHistoricalVolatility(validCloses, 20);
        
        // Support/Resistance from recent highs/lows
        const recentHighs = validHighs.slice(-20);
        const recentLows = validLows.slice(-20);
        if (recentHighs.length > 0 && recentLows.length > 0) {
          data.support = Math.round(Math.min(...recentLows));
          data.resistance = Math.round(Math.max(...recentHighs));
        }
        
        // Performance calculations
        if (validCloses.length >= 5) {
          const current = validCloses[validCloses.length - 1];
          const d5 = validCloses[validCloses.length - 6] || current;
          const d20 = validCloses[validCloses.length - 21] || current;
          
          data.performance = {
            day5: Math.round(((current - d5) / d5) * 1000) / 10,
            month1: Math.round(((current - d20) / d20) * 1000) / 10,
          };
        }
      }
    }
    
    // Earnings (already extracted by worker)
    if (earnings) {
      data.earningsDate = earnings.date;
      data.daysToEarnings = earnings.daysUntil;
      // Set earningsDays - keep actual value for display
      // Negative means earnings passed, positive means upcoming
      data.earningsDays = earnings.daysUntil;
      // Warning only for upcoming earnings within 14 days
      data.earningsWarning = earnings.daysUntil > 0 && earnings.daysUntil <= 14;
    }
    
    // Analyst ratings (already extracted by worker)
    if (analysts && analysts.total > 0) {
      data.analystRatings = {
        strongBuy: analysts.strongBuy,
        buy: analysts.buy,
        hold: analysts.hold,
        sell: analysts.sell,
        strongSell: analysts.strongSell,
        total: analysts.total,
        bullishPercent: analysts.bullishPct,
      };
    }
    
    // Short interest (already extracted by worker)
    if (shortInterest) {
      data.shortInterest = {
        shortRatio: shortInterest.shortRatio ?? 0,
        shortPct: shortInterest.shortPctFloat ?? 0,
      };
    }
    
    // News (already cleaned by worker)
    if (news && news.length > 0) {
      data.news = news.slice(0, 3).map(n => ({
        title: n.title,
        url: n.link || '',
        source: n.source || 'Unknown',
        date: n.date || new Date().toISOString(),
      }));
    }
    
    // Options data (already summarized by worker)
    if (options) {
      // IV analysis
      if (options.atmIV !== null) {
        const currentIV = options.atmIV;
        let ivLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
        let ivPercentile: number;
        
        if (currentIV < 20) {
          ivPercentile = currentIV * 2;
          ivLevel = 'LOW';
        } else if (currentIV < 35) {
          ivPercentile = 30 + (currentIV - 20) * 2;
          ivLevel = 'NORMAL';
        } else if (currentIV < 50) {
          ivPercentile = 60 + (currentIV - 35) * 1.5;
          ivLevel = 'ELEVATED';
        } else {
          ivPercentile = Math.min(99, 80 + (currentIV - 50) * 0.4);
          ivLevel = 'HIGH';
        }
        
        data.iv = {
          currentIV: Math.round(currentIV * 10) / 10,
          hv20: data.hv20,
          ivPercentile: Math.round(ivPercentile),
          ivLevel,
          premium: ivLevel === 'LOW' ? 'cheap' :
                   ivLevel === 'HIGH' ? 'expensive' : 'fair',
        };
      }
      
      // Options flow (already calculated by worker)
      if (options.callVolume > 0 || options.callOI > 0) {
        // Use lowercase to match OptionsFlow type definition
        const sentiment: 'bullish' | 'bearish' | 'neutral' = 
          options.callVolume > options.putVolume * 1.5 
            ? 'bullish' 
            : options.putVolume > options.callVolume * 1.5 
              ? 'bearish' 
              : 'neutral';
        
        data.optionsFlow = {
          pcRatioOI: options.pcRatioOI ?? undefined,
          pcRatioVol: options.pcRatioVol ?? undefined,
          sentiment,
        };
      }
    }
    
    // Calculate grade if we have enough data
    if (data.rsi && data.price) {
      data.grade = calculateTradeGrade(data);
    }
    
    console.log(`[Yahoo Proxy] Successfully fetched ${symbol}`);
    return data;
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Yahoo Proxy] Error fetching ${symbol}:`, msg);
    
    // Fall back to Polygon if proxy fails
    console.log(`[Yahoo Proxy] Falling back to Polygon...`);
    return fetchTickerDataFromPolygon(ticker);
  }
}

// ============================================================================
// DIRECT YAHOO FINANCE FETCHING
// ============================================================================

/**
 * Fetch basic ticker data from Yahoo Finance
 * 
 * Priority order:
 * 1. Cloudflare Worker proxy (if YAHOO_PROXY_URL configured)
 * 2. Direct Yahoo Finance (if not rate limited)
 * 3. Polygon.io fallback (if Yahoo rate limited)
 * 
 * Architecture optimized to minimize API calls:
 * - Options chain fetched ONCE and shared across IV/spread/PFV analysis
 * - Total: ~5-6 API calls instead of 15+
 */
export async function fetchTickerData(
  ticker: string
): Promise<TickerData | null> {
  // PRIORITY 1: Use Cloudflare Worker proxy if configured
  if (isProxyConfigured()) {
    console.log(`[Yahoo] Using Cloudflare Worker proxy for ${ticker}...`);
    return fetchTickerDataViaProxy(ticker);
  }
  
  // PRIORITY 2: Check if Yahoo is rate limited
  if (isYahooRateLimited()) {
    console.log(`[Yahoo] Currently rate limited, using Polygon fallback...`);
    return fetchTickerDataFromPolygon(ticker);
  }
  
  console.log(`[Yahoo] Fetching data for ${ticker} (direct)...`);
  
  let yahooFinance;
  try {
    yahooFinance = await getYahooFinance();
  } catch (importError) {
    console.error(`[Yahoo] Failed to import yahoo-finance2:`, importError);
    throw new Error('Yahoo Finance library not available');
  }
  
  try {
    console.log(`[Yahoo] Calling quote API for ${ticker}...`);
    const quote = await rateLimitedRequest(
      () => yahooFinance.quote(ticker.toUpperCase())
    );
    
    if (!quote?.regularMarketPrice) {
      console.log(`[Yahoo] No price data for ${ticker}`);
      return null;
    }
    
    console.log(`[Yahoo] Got quote for ${ticker}: $${quote.regularMarketPrice}`);
    
    const price = quote.regularMarketPrice;
    const change = quote.regularMarketChange ?? 0;
    const changePct = quote.regularMarketChangePercent ?? 0;
    
    // Check data freshness
    const dataQuality = checkDataStaleness(quote.regularMarketTime);
    
    // Build basic ticker data
    const data: TickerData = {
      ticker: ticker.toUpperCase(),
      price,
      change,
      changePct,
      ma20: quote.fiftyDayAverage, // Approximation
      ma50: quote.fiftyDayAverage,
      ma200: quote.twoHundredDayAverage,
      aboveMA200: quote.twoHundredDayAverage 
        ? price > quote.twoHundredDayAverage 
        : undefined,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      forwardPE: quote.forwardPE,
      eps: quote.trailingEps,
      dividendYield: quote.dividendYield,
      beta: quote.beta,
      dataQuality,
    };
    
    // Fetch additional data (sequential to avoid rate limits)
    try {
      // Run sequentially instead of Promise.all to respect rate limits
      const summary = await fetchSummaryData(yahooFinance, ticker, price);
      const history = await fetchHistoricalData(yahooFinance, ticker);
      const newsData = await fetchNewsData(yahooFinance, ticker);
      
      // Skip separate options flow call - we'll get this from the unified chain fetch below
      const optionsFlow: OptionsFlow | null = null;
      
      // Merge summary data
      if (summary) {
        Object.assign(data, summary);
      }
      
      // Add options flow (same as CLI)
      if (optionsFlow) {
        data.optionsFlow = optionsFlow;
        console.log(`[Yahoo] Options flow for ${ticker}: P/C ${
          optionsFlow.pcRatioOI
        } (${optionsFlow.sentiment})`);
      }
      
      // Calculate technicals from history
      if (history && history.closes.length >= 14) {
        data.rsi = calculateRSI(history.closes);
        data.adx = calculateADX(history.closes);
        data.trendStrength = getTrendStrength(data.adx);
        
        // Calculate support/resistance from recent lows/highs
        const recentLow = Math.min(...history.lows.slice(-20));
        const recentHigh = Math.max(...history.highs.slice(-20));
        data.support = Math.round(recentLow);
        data.resistance = Math.round(recentHigh);
        
        // Performance metrics
        if (history.closes.length >= 20) {
          const now = history.closes[history.closes.length - 1];
          const d5 = history.closes[history.closes.length - 6] || now;
          const m1 = history.closes[0] || now;
          
          data.performance = {
            day1: ((now - (history.closes[history.closes.length - 2] || now)) 
              / (history.closes[history.closes.length - 2] || now)) * 100,
            day5: ((now - d5) / d5) * 100,
            month1: ((now - m1) / m1) * 100,
          };
          
          // Fetch relative strength vs SPY
          const relStrength = await fetchRelativeStrength(
            yahooFinance, 
            ticker, 
            data.performance.month1
          );
          if (relStrength) {
            data.relativeStrength = relStrength;
            console.log(`[Yahoo] Relative strength for ${ticker}: ${
              relStrength.vsSPY > 0 ? '+' : ''
            }${relStrength.vsSPY}% vs SPY (${relStrength.trend})`);
          }
        }
        
        // Calculate HV20 for reference
        const hv20 = calculateHistoricalVolatility(history.closes, 20);
        if (hv20) {
          data.hv20 = hv20;
        }
      }
      
      // Add news
      if (newsData && newsData.length > 0) {
        data.news = newsData;
      }
      
      // ================================================================
      // REAL OPTIONS DATA (IV, Spread, PFV)
      // OPTIMIZED: Fetch options chain ONCE and share across all analysis
      // ================================================================
      try {
        console.log(`[Yahoo] Fetching options data for ${ticker}...`);
        
        // SINGLE options chain fetch - shared across IV, spreads, PFV
        const optionsChain = await getOptionsChain(ticker, 30);
        
        // Calculate options flow from the chain we already have
        if (optionsChain) {
          const { calls, puts } = optionsChain;
          const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
          const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
          const totalCallVol = calls.reduce((sum, c) => sum + c.volume, 0);
          const totalPutVol = puts.reduce((sum, p) => sum + p.volume, 0);
          
          if (totalCallOI > 0) {
            const pcRatioOI = Math.round((totalPutOI / totalCallOI) * 100) / 100;
            const pcRatioVol = totalCallVol > 0 
              ? Math.round((totalPutVol / totalCallVol) * 100) / 100 
              : 0;
            const sentiment: 'bullish' | 'neutral' | 'bearish' = 
              pcRatioOI < 0.7 ? 'bullish' : 
              pcRatioOI > 1.0 ? 'bearish' : 
              'neutral';
            
            data.optionsFlow = { pcRatioOI, pcRatioVol, sentiment };
            console.log(`[Yahoo] Options flow: P/C ${pcRatioOI} (${sentiment})`);
          }
        }
        
        // Get IV from the chain we already have (no extra API call)
        const ivResult = optionsChain 
          ? getIVFromChain(optionsChain)
          : null;
        
        // PFV still needs multiple expirations - but we'll optimize it too
        const pfvResult = await getPsychologicalFairValue(ticker);
        
        // Build spread context using PFV walls (same as CLI does)
        let putWalls: number[] | undefined;
        let callWalls: number[] | undefined;
        
        if (pfvResult) {
          const walls = extractWallsFromPFV(pfvResult);
          putWalls = walls.putWalls.length > 0 ? walls.putWalls : undefined;
          callWalls = walls.callWalls.length > 0 ? walls.callWalls : undefined;
          console.log(`[Yahoo] PFV for ${ticker}: $${pfvResult.fairValue.toFixed(2)} (${pfvResult.bias})`);
        }
        
        const spreadContext = {
          ma50: data.ma50,
          ma200: data.ma200,
          supportLevels: data.support ? [data.support] : undefined,
          resistanceLevels: data.resistance ? [data.resistance] : undefined,
          putWalls,
          callWalls,
        };
        
        // Pass the pre-fetched chain to avoid another API call
        const spreadResult = await findSpreadWithAlternatives(
          ticker, 30, undefined, spreadContext, optionsChain
        );
        
        if (ivResult) {
          console.log(`[Yahoo] Got REAL IV for ${ticker}: ${ivResult.currentIV}%`);
          data.iv = {
            currentIV: ivResult.currentIV,
            hv20: data.hv20,
            ivPercentile: ivResult.ivPercentile,
            ivLevel: ivResult.ivLevel,
            premium: ivResult.ivLevel === 'LOW' ? 'cheap' :
                     ivResult.ivLevel === 'HIGH' ? 'expensive' : 'fair',
          };
        } else {
          console.log(`[Yahoo] No options IV available for ${ticker}, using HV fallback`);
          // Fallback to HV-based estimate if options unavailable
          if (data.hv20) {
            data.iv = {
              currentIV: data.hv20 * 1.1,
              hv20: data.hv20,
              premium: data.hv20 > 40 ? 'expensive' : data.hv20 < 25 ? 'cheap' : 'fair',
            };
          }
        }
        
        // Store PFV data (same as CLI displays)
        if (pfvResult) {
          data.pfv = {
            fairValue: pfvResult.fairValue,
            bias: pfvResult.bias,
            confidence: pfvResult.confidence,
            deviationPercent: pfvResult.deviationPercent,
          };
        }
        
        if (spreadResult.primary) {
          const spread = spreadResult.primary;
          console.log(`[Yahoo] Got REAL spread for ${ticker}: ` +
            `$${spread.longStrike}/$${spread.shortStrike}, ` +
            `${spread.cushion}% cushion`);
          data.spread = spread;
          
          // Log alternatives if any (useful for debugging)
          if (spreadResult.alternatives.length > 0) {
            console.log(`[Yahoo] Spread alternatives: ${
              spreadResult.alternatives.map(a => 
                `$${a.longStrike}/$${a.shortStrike}`
              ).join(', ')
            }`);
          }
          if (spreadResult.reason) {
            console.log(`[Yahoo] Spread note: ${spreadResult.reason}`);
          }
        } else {
          console.log(`[Yahoo] No viable spread for ${ticker} - options too expensive or illiquid`);
          // Explicitly tell the AI there's no viable spread
          data.noSpreadReason = "No viable deep ITM call spread found - options are either too expensive (debit > 80% of width), have insufficient cushion (< 5%), or probability of profit is too low (< 70%)";
        }
      } catch (optionsError) {
        console.error(`[Yahoo] Options data fetch failed for ${ticker}:`, optionsError);
        // Continue without options data - better than nothing
      }
      
      // Calculate grade based on all available data
      if (data.rsi && data.price) {
        data.grade = calculateTradeGrade(data);
      }
    } catch (err) {
      console.error(`Error fetching additional data for ${ticker}:`, err);
      // Continue with basic data if additional fetches fail
    }
    
    return data;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Yahoo] Error fetching ${ticker}:`, errorMsg);
    
    // Check if it's a rate limit error
    const isRateLimit = errorMsg.toLowerCase().includes('429') || 
                        errorMsg.toLowerCase().includes('too many requests') ||
                        errorMsg.toLowerCase().includes('crumb');
    
    if (isRateLimit) {
      console.log(`[Yahoo] Rate limited - falling back to Polygon...`);
      return fetchTickerDataFromPolygon(ticker);
    }
    
    return null;
  }
}

// Sector average P/E ratios for comparison (same as CLI)
const SECTOR_AVG_PE: Record<string, number> = {
  'Technology': 28, 
  'Healthcare': 22, 
  'Financial Services': 15,
  'Consumer Cyclical': 20, 
  'Communication Services': 18, 
  'Industrials': 22,
  'Consumer Defensive': 24, 
  'Energy': 12, 
  'Basic Materials': 14,
  'Real Estate': 35, 
  'Utilities': 18,
};

/**
 * Fetch summary data including analyst ratings, earnings, etc.
 */
async function fetchSummaryData(
  yahooFinance: InstanceType<typeof import('yahoo-finance2').default>,
  ticker: string,
  currentPrice: number
): Promise<Partial<TickerData> | null> {
  try {
    const insights = await rateLimitedRequest(() => 
      yahooFinance.quoteSummary(ticker, {
      modules: [
        "financialData",
        "defaultKeyStatistics",
        "calendarEvents",
        "recommendationTrend",
        "assetProfile",
        "summaryDetail",
        "earningsHistory",  // Added for beat/miss streak
      ],
      })
    );
    
    const result: Partial<TickerData> = {};
    
    // Analyst ratings
    const recs = insights?.recommendationTrend?.trend?.[0];
    if (recs) {
      const total = (recs.strongBuy ?? 0) + (recs.buy ?? 0) + 
        (recs.hold ?? 0) + (recs.sell ?? 0) + (recs.strongSell ?? 0);
      const bullish = (recs.strongBuy ?? 0) + (recs.buy ?? 0);
      
      result.analystRatings = {
        strongBuy: recs.strongBuy ?? 0,
        buy: recs.buy ?? 0,
        hold: recs.hold ?? 0,
        sell: recs.sell ?? 0,
        strongSell: recs.strongSell ?? 0,
        bullishPercent: total > 0 ? Math.round((bullish / total) * 100) : 0,
      };
    }
    
    // Target prices
    const fd = insights?.financialData;
    if (fd?.targetMeanPrice) {
      const currentPrice = fd.currentPrice ?? 0;
      result.targetPrices = {
        low: fd.targetLowPrice ?? 0,
        mean: fd.targetMeanPrice ?? 0,
        high: fd.targetHighPrice ?? 0,
        upside: currentPrice > 0 
          ? ((fd.targetMeanPrice - currentPrice) / currentPrice) * 100 
          : 0,
      };
    }
    
    // Earnings with beat/miss history (same as CLI)
    const calendar = insights?.calendarEvents;
    const earningsHist = insights?.earningsHistory?.history ?? [];
    
    let streak = 0;
    let surpriseSum = 0;
    let surpriseCount = 0;
    let lastSurprise: number | undefined;
    
    // Process earnings history for beat/miss streak
    for (let i = 0; i < earningsHist.length && i < 4; i++) {
      const h = earningsHist[i];
      const epsActual = h.epsActual;
      const epsEstimate = h.epsEstimate;
      
      if (epsActual != null && epsEstimate != null && epsEstimate !== 0) {
        const surprise = 
          ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100;
        if (i === 0) lastSurprise = Math.round(surprise * 10) / 10;
        surpriseSum += surprise;
        surpriseCount++;
        if (i === 0 || (streak > 0 && surprise > 0) || 
            (streak < 0 && surprise < 0)) {
          streak += surprise > 0 ? 1 : -1;
        }
      }
    }
    
    // Build earnings object
    const nextEarnings = calendar?.earnings?.earningsDate?.[0];
    if (nextEarnings || surpriseCount > 0) {
      const earningsDateObj = nextEarnings ? new Date(nextEarnings) : null;
      const now = new Date();
      const daysUntil = earningsDateObj 
        ? Math.ceil((earningsDateObj.getTime() - now.getTime()) / 
            (1000 * 60 * 60 * 24))
        : undefined;
      
      result.earnings = {
        date: earningsDateObj?.toLocaleDateString('en-US', { 
          month: 'short', day: 'numeric' 
        }),
        daysUntil,
        streak: streak !== 0 ? streak : undefined,
        lastSurprise,
        avgSurprise: surpriseCount > 0 
          ? Math.round((surpriseSum / surpriseCount) * 10) / 10 
          : undefined,
      };
      
      // Also set legacy fields for backward compatibility
      // Keep actual value (negative = passed, positive = upcoming)
      result.earningsDays = daysUntil ?? null;
      // Warning only for upcoming earnings within 14 days
      result.earningsWarning = daysUntil !== undefined && 
        daysUntil > 0 && daysUntil <= 14;
    }
    
    // Sector with P/E comparison (same as CLI)
    const profile = insights?.assetProfile;
    const quote = insights?.summaryDetail;
    const trailingPE = quote?.trailingPE;
    
    if (profile?.sector) {
      const sectorName = profile.sector;
      const avgPE = SECTOR_AVG_PE[sectorName];
      
      result.sectorContext = {
        name: sectorName,
        avgPE,
        vsAvg: avgPE && trailingPE 
          ? Math.round(((trailingPE - avgPE) / avgPE) * 100)
          : undefined,
      };
    }
    
    // Short interest
    const ks = insights?.defaultKeyStatistics;
    if (ks?.shortPercentOfFloat) {
      result.shortInterest = {
        shortPct: Math.round((ks.shortPercentOfFloat ?? 0) * 1000) / 10,
        shortRatio: ks.shortRatio ?? 0,
      };
    }
    
    return result;
  } catch {
    return null;
  }
}

interface HistoricalData {
  closes: number[];
  highs: number[];
  lows: number[];
}

/**
 * Fetch historical price data for technical calculations
 */
async function fetchHistoricalData(
  yahooFinance: InstanceType<typeof import('yahoo-finance2').default>,
  ticker: string
): Promise<HistoricalData | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // 60 days for better calculations
    
    const history = await rateLimitedRequest(() => 
      yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
      })
    );
    
    const quotes = history?.quotes ?? [];
    const closes = quotes
      .map(q => q.close)
      .filter((c): c is number => c !== null && c !== undefined);
    const highs = quotes
      .map(q => q.high)
      .filter((h): h is number => h !== null && h !== undefined);
    const lows = quotes
      .map(q => q.low)
      .filter((l): l is number => l !== null && l !== undefined);
    
    if (closes.length < 14) return null;
    
    return { closes, highs, lows };
  } catch {
    return null;
  }
}

/**
 * Fetch news data for ticker
 */
async function fetchNewsData(
  yahooFinance: InstanceType<typeof import('yahoo-finance2').default>,
  ticker: string
): Promise<NewsItem[] | null> {
  try {
    const search = await rateLimitedRequest(() => 
      yahooFinance.search(ticker, { newsCount: 5 })
    );
    const news = search?.news ?? [];
    
    return news.slice(0, 3).map(n => ({
      title: n.title || 'No title',
      url: n.link || '',
      date: typeof n.providerPublishTime === 'number'
        ? new Date(n.providerPublishTime * 1000).toISOString() 
        : undefined,
      source: n.publisher || undefined,
    }));
  } catch {
    return null;
  }
}

/**
 * Fetch options flow (put/call ratio) - same as CLI
 * Analyzes total open interest and volume across all expirations
 */
async function fetchOptionsFlow(
  yahooFinance: InstanceType<typeof import('yahoo-finance2').default>,
  ticker: string
): Promise<OptionsFlow | null> {
  try {
    const options = await rateLimitedRequest(() => 
      yahooFinance.options(ticker)
    );
    
    let totalCallOI = 0;
    let totalPutOI = 0;
    let totalCallVol = 0;
    let totalPutVol = 0;
    
    for (const expiry of options.options || []) {
      for (const call of expiry.calls || []) {
        totalCallOI += call.openInterest || 0;
        totalCallVol += call.volume || 0;
      }
      for (const put of expiry.puts || []) {
        totalPutOI += put.openInterest || 0;
        totalPutVol += put.volume || 0;
      }
    }
    
    if (totalCallOI === 0) return null;
    
    const pcRatioOI = Math.round((totalPutOI / totalCallOI) * 100) / 100;
    const pcRatioVol = totalCallVol > 0 
      ? Math.round((totalPutVol / totalCallVol) * 100) / 100 
      : 0;
    
    // Sentiment interpretation (same as CLI)
    const sentiment: 'bullish' | 'neutral' | 'bearish' = 
      pcRatioOI < 0.7 ? 'bullish' : 
      pcRatioOI > 1.0 ? 'bearish' : 
      'neutral';
    
    return { pcRatioOI, pcRatioVol, sentiment };
  } catch {
    return null;
  }
}

/**
 * Fetch relative strength vs SPY (30-day) - same as CLI
 * Shows how ticker is performing relative to the market
 */
async function fetchRelativeStrength(
  yahooFinance: InstanceType<typeof import('yahoo-finance2').default>,
  ticker: string,
  tickerPerformance1M: number
): Promise<RelativeStrength | null> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const spyHistory = await rateLimitedRequest(() => 
      yahooFinance.chart('SPY', {
      period1: thirtyDaysAgo,
      period2: new Date(),
      interval: '1d',
      })
    );
    
    if (!spyHistory?.quotes || spyHistory.quotes.length < 5) return null;
    
    const spyStart = spyHistory.quotes[0]?.close;
    const spyEnd = spyHistory.quotes[spyHistory.quotes.length - 1]?.close;
    
    if (!spyStart || !spyEnd) return null;
    
    const spyReturn = ((spyEnd - spyStart) / spyStart) * 100;
    const vsSPY = Math.round((tickerPerformance1M - spyReturn) * 10) / 10;
    
    // Trend interpretation (same as CLI)
    const trend: 'outperforming' | 'inline' | 'underperforming' = 
      vsSPY > 5 ? 'outperforming' : 
      vsSPY < -5 ? 'underperforming' : 
      'inline';
    
    return { vsSPY, trend };
  } catch {
    return null;
  }
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let gains = 0;
  let losses = 0;
  
  // First average
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) gains += changes[i];
    else losses -= changes[i];
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Smooth subsequent values
  for (let i = period; i < changes.length; i++) {
    if (changes[i] >= 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - changes[i]) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate ADX (Average Directional Index) - simplified
 */
function calculateADX(prices: number[], period: number = 14): number {
  if (prices.length < period * 2) return 25;
  
  // Simplified ADX calculation based on price movement
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(Math.abs(prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  
  // Scale to 0-100 range (typical ADX values)
  // Higher volatility = higher ADX
  return Math.min(Math.round(avgChange * 1000), 60);
}

/**
 * Get trend strength label from ADX
 */
function getTrendStrength(adx?: number): 'WEAK' | 'MODERATE' | 'STRONG' {
  if (!adx || adx < 20) return 'WEAK';
  if (adx < 40) return 'MODERATE';
  return 'STRONG';
}

/**
 * Calculate historical volatility (annualized)
 */
function calculateHistoricalVolatility(
  prices: number[],
  period: number = 20
): number | null {
  if (prices.length < period + 1) return null;
  
  const returns: number[] = [];
  const slice = prices.slice(-period - 1);
  
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) 
    / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Annualize (252 trading days)
  return stdDev * Math.sqrt(252) * 100;
}

// NOTE: calculateSpreadRecommendation was REMOVED
// We now use findSpreadWithAlternatives from ../options/spreads
// This ensures CLI and Frontend use the EXACT SAME spread logic

/**
 * Calculate trade grade based on criteria
 */
function calculateTradeGrade(data: TickerData): TradeGrade | undefined {
  const { rsi, aboveMA200, earningsDays, analystRatings, spread } = data;
  
  let score = 50; // Start at neutral
  
  // RSI in sweet spot (35-55)
  if (rsi) {
    if (rsi >= 35 && rsi <= 55) score += 20;
    else if (rsi >= 30 && rsi <= 60) score += 10;
    else if (rsi < 30 || rsi > 70) score -= 10;
  }
  
  // Above 200 MA = uptrend
  if (aboveMA200 === true) score += 15;
  else if (aboveMA200 === false) score -= 5;
  
  // No earnings within 14 days
  if (earningsDays !== null && earningsDays !== undefined) {
    if (earningsDays > 30) score += 10;
    else if (earningsDays > 14) score += 5;
    else score -= 15; // Too close to earnings
  }
  
  // Analyst sentiment
  if (analystRatings) {
    if (analystRatings.bullishPercent >= 70) score += 10;
    else if (analystRatings.bullishPercent <= 30) score -= 10;
  }
  
  // Cushion from spread
  if (spread && spread.cushion >= 3) score += 5;
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Determine grade and recommendation
  let grade: string;
  let recommendation: string;
  
  if (score >= 80) { grade = 'A'; recommendation = 'STRONG BUY'; }
  else if (score >= 70) { grade = 'A-'; recommendation = 'BUY'; }
  else if (score >= 60) { grade = 'B+'; recommendation = 'BUY'; }
  else if (score >= 50) { grade = 'B'; recommendation = 'HOLD'; }
  else if (score >= 40) { grade = 'C+'; recommendation = 'CAUTION'; }
  else if (score >= 30) { grade = 'C'; recommendation = 'AVOID'; }
  else { grade = 'D'; recommendation = 'SELL'; }
  
  return { grade, score, recommendation };
}

// ============================================================================
// DATA QUALITY
// ============================================================================

/**
 * Check if data is stale (weekend/after-hours)
 */
function checkDataStaleness(
  marketTime?: Date | string | number
): DataQuality {
  if (!marketTime) {
    return { isStale: true, ageHours: 0, warning: 'No market time' };
  }
  
  const time = new Date(marketTime);
  const now = new Date();
  const ageMs = now.getTime() - time.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  
  const isStale = ageHours > 8; // More than 8 hours old
  
  return {
    isStale,
    ageHours: Math.round(ageHours),
    warning: isStale 
      ? `Data is ${Math.round(ageHours / 24)} days old` 
      : undefined,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { 
  calculateRSI, 
  calculateADX, 
  getTrendStrength, 
  checkDataStaleness,
  clearYahooCache,
};

