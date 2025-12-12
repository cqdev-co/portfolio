/**
 * Yahoo Finance Service for AI Analyst
 * Fetches options chains, earnings dates, and enhanced ticker data
 */

import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey", "rippiReport"],
  validation: {
    logErrors: false,
    logOptionsErrors: false,
  },
});

// ============================================================================
// TYPES
// ============================================================================

export interface OptionContract {
  strike: number;
  expiration: Date;
  bid: number;
  ask: number;
  mid: number;
  openInterest: number;
  volume: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  calls: OptionContract[];
  puts: OptionContract[];
  expiration: Date;
  dte: number;
  underlyingPrice: number;
}

export interface SpreadRecommendation {
  longStrike: number;
  shortStrike: number;
  expiration: Date;
  dte: number;
  estimatedDebit: number;
  maxProfit: number;
  breakeven: number;
  cushion: number;  // Distance from current price to breakeven as %
  longDelta: number;  // Approximate based on ITM %
  returnOnRisk: number;  // Max profit / debit as percentage
  spreadWidth: number;  // Width between strikes
}

export interface SpreadAlternatives {
  primary: SpreadRecommendation | null;
  alternatives: SpreadRecommendation[];
  reason?: string;  // Why alternatives are suggested
}

export interface DataQuality {
  isStale: boolean;
  staleHours?: number;
  warning?: string;
}

export interface MarketStatus {
  isOpen: boolean;
  status: 'PRE_MARKET' | 'OPEN' | 'AFTER_HOURS' | 'CLOSED';
  nextOpen?: Date;
  warning?: string;
}

// ============================================================================
// DATA QUALITY CHECKS
// ============================================================================

/**
 * Check if market data is stale (weekend/after-hours)
 */
export function checkDataStaleness(regularMarketTime?: Date | number): DataQuality {
  if (!regularMarketTime) {
    return { isStale: false };
  }
  
  const marketTime = typeof regularMarketTime === 'number' 
    ? new Date(regularMarketTime * 1000) 
    : regularMarketTime;
  
  const hoursSinceUpdate = (Date.now() - marketTime.getTime()) / (1000 * 60 * 60);
  
  // Weekend check
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  if (hoursSinceUpdate > 48 || (isWeekend && hoursSinceUpdate > 16)) {
    return {
      isStale: true,
      staleHours: Math.round(hoursSinceUpdate),
      warning: `⚠️ Data is ${Math.round(hoursSinceUpdate / 24)} days old - prices may be outdated`,
    };
  } else if (hoursSinceUpdate > 16) {
    return {
      isStale: true,
      staleHours: Math.round(hoursSinceUpdate),
      warning: '⚠️ Weekend/after-hours data - prices from last trading session',
    };
  }
  
  return { isStale: false, staleHours: Math.round(hoursSinceUpdate) };
}

/**
 * Validate IV is within reasonable range
 */
export function validateIV(iv: number): { valid: boolean; warning?: string } {
  // IV should be between 10% and 200% for most stocks
  if (iv < 0.10) {
    return { valid: false, warning: 'IV data appears invalid (too low)' };
  }
  if (iv > 2.0) {
    return { valid: false, warning: 'IV data appears invalid (extremely high)' };
  }
  return { valid: true };
}

/**
 * Check if US stock market is currently open
 * Market hours: 9:30 AM - 4:00 PM ET, Mon-Fri
 */
export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  // Get current time in ET
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const timeInMinutes = hour * 60 + minute;
  
  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    const nextOpen = new Date(now);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 30, 0, 0);
    
    return {
      isOpen: false,
      status: 'CLOSED',
      nextOpen,
      warning: '📅 Weekend - Markets closed. Data is from Friday close.',
    };
  }
  
  const marketOpen = 9 * 60 + 30;   // 9:30 AM
  const marketClose = 16 * 60;       // 4:00 PM
  const preMarketStart = 4 * 60;     // 4:00 AM
  const afterHoursEnd = 20 * 60;     // 8:00 PM
  
  if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
    return { isOpen: true, status: 'OPEN' };
  }
  
  if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
    return {
      isOpen: false,
      status: 'PRE_MARKET',
      warning: '🌅 Pre-market session - Limited liquidity, wider spreads.',
    };
  }
  
  if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
    return {
      isOpen: false,
      status: 'AFTER_HOURS',
      warning: '🌙 After-hours - Limited liquidity, prices may gap at open.',
    };
  }
  
  // Overnight
  const nextOpen = new Date(now);
  if (timeInMinutes >= afterHoursEnd) {
    nextOpen.setDate(nextOpen.getDate() + 1);
  }
  nextOpen.setHours(9, 30, 0, 0);
  
  return {
    isOpen: false,
    status: 'CLOSED',
    nextOpen,
    warning: '🌙 Markets closed overnight.',
  };
}

export interface EarningsInfo {
  nextEarningsDate: Date | null;
  daysUntilEarnings: number | null;
  withinEarningsWindow: boolean;  // Within 14 days
}

export interface IVAnalysis {
  currentIV: number;           // Current implied volatility (ATM average)
  ivPercentile: number;        // Where current IV sits vs historical (0-100)
  ivLevel: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH';
  recommendation: string;
}

export interface SupportResistance {
  supports: PriceLevel[];
  resistances: PriceLevel[];
  nearestSupport: PriceLevel | null;
  nearestResistance: PriceLevel | null;
}

export interface PriceLevel {
  price: number;
  type: 'MA20' | 'MA50' | 'MA200' | 'ROUND' | 'RECENT_LOW' | 'RECENT_HIGH' | '52W_LOW' | '52W_HIGH';
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  distance: number;  // % from current price
}

// ============================================================================
// OPTIONS CHAIN
// ============================================================================

/**
 * Fetch options chain for a symbol
 */
export async function getOptionsChain(
  symbol: string,
  targetDTE: number = 30
): Promise<OptionsChain | null> {
  try {
    // Get quote for underlying price
    const quote = await yahooFinance.quote(symbol);
    const underlyingPrice = quote?.regularMarketPrice;
    if (!underlyingPrice) return null;

    // Get available expiration dates
    const expirations = await yahooFinance.options(symbol);
    if (!expirations?.expirationDates?.length) return null;

    // Find expiration closest to target DTE
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + targetDTE);

    let closestExp = expirations.expirationDates[0];
    let closestDiff = Math.abs(closestExp.getTime() - targetDate.getTime());

    for (const exp of expirations.expirationDates) {
      const diff = Math.abs(exp.getTime() - targetDate.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closestExp = exp;
      }
    }

    // Fetch options for that expiration
    const chain = await yahooFinance.options(symbol, { date: closestExp });
    if (!chain?.options?.[0]) return null;

    const opts = chain.options[0];
    const dte = Math.ceil(
      (closestExp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const calls: OptionContract[] = (opts.calls ?? []).map(
      (c: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }) => ({
        strike: c.strike,
        expiration: closestExp,
        bid: c.bid ?? 0,
        ask: c.ask ?? 0,
        mid: ((c.bid ?? 0) + (c.ask ?? 0)) / 2,
        openInterest: c.openInterest ?? 0,
        volume: c.volume ?? 0,
        impliedVolatility: c.impliedVolatility ?? 0,
        inTheMoney: c.inTheMoney ?? c.strike < underlyingPrice,
      })
    );

    const puts: OptionContract[] = (opts.puts ?? []).map(
      (p: {
        strike: number;
        bid?: number;
        ask?: number;
        openInterest?: number;
        volume?: number;
        impliedVolatility?: number;
        inTheMoney?: boolean;
      }) => ({
        strike: p.strike,
        expiration: closestExp,
        bid: p.bid ?? 0,
        ask: p.ask ?? 0,
        mid: ((p.bid ?? 0) + (p.ask ?? 0)) / 2,
        openInterest: p.openInterest ?? 0,
        volume: p.volume ?? 0,
        impliedVolatility: p.impliedVolatility ?? 0,
        inTheMoney: p.inTheMoney ?? p.strike > underlyingPrice,
      })
    );

    return {
      calls,
      puts,
      expiration: closestExp,
      dte,
      underlyingPrice,
    };
  } catch (error) {
    console.error(`Failed to fetch options for ${symbol}:`, error);
    return null;
  }
}

/**
 * Find optimal deep ITM call debit spread
 * - Long strike: 6-12% ITM
 * - Short strike: $5 higher than long
 * - Target DTE: 21-45 days
 */
export async function findOptimalSpread(
  symbol: string,
  targetDTE: number = 30
): Promise<SpreadRecommendation | null> {
  const chain = await getOptionsChain(symbol, targetDTE);
  if (!chain || chain.calls.length === 0) return null;

  const { calls, underlyingPrice, expiration, dte } = chain;

  // Sort calls by strike
  const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

  // Find strikes that are 6-12% ITM
  const minITM = underlyingPrice * 0.88; // 12% ITM
  const maxITM = underlyingPrice * 0.94; // 6% ITM

  // Find long strike in the ITM range
  let longCall: OptionContract | null = null;
  for (const call of sortedCalls) {
    if (call.strike >= minITM && call.strike <= maxITM) {
      longCall = call;
      break;
    }
  }

  // If no call in ideal range, find closest ITM call
  if (!longCall) {
    for (const call of sortedCalls) {
      if (call.strike < underlyingPrice) {
        longCall = call;
      }
    }
  }

  if (!longCall) return null;

  // Find short strike ($5 above long)
  const targetShortStrike = longCall.strike + 5;
  let shortCall: OptionContract | null = null;
  for (const call of sortedCalls) {
    if (call.strike >= targetShortStrike) {
      shortCall = call;
      break;
    }
  }

  if (!shortCall) return null;

  // Calculate spread metrics
  const spreadWidth = shortCall.strike - longCall.strike;
  let estimatedDebit = longCall.mid - shortCall.mid;
  
  // If debit is 0, negative, or exceeds spread width (bad data), estimate properly
  if (estimatedDebit <= 0 || estimatedDebit >= spreadWidth) {
    // For deep ITM spreads, debit should be close to (but less than) spread width
    // Estimate: ~80-90% of spread width for deep ITM calls
    const itmPercent = (underlyingPrice - longCall.strike) / underlyingPrice;
    const estimatedDebitRatio = 0.75 + (itmPercent * 0.2); // 75-95% based on ITM depth
    estimatedDebit = spreadWidth * Math.min(0.95, estimatedDebitRatio);
  }
  
  const maxProfit = spreadWidth - estimatedDebit;
  const breakeven = longCall.strike + estimatedDebit;
  const cushion = ((underlyingPrice - breakeven) / underlyingPrice) * 100;

  // VALIDATION: Reject spreads with poor risk/reward (< 10% return)
  const returnOnRisk = maxProfit / estimatedDebit;
  if (returnOnRisk < 0.10) {
    // This spread has terrible risk/reward, try to find a better one
    // or return null if none found
    return null;
  }

  // Approximate delta based on how deep ITM
  const itmPercent = (underlyingPrice - longCall.strike) / underlyingPrice;
  const longDelta = Math.min(0.95, 0.50 + itmPercent * 3); // Rough approximation

  return {
    longStrike: longCall.strike,
    shortStrike: shortCall.strike,
    expiration,
    dte,
    estimatedDebit: Math.round(estimatedDebit * 100) / 100,
    maxProfit: Math.round(maxProfit * 100) / 100,
    breakeven: Math.round(breakeven * 100) / 100,
    cushion: Math.round(cushion * 10) / 10,
    longDelta: Math.round(longDelta * 100) / 100,
    returnOnRisk: Math.round(returnOnRisk * 1000) / 10,  // As percentage
    spreadWidth,
  };
}

/**
 * Find optimal spread WITH alternatives for different budgets
 * Returns primary recommendation plus smaller/larger alternatives
 */
export async function findSpreadWithAlternatives(
  symbol: string,
  targetDTE: number = 30,
  maxDebit?: number  // Max debit budget (e.g., $300 for position limit)
): Promise<SpreadAlternatives> {
  const chain = await getOptionsChain(symbol, targetDTE);
  if (!chain || chain.calls.length === 0) {
    return { primary: null, alternatives: [] };
  }

  const { calls, underlyingPrice, expiration, dte } = chain;
  const sortedCalls = [...calls].sort((a, b) => a.strike - b.strike);

  // Find spreads with different widths: $2.50, $5, $10
  const widths = [2.5, 5, 10];
  const allSpreads: SpreadRecommendation[] = [];

  for (const width of widths) {
    // Find strikes that are 6-12% ITM
    const minITM = underlyingPrice * 0.88;
    const maxITM = underlyingPrice * 0.94;

    for (const longCall of sortedCalls) {
      if (longCall.strike < minITM || longCall.strike > maxITM) continue;
      if (longCall.strike >= underlyingPrice) continue;  // Must be ITM

      // Find matching short strike
      const targetShort = longCall.strike + width;
      const shortCall = sortedCalls.find(
        c => Math.abs(c.strike - targetShort) < 0.5
      );
      if (!shortCall) continue;

      // Calculate spread metrics
      const spreadWidth = shortCall.strike - longCall.strike;
      let estimatedDebit = longCall.mid - shortCall.mid;

      // Estimate debit if bad data
      if (estimatedDebit <= 0 || estimatedDebit >= spreadWidth) {
        const itmPct = (underlyingPrice - longCall.strike) / underlyingPrice;
        const ratio = 0.75 + (itmPct * 0.2);
        estimatedDebit = spreadWidth * Math.min(0.95, ratio);
      }

      const maxProfit = spreadWidth - estimatedDebit;
      const returnOnRisk = maxProfit / estimatedDebit;
      
      // Skip poor risk/reward
      if (returnOnRisk < 0.10) continue;

      const breakeven = longCall.strike + estimatedDebit;
      const cushion = ((underlyingPrice - breakeven) / underlyingPrice) * 100;
      const itmPct = (underlyingPrice - longCall.strike) / underlyingPrice;
      const longDelta = Math.min(0.95, 0.50 + itmPct * 3);

      allSpreads.push({
        longStrike: longCall.strike,
        shortStrike: shortCall.strike,
        expiration,
        dte,
        estimatedDebit: Math.round(estimatedDebit * 100) / 100,
        maxProfit: Math.round(maxProfit * 100) / 100,
        breakeven: Math.round(breakeven * 100) / 100,
        cushion: Math.round(cushion * 10) / 10,
        longDelta: Math.round(longDelta * 100) / 100,
        returnOnRisk: Math.round(returnOnRisk * 1000) / 10,
        spreadWidth,
      });
    }
  }

  if (allSpreads.length === 0) {
    return { primary: null, alternatives: [] };
  }

  // Sort by cushion (highest first)
  allSpreads.sort((a, b) => b.cushion - a.cushion);

  // Find primary (best cushion with $5 width)
  let primary = allSpreads.find(s => s.spreadWidth === 5) ?? allSpreads[0];
  let reason: string | undefined;

  // If maxDebit specified and primary exceeds it, find cheaper alternative
  if (maxDebit && primary.estimatedDebit * 100 > maxDebit) {
    const affordable = allSpreads.filter(
      s => s.estimatedDebit * 100 <= maxDebit
    );
    if (affordable.length > 0) {
      const newPrimary = affordable[0];
      reason = `$${primary.longStrike}/$${primary.shortStrike} costs `
        + `$${(primary.estimatedDebit * 100).toFixed(0)} (exceeds `
        + `$${maxDebit} limit). Suggesting $${newPrimary.spreadWidth} `
        + `wide spread instead.`;
      primary = newPrimary;
    } else {
      reason = `All spreads exceed $${maxDebit} budget. Consider `
        + `waiting for pullback or reducing DTE.`;
    }
  }

  // Get alternatives (different widths from primary)
  const alternatives = allSpreads
    .filter(s => s.spreadWidth !== primary.spreadWidth)
    .slice(0, 2);

  return { primary, alternatives, reason };
}

// ============================================================================
// EARNINGS DATA
// ============================================================================

/**
 * Get earnings date info for a symbol
 */
export async function getEarningsInfo(symbol: string): Promise<EarningsInfo> {
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["calendarEvents"],
    });

    const earningsDates = summary?.calendarEvents?.earnings?.earningsDate;
    if (!earningsDates || earningsDates.length === 0) {
      return {
        nextEarningsDate: null,
        daysUntilEarnings: null,
        withinEarningsWindow: false,
      };
    }

    // Try both dates if available (earnings dates are often a range)
    const now = new Date();
    
    for (const dateVal of earningsDates) {
      const earningsDate = new Date(dateVal);
      const daysUntil = Math.ceil(
        (earningsDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Only return future earnings (positive days)
      if (daysUntil > 0) {
        return {
          nextEarningsDate: earningsDate,
          daysUntilEarnings: daysUntil,
          withinEarningsWindow: daysUntil <= 14,
        };
      }
    }
    
    // All earnings dates are in the past - no upcoming earnings known
    return {
      nextEarningsDate: null,
      daysUntilEarnings: null,
      withinEarningsWindow: false,
    };
  } catch {
    return {
      nextEarningsDate: null,
      daysUntilEarnings: null,
      withinEarningsWindow: false,
    };
  }
}

// ============================================================================
// ENHANCED EARNINGS ANALYSIS
// ============================================================================

export interface EarningsHistoryData {
  averageMove: number;         // Average % move on earnings day
  averageSurprise: number;     // Average EPS surprise %
  beatRate: number;            // % of times beat estimates
  recentReactions: {
    date: Date;
    actualEps: number;
    estimatedEps: number;
    surprise: number;
    priceMove?: number;
  }[];
  ivCrushRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

/**
 * Get historical earnings reaction data
 * Analyzes past earnings to predict volatility
 */
export async function getEarningsHistory(
  symbol: string
): Promise<EarningsHistoryData | null> {
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["earningsHistory", "earningsTrend"],
    });

    const earningsHistory = summary?.earningsHistory?.history;
    if (!earningsHistory || earningsHistory.length === 0) {
      return null;
    }

    // Calculate metrics from earnings history
    const recentEarnings = earningsHistory.slice(0, 8); // Last 8 quarters
    
    let totalSurprise = 0;
    let beats = 0;
    const recentReactions: EarningsHistoryData['recentReactions'] = [];

    for (const earning of recentEarnings) {
      const actual = earning.epsActual;
      const estimated = earning.epsEstimate;
      
      if (actual !== undefined && estimated !== undefined && estimated !== 0) {
        const surprise = ((actual - estimated) / Math.abs(estimated)) * 100;
        totalSurprise += surprise;
        
        if (actual > estimated) beats++;
        
        recentReactions.push({
          date: new Date(earning.quarter ?? Date.now()),
          actualEps: actual,
          estimatedEps: estimated,
          surprise: Math.round(surprise * 10) / 10,
        });
      }
    }

    const avgSurprise = recentEarnings.length > 0 
      ? totalSurprise / recentEarnings.length 
      : 0;
    const beatRate = recentEarnings.length > 0 
      ? (beats / recentEarnings.length) * 100 
      : 50;

    // Estimate average move (typically 3-8% for most stocks)
    // Stocks with higher surprise variance tend to move more
    const surpriseVariance = recentReactions.reduce((sum, r) => 
      sum + Math.pow(r.surprise - avgSurprise, 2), 0
    ) / Math.max(1, recentReactions.length);
    const avgMove = Math.min(15, Math.max(3, Math.sqrt(surpriseVariance) * 1.5 + 4));

    // Assess IV crush risk based on typical move vs IV expectations
    let ivCrushRisk: EarningsHistoryData['ivCrushRisk'] = 'MEDIUM';
    let recommendation = 'Standard IV crush expected post-earnings';
    
    if (avgMove < 4) {
      ivCrushRisk = 'LOW';
      recommendation = 'Low historical volatility - IV crush may be mild';
    } else if (avgMove > 8) {
      ivCrushRisk = 'HIGH';
      recommendation = 'High earnings volatility - significant IV crush likely';
    }

    return {
      averageMove: Math.round(avgMove * 10) / 10,
      averageSurprise: Math.round(avgSurprise * 10) / 10,
      beatRate: Math.round(beatRate),
      recentReactions: recentReactions.slice(0, 4),
      ivCrushRisk,
      recommendation,
    };
  } catch {
    return null;
  }
}

/**
 * Get enhanced earnings info including history
 */
export async function getEnhancedEarningsInfo(symbol: string): Promise<{
  basic: EarningsInfo;
  history: EarningsHistoryData | null;
}> {
  const [basic, history] = await Promise.all([
    getEarningsInfo(symbol),
    getEarningsHistory(symbol),
  ]);
  
  return { basic, history };
}

// ============================================================================
// IV ANALYSIS
// ============================================================================

/**
 * Analyze implied volatility from options chain
 */
export async function getIVAnalysis(symbol: string): Promise<IVAnalysis | null> {
  try {
    const chain = await getOptionsChain(symbol, 30);
    if (!chain || chain.calls.length === 0) return null;

    const { calls, underlyingPrice } = chain;

    // Find ATM options (closest to current price)
    const atmCalls = calls
      .filter(c => Math.abs(c.strike - underlyingPrice) / underlyingPrice < 0.05)
      .sort((a, b) => Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice));

    if (atmCalls.length === 0) return null;

    // Average IV of ATM options (filter out zero IV - bad data)
    const validIVCalls = atmCalls.filter(c => c.impliedVolatility > 0.01);
    if (validIVCalls.length === 0) {
      // No valid IV data (weekend or illiquid options)
      return null;
    }
    
    const avgIV = validIVCalls.slice(0, 3).reduce((sum, c) => sum + c.impliedVolatility, 0) / 
                 Math.min(3, validIVCalls.length);
    
    const currentIV = avgIV * 100;  // Convert to percentage

    // Estimate IV percentile based on typical ranges
    // This is simplified - ideally we'd compare to historical IV
    // Low: < 20%, Normal: 20-35%, Elevated: 35-50%, High: > 50%
    let ivPercentile: number;
    let ivLevel: IVAnalysis['ivLevel'];
    let recommendation: string;

    if (currentIV < 20) {
      ivPercentile = currentIV * 2;  // 0-40 percentile
      ivLevel = 'LOW';
      recommendation = 'IV is low - good for buying spreads (cheaper premium)';
    } else if (currentIV < 35) {
      ivPercentile = 30 + (currentIV - 20) * 2;  // 30-60 percentile
      ivLevel = 'NORMAL';
      recommendation = 'IV is normal - standard entry conditions';
    } else if (currentIV < 50) {
      ivPercentile = 60 + (currentIV - 35) * 1.5;  // 60-82 percentile
      ivLevel = 'ELEVATED';
      recommendation = 'IV is elevated - consider smaller position or wait';
    } else {
      ivPercentile = Math.min(99, 80 + (currentIV - 50) * 0.4);  // 80-99 percentile
      ivLevel = 'HIGH';
      recommendation = 'IV is high - spreads are expensive, consider waiting for IV crush';
    }

    return {
      currentIV: Math.round(currentIV * 10) / 10,
      ivPercentile: Math.round(ivPercentile),
      ivLevel,
      recommendation,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// SUPPORT/RESISTANCE
// ============================================================================

interface SRInput {
  currentPrice: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  recentHigh?: number;
  recentLow?: number;
}

/**
 * Calculate support and resistance levels
 */
export function calculateSupportResistance(input: SRInput): SupportResistance {
  const { currentPrice } = input;
  const levels: PriceLevel[] = [];

  // Add MA levels
  if (input.ma20) {
    const distance = ((input.ma20 - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.ma20,
      type: 'MA20',
      strength: 'WEAK',
      distance,
    });
  }

  if (input.ma50) {
    const distance = ((input.ma50 - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.ma50,
      type: 'MA50',
      strength: 'MODERATE',
      distance,
    });
  }

  if (input.ma200) {
    const distance = ((input.ma200 - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.ma200,
      type: 'MA200',
      strength: 'STRONG',
      distance,
    });
  }

  // Add 52-week levels
  if (input.fiftyTwoWeekLow) {
    const distance = ((input.fiftyTwoWeekLow - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.fiftyTwoWeekLow,
      type: '52W_LOW',
      strength: 'STRONG',
      distance,
    });
  }

  if (input.fiftyTwoWeekHigh) {
    const distance = ((input.fiftyTwoWeekHigh - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.fiftyTwoWeekHigh,
      type: '52W_HIGH',
      strength: 'STRONG',
      distance,
    });
  }

  // Add recent highs/lows
  if (input.recentHigh) {
    const distance = ((input.recentHigh - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.recentHigh,
      type: 'RECENT_HIGH',
      strength: 'MODERATE',
      distance,
    });
  }

  if (input.recentLow) {
    const distance = ((input.recentLow - currentPrice) / currentPrice) * 100;
    levels.push({
      price: input.recentLow,
      type: 'RECENT_LOW',
      strength: 'MODERATE',
      distance,
    });
  }

  // Add round number levels (psychological)
  const roundBase = Math.pow(10, Math.floor(Math.log10(currentPrice)));
  const roundLevels = [
    Math.floor(currentPrice / roundBase) * roundBase,
    Math.ceil(currentPrice / roundBase) * roundBase,
    Math.round(currentPrice / (roundBase / 2)) * (roundBase / 2),
  ];
  
  for (const round of [...new Set(roundLevels)]) {
    if (Math.abs(round - currentPrice) / currentPrice > 0.01) {  // At least 1% away
      const distance = ((round - currentPrice) / currentPrice) * 100;
      levels.push({
        price: round,
        type: 'ROUND',
        strength: 'WEAK',
        distance,
      });
    }
  }

  // Separate into supports and resistances
  const supports = levels
    .filter(l => l.price < currentPrice)
    .sort((a, b) => b.price - a.price);  // Closest first

  const resistances = levels
    .filter(l => l.price > currentPrice)
    .sort((a, b) => a.price - b.price);  // Closest first

  return {
    supports,
    resistances,
    nearestSupport: supports[0] ?? null,
    nearestResistance: resistances[0] ?? null,
  };
}

/**
 * Get full support/resistance analysis for a ticker
 */
export async function getSupportResistance(symbol: string): Promise<SupportResistance | null> {
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote?.regularMarketPrice) return null;

    // Get historical data for recent high/low
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    let recentHigh: number | undefined;
    let recentLow: number | undefined;

    try {
      const history = await yahooFinance.chart(symbol, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });

      if (history?.quotes && history.quotes.length > 0) {
        const highs = history.quotes.map(q => q.high).filter((h): h is number => h !== null && h !== undefined);
        const lows = history.quotes.map(q => q.low).filter((l): l is number => l !== null && l !== undefined);
        
        if (highs.length > 0) recentHigh = Math.max(...highs);
        if (lows.length > 0) recentLow = Math.min(...lows);
      }
    } catch {
      // Historical data optional
    }

    return calculateSupportResistance({
      currentPrice: quote.regularMarketPrice,
      ma20: undefined,  // Will be passed from caller
      ma50: quote.fiftyDayAverage ?? undefined,
      ma200: quote.twoHundredDayAverage ?? undefined,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? undefined,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? undefined,
      recentHigh,
      recentLow,
    });
  } catch {
    return null;
  }
}

// ============================================================================
// NEWS
// ============================================================================

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: Date;
  summary?: string;
}

/**
 * Get recent news for a ticker (filtered to relevant news only)
 */
export async function getTickerNews(symbol: string, limit: number = 5): Promise<NewsItem[]> {
  try {
    // Request more than needed since we'll filter
    const result = await yahooFinance.search(symbol, { newsCount: limit * 3 });
    
    if (!result?.news || result.news.length === 0) {
      return [];
    }

    // Get company name for filtering
    let companyName = '';
    try {
      const quote = await yahooFinance.quote(symbol);
      companyName = quote?.shortName ?? quote?.longName ?? '';
    } catch {
      // Use symbol only if quote fails
    }

    // Filter news to only include items that mention the ticker or company
    const symbolUpper = symbol.toUpperCase();
    const companyWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const filteredNews = result.news.filter(item => {
      const title = item.title ?? '';
      const titleUpper = title.toUpperCase();
      const titleLower = title.toLowerCase();
      
      // Check if ticker symbol appears in title (with word boundaries)
      if (titleUpper.includes(symbolUpper + ':') || 
          titleUpper.includes(symbolUpper + ' ') ||
          titleUpper.includes('(' + symbolUpper + ')') ||
          titleUpper.startsWith(symbolUpper + ' ')) {
        return true;
      }
      
      // Check if company name words appear in title
      if (companyWords.length > 0) {
        const matchCount = companyWords.filter(word => titleLower.includes(word)).length;
        // Require at least 2 company name words to match, or 1 if it's the main word
        if (matchCount >= 2 || (matchCount === 1 && companyWords[0].length > 4)) {
          return true;
        }
      }
      
      return false;
    });

    return filteredNews.slice(0, limit).map(item => ({
      title: item.title ?? 'No title',
      publisher: item.publisher ?? 'Unknown',
      link: item.link ?? '',
      publishedAt: item.providerPublishTime 
        ? new Date(item.providerPublishTime * 1000) 
        : new Date(),
      summary: undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Format news for AI context
 */
export function formatNewsForAI(news: NewsItem[]): string {
  if (news.length === 0) return '';
  
  let output = '\n=== RECENT NEWS ===\n';
  for (const item of news) {
    const timeAgo = getTimeAgo(item.publishedAt);
    output += `• [${timeAgo}] ${item.title} (${item.publisher})\n`;
  }
  output += '=== END NEWS ===\n';
  
  return output;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

