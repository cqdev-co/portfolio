/**
 * Polygon.io Data Fetching (Fallback)
 * 
 * Used when Yahoo Finance rate limits us (429 errors).
 * Free tier: 5 API calls/minute, EOD data, 2 years history.
 */

import type { TickerData, NewsItem } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POLYGON_BASE_URL = 'https://api.polygon.io';

function getApiKey(): string {
  const key = process.env.POLYGON_API_TOKEN;
  if (!key) {
    throw new Error('POLYGON_API_TOKEN not set in environment');
  }
  return key;
}

// Rate limiting for Polygon (5 calls/minute = 12s between calls to be safe)
let lastPolygonRequest = 0;
const MIN_POLYGON_DELAY_MS = 12000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function polygonFetch<T>(endpoint: string): Promise<T> {
  const now = Date.now();
  const timeSince = now - lastPolygonRequest;
  if (timeSince < MIN_POLYGON_DELAY_MS && lastPolygonRequest > 0) {
    const waitTime = MIN_POLYGON_DELAY_MS - timeSince;
    console.log(`[Polygon] Rate limiting, waiting ${Math.round(waitTime/1000)}s...`);
    await sleep(waitTime);
  }
  lastPolygonRequest = Date.now();
  
  const url = `${POLYGON_BASE_URL}${endpoint}`;
  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}apiKey=${getApiKey()}`;
  
  console.log(`[Polygon] Fetching: ${endpoint}`);
  
  const response = await fetch(fullUrl);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Polygon API error: ${response.status} - ${text}`);
  }
  
  return response.json();
}

// ============================================================================
// TYPES
// ============================================================================

interface PolygonTickerDetails {
  results?: {
    ticker: string;
    name: string;
    market_cap?: number;
    description?: string;
    sic_description?: string;
    total_employees?: number;
  };
  status: string;
}

interface PolygonPrevClose {
  results?: Array<{
    T: string;     // ticker
    c: number;     // close
    h: number;     // high
    l: number;     // low
    o: number;     // open
    v: number;     // volume
    vw: number;    // volume weighted avg price
  }>;
  status: string;
}

interface PolygonSnapshot {
  ticker?: {
    ticker: string;
    todaysChange: number;
    todaysChangePerc: number;
    day: {
      c: number;   // close
      h: number;   // high
      l: number;   // low
      o: number;   // open
      v: number;   // volume
    };
    prevDay: {
      c: number;
      h: number;
      l: number;
      o: number;
      v: number;
    };
  };
  status: string;
}

interface PolygonAggregates {
  results?: Array<{
    c: number;     // close
    h: number;     // high
    l: number;     // low
    o: number;     // open
    v: number;     // volume
    t: number;     // timestamp
  }>;
  status: string;
}

interface PolygonRSI {
  results?: {
    values?: Array<{
      timestamp: number;
      value: number;
    }>;
  };
  status: string;
}

interface PolygonSMA {
  results?: {
    values?: Array<{
      timestamp: number;
      value: number;
    }>;
  };
  status: string;
}

interface PolygonNews {
  results?: Array<{
    title: string;
    article_url: string;
    published_utc: string;
    publisher: {
      name: string;
    };
  }>;
  status: string;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch ticker data from Polygon.io
 * 
 * This is a fallback when Yahoo Finance is rate limited.
 * Note: Free tier only provides EOD data, not real-time.
 */
export async function fetchTickerDataFromPolygon(
  ticker: string
): Promise<TickerData | null> {
  const symbol = ticker.toUpperCase();
  console.log(`[Polygon] Fetching data for ${symbol} (fallback)...`);
  
  try {
    // Fetch previous day's data (EOD - free tier)
    const prevClose = await polygonFetch<PolygonPrevClose>(
      `/v2/aggs/ticker/${symbol}/prev`
    );
    
    if (!prevClose.results?.[0]) {
      console.log(`[Polygon] No data for ${symbol}`);
      return null;
    }
    
    const prev = prevClose.results[0];
    const price = prev.c;
    
    // Build basic ticker data
    const data: TickerData = {
      ticker: symbol,
      price,
      change: 0,  // EOD data doesn't have today's change
      changePct: 0,
      dataQuality: {
        isStale: true,
        ageHours: 0,
        warning: 'Using Polygon EOD data (Yahoo rate limited)',
      },
    };
    
    // Try to get ticker details (market cap, etc.)
    try {
      const details = await polygonFetch<PolygonTickerDetails>(
        `/v3/reference/tickers/${symbol}`
      );
      if (details.results) {
        data.marketCap = details.results.market_cap;
        if (details.results.sic_description) {
          data.sectorContext = {
            name: details.results.sic_description,
          };
        }
      }
    } catch (e) {
      console.log(`[Polygon] Could not fetch details for ${symbol}`);
    }
    
    // Fetch historical data for technicals (last 60 days)
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 60);
      
      const history = await polygonFetch<PolygonAggregates>(
        `/v2/aggs/ticker/${symbol}/range/1/day/` +
        `${startDate.toISOString().split('T')[0]}/` +
        `${endDate.toISOString().split('T')[0]}`
      );
      
      if (history.results && history.results.length >= 14) {
        const closes = history.results.map(r => r.c);
        const highs = history.results.map(r => r.h);
        const lows = history.results.map(r => r.l);
        
        // Calculate RSI
        data.rsi = calculateRSI(closes);
        
        // Calculate support/resistance
        const recentLow = Math.min(...lows.slice(-20));
        const recentHigh = Math.max(...highs.slice(-20));
        data.support = Math.round(recentLow);
        data.resistance = Math.round(recentHigh);
        
        // Calculate MAs
        if (closes.length >= 20) {
          data.ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        }
        if (closes.length >= 50) {
          data.ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
        }
        
        // 52-week high/low approximation from available data
        data.fiftyTwoWeekLow = Math.min(...lows);
        data.fiftyTwoWeekHigh = Math.max(...highs);
        
        // Calculate HV20
        data.hv20 = calculateHistoricalVolatility(closes, 20);
        
        // Performance
        if (closes.length >= 5) {
          const now = closes[closes.length - 1];
          const d5 = closes[closes.length - 6] || now;
          const m1 = closes[0] || now;
          
          data.performance = {
            day5: ((now - d5) / d5) * 100,
            month1: ((now - m1) / m1) * 100,
          };
        }
      }
    } catch (e) {
      console.log(`[Polygon] Could not fetch history for ${symbol}`);
    }
    
    // Fetch news
    try {
      const news = await polygonFetch<PolygonNews>(
        `/v2/reference/news?ticker=${symbol}&limit=3`
      );
      
      if (news.results && news.results.length > 0) {
        data.news = news.results.map(n => ({
          title: n.title,
          url: n.article_url,
          date: n.published_utc,
          source: n.publisher?.name,
        }));
      }
    } catch (e) {
      console.log(`[Polygon] Could not fetch news for ${symbol}`);
    }
    
    console.log(`[Polygon] Got data for ${symbol}: $${price}`);
    return data;
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Polygon] Error fetching ${symbol}:`, msg);
    return null;
  }
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

/**
 * Calculate RSI from closing prices
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) gains += changes[i];
    else losses -= changes[i];
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
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
 * Calculate historical volatility (annualized)
 */
function calculateHistoricalVolatility(
  prices: number[],
  period: number = 20
): number | undefined {
  if (prices.length < period + 1) return undefined;
  
  const returns: number[] = [];
  const slice = prices.slice(-period - 1);
  
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce(
    (sum, r) => sum + Math.pow(r - mean, 2), 0
  ) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev * Math.sqrt(252) * 100;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { polygonFetch };

