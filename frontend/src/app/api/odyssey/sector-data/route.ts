import { NextResponse } from 'next/server';

// Simple in-memory cache
const cache = new Map<string, { data: SectorData[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface SectorData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export async function GET() {
  const cacheKey = 'sector-data';
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Import dynamically
    const { default: yahooFinance } = await import('yahoo-finance2');

    // Sector ETF symbols
    const sectors = [
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

    const data: SectorData[] = [];

    // Fetch real data from Yahoo Finance
    const symbols = sectors.map((s) => s.symbol);
    const quotesResponse = await yahooFinance.quote(symbols);

    const quotesArray = (
      Array.isArray(quotesResponse) ? quotesResponse : [quotesResponse]
    ) as any[];

    for (let i = 0; i < quotesArray.length; i++) {
      const quote = quotesArray[i];
      const sector = sectors[i];

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

    // Cache the data
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching sector data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sector data' },
      { status: 500 }
    );
  }
}
