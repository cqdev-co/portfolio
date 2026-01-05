/**
 * Yahoo Finance Proxy Client
 * 
 * Fetches data via Cloudflare Worker proxy to bypass IP rate limits.
 * Falls back to direct Yahoo Finance if proxy not configured.
 */

import type { TickerData, NewsItem } from './types';

// ============================================================================
// CONFIGURATION  
// ============================================================================

/**
 * Get proxy URL from environment
 */
function getProxyUrl(): string | null {
  return process.env.YAHOO_PROXY_URL || null;
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!getProxyUrl();
}

// ============================================================================
// PROXY FETCH HELPERS
// ============================================================================

interface ProxyQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol: string;
      regularMarketPrice: number;
      regularMarketChange: number;
      regularMarketChangePercent: number;
      regularMarketTime: number;
      fiftyDayAverage: number;
      twoHundredDayAverage: number;
      fiftyTwoWeekLow: number;
      fiftyTwoWeekHigh: number;
      marketCap: number;
      trailingPE: number;
      forwardPE: number;
      trailingEps: number;
      dividendYield: number;
      beta: number;
    }>;
    error?: { code: string; description: string };
  };
}

// yahoo-finance2 returns chart data in this format
interface ProxyChartResponse {
  chart?: {
    result?: Array<{
      // yahoo-finance2 format: quotes array with date objects
      quotes?: Array<{
        date: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>;
      // Raw API format: timestamps + indicators
      timestamp?: number[];
      indicators?: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

interface ProxyOptionsResponse {
  optionChain?: {
    result?: Array<{
      expirationDates: number[];
      strikes: number[];
      quote: {
        regularMarketPrice: number;
      };
      options: Array<{
        expirationDate: number;
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
      }>;
    }>;
    error?: { code: string; description: string };
  };
}

interface ProxySummaryResponse {
  quoteSummary?: {
    result?: Array<{
      price?: {
        regularMarketPrice?: { raw: number };
        regularMarketChange?: { raw: number };
        regularMarketChangePercent?: { raw: number };
      };
      summaryDetail?: {
        trailingPE?: { raw: number };
        forwardPE?: { raw: number };
        dividendYield?: { raw: number };
        beta?: { raw: number };
        fiftyTwoWeekLow?: { raw: number };
        fiftyTwoWeekHigh?: { raw: number };
        fiftyDayAverage?: { raw: number };
        twoHundredDayAverage?: { raw: number };
        marketCap?: { raw: number };
      };
      financialData?: {
        revenueGrowth?: { raw: number };
        earningsGrowth?: { raw: number };
        currentRatio?: { raw: number };
        debtToEquity?: { raw: number };
      };
      defaultKeyStatistics?: {
        trailingEps?: { raw: number };
        forwardEps?: { raw: number };
        pegRatio?: { raw: number };
        shortRatio?: { raw: number };
        shortPercentOfFloat?: { raw: number };
      };
      calendarEvents?: {
        earnings?: {
          earningsDate?: Array<{ raw: number }>;
        };
      };
      recommendationTrend?: {
        trend?: Array<{
          strongBuy: number;
          buy: number;
          hold: number;
          sell: number;
          strongSell: number;
        }>;
      };
      institutionOwnership?: {
        ownershipList?: Array<{
          organization: string;
          pctHeld: { raw: number };
          position: { raw: number };
          value: { raw: number };
        }>;
      };
      majorHoldersBreakdown?: {
        institutionsPercentHeld?: { raw: number };
        insidersPercentHeld?: { raw: number };
      };
    }>;
    error?: { code: string; description: string };
  };
}

// yahoo-finance2 search returns news in this format
interface ProxySearchResponse {
  news?: Array<{
    title: string;
    link?: string;
    url?: string;  // yahoo-finance2 uses 'url' instead of 'link'
    publisher: string;
    providerPublishTime?: number | string | Date;
  }>;
}

/**
 * Fetch from proxy with error handling
 */
async function proxyFetch<T>(endpoint: string): Promise<T> {
  const baseUrl = getProxyUrl();
  if (!baseUrl) {
    throw new Error('YAHOO_PROXY_URL not configured');
  }
  
  const url = `${baseUrl}${endpoint}`;
  console.log(`[Yahoo Proxy] Fetching: ${endpoint}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Proxy error ${response.status}: ${text}`);
  }
  
  return response.json();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fetch quote data via proxy
 */
export async function fetchQuoteViaProxy(
  ticker: string
): Promise<ProxyQuoteResponse['quoteResponse']['result'][0] | null> {
  try {
    const data = await proxyFetch<ProxyQuoteResponse>(
      `/quote/${ticker.toUpperCase()}`
    );
    
    if (data.quoteResponse?.error) {
      console.log(`[Yahoo Proxy] Quote error: ${
        data.quoteResponse.error.description
      }`);
      return null;
    }
    
    return data.quoteResponse?.result?.[0] || null;
  } catch (error) {
    console.error(`[Yahoo Proxy] Quote fetch failed:`, error);
    return null;
  }
}

/**
 * Fetch chart/historical data via proxy
 */
export async function fetchChartViaProxy(
  ticker: string,
  range: string = '3mo',
  interval: string = '1d'
): Promise<{
  timestamps: number[];
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
} | null> {
  try {
    const data = await proxyFetch<ProxyChartResponse>(
      `/chart/${ticker.toUpperCase()}?range=${range}&interval=${interval}`
    );
    
    if (data.chart?.error) {
      console.log(`[Yahoo Proxy] Chart error: ${data.chart.error.description}`);
      return null;
    }
    
    const result = data.chart?.result?.[0];
    if (!result) return null;
    
    // Handle yahoo-finance2 format (quotes array with date objects)
    if (result.quotes && result.quotes.length > 0) {
      const validQuotes = result.quotes.filter(q => 
        q.close !== null && q.close !== undefined
      );
      return {
        timestamps: validQuotes.map(q => new Date(q.date).getTime() / 1000),
        closes: validQuotes.map(q => q.close),
        highs: validQuotes.map(q => q.high),
        lows: validQuotes.map(q => q.low),
        volumes: validQuotes.map(q => q.volume),
      };
    }
    
    // Handle raw Yahoo API format (indicators with arrays)
    if (result.indicators?.quote?.[0] && result.timestamp) {
      const quote = result.indicators.quote[0];
      return {
        timestamps: result.timestamp,
        closes: quote.close,
        highs: quote.high,
        lows: quote.low,
        volumes: quote.volume,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[Yahoo Proxy] Chart fetch failed:`, error);
    return null;
  }
}

/**
 * Fetch options chain via proxy
 */
export async function fetchOptionsViaProxy(
  ticker: string,
  expirationDate?: number
): Promise<ProxyOptionsResponse['optionChain']['result'][0] | null> {
  try {
    let endpoint = `/options/${ticker.toUpperCase()}`;
    if (expirationDate) {
      endpoint += `?date=${expirationDate}`;
    }
    
    const data = await proxyFetch<ProxyOptionsResponse>(endpoint);
    
    if (data.optionChain?.error) {
      console.log(`[Yahoo Proxy] Options error: ${
        data.optionChain.error.description
      }`);
      return null;
    }
    
    return data.optionChain?.result?.[0] || null;
  } catch (error) {
    console.error(`[Yahoo Proxy] Options fetch failed:`, error);
    return null;
  }
}

/**
 * Fetch detailed summary via proxy
 */
export async function fetchSummaryViaProxy(
  ticker: string,
  modules?: string[]
): Promise<ProxySummaryResponse['quoteSummary']['result'][0] | null> {
  try {
    let endpoint = `/summary/${ticker.toUpperCase()}`;
    if (modules && modules.length > 0) {
      endpoint += `?modules=${modules.join(',')}`;
    }
    
    const data = await proxyFetch<ProxySummaryResponse>(endpoint);
    
    if (data.quoteSummary?.error) {
      console.log(`[Yahoo Proxy] Summary error: ${
        data.quoteSummary.error.description
      }`);
      return null;
    }
    
    return data.quoteSummary?.result?.[0] || null;
  } catch (error) {
    console.error(`[Yahoo Proxy] Summary fetch failed:`, error);
    return null;
  }
}

/**
 * Parse date from various formats returned by yahoo-finance2
 */
function parseNewsDate(dateValue: number | string | Date | undefined): string {
  if (!dateValue) return new Date().toISOString();
  
  // Already a Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  
  // Unix timestamp (seconds)
  if (typeof dateValue === 'number') {
    // If it looks like milliseconds (> year 2100 in seconds), divide
    const ts = dateValue > 10000000000 ? dateValue : dateValue * 1000;
    const date = new Date(ts);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  
  // ISO string or other string format
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  
  return new Date().toISOString();
}

/**
 * Fetch news via proxy search
 */
export async function fetchNewsViaProxy(
  ticker: string,
  count: number = 5
): Promise<NewsItem[]> {
  try {
    const data = await proxyFetch<ProxySearchResponse>(
      `/search?q=${ticker.toUpperCase()}&newsCount=${count}`
    );
    
    if (!data.news || data.news.length === 0) {
      return [];
    }
    
    return data.news.map(n => ({
      title: n.title,
      url: n.link || n.url || '',
      source: n.publisher || 'Unknown',
      date: parseNewsDate(n.providerPublishTime),
    }));
  } catch (error) {
    console.error(`[Yahoo Proxy] News fetch failed:`, error);
    return [];
  }
}

/**
 * Check if proxy is healthy
 */
export async function checkProxyHealth(): Promise<boolean> {
  try {
    const baseUrl = getProxyUrl();
    if (!baseUrl) return false;
    
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// COMBINED ENDPOINT (5x more efficient - 1 request instead of 5)
// ============================================================================

/**
 * Clean, focused response from combined endpoint
 * No noise - only data useful for AI analysis
 * 
 * NOTE: Many fields can be null for companies with unavailable data
 * (e.g., peRatio is null for loss-making companies)
 */
interface CombinedTickerResponse {
  ticker: string;
  timestamp: string;
  elapsed_ms: number;
  
  // Essential quote data
  quote?: {
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
  };
  
  // Simplified chart data
  chart?: {
    dataPoints: number;
    quotes: Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  };
  
  // Earnings (extracted from summary)
  earnings?: {
    date: string;       // YYYY-MM-DD
    daysUntil: number;
  };
  
  // Analyst ratings (extracted from summary)
  analysts?: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    total: number;
    bullishPct: number;
  };
  
  // Short interest (extracted from summary)
  shortInterest?: {
    shortRatio: number;
    shortPctFloat: number;
  };
  
  // Options summary (not every contract)
  options?: {
    expirations: number;
    nearestExpiry: string;
    callCount: number;
    putCount: number;
    atmIV: number | null;      // ATM implied volatility %
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
    pcRatioVol: number | null; // Put/Call by volume
    pcRatioOI: number | null;  // Put/Call by OI
  };
  
  // Clean news (no thumbnails, uuids)
  news?: Array<{
    title: string;
    source: string;
    link: string;
    date: string;
  }>;
  
  errors?: string[];
}

/**
 * Fetch ALL ticker data in ONE request (5x more efficient)
 * 
 * This is the RECOMMENDED way to fetch data - uses 1 Cloudflare request
 * instead of 5 separate requests.
 */
export async function fetchAllViaProxy(
  ticker: string
): Promise<CombinedTickerResponse | null> {
  try {
    const data = await proxyFetch<CombinedTickerResponse>(
      `/ticker/${ticker.toUpperCase()}`
    );
    
    if (!data.quote) {
      console.log(`[Yahoo Proxy] No quote data in combined response`);
      return null;
    }
    
    console.log(`[Yahoo Proxy] Combined fetch: ${data.elapsed_ms}ms`);
    
    // Debug: dump what proxy returned
    console.log(`[Yahoo Proxy] Response keys:`, Object.keys(data));
    console.log(`[Yahoo Proxy] Quote fields:`, data.quote ? Object.keys(data.quote) : 'none');
    console.log(`[Yahoo Proxy] Quote sample:`, JSON.stringify({
      marketCap: data.quote?.marketCap,
      peRatio: data.quote?.peRatio,
      beta: data.quote?.beta,
      eps: data.quote?.eps,
    }));
    console.log(`[Yahoo Proxy] Analysts:`, data.analysts ? JSON.stringify(data.analysts) : 'null/undefined');
    console.log(`[Yahoo Proxy] Options:`, data.options ? 'present' : 'null/undefined');
    console.log(`[Yahoo Proxy] Errors:`, data.errors ? JSON.stringify(data.errors) : 'none');
    
    return data;
  } catch (error) {
    console.error(`[Yahoo Proxy] Combined fetch failed:`, error);
    return null;
  }
}

// ============================================================================
// FINANCIALS VIA PROXY
// ============================================================================

interface ProxyFinancialsResponse {
  ticker: string;
  currency: string;
  fiscalYear: string;
  income: {
    revenue: number;
    revenueGrowth: number | null;
    grossProfit: number;
    grossMargin: number;
    operatingIncome: number;
    operatingMargin: number;
    netIncome: number;
    netMargin: number;
    eps: number;
    epsGrowth: number | null;
  };
  balance: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    cash: number;
    totalDebt: number;
    debtToEquity: number;
    currentRatio: number;
  };
  cashFlow: {
    operatingCashFlow: number;
    capitalExpenditure: number;
    freeCashFlow: number;
    fcfYield: number | null;
    dividendsPaid: number | null;
  };
  valuationMetrics: {
    peRatio: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    priceToSales: number | null;
    evToEbitda: number | null;
  };
}

/**
 * Fetch deep financial data via proxy
 */
export async function fetchFinancialsViaProxy(
  ticker: string
): Promise<ProxyFinancialsResponse | null> {
  try {
    const data = await proxyFetch<ProxyFinancialsResponse>(
      `/financials/${ticker.toUpperCase()}`
    );
    return data;
  } catch (error) {
    console.error(`[Yahoo Proxy] Financials fetch failed:`, error);
    return null;
  }
}

// ============================================================================
// HOLDINGS VIA PROXY
// ============================================================================

interface ProxyHoldingsResponse {
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

/**
 * Fetch institutional holdings via proxy
 */
export async function fetchHoldingsViaProxy(
  ticker: string
): Promise<ProxyHoldingsResponse | null> {
  try {
    const data = await proxyFetch<ProxyHoldingsResponse>(
      `/holdings/${ticker.toUpperCase()}`
    );
    return data;
  } catch (error) {
    console.error(`[Yahoo Proxy] Holdings fetch failed:`, error);
    return null;
  }
}

