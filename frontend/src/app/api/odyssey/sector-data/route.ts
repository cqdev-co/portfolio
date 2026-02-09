import { NextResponse } from 'next/server';
import { yahooFinance } from '@/lib/yahoo-finance';

// Simple in-memory cache
const cache = new Map<string, { data: SectorData[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PROXY_URL =
  process.env.YAHOO_PROXY_URL || 'https://yahoo-proxy.conorquinlan.workers.dev';

interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const SECTORS = [
  { symbol: 'XLK', name: 'Technology' },
  { symbol: 'XLF', name: 'Financials' },
  { symbol: 'XLE', name: 'Energy' },
  { symbol: 'XLV', name: 'Healthcare' },
  { symbol: 'XLY', name: 'Consumer Discretionary' },
  { symbol: 'XLP', name: 'Consumer Staples' },
  { symbol: 'XLI', name: 'Industrials' },
  { symbol: 'XLB', name: 'Materials' },
  { symbol: 'XLU', name: 'Utilities' },
  { symbol: 'XLRE', name: 'Real Estate' },
  { symbol: 'XLC', name: 'Communication Services' },
];

export async function GET() {
  const cacheKey = 'sector-data';
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  let data: SectorData[] = [];

  // Strategy 1: Try Cloudflare proxy (avoids local IP rate limits)
  try {
    data = await fetchViaProxy();
  } catch (err) {
    console.warn('[Sector Data] Proxy failed, trying direct:', err);
  }

  // Strategy 2: Fallback to direct Yahoo Finance
  if (data.length === 0) {
    try {
      data = await fetchDirect();
    } catch (err) {
      console.error('[Sector Data] Direct fetch also failed:', err);
    }
  }

  if (data.length === 0) {
    return NextResponse.json(
      { error: 'Failed to fetch sector data' },
      { status: 500 }
    );
  }

  // Cache the data
  cache.set(cacheKey, { data, timestamp: Date.now() });

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=120',
    },
  });
}

// =============================================================================
// Cloudflare Proxy fetch
// =============================================================================

async function fetchViaProxy(): Promise<SectorData[]> {
  const symbols = SECTORS.map((s) => s.symbol);
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
        { price: number; change: number; changePct: number } | null
      >;
    }
  ).quotes;
  if (!quotes) return [];

  const data: SectorData[] = [];
  for (const sector of SECTORS) {
    const quote = quotes[sector.symbol];
    if (quote && quote.price > 0) {
      data.push({
        symbol: sector.symbol,
        name: sector.name,
        price: Number(quote.price.toFixed(2)),
        change: Number(quote.change.toFixed(2)),
        changePercent: Number(quote.changePct.toFixed(2)),
      });
    }
  }

  return data;
}

// =============================================================================
// Direct Yahoo Finance fetch (fallback)
// =============================================================================

async function fetchDirect(): Promise<SectorData[]> {
  const symbols = SECTORS.map((s) => s.symbol);
  const data: SectorData[] = [];

  const quotesResponse = await yahooFinance.quote(symbols);
  const quotesArray = (
    Array.isArray(quotesResponse) ? quotesResponse : [quotesResponse]
  ) as Record<string, unknown>[];

  for (let i = 0; i < quotesArray.length; i++) {
    const quote = quotesArray[i];
    const sector = SECTORS[i];

    if (quote && sector) {
      const price = (quote.regularMarketPrice as number) || 0;
      const previousClose =
        (quote.regularMarketPreviousClose as number) || price;
      const change = price - previousClose;
      const changePercent =
        previousClose !== 0 ? (change / previousClose) * 100 : 0;

      data.push({
        symbol: sector.symbol,
        name: sector.name,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
      });
    }
  }

  return data;
}
