import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route: /api/positions/prices
 *
 * Fetches current stock prices for multiple symbols using the Cloudflare Yahoo proxy.
 * Used by the positions refresh functionality.
 */

const YAHOO_PROXY_URL =
  process.env.YAHOO_PROXY_URL || 'https://yahoo-proxy.conorquinlan.workers.dev';

interface QuoteData {
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
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
}

interface PriceResult {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  error?: string;
}

/**
 * Fetch quote for a single symbol via Cloudflare proxy
 */
async function fetchSymbolPrice(symbol: string): Promise<PriceResult> {
  try {
    const response = await fetch(`${YAHOO_PROXY_URL}/quote/${symbol}`, {
      headers: {
        Accept: 'application/json',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        symbol,
        price: 0,
        change: 0,
        changePct: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const data: QuoteData = await response.json();

    return {
      symbol,
      price: data.price,
      change: data.change,
      changePct: data.changePct,
    };
  } catch (error) {
    console.error(`[Prices] Error fetching ${symbol}:`, error);
    return {
      symbol,
      price: 0,
      change: 0,
      changePct: 0,
      error: String(error),
    };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json(
      { error: 'symbols parameter is required (comma-separated)' },
      { status: 400 }
    );
  }

  // Parse and dedupe symbols
  const symbols = [
    ...new Set(
      symbolsParam
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0 && s.length <= 10)
    ),
  ];

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'No valid symbols provided' },
      { status: 400 }
    );
  }

  // Limit to 20 symbols per request to avoid rate limiting
  if (symbols.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 symbols per request' },
      { status: 400 }
    );
  }

  try {
    // Fetch all prices in parallel
    const results = await Promise.all(
      symbols.map((symbol) => fetchSymbolPrice(symbol))
    );

    // Build response
    const prices: PriceResult[] = [];
    const errors: { symbol: string; error: string }[] = [];

    for (const result of results) {
      if (result.error) {
        errors.push({ symbol: result.symbol, error: result.error });
      }
      prices.push(result);
    }

    return NextResponse.json({
      prices,
      errors: errors.length > 0 ? errors : undefined,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Prices API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}
