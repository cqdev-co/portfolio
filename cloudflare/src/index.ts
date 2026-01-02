/**
 * Yahoo Finance Proxy Worker
 * 
 * Uses yahoo-finance2 library to fetch data through Cloudflare's IP pool,
 * bypassing rate limiting on blocked IPs.
 * 
 * RECOMMENDED:
 *   GET /ticker/:symbol    - All data in ONE request (5x more efficient)
 * 
 * Individual endpoints (for debugging):
 *   GET /quote/:ticker     - Stock quote
 *   GET /chart/:ticker     - Historical data  
 *   GET /options/:ticker   - Options chain
 *   GET /summary/:ticker   - Full quote summary
 *   GET /search            - Search/news
 *   GET /health            - Health check
 */

import yahooFinance from 'yahoo-finance2';

export interface Env {}

// CORS headers for browser requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handle stock quote request
 * GET /quote/:ticker
 */
async function handleQuote(ticker: string): Promise<Response> {
  try {
    console.log(`[Yahoo Proxy] Fetching quote for ${ticker}`);
    const quote = await yahooFinance.quote(ticker.toUpperCase());
    
    // Return in consistent format
    return jsonResponse({
      quoteResponse: {
        result: [quote],
        error: null,
      },
    });
  } catch (error) {
    console.error(`[Yahoo Proxy] Quote error:`, error);
    return jsonResponse({
      quoteResponse: {
        result: [],
        error: {
          code: 'Error',
          description: String(error),
        },
      },
    });
  }
}

/**
 * Handle historical chart data request
 * GET /chart/:ticker?range=1mo&interval=1d
 */
async function handleChart(
  ticker: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    const period1 = searchParams.get('period1');
    const period2 = searchParams.get('period2');
    const interval = (searchParams.get('interval') || '1d') as 
      '1d' | '1wk' | '1mo';
    
    let queryOptions: Parameters<typeof yahooFinance.chart>[1];
    
    if (period1) {
      // Use explicit period
      queryOptions = {
        period1: new Date(parseInt(period1) * 1000),
        period2: period2 
          ? new Date(parseInt(period2) * 1000) 
          : new Date(),
        interval,
      };
    } else {
      // Use range
      const range = searchParams.get('range') || '1mo';
      queryOptions = {
        period1: getStartDate(range),
        period2: new Date(),
        interval,
      };
    }
    
    console.log(`[Yahoo Proxy] Fetching chart for ${ticker}`);
    const chart = await yahooFinance.chart(ticker.toUpperCase(), queryOptions);
    
    return jsonResponse({
      chart: {
        result: [chart],
        error: null,
      },
    });
  } catch (error) {
    console.error(`[Yahoo Proxy] Chart error:`, error);
    return jsonResponse({
      chart: {
        result: [],
        error: {
          code: 'Error',
          description: String(error),
        },
      },
    });
  }
}

/**
 * Get start date from range string
 */
function getStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1d': return new Date(now.setDate(now.getDate() - 1));
    case '5d': return new Date(now.setDate(now.getDate() - 5));
    case '1mo': return new Date(now.setMonth(now.getMonth() - 1));
    case '3mo': return new Date(now.setMonth(now.getMonth() - 3));
    case '6mo': return new Date(now.setMonth(now.getMonth() - 6));
    case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
    case '2y': return new Date(now.setFullYear(now.getFullYear() - 2));
    case '5y': return new Date(now.setFullYear(now.getFullYear() - 5));
    default: return new Date(now.setMonth(now.getMonth() - 1));
  }
}

/**
 * Handle options chain request
 * GET /options/:ticker?date=EXPIRY_DATE
 */
async function handleOptions(
  ticker: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    const dateParam = searchParams.get('date');
    
    console.log(`[Yahoo Proxy] Fetching options for ${ticker}`);
    const options = await yahooFinance.options(
      ticker.toUpperCase(),
      dateParam ? { date: new Date(parseInt(dateParam) * 1000) } : undefined
    );
    
    return jsonResponse({
      optionChain: {
        result: [options],
        error: null,
      },
    });
  } catch (error) {
    console.error(`[Yahoo Proxy] Options error:`, error);
    return jsonResponse({
      optionChain: {
        result: [],
        error: {
          code: 'Error',
          description: String(error),
        },
      },
    });
  }
}

/**
 * Handle quote summary request (detailed data)
 * GET /summary/:ticker?modules=price,summaryDetail,...
 */
async function handleSummary(
  ticker: string,
  searchParams: URLSearchParams
): Promise<Response> {
  try {
    const modulesParam = searchParams.get('modules');
    const modules = modulesParam 
      ? modulesParam.split(',') as Parameters<
          typeof yahooFinance.quoteSummary
        >[1]['modules']
      : [
          'price',
          'summaryDetail',
          'summaryProfile',
          'financialData',
          'recommendationTrend',
          'earningsHistory',
          'earningsTrend',
          'defaultKeyStatistics',
          'calendarEvents',
          'incomeStatementHistory',
          'balanceSheetHistory',
          'cashflowStatementHistory',
          'institutionOwnership',
          'majorHoldersBreakdown',
        ];
    
    console.log(`[Yahoo Proxy] Fetching summary for ${ticker}`);
    const summary = await yahooFinance.quoteSummary(
      ticker.toUpperCase(),
      { modules }
    );
    
    return jsonResponse({
      quoteSummary: {
        result: [summary],
        error: null,
      },
    });
  } catch (error) {
    console.error(`[Yahoo Proxy] Summary error:`, error);
    return jsonResponse({
      quoteSummary: {
        result: [],
        error: {
          code: 'Error',
          description: String(error),
        },
      },
    });
  }
}

/**
 * Handle search request (for news, etc.)
 * GET /search?q=AAPL&newsCount=5
 */
async function handleSearch(
  searchParams: URLSearchParams
): Promise<Response> {
  const query = searchParams.get('q');
  const newsCount = parseInt(searchParams.get('newsCount') || '5');
  
  if (!query) {
    return jsonResponse({ error: 'Missing query parameter' }, 400);
  }
  
  try {
    console.log(`[Yahoo Proxy] Searching for ${query}`);
    const results = await yahooFinance.search(query, {
      newsCount,
      quotesCount: 5,
    });
    
    return jsonResponse(results);
  } catch (error) {
    console.error(`[Yahoo Proxy] Search error:`, error);
    return jsonResponse({
      error: 'Search failed',
      details: String(error),
    });
  }
}

/**
 * COMBINED ENDPOINT - Fetch all data in ONE request
 * GET /ticker/:symbol
 * 
 * This is 5x more efficient than calling individual endpoints.
 * Returns CLEAN, FOCUSED data for AI analysis - no noise.
 */
async function handleTicker(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();
  console.log(`[Yahoo Proxy] Fetching ALL data for ${symbol}`);
  
  const startTime = Date.now();
  
  // Fetch all data in parallel
  const [quoteResult, chartResult, summaryResult, optionsResult, searchResult] = 
    await Promise.allSettled([
      yahooFinance.quote(symbol),
      yahooFinance.chart(symbol, {
        period1: getStartDate('3mo'),
        period2: new Date(),
        interval: '1d',
      }),
      yahooFinance.quoteSummary(symbol, {
        modules: [
          'calendarEvents',
          'recommendationTrend', 
          'financialData',
          'defaultKeyStatistics',
        ],
      }),
      yahooFinance.options(symbol),
      yahooFinance.search(symbol, { newsCount: 5, quotesCount: 0 }),
    ]);
  
  const elapsed = Date.now() - startTime;
  console.log(`[Yahoo Proxy] Fetched ${symbol} in ${elapsed}ms`);
  
  const errors: string[] = [];
  
  // === PROCESS QUOTE (essential fields only) ===
  let quote: Record<string, unknown> | null = null;
  if (quoteResult.status === 'fulfilled' && quoteResult.value) {
    const q = quoteResult.value;
    quote = {
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      volume: q.regularMarketVolume,
      avgVolume: q.averageDailyVolume3Month,
      marketCap: q.marketCap,
      peRatio: q.trailingPE,
      forwardPE: q.forwardPE,
      eps: q.trailingEps,
      beta: q.beta,
      dividendYield: q.dividendYield,
      fiftyDayAverage: q.fiftyDayAverage,
      twoHundredDayAverage: q.twoHundredDayAverage,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    };
  } else {
    errors.push(`quote: ${quoteResult.status === 'rejected' ? quoteResult.reason : 'no data'}`);
  }
  
  // === PROCESS CHART (simplified OHLCV) ===
  let chart: Record<string, unknown> | null = null;
  if (chartResult.status === 'fulfilled' && chartResult.value?.quotes) {
    const quotes = chartResult.value.quotes;
    chart = {
      dataPoints: quotes.length,
      quotes: quotes.map((q: { 
        date: Date; 
        open: number; 
        high: number; 
        low: number; 
        close: number; 
        volume: number; 
      }) => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume,
      })),
    };
  } else {
    errors.push(`chart: ${chartResult.status === 'rejected' ? chartResult.reason : 'no data'}`);
  }
  
  // === PROCESS SUMMARY (extract key fields) ===
  let earnings: Record<string, unknown> | null = null;
  let analysts: Record<string, unknown> | null = null;
  let shortInterest: Record<string, unknown> | null = null;
  
  if (summaryResult.status === 'fulfilled' && summaryResult.value) {
    const s = summaryResult.value;
    
    // Earnings date
    const earningsDate = s.calendarEvents?.earnings?.earningsDate?.[0];
    if (earningsDate) {
      const date = earningsDate instanceof Date ? earningsDate : new Date(earningsDate);
      const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      earnings = {
        date: date.toISOString().split('T')[0],
        daysUntil,
      };
    }
    
    // Analyst ratings
    const trend = s.recommendationTrend?.trend?.[0];
    if (trend) {
      const total = (trend.strongBuy || 0) + (trend.buy || 0) + 
                    (trend.hold || 0) + (trend.sell || 0) + (trend.strongSell || 0);
      analysts = {
        strongBuy: trend.strongBuy || 0,
        buy: trend.buy || 0,
        hold: trend.hold || 0,
        sell: trend.sell || 0,
        strongSell: trend.strongSell || 0,
        total,
        bullishPct: total > 0 
          ? Math.round(((trend.strongBuy || 0) + (trend.buy || 0)) / total * 100) 
          : 0,
      };
    }
    
    // Short interest
    const ks = s.defaultKeyStatistics;
    if (ks?.shortRatio || ks?.shortPercentOfFloat) {
      shortInterest = {
        shortRatio: ks.shortRatio,
        shortPctFloat: ks.shortPercentOfFloat 
          ? Math.round(ks.shortPercentOfFloat * 10000) / 100 
          : undefined,
      };
    }
  } else {
    errors.push(`summary: ${summaryResult.status === 'rejected' ? summaryResult.reason : 'no data'}`);
  }
  
  // === PROCESS OPTIONS (summarized stats, not every contract) ===
  let options: Record<string, unknown> | null = null;
  if (optionsResult.status === 'fulfilled' && optionsResult.value?.options?.[0]) {
    const opts = optionsResult.value;
    const firstExp = opts.options[0];
    const calls = firstExp.calls || [];
    const puts = firstExp.puts || [];
    const underlyingPrice = opts.quote?.regularMarketPrice || quote?.price as number;
    
    // Calculate ATM IV (from calls within 5% of price)
    const atmCalls = calls.filter((c: { strike: number; impliedVolatility: number }) => 
      Math.abs(c.strike - underlyingPrice) / underlyingPrice < 0.05 &&
      c.impliedVolatility > 0.01
    );
    const avgIV = atmCalls.length > 0
      ? atmCalls.slice(0, 3).reduce((sum: number, c: { impliedVolatility: number }) => 
          sum + c.impliedVolatility, 0) / Math.min(3, atmCalls.length)
      : null;
    
    // Volume and OI totals
    const callVolume = calls.reduce((sum: number, c: { volume?: number }) => 
      sum + (c.volume || 0), 0);
    const putVolume = puts.reduce((sum: number, p: { volume?: number }) => 
      sum + (p.volume || 0), 0);
    const callOI = calls.reduce((sum: number, c: { openInterest?: number }) => 
      sum + (c.openInterest || 0), 0);
    const putOI = puts.reduce((sum: number, p: { openInterest?: number }) => 
      sum + (p.openInterest || 0), 0);
    
    options = {
      expirations: opts.expirationDates?.length || 0,
      nearestExpiry: firstExp.expirationDate,
      callCount: calls.length,
      putCount: puts.length,
      atmIV: avgIV ? Math.round(avgIV * 10000) / 100 : null,  // as percentage
      callVolume,
      putVolume,
      callOI,
      putOI,
      pcRatioVol: callVolume > 0 
        ? Math.round((putVolume / callVolume) * 100) / 100 
        : null,
      pcRatioOI: callOI > 0 
        ? Math.round((putOI / callOI) * 100) / 100 
        : null,
    };
  } else {
    errors.push(`options: ${optionsResult.status === 'rejected' ? optionsResult.reason : 'no data'}`);
  }
  
  // === PROCESS NEWS (clean, no thumbnails/uuids) ===
  let news: Array<Record<string, unknown>> = [];
  if (searchResult.status === 'fulfilled' && searchResult.value?.news) {
    news = searchResult.value.news.slice(0, 5).map((n: {
      title: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: Date | string;
    }) => ({
      title: n.title,
      source: n.publisher,
      link: n.link,
      date: n.providerPublishTime instanceof Date 
        ? n.providerPublishTime.toISOString()
        : n.providerPublishTime,
    }));
  } else {
    errors.push(`news: ${searchResult.status === 'rejected' ? searchResult.reason : 'no data'}`);
  }
  
  // === BUILD CLEAN RESPONSE ===
  const response: Record<string, unknown> = {
    ticker: symbol,
    timestamp: new Date().toISOString(),
    elapsed_ms: elapsed,
    quote,
    chart,
    earnings,
    analysts,
    shortInterest,
    options,
    news,
  };
  
  if (errors.length > 0) {
    response.errors = errors;
  }
  
  // Return error status if quote failed (critical data)
  if (!quote) {
    return jsonResponse(response, 500);
  }
  
  return jsonResponse(response);
}

/**
 * Main request handler
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    
    // Only allow GET requests
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams;
    
    try {
      // Health check
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'ok',
          service: 'yahoo-proxy',
          timestamp: new Date().toISOString(),
          endpoints: {
            recommended: 'GET /ticker/:symbol (all data, 1 request)',
            individual: [
              '/quote/:ticker',
              '/chart/:ticker',
              '/options/:ticker', 
              '/summary/:ticker',
              '/search?q=TICKER',
            ],
          },
        });
      }
      
      // COMBINED: /ticker/:symbol (RECOMMENDED - 5x more efficient)
      const tickerMatch = path.match(/^\/ticker\/([A-Z0-9.-]+)$/i);
      if (tickerMatch) {
        return handleTicker(tickerMatch[1]);
      }
      
      // Quote: /quote/:ticker (individual)
      const quoteMatch = path.match(/^\/quote\/([A-Z0-9.-]+)$/i);
      if (quoteMatch) {
        return handleQuote(quoteMatch[1]);
      }
      
      // Chart: /chart/:ticker
      const chartMatch = path.match(/^\/chart\/([A-Z0-9.-]+)$/i);
      if (chartMatch) {
        return handleChart(chartMatch[1], searchParams);
      }
      
      // Options: /options/:ticker
      const optionsMatch = path.match(/^\/options\/([A-Z0-9.-]+)$/i);
      if (optionsMatch) {
        return handleOptions(optionsMatch[1], searchParams);
      }
      
      // Summary: /summary/:ticker
      const summaryMatch = path.match(/^\/summary\/([A-Z0-9.-]+)$/i);
      if (summaryMatch) {
        return handleSummary(summaryMatch[1], searchParams);
      }
      
      // Search: /search?q=...
      if (path === '/search') {
        return handleSearch(searchParams);
      }
      
      // 404 for unknown routes
      return jsonResponse({
        error: 'Not found',
        recommended: 'GET /ticker/:symbol - All data in ONE request (5x efficient)',
        individual_endpoints: [
          'GET /quote/:ticker',
          'GET /chart/:ticker?range=1mo&interval=1d',
          'GET /options/:ticker?date=UNIX_TIMESTAMP',
          'GET /summary/:ticker?modules=price,summaryDetail,...',
          'GET /search?q=TICKER&newsCount=5',
          'GET /health',
        ],
      }, 404);
    } catch (error) {
      console.error('[Yahoo Proxy] Unexpected error:', error);
      return jsonResponse({
        error: 'Internal server error',
        details: String(error),
      }, 500);
    }
  },
};
