/**
 * Ticker Handler
 * 
 * Main endpoint that fetches all data for a ticker
 */

import { CONFIG } from '../config';
import { jsonResponse } from '../utils/response';
import { getYahooAuth } from '../auth/crumb';
import { 
  fetchQuote, 
  fetchChart, 
  fetchSummary, 
  fetchOptions, 
  fetchNews 
} from '../fetchers';
import type { 
  QuoteData, 
  ChartData, 
  SummaryData, 
  OptionsData, 
  NewsItem 
} from '../types';

/**
 * Handle /ticker/:symbol endpoint
 * 
 * Fetches all available data for a ticker in parallel
 */
export async function handleTicker(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();
  console.log(`[Yahoo Proxy] Fetching ${symbol}`);
  
  const startTime = Date.now();
  const errors: string[] = [];
  
  // Get auth (cached)
  try {
    const auth = await getYahooAuth();
    
    // Initialize data holders
    let quote: QuoteData | null = null;
    let chart: ChartData | null = null;
    let summary: SummaryData = { 
      earnings: null, 
      analysts: null, 
      shortInterest: null,
      beta: null,
      eps: null,
    };
    let options: OptionsData | null = null;
    let news: NewsItem[] = [];
    
    // Fetch quote
    try {
      quote = await fetchQuote(symbol, auth);
    } catch (e) {
      errors.push(`quote: ${e}`);
    }
    
    // Fetch chart
    try {
      chart = await fetchChart(symbol);
    } catch (e) {
      errors.push(`chart: ${e}`);
    }
    
    // Fetch summary (earnings, analysts, short interest)
    try {
      summary = await fetchSummary(symbol, auth);
      // Supplement quote with beta/eps from summary if unavailable
      if (quote && (!quote.beta || quote.beta === 0) && summary.beta) {
        quote.beta = summary.beta;
      }
      if (quote && (!quote.eps || quote.eps === 0) && summary.eps) {
        quote.eps = summary.eps;
      }
    } catch (e) {
      errors.push(`summary: ${e}`);
    }
    
    // Fetch options
    try {
      options = await fetchOptions(symbol, auth, quote?.price);
    } catch (e) {
      errors.push(`options: ${e}`);
    }
    
    // Fetch news
    try {
      news = await fetchNews(symbol, auth);
    } catch (e) {
      errors.push(`news: ${e}`);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[Yahoo Proxy] Fetched ${symbol} in ${elapsed}ms`);
    
    // Build response matching lib/ai-agent CombinedTickerResponse
    const response: Record<string, unknown> = {
      ticker: symbol,
      timestamp: new Date().toISOString(),
      elapsed_ms: elapsed,
      quote,
      chart,
      earnings: summary.earnings,
      analysts: summary.analysts,
      shortInterest: summary.shortInterest,
      options,
      news,
    };
    
    if (errors.length > 0) {
      response.errors = errors;
    }
    
    if (!quote) {
      return jsonResponse(response, 500);
    }
    
    return jsonResponse(
      response, 
      200, 
      `public, max-age=${CONFIG.cache.quote}`
    );
  } catch (e) {
    return jsonResponse({
      ticker: symbol,
      timestamp: new Date().toISOString(),
      error: `Auth failed: ${e}`,
    }, 500);
  }
}

