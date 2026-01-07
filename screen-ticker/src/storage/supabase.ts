import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StockScore, StockOpportunityRecord } from '../types/index.ts';
import { logger } from '../utils/logger.ts';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase URL from env (supports multiple variable names)
 */
function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Get Supabase service key from env (supports multiple variable names)
 */
function getSupabaseKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Get or create Supabase client
 */
function getClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ' +
        'and SUPABASE_SERVICE_KEY/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  supabaseClient = createClient(url, key);
  return supabaseClient;
}

/**
 * Convert StockScore to database record format
 */
function toRecord(score: StockScore): StockOpportunityRecord {
  return {
    ticker: score.ticker,
    price: score.price,
    technical_score: score.technicalScore,
    fundamental_score: score.fundamentalScore,
    analyst_score: score.analystScore,
    total_score: score.totalScore,
    upside_potential: score.upsidePotential,
    signals: score.signals,
    scan_date: score.scanDate.toISOString().split('T')[0] ?? '',
  };
}

/**
 * Upsert a single stock opportunity
 */
export async function upsertOpportunity(score: StockScore): Promise<boolean> {
  try {
    const client = getClient();
    const record = toRecord(score);

    const { error } = await client.from('stock_opportunities').upsert(record, {
      onConflict: 'ticker,scan_date',
    });

    if (error) {
      logger.error(`Failed to upsert ${score.ticker}: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`Database error for ${score.ticker}: ${error}`);
    return false;
  }
}

/**
 * Upsert multiple stock opportunities
 */
export async function upsertOpportunities(
  scores: StockScore[]
): Promise<{ success: number; failed: number }> {
  if (scores.length === 0) {
    return { success: 0, failed: 0 };
  }

  try {
    const client = getClient();
    const records = scores.map(toRecord);

    const { error, data } = await client
      .from('stock_opportunities')
      .upsert(records, {
        onConflict: 'ticker,scan_date',
      })
      .select();

    if (error) {
      logger.error(`Bulk upsert failed: ${error.message}`);
      return { success: 0, failed: scores.length };
    }

    const successCount = data?.length ?? 0;
    logger.success(`Stored ${successCount} opportunities in database`);

    return {
      success: successCount,
      failed: scores.length - successCount,
    };
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return { success: 0, failed: scores.length };
  }
}

/**
 * Get historical scores for a ticker (for trend analysis)
 */
export async function getTickerHistory(
  ticker: string,
  days = 30
): Promise<StockOpportunityRecord[]> {
  try {
    const client = getClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await client
      .from('stock_opportunities')
      .select('*')
      .eq('ticker', ticker)
      .gte('scan_date', cutoff.toISOString().split('T')[0])
      .order('scan_date', { ascending: false });

    if (error) {
      logger.error(`Failed to fetch history for ${ticker}: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return [];
  }
}

/**
 * Get score trends (stocks with improving scores)
 */
export async function getScoreTrends(
  minDelta = 10,
  days = 7
): Promise<
  Array<{
    ticker: string;
    currentScore: number;
    previousScore: number;
    delta: number;
  }>
> {
  try {
    const client = getClient();
    const today = new Date().toISOString().split('T')[0];
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - days);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    // Get today's scores
    const { data: todayData, error: todayError } = await client
      .from('stock_opportunities')
      .select('ticker, total_score')
      .eq('scan_date', today);

    if (todayError || !todayData) {
      return [];
    }

    // Get past scores
    const { data: pastData, error: pastError } = await client
      .from('stock_opportunities')
      .select('ticker, total_score')
      .eq('scan_date', pastDateStr);

    if (pastError) {
      return [];
    }

    // Calculate deltas
    const pastScores = new Map(
      (pastData ?? []).map((d) => [d.ticker, d.total_score])
    );

    const trends = todayData
      .map((current) => {
        const previous = pastScores.get(current.ticker);
        if (previous === undefined) return null;

        const delta = current.total_score - previous;
        return {
          ticker: current.ticker,
          currentScore: current.total_score,
          previousScore: previous,
          delta,
        };
      })
      .filter(
        (t): t is NonNullable<typeof t> => t !== null && t.delta >= minDelta
      )
      .sort((a, b) => b.delta - a.delta);

    return trends;
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return [];
  }
}

/**
 * Get top opportunities from today's scan
 */
export async function getTodayTopOpportunities(
  limit = 10
): Promise<StockOpportunityRecord[]> {
  try {
    const client = getClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await client
      .from('stock_opportunities')
      .select('*')
      .eq('scan_date', today)
      .order('total_score', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(`Failed to fetch top opportunities: ${error.message}`);
      return [];
    }

    return data ?? [];
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return [];
  }
}

/**
 * Check if Supabase is configured
 */
export function isConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseKey());
}
