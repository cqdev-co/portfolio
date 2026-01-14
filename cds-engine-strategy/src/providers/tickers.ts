import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.ts';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

let supabaseClient: SupabaseClient | null = null;

// File-based cache for S&P 500 list (persists across runs)
const SP500_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DIR = path.join(process.cwd(), '.cache');
const SP500_CACHE_FILE = path.join(CACHE_DIR, 'sp500-tickers.json');

interface SP500CacheData {
  tickers: string[];
  timestamp: number;
}

function loadSP500Cache(): SP500CacheData | null {
  try {
    if (fs.existsSync(SP500_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SP500_CACHE_FILE, 'utf-8'));
      if (data.tickers && data.timestamp) {
        return data as SP500CacheData;
      }
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function saveSP500Cache(tickers: string[]): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR);
    }
    const data: SP500CacheData = { tickers, timestamp: Date.now() };
    fs.writeFileSync(SP500_CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

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
      'Supabase not configured for ticker fetching. ' +
        'Set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
    );
    return [];
  }

  const PAGE_SIZE = 1000;
  const allTickers: string[] = [];
  let offset = 0;
  let hasMore = true;

  logger.info('Fetching tickers from database...');

  try {
    while (hasMore) {
      let query = client
        .from('tickers')
        .select('symbol, name, sector, market_cap')
        .eq('is_active', true)
        .order('symbol', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      // Apply filters
      if (options.tickerType) {
        query = query.eq('ticker_type', options.tickerType);
      }
      if (options.minMarketCap) {
        query = query.gte('market_cap', options.minMarketCap);
      }
      if (options.sector) {
        query = query.eq('sector', options.sector);
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
 * Fallback S&P 500 list (top 100 by weight) if fetch fails
 */
const SP500_FALLBACK: string[] = [
  'AAPL',
  'MSFT',
  'NVDA',
  'AMZN',
  'GOOGL',
  'META',
  'BRK.B',
  'TSLA',
  'AVGO',
  'JPM',
  'LLY',
  'V',
  'UNH',
  'XOM',
  'MA',
  'COST',
  'HD',
  'PG',
  'JNJ',
  'WMT',
  'NFLX',
  'CRM',
  'BAC',
  'ABBV',
  'ORCL',
  'CVX',
  'MRK',
  'KO',
  'AMD',
  'PEP',
  'TMO',
  'CSCO',
  'LIN',
  'ACN',
  'MCD',
  'ADBE',
  'WFC',
  'IBM',
  'PM',
  'ABT',
  'GE',
  'ISRG',
  'TXN',
  'NOW',
  'CAT',
  'QCOM',
  'GS',
  'VZ',
  'INTU',
  'MS',
  'AMGN',
  'BKNG',
  'DIS',
  'AXP',
  'PFE',
  'T',
  'SPGI',
  'BLK',
  'DHR',
  'NEE',
  'LOW',
  'HON',
  'UNP',
  'RTX',
  'CMCSA',
  'COP',
  'AMAT',
  'PLD',
  'BA',
  'SYK',
  'ELV',
  'DE',
  'SCHW',
  'TJX',
  'MDLZ',
  'BMY',
  'CB',
  'GILD',
  'ADI',
  'VRTX',
  'SO',
  'MMC',
  'LRCX',
  'MO',
  'ETN',
  'ADP',
  'CI',
  'SLB',
  'REGN',
  'ZTS',
  'BDX',
  'KLAC',
  'CME',
  'TMUS',
  'AON',
  'DUK',
  'ITW',
  'PYPL',
  'SNPS',
  'MU',
];

/**
 * Fetch S&P 500 list from Wikipedia (official source)
 * Scrapes the table from the List of S&P 500 companies page
 */
async function fetchSP500FromWikipedia(): Promise<string[]> {
  const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

  try {
    logger.info('Fetching S&P 500 list from Wikipedia...');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Wikipedia returned ${response.status}`);
    }

    const html: string = await response.text();
    const $ = cheerio.load(html);

    const tickers: string[] = [];

    // The first table on the page contains S&P 500 constituents
    // Column 0 is the symbol (with link)
    $('#constituents tbody tr').each((_, row) => {
      const symbolCell = $(row).find('td').first();
      const symbol = symbolCell.text().trim();

      if (symbol && symbol.length > 0 && symbol.length <= 5) {
        // Normalize: BRK.B format is used by Yahoo
        tickers.push(symbol.replace('.', '.'));
      }
    });

    if (tickers.length >= 400) {
      logger.success(
        `Fetched ${tickers.length} S&P 500 tickers from Wikipedia`
      );
      return tickers;
    }

    throw new Error(`Only found ${tickers.length} tickers (expected ~500)`);
  } catch (error) {
    logger.warn(`Failed to fetch from Wikipedia: ${error}`);
    return [];
  }
}

/**
 * Fetch S&P 500 tickers
 * 1. Try file-cached list (24h TTL)
 * 2. Fetch fresh from Wikipedia
 * 3. Fallback to hardcoded top 100
 */
export async function fetchSP500Tickers(options?: {
  limit?: number;
  forceRefresh?: boolean;
}): Promise<string[]> {
  const { limit, forceRefresh = false } = options || {};

  // Check file cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = loadSP500Cache();
    if (cached && Date.now() - cached.timestamp < SP500_CACHE_TTL) {
      const result = limit ? cached.tickers.slice(0, limit) : cached.tickers;
      logger.success(`Using cached S&P 500 list (${result.length} tickers)`);
      return result;
    }
  }

  // Try fetching from Wikipedia
  const fresh = await fetchSP500FromWikipedia();

  if (fresh.length >= 400) {
    // Save to file cache
    saveSP500Cache(fresh);
    const result = limit ? fresh.slice(0, limit) : fresh;
    return result;
  }

  // Fallback to hardcoded list
  logger.warn(`Using fallback S&P 500 list (${SP500_FALLBACK.length} tickers)`);
  const result = limit ? SP500_FALLBACK.slice(0, limit) : SP500_FALLBACK;
  return result;
}

/**
 * Fetch all stock tickers
 */
export async function fetchAllStockTickers(limit?: number): Promise<string[]> {
  return fetchTickersFromDB({
    tickerType: 'stock',
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
