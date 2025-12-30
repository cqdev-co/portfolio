/**
 * Yahoo Finance Data Fetching
 * 
 * Shared data fetching logic for CLI and Frontend.
 * Uses yahoo-finance2 which works in both Node.js and browser.
 * 
 * NOTE: This module now uses REAL options data for IV and spreads.
 * No more approximations!
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
import { getIVAnalysis } from '../options/iv';
import { findSpreadWithAlternatives } from '../options/spreads';
import { getPsychologicalFairValue, extractWallsFromPFV } from '../pfv';

// ============================================================================
// YAHOO FINANCE WRAPPER
// ============================================================================

/**
 * Fetch basic ticker data from Yahoo Finance
 * Works in both CLI and Frontend environments
 */
export async function fetchTickerData(
  ticker: string
): Promise<TickerData | null> {
  console.log(`[Yahoo] Fetching data for ${ticker}...`);
  
  // Dynamic import to work in both environments
  let YahooFinance;
  try {
    YahooFinance = (await import('yahoo-finance2')).default;
  } catch (importError) {
    console.error(`[Yahoo] Failed to import yahoo-finance2:`, importError);
    throw new Error('Yahoo Finance library not available');
  }
  
  const yahooFinance = new YahooFinance({ 
    suppressNotices: ["yahooSurvey"] 
  });
  
  try {
    console.log(`[Yahoo] Calling quote API for ${ticker}...`);
    const quote = await yahooFinance.quote(ticker.toUpperCase());
    
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
    
    // Fetch additional data
    try {
      const [summary, history, newsData, optionsFlow] = await Promise.all([
        fetchSummaryData(yahooFinance, ticker, price),
        fetchHistoricalData(yahooFinance, ticker),
        fetchNewsData(yahooFinance, ticker),
        fetchOptionsFlow(yahooFinance, ticker),
      ]);
      
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
          
          // Fetch relative strength vs SPY (same as CLI)
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
      // Uses the EXACT SAME functions as CLI - no approximations
      // ================================================================
      try {
        console.log(`[Yahoo] Fetching REAL options data for ${ticker}...`);
        
        // Fetch IV and PFV in parallel first
        // PFV gives us put/call walls for smart spread selection
        const [ivResult, pfvResult] = await Promise.all([
          getIVAnalysis(ticker),
          getPsychologicalFairValue(ticker),
        ]);
        
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
        
        // Now fetch spread with full context
        const spreadResult = await findSpreadWithAlternatives(
          ticker, 30, undefined, spreadContext
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
    console.error(`Error fetching ${ticker}:`, error);
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
    const insights = await yahooFinance.quoteSummary(ticker, {
      modules: [
        "financialData",
        "defaultKeyStatistics",
        "calendarEvents",
        "recommendationTrend",
        "assetProfile",
        "summaryDetail",
        "earningsHistory",  // Added for beat/miss streak
      ],
    });
    
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
      result.earningsDays = daysUntil !== undefined && daysUntil > 0 
        ? daysUntil 
        : null;
      result.earningsWarning = daysUntil !== undefined && daysUntil <= 14;
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
    
    const history = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });
    
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
    const search = await yahooFinance.search(ticker, { newsCount: 5 });
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
    const options = await yahooFinance.options(ticker);
    
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
    
    const spyHistory = await yahooFinance.chart('SPY', {
      period1: thirtyDaysAgo,
      period2: new Date(),
      interval: '1d',
    });
    
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

export { calculateRSI, calculateADX, getTrendStrength, checkDataStaleness };

