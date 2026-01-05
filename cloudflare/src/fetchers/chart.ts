/**
 * Chart Fetcher
 * 
 * Fetches historical OHLCV data from Yahoo Finance
 * Note: Chart endpoint doesn't require auth
 */

import { CONFIG } from '../config';
import { getCacheKey, getFromCache, storeInCache } from '../utils/cache';
import { withRetry } from '../utils/retry';
import type { ChartData, YahooChartResponse } from '../types';

/**
 * Fetch historical chart data
 * 
 * @param ticker - Stock symbol
 * @param range - Time range (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
 * @param interval - Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
 */
export async function fetchChart(
  ticker: string,
  range: string = '3mo',
  interval: string = '1d'
): Promise<ChartData | null> {
  const cacheKey = getCacheKey('chart', `${ticker}-${range}-${interval}`);
  const cached = await getFromCache<ChartData>(cacheKey);
  
  if (cached) {
    console.log(`[Cache] HIT chart/${ticker} (age: ${cached.age}s)`);
    return cached.data;
  }
  
  const url = 
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${ticker.toUpperCase()}?range=${range}&interval=${interval}`;
  
  const response = await withRetry(
    async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': CONFIG.userAgent },
      });
      if (!res.ok) throw new Error(`Chart error: ${res.status}`);
      return res.json() as Promise<YahooChartResponse>;
    },
    `chart/${ticker}`
  );
  
  const chartData = response.chart?.result?.[0];
  if (!chartData) return null;
  
  const timestamps = chartData.timestamp || [];
  const quotes = chartData.indicators?.quote?.[0] || {};
  
  const result: ChartData = {
    dataPoints: timestamps.length,
    quotes: timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        open: quotes.open?.[i] ?? 0,
        high: quotes.high?.[i] ?? 0,
        low: quotes.low?.[i] ?? 0,
        close: quotes.close?.[i] ?? 0,
        volume: quotes.volume?.[i] ?? 0,
      }))
      .filter(q => q.close > 0), // Filter out null/zero entries
  };
  
  await storeInCache(cacheKey, result, CONFIG.cache.chart);
  return result;
}

