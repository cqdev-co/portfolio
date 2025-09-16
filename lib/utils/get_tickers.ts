/**
 * TypeScript/JavaScript Ticker Utility Functions
 * 
 * Frontend-compatible utility functions for retrieving ticker data.
 * Works with Next.js, React, and other JavaScript frameworks.
 */

import { createClient } from '@supabase/supabase-js';
import type { 
  Ticker, 
  TickerSearchParams, 
  TickerFilters,
  TickerQueryResult,
  GetTickersResponse,
  SearchTickersResponse 
} from '../types/ticker';

// Supabase client singleton
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !anonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }
    
    supabaseClient = createClient(url, anonKey);
  }
  
  return supabaseClient;
}

/**
 * Get all tickers from the database
 */
export async function getAllTickers(
  params: TickerSearchParams = {}
): Promise<TickerQueryResult> {
  try {
    const { active_only = true, limit, offset = 0 } = params;
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('tickers')
      .select('*', { count: 'exact' });
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (offset > 0) {
      query = query.range(offset, offset + (limit || 1000) - 1);
    }
    
    query = query.order('symbol');
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching tickers:', error);
      return { data: [], error: error.message };
    }
    
    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error in getAllTickers:', error);
    return { data: [], error: 'Failed to fetch tickers' };
  }
}

/**
 * Get a specific ticker by symbol
 */
export async function getTickerBySymbol(symbol: string): Promise<Ticker | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('tickers')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error fetching ticker:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getTickerBySymbol:', error);
    return null;
  }
}

/**
 * Get tickers by exchange
 */
export async function getTickersByExchange(
  exchange: string,
  params: TickerSearchParams = {}
): Promise<TickerQueryResult> {
  try {
    const { active_only = true, limit } = params;
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('tickers')
      .select('*', { count: 'exact' })
      .eq('exchange', exchange.toUpperCase());
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    query = query.order('symbol');
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching tickers by exchange:', error);
      return { data: [], error: error.message };
    }
    
    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error in getTickersByExchange:', error);
    return { data: [], error: 'Failed to fetch tickers by exchange' };
  }
}

/**
 * Get tickers by country
 */
export async function getTickersByCountry(
  country: string,
  params: TickerSearchParams = {}
): Promise<TickerQueryResult> {
  try {
    const { active_only = true, limit } = params;
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('tickers')
      .select('*', { count: 'exact' })
      .eq('country', country.toUpperCase());
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    query = query.order('symbol');
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching tickers by country:', error);
      return { data: [], error: error.message };
    }
    
    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error in getTickersByCountry:', error);
    return { data: [], error: 'Failed to fetch tickers by country' };
  }
}

/**
 * Get tickers by sector
 */
export async function getTickersBySector(
  sector: string,
  params: TickerSearchParams = {}
): Promise<TickerQueryResult> {
  try {
    const { active_only = true, limit } = params;
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('tickers')
      .select('*', { count: 'exact' })
      .ilike('sector', `%${sector}%`);
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    query = query.order('symbol');
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching tickers by sector:', error);
      return { data: [], error: error.message };
    }
    
    return { data: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error in getTickersBySector:', error);
    return { data: [], error: 'Failed to fetch tickers by sector' };
  }
}

/**
 * Search tickers by symbol or name
 */
export async function searchTickers(
  searchQuery: string,
  options: {
    search_fields?: string[];
    active_only?: boolean;
    limit?: number;
  } = {}
): Promise<SearchTickersResponse> {
  try {
    const { 
      search_fields = ['symbol', 'name'], 
      active_only = true, 
      limit = 50 
    } = options;
    
    const supabase = getSupabaseClient();
    
    // Build OR conditions for search fields
    const conditions = search_fields.map(field => 
      `${field}.ilike.%${searchQuery}%`
    ).join(',');
    
    let query = supabase
      .from('tickers')
      .select('*', { count: 'exact' })
      .or(conditions);
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    query = query.limit(limit).order('symbol');
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error searching tickers:', error);
      return { 
        results: [], 
        query: searchQuery, 
        total_matches: 0 
      };
    }
    
    return {
      results: data || [],
      query: searchQuery,
      total_matches: count || 0
    };
  } catch (error) {
    console.error('Error in searchTickers:', error);
    return { 
      results: [], 
      query: searchQuery, 
      total_matches: 0 
    };
  }
}

/**
 * Get ticker count
 */
export async function getTickerCount(active_only: boolean = true): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('tickers')
      .select('id', { count: 'exact', head: true });
    
    if (active_only) {
      query = query.eq('is_active', true);
    }
    
    const { count, error } = await query;
    
    if (error) {
      console.error('Error getting ticker count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error in getTickerCount:', error);
    return 0;
  }
}

/**
 * Get unique exchanges
 */
export async function getExchanges(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('tickers')
      .select('exchange')
      .not('exchange', 'is', null);
    
    if (error) {
      console.error('Error fetching exchanges:', error);
      return [];
    }
    
    const exchanges = [...new Set(
      data
        .map(item => item.exchange)
        .filter(Boolean)
    )].sort();
    
    return exchanges;
  } catch (error) {
    console.error('Error in getExchanges:', error);
    return [];
  }
}

/**
 * Get unique countries
 */
export async function getCountries(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('tickers')
      .select('country')
      .not('country', 'is', null);
    
    if (error) {
      console.error('Error fetching countries:', error);
      return [];
    }
    
    const countries = [...new Set(
      data
        .map(item => item.country)
        .filter(Boolean)
    )].sort();
    
    return countries;
  } catch (error) {
    console.error('Error in getCountries:', error);
    return [];
  }
}

/**
 * Get unique sectors
 */
export async function getSectors(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('tickers')
      .select('sector')
      .not('sector', 'is', null);
    
    if (error) {
      console.error('Error fetching sectors:', error);
      return [];
    }
    
    const sectors = [...new Set(
      data
        .map(item => item.sector)
        .filter(Boolean)
    )].sort();
    
    return sectors;
  } catch (error) {
    console.error('Error in getSectors:', error);
    return [];
  }
}

// Convenience functions
export async function getSP500Tickers(): Promise<Ticker[]> {
  const [nyse, nasdaq] = await Promise.all([
    getTickersByExchange('NYSE'),
    getTickersByExchange('NASDAQ')
  ]);
  
  return [...nyse.data, ...nasdaq.data];
}

export async function getTechTickers(limit: number = 100): Promise<Ticker[]> {
  const result = await getTickersBySector('Technology', { limit });
  return result.data;
}

/**
 * Get recently updated tickers
 */
export async function getRecentlyUpdatedTickers(hours: number = 24): Promise<Ticker[]> {
  try {
    const supabase = getSupabaseClient();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('tickers')
      .select('*')
      .gte('updated_at', cutoffTime)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching recently updated tickers:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getRecentlyUpdatedTickers:', error);
    return [];
  }
}

// React Hook for easy integration
export function useTickerData() {
  return {
    getAllTickers,
    getTickerBySymbol,
    getTickersByExchange,
    getTickersByCountry,
    getTickersBySector,
    searchTickers,
    getTickerCount,
    getExchanges,
    getCountries,
    getSectors,
    getSP500Tickers,
    getTechTickers,
    getRecentlyUpdatedTickers,
  };
}
