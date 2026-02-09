import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/stock-prices
 * Fetches historical stock prices from Yahoo Finance (server-side)
 * Bypasses CORS restrictions by proxying the request
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1mo';
  const interval = searchParams.get('interval') || '1h';

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Yahoo Finance API endpoint
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?` +
      `period1=0&period2=9999999999&interval=${interval}&range=${range}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.chart?.result?.[0]) {
      return NextResponse.json(
        { error: 'Invalid ticker or no data available' },
        { status: 404 }
      );
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    // Transform to our format
    const priceData = timestamps.map((timestamp: number, index: number) => ({
      time: new Date(timestamp * 1000).toISOString(),
      price: quotes.close[index] || quotes.open[index] || 0,
      open: quotes.open[index] || 0,
      high: quotes.high[index] || 0,
      low: quotes.low[index] || 0,
      close: quotes.close[index] || 0,
      volume: quotes.volume[index] || 0,
    }));

    // Filter out null/invalid data points
    const validData = priceData.filter(
      (point: {
        price: number;
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }) => point.price > 0 && !isNaN(point.price)
    );

    return NextResponse.json(
      {
        ticker,
        range,
        interval,
        data: validData,
      },
      {
        headers: {
          // Cache for 2 minutes — stock prices are semi-real-time
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching stock prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch stock price data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
