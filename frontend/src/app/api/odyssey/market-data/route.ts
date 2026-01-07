import { NextResponse } from 'next/server';

// Simple in-memory cache
const cache = new Map<string, { data: MarketDataPoint[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  try {
    // Import dynamically to use v3 API
    const { default: yahooFinance } = await import('yahoo-finance2');

    // Fetch data for major indices
    const symbols = ['SPY', 'QQQ', 'DIA', 'IWM', '^VIX'];
    const data: MarketDataPoint[] = [];

    // Fetch all quotes in a single call for efficiency
    try {
      const quotesResponse = await yahooFinance.quote(symbols);

      const quotesArray = (
        Array.isArray(quotesResponse) ? quotesResponse : [quotesResponse]
      ) as any[];

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
    } catch (err) {
      console.error('Error fetching quotes:', err);
      // Fallback: try individual requests
      for (const symbol of symbols) {
        try {
          const quote = await yahooFinance.quote(symbol);

          if (quote) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const q = quote as any;
            const price = (q.regularMarketPrice as number) || 0;
            const previousClose =
              (q.regularMarketPreviousClose as number) || price;
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
          // Skip this symbol if fetch fails
        }
      }
    }

    // Cache the data
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching market data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
