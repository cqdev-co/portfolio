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

// ============================================================
// Signal Performance Tracking (Phase 2)
// ============================================================

export interface SignalData {
  ticker: string;
  signalDate: Date;
  signalScore: number;
  regime: string | null;
  regimeConfidence: number | null;
  sector: string | null;
  signals: string[];
  topSignals: string;
  price: number;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  spreadViable: boolean;
  spreadStrikes: string | null;
  spreadDebit: number | null;
  spreadCushion: number | null;
  spreadPop: number | null;
  spreadReturn: number | null;
  // Target tracking (for automatic outcome verification)
  upsidePotential: number | null;
  targetPrice: number | null;
}

/**
 * Save a signal to the cds_signals table (auto-capture)
 * Uses upsert to handle multiple scans per day
 */
export async function saveSignal(signal: SignalData): Promise<string | null> {
  try {
    const client = getClient();

    const { data, error } = await client.rpc('upsert_cds_signal', {
      p_ticker: signal.ticker,
      p_signal_date: signal.signalDate.toISOString().split('T')[0],
      p_signal_score: signal.signalScore,
      p_regime: signal.regime,
      p_regime_confidence: signal.regimeConfidence,
      p_signals: JSON.stringify(signal.signals),
      p_top_signals: signal.topSignals,
      p_price: signal.price,
      p_ma50: signal.ma50,
      p_ma200: signal.ma200,
      p_rsi: signal.rsi,
      p_spread_viable: signal.spreadViable,
      p_spread_strikes: signal.spreadStrikes,
      p_spread_debit: signal.spreadDebit,
      p_spread_cushion: signal.spreadCushion,
      p_spread_pop: signal.spreadPop,
      p_spread_return: signal.spreadReturn,
      p_sector: signal.sector,
      p_upside_potential: signal.upsidePotential,
      p_target_price: signal.targetPrice,
    });

    if (error) {
      logger.debug(`Failed to save signal ${signal.ticker}: ${error.message}`);
      return null;
    }

    return data as string;
  } catch (error) {
    logger.debug(`Signal save error: ${error}`);
    return null;
  }
}

/**
 * Batch save signals (auto-capture from scan-all)
 */
export async function saveSignals(
  signals: SignalData[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const signal of signals) {
    const result = await saveSignal(signal);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  if (success > 0) {
    logger.success(`Captured ${success} signals to database`);
  }

  return { success, failed };
}

export interface SignalOutcome {
  signalId: string;
  entryDate?: Date;
  entryPrice?: number;
  entryDebit?: number;
  entrySpread?: string;
  entryQuantity?: number;
  exitDate?: Date;
  exitPrice?: number;
  exitCredit?: number;
  exitReason?: 'target' | 'stop' | 'time' | 'earnings' | 'manual';
  notes?: string;
}

/**
 * Record a trade entry for a signal
 */
export async function recordEntry(
  ticker: string,
  signalDate: Date,
  entry: {
    entryDate: Date;
    entryPrice: number;
    entryDebit: number;
    entrySpread: string;
    entryQuantity?: number;
  }
): Promise<boolean> {
  try {
    const client = getClient();

    // First find the signal ID
    const { data: signal, error: findError } = await client
      .from('cds_signals')
      .select('id')
      .eq('ticker', ticker)
      .eq('signal_date', signalDate.toISOString().split('T')[0])
      .single();

    if (findError || !signal) {
      logger.error(`Signal not found for ${ticker} on ${signalDate}`);
      return false;
    }

    // Insert or update outcome
    const { error } = await client.from('cds_signal_outcomes').upsert(
      {
        signal_id: signal.id,
        entry_date: entry.entryDate.toISOString().split('T')[0],
        entry_price: entry.entryPrice,
        entry_debit: entry.entryDebit,
        entry_spread: entry.entrySpread,
        entry_quantity: entry.entryQuantity ?? 1,
      },
      { onConflict: 'signal_id' }
    );

    if (error) {
      logger.error(`Failed to record entry: ${error.message}`);
      return false;
    }

    logger.success(`Recorded entry for ${ticker}`);
    return true;
  } catch (error) {
    logger.error(`Entry recording error: ${error}`);
    return false;
  }
}

/**
 * Record a trade exit for a signal
 */
export async function recordExit(
  ticker: string,
  signalDate: Date,
  exit: {
    exitDate: Date;
    exitPrice: number;
    exitCredit: number;
    exitReason: 'target' | 'stop' | 'time' | 'earnings' | 'manual';
    notes?: string;
  }
): Promise<boolean> {
  try {
    const client = getClient();

    // Find the signal
    const { data: signal, error: findError } = await client
      .from('cds_signals')
      .select('id')
      .eq('ticker', ticker)
      .eq('signal_date', signalDate.toISOString().split('T')[0])
      .single();

    if (findError || !signal) {
      logger.error(`Signal not found for ${ticker} on ${signalDate}`);
      return false;
    }

    // Get the outcome to calculate P&L
    const { data: outcome, error: outcomeError } = await client
      .from('cds_signal_outcomes')
      .select('entry_debit, entry_quantity')
      .eq('signal_id', signal.id)
      .single();

    if (outcomeError || !outcome) {
      logger.error(`No entry found for ${ticker} - record entry first`);
      return false;
    }

    // Calculate P&L
    const entryDebit = outcome.entry_debit ?? 0;
    const quantity = outcome.entry_quantity ?? 1;
    const pnlDollars = (exit.exitCredit - entryDebit) * 100 * quantity;
    const pnlPercent =
      entryDebit > 0 ? ((exit.exitCredit - entryDebit) / entryDebit) * 100 : 0;

    // Find entry date for days held calculation
    const { data: entryData } = await client
      .from('cds_signal_outcomes')
      .select('entry_date')
      .eq('signal_id', signal.id)
      .single();

    const entryDate = entryData?.entry_date
      ? new Date(entryData.entry_date)
      : new Date();
    const daysHeld = Math.ceil(
      (exit.exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update with exit info
    const { error } = await client
      .from('cds_signal_outcomes')
      .update({
        exit_date: exit.exitDate.toISOString().split('T')[0],
        exit_price: exit.exitPrice,
        exit_credit: exit.exitCredit,
        exit_reason: exit.exitReason,
        pnl_dollars: pnlDollars,
        pnl_percent: pnlPercent,
        days_held: daysHeld,
        notes: exit.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('signal_id', signal.id);

    if (error) {
      logger.error(`Failed to record exit: ${error.message}`);
      return false;
    }

    const resultIcon = pnlDollars >= 0 ? '✅' : '❌';
    logger.success(
      `${resultIcon} Exit recorded: $${pnlDollars.toFixed(0)} ` +
        `(${pnlPercent.toFixed(1)}%) in ${daysHeld} days`
    );
    return true;
  } catch (error) {
    logger.error(`Exit recording error: ${error}`);
    return false;
  }
}

/**
 * Get recent signals for trade entry
 */
export async function getRecentSignals(days = 7): Promise<
  Array<{
    id: string;
    ticker: string;
    signalDate: string;
    score: number;
    grade: string;
    regime: string | null;
    spreadViable: boolean;
    spreadStrikes: string | null;
    hasOutcome: boolean;
  }>
> {
  try {
    const client = getClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await client
      .from('cds_signal_performance')
      .select('*')
      .gte('signal_date', cutoff.toISOString().split('T')[0])
      .order('signal_date', { ascending: false })
      .order('signal_score', { ascending: false });

    if (error) {
      logger.error(`Failed to fetch recent signals: ${error.message}`);
      return [];
    }

    return (data ?? []).map((d) => ({
      id: d.id,
      ticker: d.ticker,
      signalDate: d.signal_date,
      score: d.signal_score,
      grade: d.signal_grade,
      regime: d.regime,
      spreadViable: d.spread_viable,
      spreadStrikes: d.spread_strikes,
      hasOutcome: d.status !== 'no_trade',
    }));
  } catch (error) {
    logger.error(`Database error: ${error}`);
    return [];
  }
}

/**
 * Get performance statistics by grade
 */
export async function getPerformanceByGrade(): Promise<
  Array<{
    grade: string;
    totalSignals: number;
    tradesTaken: number;
    wins: number;
    losses: number;
    winRate: number | null;
    avgReturn: number | null;
    totalPnl: number;
  }>
> {
  try {
    const client = getClient();

    const { data, error } = await client.rpc('get_performance_by_grade');

    if (error) {
      // Fallback to manual query if RPC doesn't exist
      const { data: manualData, error: manualError } = await client
        .from('cds_signal_performance')
        .select('*')
        .eq('status', 'closed');

      if (manualError || !manualData) return [];

      // Group by grade manually
      const grades = new Map<
        string,
        { wins: number; losses: number; pnl: number; returns: number[] }
      >();

      for (const d of manualData) {
        const grade = d.signal_grade;
        if (!grades.has(grade)) {
          grades.set(grade, { wins: 0, losses: 0, pnl: 0, returns: [] });
        }
        const g = grades.get(grade)!;
        if (d.pnl_dollars > 0) g.wins++;
        else g.losses++;
        g.pnl += d.pnl_dollars ?? 0;
        if (d.pnl_percent) g.returns.push(d.pnl_percent);
      }

      return Array.from(grades.entries()).map(([grade, stats]) => ({
        grade,
        totalSignals: 0, // Would need separate query
        tradesTaken: stats.wins + stats.losses,
        wins: stats.wins,
        losses: stats.losses,
        winRate:
          stats.wins + stats.losses > 0
            ? (stats.wins / (stats.wins + stats.losses)) * 100
            : null,
        avgReturn:
          stats.returns.length > 0
            ? stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length
            : null,
        totalPnl: stats.pnl,
      }));
    }

    return data ?? [];
  } catch (error) {
    logger.error(`Performance query error: ${error}`);
    return [];
  }
}

/**
 * Get tickers from recent signals (for re-scanning)
 */
export async function getRecentSignalTickers(
  days = 7,
  minScore = 60
): Promise<string[]> {
  try {
    const client = getClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await client
      .from('cds_signals')
      .select('ticker')
      .gte('signal_date', cutoff.toISOString().split('T')[0])
      .gte('signal_score', minScore)
      .order('signal_score', { ascending: false });

    if (error) {
      logger.debug(`Failed to fetch signal tickers: ${error.message}`);
      return [];
    }

    // Unique tickers only
    const tickers = [...new Set((data ?? []).map((d) => d.ticker))];
    return tickers;
  } catch (error) {
    logger.debug(`Signal tickers error: ${error}`);
    return [];
  }
}

/**
 * Get top tickers from stock_opportunities table (existing scans)
 */
export async function getTopTickersFromDB(
  days = 30,
  minScore = 65,
  limit = 50
): Promise<string[]> {
  try {
    const client = getClient();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { data, error } = await client
      .from('stock_opportunities')
      .select('ticker, total_score')
      .gte('scan_date', cutoff.toISOString().split('T')[0])
      .gte('total_score', minScore)
      .order('total_score', { ascending: false })
      .limit(limit * 3); // Get more to account for duplicates

    if (error) {
      logger.debug(`Failed to fetch DB tickers: ${error.message}`);
      return [];
    }

    // Unique tickers, preserving order by score
    const seen = new Set<string>();
    const tickers: string[] = [];
    for (const d of data ?? []) {
      if (!seen.has(d.ticker)) {
        seen.add(d.ticker);
        tickers.push(d.ticker);
        if (tickers.length >= limit) break;
      }
    }

    return tickers;
  } catch (error) {
    logger.debug(`DB tickers error: ${error}`);
    return [];
  }
}

/**
 * Get tickers from master tickers table
 * Uses pagination to fetch ALL tickers (bypasses Supabase 1000 row limit)
 */
export async function getMasterTickers(
  options: {
    exchange?: string;
    sector?: string;
    country?: string;
    limit?: number; // 0 or undefined = no limit (fetch all)
    activeOnly?: boolean;
  } = {}
): Promise<{ tickers: string[]; count: number }> {
  try {
    const client = getClient();
    const { exchange, sector, country, limit = 0, activeOnly = true } = options;

    // First get the total count
    let countQuery = client
      .from('tickers')
      .select('symbol', { count: 'exact', head: true });

    if (activeOnly) {
      countQuery = countQuery.eq('is_active', true);
    }
    if (exchange) {
      countQuery = countQuery.eq('exchange', exchange.toUpperCase());
    }
    if (sector) {
      countQuery = countQuery.ilike('sector', `%${sector}%`);
    }
    if (country) {
      countQuery = countQuery.eq('country', country.toUpperCase());
    }

    const { count: totalCount } = await countQuery;
    const total = totalCount ?? 0;

    if (total === 0) {
      return { tickers: [], count: 0 };
    }

    // Fetch in batches of 1000 (Supabase limit)
    const batchSize = 1000;
    const maxToFetch = limit > 0 ? Math.min(limit, total) : total;
    const allTickers: string[] = [];

    for (let offset = 0; offset < maxToFetch; offset += batchSize) {
      let query = client.from('tickers').select('symbol');

      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      if (exchange) {
        query = query.eq('exchange', exchange.toUpperCase());
      }
      if (sector) {
        query = query.ilike('sector', `%${sector}%`);
      }
      if (country) {
        query = query.eq('country', country.toUpperCase());
      }

      const remaining = maxToFetch - offset;
      const fetchCount = Math.min(batchSize, remaining);

      query = query.order('symbol').range(offset, offset + fetchCount - 1);

      const { data, error } = await query;

      if (error) {
        logger.debug(`Failed to fetch tickers batch: ${error.message}`);
        break;
      }

      const tickers = (data ?? []).map((d) => d.symbol);
      allTickers.push(...tickers);

      if (tickers.length < batchSize) break; // No more data
    }

    return { tickers: allTickers, count: total };
  } catch (error) {
    logger.debug(`Master tickers error: ${error}`);
    return { tickers: [], count: 0 };
  }
}

/**
 * Get available exchanges from master tickers table
 */
export async function getAvailableExchanges(): Promise<string[]> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('tickers')
      .select('exchange')
      .not('exchange', 'is', null);

    if (error) {
      return [];
    }

    const exchanges = [
      ...new Set((data ?? []).map((d) => d.exchange).filter(Boolean)),
    ].sort();

    return exchanges as string[];
  } catch {
    return [];
  }
}

/**
 * Get available sectors from master tickers table
 */
export async function getAvailableSectors(): Promise<string[]> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('tickers')
      .select('sector')
      .not('sector', 'is', null);

    if (error) {
      return [];
    }

    const sectors = [
      ...new Set((data ?? []).map((d) => d.sector).filter(Boolean)),
    ].sort();

    return sectors as string[];
  } catch {
    return [];
  }
}

/**
 * Get performance statistics by regime
 */
export async function getPerformanceByRegime(): Promise<
  Array<{
    regime: string;
    tradesTaken: number;
    winRate: number | null;
    avgReturn: number | null;
    totalPnl: number;
  }>
> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('cds_signal_performance')
      .select('*')
      .eq('status', 'closed');

    if (error || !data) return [];

    // Group by regime
    const regimes = new Map<
      string,
      { wins: number; losses: number; pnl: number; returns: number[] }
    >();

    for (const d of data) {
      const regime = d.regime ?? 'unknown';
      if (!regimes.has(regime)) {
        regimes.set(regime, { wins: 0, losses: 0, pnl: 0, returns: [] });
      }
      const r = regimes.get(regime)!;
      if (d.pnl_dollars > 0) r.wins++;
      else r.losses++;
      r.pnl += d.pnl_dollars ?? 0;
      if (d.pnl_percent) r.returns.push(d.pnl_percent);
    }

    return Array.from(regimes.entries()).map(([regime, stats]) => ({
      regime,
      tradesTaken: stats.wins + stats.losses,
      winRate:
        stats.wins + stats.losses > 0
          ? (stats.wins / (stats.wins + stats.losses)) * 100
          : null,
      avgReturn:
        stats.returns.length > 0
          ? stats.returns.reduce((a, b) => a + b, 0) / stats.returns.length
          : null,
      totalPnl: stats.pnl,
    }));
  } catch (error) {
    logger.error(`Regime performance error: ${error}`);
    return [];
  }
}

// ============================================================
// Signal Outcome Tracking (for CI/CD automation)
// ============================================================

export interface PendingSignal {
  id: string;
  ticker: string;
  signalDate: string;
  signalScore: number;
  signalGrade: string;
  regime: string | null;
  priceAtSignal: number;
  targetPrice: number | null;
  upsidePotential: number | null;
  maxPriceSeen: number | null;
  maxGainPct: number | null;
}

/**
 * Get pending signals that need outcome checking
 * @param minAgeDays Minimum age of signal to check (default 7 days)
 * @param maxAgeDays Maximum age to consider (default 60 days)
 */
export async function getPendingSignals(
  minAgeDays = 7,
  maxAgeDays = 60
): Promise<PendingSignal[]> {
  try {
    const client = getClient();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - maxAgeDays);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() - minAgeDays);

    const { data, error } = await client
      .from('cds_signals')
      .select('*')
      .eq('outcome_status', 'pending')
      .gte('signal_date', minDate.toISOString().split('T')[0])
      .lte('signal_date', maxDate.toISOString().split('T')[0])
      .not('target_price', 'is', null)
      .order('signal_date', { ascending: true });

    if (error) {
      logger.debug(`Failed to fetch pending signals: ${error.message}`);
      return [];
    }

    return (data ?? []).map((d) => ({
      id: d.id,
      ticker: d.ticker,
      signalDate: d.signal_date,
      signalScore: d.signal_score,
      signalGrade: d.signal_grade,
      regime: d.regime,
      priceAtSignal: d.price_at_signal,
      targetPrice: d.target_price,
      upsidePotential: d.upside_potential,
      maxPriceSeen: d.max_price_seen,
      maxGainPct: d.max_gain_pct,
    }));
  } catch (error) {
    logger.debug(`Pending signals error: ${error}`);
    return [];
  }
}

/**
 * Update signal outcome status
 */
export async function updateSignalOutcome(
  signalId: string,
  outcome: {
    status: 'target_hit' | 'target_missed' | 'expired';
    outcomeDate: Date;
    outcomePrice: number;
    maxPriceSeen: number;
    maxGainPct: number;
  }
): Promise<boolean> {
  try {
    const client = getClient();

    // Try RPC first, fall back to direct update
    const { error: rpcError } = await client.rpc('update_signal_outcome', {
      p_signal_id: signalId,
      p_outcome_status: outcome.status,
      p_outcome_date: outcome.outcomeDate.toISOString().split('T')[0],
      p_outcome_price: outcome.outcomePrice,
      p_max_price_seen: outcome.maxPriceSeen,
      p_max_gain_pct: outcome.maxGainPct,
    });

    if (rpcError) {
      // Fallback to direct update
      const { error } = await client
        .from('cds_signals')
        .update({
          outcome_status: outcome.status,
          outcome_date: outcome.outcomeDate.toISOString().split('T')[0],
          outcome_price: outcome.outcomePrice,
          max_price_seen: outcome.maxPriceSeen,
          max_gain_pct: outcome.maxGainPct,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', signalId)
        .eq('outcome_status', 'pending');

      if (error) {
        logger.debug(`Failed to update outcome: ${error.message}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.debug(`Outcome update error: ${error}`);
    return false;
  }
}

/**
 * Get signal accuracy statistics by grade
 */
export async function getSignalAccuracy(): Promise<
  Array<{
    grade: string;
    regime: string | null;
    totalSignals: number;
    hits: number;
    misses: number;
    pending: number;
    accuracyPct: number | null;
    avgDaysToTarget: number | null;
    avgMaxGainPct: number | null;
  }>
> {
  try {
    const client = getClient();

    // Try the view first
    const { data: viewData, error: viewError } = await client
      .from('cds_signal_accuracy')
      .select('*');

    if (!viewError && viewData) {
      return viewData.map((d) => ({
        grade: d.signal_grade,
        regime: d.regime,
        totalSignals: d.total_signals,
        hits: d.hits,
        misses: d.misses,
        pending: d.pending,
        accuracyPct: d.accuracy_pct,
        avgDaysToTarget: d.avg_days_to_target,
        avgMaxGainPct: d.avg_max_gain_pct,
      }));
    }

    // Fallback: manual aggregation
    const { data, error } = await client
      .from('cds_signals')
      .select('*')
      .not('target_price', 'is', null);

    if (error || !data) return [];

    // Group by grade and regime
    const groups = new Map<
      string,
      {
        grade: string;
        regime: string | null;
        total: number;
        hits: number;
        misses: number;
        pending: number;
        daysToTarget: number[];
        maxGains: number[];
      }
    >();

    for (const d of data) {
      const key = `${d.signal_grade}-${d.regime ?? 'unknown'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          grade: d.signal_grade,
          regime: d.regime,
          total: 0,
          hits: 0,
          misses: 0,
          pending: 0,
          daysToTarget: [],
          maxGains: [],
        });
      }
      const g = groups.get(key)!;
      g.total++;
      if (d.outcome_status === 'target_hit') {
        g.hits++;
        if (d.days_to_outcome) g.daysToTarget.push(d.days_to_outcome);
      } else if (d.outcome_status === 'target_missed') {
        g.misses++;
      } else {
        g.pending++;
      }
      if (d.max_gain_pct) g.maxGains.push(d.max_gain_pct);
    }

    return Array.from(groups.values()).map((g) => ({
      grade: g.grade,
      regime: g.regime,
      totalSignals: g.total,
      hits: g.hits,
      misses: g.misses,
      pending: g.pending,
      accuracyPct:
        g.hits + g.misses > 0
          ? Math.round((g.hits / (g.hits + g.misses)) * 1000) / 10
          : null,
      avgDaysToTarget:
        g.daysToTarget.length > 0
          ? Math.round(
              (g.daysToTarget.reduce((a, b) => a + b, 0) /
                g.daysToTarget.length) *
                10
            ) / 10
          : null,
      avgMaxGainPct:
        g.maxGains.length > 0
          ? Math.round(
              (g.maxGains.reduce((a, b) => a + b, 0) / g.maxGains.length) * 1000
            ) / 10
          : null,
    }));
  } catch (error) {
    logger.debug(`Accuracy query error: ${error}`);
    return [];
  }
}
