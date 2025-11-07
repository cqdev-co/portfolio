import { supabase } from '@/lib/supabase';
import type { UnusualOptionsSignal, UnusualOptionsFilters, UnusualOptionsStats } from '@/lib/types/unusual-options';
import { fromZonedTime } from 'date-fns-tz';

export interface SignalQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: keyof UnusualOptionsSignal;
  sortOrder?: 'asc' | 'desc';
  filters?: UnusualOptionsFilters;
  searchTerm?: string;
}

export interface SignalResponse {
  data: UnusualOptionsSignal[];
  count: number;
  error?: string;
}

/**
 * Fetch unusual options signals from the database
 */
export async function fetchUnusualOptionsSignals(options: SignalQueryOptions = {}): Promise<SignalResponse> {
  try {
    const {
      limit = 100,
      offset = 0,
      sortBy = 'premium_flow',
      sortOrder = 'desc',
      filters = {},
      searchTerm = ''
    } = options;

    let query = supabase
      .from('unusual_options_signals')
      .select('*', { count: 'exact' });

    // Apply search filter (ticker search)
    if (searchTerm) {
      query = query.ilike('ticker', `%${searchTerm}%`);
    }

    // Apply filters
    if (filters.ticker) {
      query = query.ilike('ticker', `%${filters.ticker}%`);
    }

    if (filters.option_type?.length) {
      query = query.in('option_type', filters.option_type);
    }

    if (filters.grade?.length) {
      query = query.in('grade', filters.grade);
    }

    if (filters.risk_level?.length) {
      query = query.in('risk_level', filters.risk_level);
    }

    if (filters.moneyness?.length) {
      query = query.in('moneyness', filters.moneyness);
    }

    if (filters.sentiment?.length) {
      query = query.in('sentiment', filters.sentiment);
    }

    if (filters.min_premium_flow !== undefined) {
      query = query.gte('premium_flow', filters.min_premium_flow);
    }

    if (filters.max_premium_flow !== undefined) {
      query = query.lte('premium_flow', filters.max_premium_flow);
    }

    if (filters.min_days_to_expiry !== undefined) {
      query = query.gte('days_to_expiry', filters.min_days_to_expiry);
    }

    if (filters.max_days_to_expiry !== undefined) {
      query = query.lte('days_to_expiry', filters.max_days_to_expiry);
    }

    if (filters.min_overall_score !== undefined) {
      query = query.gte('overall_score', filters.min_overall_score);
    }

    if (filters.max_overall_score !== undefined) {
      query = query.lte('overall_score', filters.max_overall_score);
    }

    if (filters.min_confidence !== undefined) {
      query = query.gte('confidence', filters.min_confidence);
    }

    if (filters.has_volume_anomaly !== undefined) {
      query = query.eq('has_volume_anomaly', filters.has_volume_anomaly);
    }

    if (filters.has_oi_spike !== undefined) {
      query = query.eq('has_oi_spike', filters.has_oi_spike);
    }

    if (filters.has_premium_flow !== undefined) {
      query = query.eq('has_premium_flow', filters.has_premium_flow);
    }

    if (filters.has_sweep !== undefined) {
      query = query.eq('has_sweep', filters.has_sweep);
    }

    if (filters.has_block_trade !== undefined) {
      query = query.eq('has_block_trade', filters.has_block_trade);
    }

    if (filters.detection_date) {
      // Filter for signals detected on the specified date IN EST TIMEZONE
      // This ensures "Today" means "Today in market time" (EST)
      // regardless of user's local timezone
      const US_EASTERN_TZ = 'America/New_York';
      
      // Parse the date string (e.g., "2025-11-07")
      const dateStr = filters.detection_date;
      
      // Create start and end of day in EST timezone
      // e.g., "2025-11-07" becomes:
      //   Start: 2025-11-07 00:00:00 EST → 2025-11-07 05:00:00 UTC (during EST)
      //   End:   2025-11-07 23:59:59 EST → 2025-11-08 04:59:59 UTC (during EST)
      const startOfDayEST = new Date(`${dateStr}T00:00:00`);
      const endOfDayEST = new Date(`${dateStr}T23:59:59`);
      
      // Convert EST date boundaries to UTC for database query
      const startOfDayUTC = fromZonedTime(startOfDayEST, US_EASTERN_TZ);
      const endOfDayUTC = fromZonedTime(endOfDayEST, US_EASTERN_TZ);
      
      query = query
        .gte('detection_timestamp', startOfDayUTC.toISOString())
        .lte('detection_timestamp', endOfDayUTC.toISOString());
    }

    // Continuity filters (NEW for cron job support)
    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    if (filters.is_new_signal !== undefined) {
      query = query.eq('is_new_signal', filters.is_new_signal);
    }

    if (filters.min_detection_count !== undefined) {
      query = query.gte('detection_count', filters.min_detection_count);
    }

    // Apply sorting (prefer last_detected_at for active signals)
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Fetch ALL results using pagination if limit exceeds Supabase's max (1000)
    let allData: UnusualOptionsSignal[] = [];
    let currentOffset = offset;
    const pageSize = 1000; // Supabase max page size
    
    if (limit > pageSize) {
      // Need to paginate
      let hasMore = true;
      let totalFetched = 0;
      
      while (hasMore && totalFetched < limit) {
        const fetchLimit = Math.min(pageSize, limit - totalFetched);
        const pageQuery = query.range(
          currentOffset, 
          currentOffset + fetchLimit - 1
        );
        
        const { data: pageData, error: pageError } = await pageQuery;
        
        if (pageError) {
          console.error('Error fetching page:', pageError);
          break;
        }
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
          break;
        }
        
        allData.push(...pageData);
        totalFetched += pageData.length;
        currentOffset += pageData.length;
        
        // If we got fewer results than requested, we've reached the end
        if (pageData.length < fetchLimit) {
          hasMore = false;
        }
      }
    } else {
      // Single page request
      query = query.range(offset, offset + limit - 1);
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching unusual options signals:', error);
        return {
          data: [],
          count: 0,
          error: error.message
        };
      }
      
      allData = data || [];
    }

    // Get total count (this is not affected by pagination)
    const { count } = await supabase
      .from('unusual_options_signals')
      .select('*', { count: 'exact', head: true });

    // Transform data to add id field for frontend compatibility
    const transformedData = allData.map(signal => ({
      ...signal,
      id: signal.signal_id // Add id field mapping to signal_id
    }));

    return {
      data: transformedData,
      count: count || 0
    };

  } catch (error) {
    console.error('Unexpected error fetching unusual options signals:', error);
    return {
      data: [],
      count: 0,
      error: 'Failed to fetch unusual options signals'
    };
  }
}

/**
 * Fetch latest signals from recent scans (last 7 days)
 * Now filters for active signals only by default
 */
export async function fetchLatestUnusualOptions(
  limit: number = 50, 
  activeOnly: boolean = true
): Promise<SignalResponse> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();
    
    let query = supabase
      .from('unusual_options_signals')
      .select('*', { count: 'exact' })
      .gte('detection_timestamp', dateStr);

    // Filter for active signals only (default)
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    query = query
      .order('last_detected_at', { ascending: false })
      .limit(limit);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching latest unusual options:', error);
      return {
        data: [],
        count: 0,
        error: error.message
      };
    }

    // Transform data to add id field for frontend compatibility
    const transformedData = (data || []).map(signal => ({
      ...signal,
      id: signal.signal_id
    }));

    return {
      data: transformedData,
      count: count || 0
    };

  } catch (error) {
    console.error('Unexpected error fetching latest unusual options:', error);
    return {
      data: [],
      count: 0,
      error: 'Failed to fetch latest unusual options'
    };
  }
}

/**
 * Fetch signal statistics for dashboard
 * Now filters for active signals only
 */
export async function fetchUnusualOptionsStats(activeOnly: boolean = true): Promise<UnusualOptionsStats | null> {
  try {
    // Get recent signals (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();

    let query = supabase
      .from('unusual_options_signals')
      .select('grade, option_type, risk_level, premium_flow, overall_score, detection_timestamp')
      .gte('detection_timestamp', dateStr);

    // Filter for active signals only (default)
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: signals, error } = await query;

    if (error) {
      console.error('Error fetching unusual options stats:', error);
      return null;
    }

    if (!signals || signals.length === 0) {
      return {
        total_signals: 0,
        by_grade: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
        by_type: { calls: 0, puts: 0 },
        by_risk: { LOW: 0, MEDIUM: 0, HIGH: 0, EXTREME: 0 },
        total_premium_flow: 0,
        average_score: 0,
        latest_detection_date: new Date().toISOString().split('T')[0],
        high_conviction_count: 0
      };
    }

    const by_grade = {
      S: signals.filter(s => s.grade === 'S').length,
      A: signals.filter(s => s.grade === 'A').length,
      B: signals.filter(s => s.grade === 'B').length,
      C: signals.filter(s => s.grade === 'C').length,
      D: signals.filter(s => s.grade === 'D').length,
      F: signals.filter(s => s.grade === 'F').length,
    };

    const by_type = {
      calls: signals.filter(s => s.option_type === 'call').length,
      puts: signals.filter(s => s.option_type === 'put').length,
    };

    const by_risk = {
      LOW: signals.filter(s => s.risk_level === 'LOW').length,
      MEDIUM: signals.filter(s => s.risk_level === 'MEDIUM').length,
      HIGH: signals.filter(s => s.risk_level === 'HIGH').length,
      EXTREME: signals.filter(s => s.risk_level === 'EXTREME').length,
    };

    const total_premium_flow = signals.reduce((sum, s) => {
      const premium = parseFloat(s.premium_flow?.toString() || '0') || 0;
      return sum + premium;
    }, 0);

    const average_score = signals.reduce((sum, s) => {
      const score = parseFloat(s.overall_score?.toString() || '0') || 0;
      return sum + score;
    }, 0) / signals.length;

    const latest_detection_date = signals[0]?.detection_timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];

    const high_conviction_count = by_grade.S + by_grade.A;

    return {
      total_signals: signals.length,
      by_grade,
      by_type,
      by_risk,
      total_premium_flow,
      average_score,
      latest_detection_date,
      high_conviction_count
    };

  } catch (error) {
    console.error('Unexpected error fetching unusual options stats:', error);
    return null;
  }
}

/**
 * Fetch a single signal by ID
 */
export async function fetchUnusualOptionById(id: string): Promise<UnusualOptionsSignal | null> {
  try {
    const { data, error } = await supabase
      .from('unusual_options_signals')
      .select('*')
      .eq('signal_id', id)
      .single();

    if (error) {
      console.error('Error fetching unusual option by ID:', error);
      return null;
    }

    // Transform data to add id field for frontend compatibility
    return data ? { ...data, id: data.signal_id } : null;

  } catch (error) {
    console.error('Unexpected error fetching unusual option by ID:', error);
    return null;
  }
}

/**
 * Subscribe to real-time signal updates
 */
export function subscribeToUnusualOptionsUpdates(
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown>; errors: string[] | null }) => void,
  filters?: { scan_date?: string }
) {
  const channel = supabase
    .channel('unusual_options_changes')
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'unusual_options_signals',
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
export async function fetchUnusualOptionsFilterOptions() {
  try {
    const { data, error } = await supabase
      .from('unusual_options_signals')
      .select('option_type, grade, risk_level, moneyness, sentiment')
      .not('grade', 'is', null);

    if (error) {
      console.error('Error fetching filter options:', error);
      return {
        option_types: ['call', 'put'],
        grades: ['S', 'A', 'B', 'C', 'D', 'F'],
        risk_levels: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'],
        moneyness: ['ITM', 'ATM', 'OTM'],
        sentiments: ['BULLISH', 'BEARISH', 'NEUTRAL']
      };
    }

    const option_types = [...new Set(data.map(d => d.option_type).filter(Boolean))];
    const grades = [...new Set(data.map(d => d.grade).filter(Boolean))];
    const risk_levels = [...new Set(data.map(d => d.risk_level).filter(Boolean))];
    const moneyness = [...new Set(data.map(d => d.moneyness).filter(Boolean))];
    const sentiments = [...new Set(data.map(d => d.sentiment).filter(Boolean))];

    return {
      option_types,
      grades,
      risk_levels,
      moneyness,
      sentiments
    };

  } catch (error) {
    console.error('Unexpected error fetching filter options:', error);
    return {
      option_types: ['call', 'put'],
      grades: ['S', 'A', 'B', 'C', 'D', 'F'],
      risk_levels: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'],
      moneyness: ['ITM', 'ATM', 'OTM'],
      sentiments: ['BULLISH', 'BEARISH', 'NEUTRAL']
    };
  }
}

