import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// Simple in-memory cache
const cache = new Map<
  string,
  { data: OptionsData[]; timestamp: number }
>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute for options data

interface OptionsData {
  symbol: string;
  expiration: string;
  strike: number;
  type: "call" | "put";
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get("symbol") || "SPY";

  const cacheKey = `options-${symbol}`;
  const cached = cache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Import dynamically
    const { default: yahooFinance } = await import("yahoo-finance2");

    const data: OptionsData[] = [];

    // Fetch options data from Yahoo Finance
    const result = await yahooFinance.options(symbol, {});
    
    if (!result || !result.options || result.options.length === 0) {
      throw new Error("No options data available");
    }

    // Process each expiration date
    for (const optionChain of result.options) {
      // Handle different date formats from yahoo-finance2
      let expiration: string;
      const expDate = optionChain.expirationDate;
      
      if (expDate instanceof Date) {
        expiration = expDate.toISOString().split("T")[0];
      } else if (typeof expDate === "number") {
        // Check if seconds (< year 3000) or milliseconds
        const ts = expDate < 100000000000 ? expDate * 1000 : expDate;
        expiration = new Date(ts).toISOString().split("T")[0];
      } else {
        expiration = String(expDate).split("T")[0];
      }

      // Process calls
      if (optionChain.calls) {
        for (const call of optionChain.calls) {
          if (
            call.strike && 
            call.bid && 
            call.ask && 
            call.bid > 0
          ) {
            data.push({
              symbol,
              expiration,
              strike: call.strike,
              type: "call",
              lastPrice: call.lastPrice || 0,
              bid: call.bid,
              ask: call.ask,
              volume: call.volume || 0,
              openInterest: call.openInterest || 0,
              impliedVolatility: 
                call.impliedVolatility || 0,
            });
          }
        }
      }

      // Process puts
      if (optionChain.puts) {
        for (const put of optionChain.puts) {
          if (
            put.strike && 
            put.bid && 
            put.ask && 
            put.bid > 0
          ) {
            data.push({
              symbol,
              expiration,
              strike: put.strike,
              type: "put",
              lastPrice: put.lastPrice || 0,
              bid: put.bid,
              ask: put.ask,
              volume: put.volume || 0,
              openInterest: put.openInterest || 0,
              impliedVolatility: 
                put.impliedVolatility || 0,
            });
          }
        }
      }
    }

    // Cache the data
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching options chain:", error);
    return NextResponse.json(
      { error: "Failed to fetch options chain" },
      { status: 500 }
    );
  }
}

