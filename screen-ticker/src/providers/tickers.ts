import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger.ts";

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
function getClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = 
    process.env.SUPABASE_SERVICE_KEY ?? 
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

interface TickerRecord {
  symbol: string;
  name?: string;
  sector?: string;
  market_cap?: number;
}

/**
 * Fetch all tickers from Supabase with pagination
 */
export async function fetchTickersFromDB(
  options: {
    tickerType?: string;
    minMarketCap?: number;
    sector?: string;
    limit?: number;
  } = {}
): Promise<string[]> {
  const client = getClient();
  
  if (!client) {
    logger.warn(
      "Supabase not configured for ticker fetching. " +
      "Set SUPABASE_URL and SUPABASE_SERVICE_KEY."
    );
    return [];
  }

  const PAGE_SIZE = 1000;
  const allTickers: string[] = [];
  let offset = 0;
  let hasMore = true;

  logger.info("Fetching tickers from database...");

  try {
    while (hasMore) {
      let query = client
        .from("tickers")
        .select("symbol, name, sector, market_cap")
        .eq("is_active", true)
        .order("symbol", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      // Apply filters
      if (options.tickerType) {
        query = query.eq("ticker_type", options.tickerType);
      }
      if (options.minMarketCap) {
        query = query.gte("market_cap", options.minMarketCap);
      }
      if (options.sector) {
        query = query.eq("sector", options.sector);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`Failed to fetch tickers: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      const tickers = (data as TickerRecord[]).map((t) => t.symbol);
      allTickers.push(...tickers);
      
      logger.debug(
        `Fetched ${data.length} tickers (offset: ${offset}, ` +
        `total: ${allTickers.length})`
      );

      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;

      // Apply limit if specified
      if (options.limit && allTickers.length >= options.limit) {
        hasMore = false;
      }
    }

    // Apply limit
    const result = options.limit 
      ? allTickers.slice(0, options.limit) 
      : allTickers;

    logger.success(`Loaded ${result.length} tickers from database`);
    return result;

  } catch (error) {
    logger.error(`Database error fetching tickers: ${error}`);
    return [];
  }
}

/**
 * Fetch large-cap tickers (approximating S&P 500)
 * Falls back to all stocks if market_cap filter returns too few
 */
export async function fetchSP500Tickers(): Promise<string[]> {
  // First try with market cap filter
  const largeCap = await fetchTickersFromDB({
    tickerType: "stock",
    minMarketCap: 10_000_000_000, // $10B
  });

  // If we got a reasonable number, use that
  if (largeCap.length >= 100) {
    return largeCap;
  }

  // Otherwise fetch all stocks (market_cap might not be populated)
  logger.warn(
    `Only found ${largeCap.length} large-cap tickers. ` +
    `Fetching all stocks instead.`
  );
  return fetchTickersFromDB({
    tickerType: "stock",
  });
}

/**
 * Fetch all stock tickers
 */
export async function fetchAllStockTickers(
  limit?: number
): Promise<string[]> {
  return fetchTickersFromDB({
    tickerType: "stock",
    limit,
  });
}

/**
 * Check if Supabase is configured for ticker fetching
 */
export function isTickerDBConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = 
    process.env.SUPABASE_SERVICE_KEY ?? 
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  return !!(url && key);
}

