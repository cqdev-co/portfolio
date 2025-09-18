import { supabase } from '@/lib/supabase';
import type { VolatilitySqueezeSignal, SignalFilters } from '@/lib/types/signals';

export interface SignalQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: keyof VolatilitySqueezeSignal;
  sortOrder?: 'asc' | 'desc';
  filters?: SignalFilters;
  searchTerm?: string;
}

export interface SignalResponse {
  data: VolatilitySqueezeSignal[];
  count: number;
  error?: string;
}

export interface SignalStats {
  total_signals: number;
  actionable_signals: number;
  bullish_signals: number;
  bearish_signals: number;
  average_score: number;
  latest_scan_date: string;
}

/**
 * Fetch volatility squeeze signals from the database
 * Uses the signal_analysis view which includes computed fields
 */
export async function fetchVolatilitySignals(options: SignalQueryOptions = {}): Promise<SignalResponse> {
  try {
    const {
      limit = 100,
      offset = 0,
      sortBy = 'overall_score',
      sortOrder = 'desc',
      filters = {},
      searchTerm = ''
    } = options;

    // Start with the signal_analysis view for computed fields, fallback to main table
    const tableName = 'signal_analysis';
    let query = supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    // Apply search filter
    if (searchTerm) {
      query = query.ilike('symbol', `%${searchTerm}%`);
    }

    // Apply filters
    if (filters.recommendation?.length) {
      query = query.in('recommendation', filters.recommendation);
    }

    if (filters.squeeze_category?.length) {
      query = query.in('squeeze_category', filters.squeeze_category);
    }

    if (filters.signal_quality?.length) {
      query = query.in('signal_quality', filters.signal_quality);
    }

    if (filters.is_actionable !== undefined) {
      query = query.eq('is_actionable', filters.is_actionable);
    }

    if (filters.trend_direction?.length) {
      query = query.in('trend_direction', filters.trend_direction);
    }

    if (filters.min_score !== undefined) {
      query = query.gte('overall_score', filters.min_score);
    }

    if (filters.max_score !== undefined) {
      query = query.lte('overall_score', filters.max_score);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching signals from', tableName, ':', error);
      
      // If signal_analysis view failed, try the main table
      if (tableName === 'signal_analysis') {
        console.log('Retrying with main table...');
        try {
          let fallbackQuery = supabase
            .from('volatility_squeeze_signals')
            .select('*', { count: 'exact' });

          // Reapply all filters to fallback query
          if (searchTerm) {
            fallbackQuery = fallbackQuery.ilike('symbol', `%${searchTerm}%`);
          }
          if (filters.recommendation?.length) {
            fallbackQuery = fallbackQuery.in('recommendation', filters.recommendation);
          }
          if (filters.is_actionable !== undefined) {
            fallbackQuery = fallbackQuery.eq('is_actionable', filters.is_actionable);
          }
          if (filters.min_overall_score !== undefined) {
            fallbackQuery = fallbackQuery.gte('overall_score', filters.min_overall_score);
          }
          if (filters.max_overall_score !== undefined) {
            fallbackQuery = fallbackQuery.lte('overall_score', filters.max_overall_score);
          }

          fallbackQuery = fallbackQuery.order(sortBy, { ascending: sortOrder === 'asc' });
          fallbackQuery = fallbackQuery.range(offset, offset + limit - 1);

          const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery;
          
          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            return {
              data: [],
              count: 0,
              error: fallbackError.message
            };
          }

          return {
            data: fallbackData || [],
            count: fallbackCount || 0
          };
        } catch (fallbackErr) {
          console.error('Fallback query exception:', fallbackErr);
        }
      }
      
      return {
        data: [],
        count: 0,
        error: error.message
      };
    }

    return {
      data: data || [],
      count: count || 0
    };

  } catch (error) {
    console.error('Unexpected error fetching signals:', error);
    return {
      data: [],
      count: 0,
      error: 'Failed to fetch signals'
    };
  }
}

/**
 * Fetch latest signals from today's scan
 */
export async function fetchLatestSignals(limit: number = 50): Promise<SignalResponse> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error, count } = await supabase
      .from('signal_analysis')
      .select('*', { count: 'exact' })
      .eq('scan_date', today)
      .order('overall_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching latest signals:', error);
      return {
        data: [],
        count: 0,
        error: error.message
      };
    }

    return {
      data: data || [],
      count: count || 0
    };

  } catch (error) {
    console.error('Unexpected error fetching latest signals:', error);
    return {
      data: [],
      count: 0,
      error: 'Failed to fetch latest signals'
    };
  }
}

/**
 * Fetch signal statistics for dashboard
 */
export async function fetchSignalStats(): Promise<SignalStats | null> {
  try {
    // Get all signals to calculate stats (not just today's)
    const { data: signals, error: signalsError } = await supabase
      .from('signal_analysis')
      .select('is_actionable, trend_direction, overall_score, scan_date');

    if (signalsError) {
      console.error('Error fetching signal stats:', signalsError);
      // If the view doesn't exist, try the main table
      const { data: fallbackSignals, error: fallbackError } = await supabase
        .from('volatility_squeeze_signals')
        .select('is_actionable, trend_direction, overall_score, scan_date');
      
      if (fallbackError) {
        console.error('Error fetching fallback signal stats:', fallbackError);
        return null;
      }
      
      if (!fallbackSignals || fallbackSignals.length === 0) {
        return {
          total_signals: 0,
          actionable_signals: 0,
          bullish_signals: 0,

          bearish_signals: 0,
          average_score: 0,
          latest_scan_date: new Date().toISOString().split('T')[0]
        };
      }

      return {
        total_signals: fallbackSignals.length,
        actionable_signals: fallbackSignals.filter(s => s.is_actionable).length,
        bullish_signals: fallbackSignals.filter(s => s.trend_direction === 'bullish').length,
        bearish_signals: fallbackSignals.filter(s => s.trend_direction === 'bearish').length,
        average_score: 0,
        latest_scan_date: new Date().toISOString().split('T')[0]
      };
    }

    if (!signals || signals.length === 0) {
      return {
        total_signals: 0,
        actionable_signals: 0,
        bullish_signals: 0,
        bearish_signals: 0,
        average_score: 0,
        latest_scan_date: new Date().toISOString().split('T')[0]
      };
    }

    const stats: SignalStats = {
      total_signals: signals.length,
      actionable_signals: signals.filter(s => s.is_actionable).length,
      bullish_signals: signals.filter(s => s.trend_direction === 'bullish').length,
      bearish_signals: signals.filter(s => s.trend_direction === 'bearish').length,
      average_score: signals.reduce((sum, s) => sum + (parseFloat(s.overall_score?.toString() || '0') || 0), 0) / signals.length,
      latest_scan_date: signals[0]?.scan_date || new Date().toISOString().split('T')[0]
    };

    return stats;

  } catch (error) {
    console.error('Unexpected error fetching signal stats:', error);
    return null;
  }
}

/**
 * Fetch a single signal by ID
 */
export async function fetchSignalById(id: string): Promise<VolatilitySqueezeSignal | null> {
  try {
    const { data, error } = await supabase
      .from('signal_analysis')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching signal by ID:', error);
      return null;
    }

    return data;

  } catch (error) {
    console.error('Unexpected error fetching signal by ID:', error);
    return null;
  }
}

/**
 * Subscribe to real-time signal updates
 */
export function subscribeToSignalUpdates(
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown>; errors: string[] | null }) => void,
  filters?: { scan_date?: string }
) {
  const channel = supabase
    .channel('volatility_signals_changes')
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any, // Type assertion to avoid Supabase type conflicts
      {
        event: '*',
        schema: 'public',
        table: 'volatility_squeeze_signals',
        filter: filters?.scan_date ? `scan_date=eq.${filters.scan_date}` : undefined
      },
      callback
    );

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get unique values for filter options
 */
export async function fetchFilterOptions() {
  try {
    const { data, error } = await supabase
      .from('signal_analysis')
      .select('recommendation, squeeze_category, signal_quality, trend_direction')
      .not('recommendation', 'is', null)
      .not('trend_direction', 'is', null);

    if (error) {
      console.error('Error fetching filter options:', error);
      return {
        recommendations: [],
        squeeze_categories: [],
        signal_qualities: [],
        trend_directions: []
      };
    }

    const recommendations = [...new Set(data.map(d => d.recommendation).filter(Boolean))];
    const squeeze_categories = [...new Set(data.map(d => d.squeeze_category))];
    const signal_qualities = [...new Set(data.map(d => d.signal_quality))];
    const trend_directions = [...new Set(data.map(d => d.trend_direction).filter(Boolean))];

    return {
      recommendations,
      squeeze_categories,
      signal_qualities,
      trend_directions
    };

  } catch (error) {
    console.error('Unexpected error fetching filter options:', error);
    return {
      recommendations: [],
      squeeze_categories: [],
      signal_qualities: [],
      trend_directions: []
    };
  }
}
