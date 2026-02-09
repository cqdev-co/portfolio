import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo-finance';

// Simple in-memory cache
const cache = new Map<string, { data: MarketDataPoint[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PROXY_URL =
  process.env.YAHOO_PROXY_URL || 'https://yahoo-proxy.conorquinlan.workers.dev';

interface MarketDataPoint {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export async function GET() {
  const cacheKey = 'market-data';
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const symbols = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX'];
  let data: MarketDataPoint[] = [];

  // Strategy 1: Try Cloudflare proxy (avoids local IP rate limits)
  try {
    data = await fetchViaProxy(symbols);
  } catch (err) {
    console.warn('[Market Data] Proxy failed, trying direct:', err);
  }

  // Strategy 2: Fallback to direct Yahoo Finance
  if (data.length === 0) {
    try {
      data = await fetchDirect(symbols);
    } catch (err) {
      console.error('[Market Data] Direct fetch also failed:', err);
    }
  }

  // Cache whatever we got (even empty — will retry after TTL)
  if (data.length > 0) {
    cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=180',
    },
  });
}

// =============================================================================
// Cloudflare Proxy fetch
// =============================================================================

async function fetchViaProxy(symbols: string[]): Promise<MarketDataPoint[]> {
  const res = await fetch(
    `${PROXY_URL}/batch-quotes?symbols=${symbols.join(',')}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) {
    throw new Error(`Proxy returned ${res.status}`);
  }

  const json = await res.json();
  const quotes = (
    json as {
      quotes?: Record<
        string,
        {
          price: number;
          change: number;
          changePct: number;
          volume: number;
        } | null
      >;
    }
  ).quotes;
  if (!quotes) return [];

  const data: MarketDataPoint[] = [];
  for (const symbol of symbols) {
    const key = symbol.replace('^', ''); // proxy may normalize ^VIX → VIX
    const quote = quotes[symbol] || quotes[key];
    if (quote && quote.price > 0) {
      data.push({
        symbol,
        price: Number(quote.price.toFixed(2)),
        change: Number(quote.change.toFixed(2)),
        changePercent: Number(quote.changePct.toFixed(2)),
        volume: quote.volume || 0,
      });
    }
  }

  return data;
}

// =============================================================================
// Direct Yahoo Finance fetch (fallback)
// =============================================================================

async function fetchDirect(symbols: string[]): Promise<MarketDataPoint[]> {
  const data: MarketDataPoint[] = [];

  // Try batch first
  try {
    const quotesResponse = await yahooFinance.quote(symbols);
    const quotesArray = (
      Array.isArray(quotesResponse) ? quotesResponse : [quotesResponse]
    ) as Record<string, unknown>[];

    for (const quote of quotesArray) {
      if (quote) {
        const price = (quote.regularMarketPrice as number) || 0;
        const previousClose =
          (quote.regularMarketPreviousClose as number) || price;
        const change = price - previousClose;
        const changePercent =
          previousClose !== 0 ? (change / previousClose) * 100 : 0;

        data.push({
          symbol: (quote.symbol as string) || '',
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: (quote.regularMarketVolume as number) || 0,
        });
      }
    }
    return data;
  } catch (err) {
    console.error('Error fetching quotes:', err);
  }

  // Fallback: try individual requests
  for (const symbol of symbols) {
    try {
      const quote = await yahooFinance.quote(symbol);
      if (quote) {
        const q = quote as Record<string, unknown>;
        const price = (q.regularMarketPrice as number) || 0;
        const previousClose = (q.regularMarketPreviousClose as number) || price;
        const change = price - previousClose;
        const changePercent =
          previousClose !== 0 ? (change / previousClose) * 100 : 0;

        data.push({
          symbol: (q.symbol as string) || symbol,
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: (q.regularMarketVolume as number) || 0,
        });
      }
    } catch (err) {
      console.error(`Error fetching data for ${symbol}:`, err);
    }
  }

  return data;
}
