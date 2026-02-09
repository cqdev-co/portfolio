/**
 * PCS Supabase Storage
 *
 * Manages database interactions for PCS engine results.
 * Uses separate tables from CDS (pcs_signals, pcs_signal_outcomes).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.ts';
import type { PCSStockScore } from '../types/index.ts';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logger.warn(
      'Supabase not configured. Set SUPABASE_URL + SUPABASE_SERVICE_KEY'
    );
    return null;
  }

  client = createClient(url, key);
  return client;
}

/**
 * Save PCS signal data
 */
export async function savePCSSignal(score: PCSStockScore): Promise<void> {
  const db = getClient();
  if (!db) return;

  const { error } = await db.from('pcs_signals').upsert(
    {
      ticker: score.ticker,
      price: score.price,
      technical_score: score.technicalScore,
      fundamental_score: score.fundamentalScore,
      analyst_score: score.analystScore,
      iv_score: score.ivScore,
      total_score: score.totalScore,
      iv_rank: score.ivRank ?? null,
      upside_potential: score.upsidePotential,
      signals: score.signals,
      warnings: score.warnings,
      sector: score.sector ?? null,
      industry: score.industry ?? null,
      scan_date: score.scanDate.toISOString(),
    },
    { onConflict: 'ticker,scan_date' }
  );

  if (error) {
    logger.debug(
      `Failed to save PCS signal for ${score.ticker}: ${error.message}`
    );
  }
}

/**
 * Record PCS trade entry
 */
export async function recordPCSTradeEntry(params: {
  ticker: string;
  shortStrike: number;
  longStrike: number;
  expiration: string;
  entryCredit: number;
  contracts: number;
  entryDate: string;
  ivRank?: number;
  totalScore?: number;
}): Promise<string | null> {
  const db = getClient();
  if (!db) return null;

  const { data, error } = await db
    .from('pcs_signal_outcomes')
    .insert({
      ticker: params.ticker,
      short_strike: params.shortStrike,
      long_strike: params.longStrike,
      expiration: params.expiration,
      entry_credit: params.entryCredit,
      contracts: params.contracts,
      entry_date: params.entryDate,
      iv_rank_at_entry: params.ivRank ?? null,
      total_score_at_entry: params.totalScore ?? null,
      status: 'open',
    })
    .select('id')
    .single();

  if (error) {
    logger.error(`Failed to record PCS trade: ${error.message}`);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Record PCS trade exit
 */
export async function recordPCSTradeExit(params: {
  tradeId: string;
  exitDate: string;
  exitDebit: number;
  exitReason: string;
}): Promise<void> {
  const db = getClient();
  if (!db) return;

  const { error } = await db
    .from('pcs_signal_outcomes')
    .update({
      exit_date: params.exitDate,
      exit_debit: params.exitDebit,
      exit_reason: params.exitReason,
      status: 'closed',
    })
    .eq('id', params.tradeId);

  if (error) {
    logger.error(`Failed to record PCS exit: ${error.message}`);
  }
}

/**
 * Get PCS performance summary
 */
export async function getPCSPerformance(): Promise<{
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  avgReturn: number;
  totalPnL: number;
} | null> {
  const db = getClient();
  if (!db) return null;

  const { data, error } = await db
    .from('pcs_signal_outcomes')
    .select('*')
    .eq('status', 'closed');

  if (error || !data) return null;

  let winners = 0;
  let losers = 0;
  let totalPnL = 0;
  let totalReturn = 0;

  for (const trade of data) {
    const credit = trade.entry_credit ?? 0;
    const debit = trade.exit_debit ?? 0;
    const pnl = (credit - debit) * (trade.contracts ?? 1) * 100;

    totalPnL += pnl;
    if (pnl >= 0) winners++;
    else losers++;

    if (credit > 0) {
      totalReturn += (credit - debit) / credit;
    }
  }

  const totalTrades = data.length;

  return {
    totalTrades,
    winners,
    losers,
    winRate: totalTrades > 0 ? (winners / totalTrades) * 100 : 0,
    avgReturn: totalTrades > 0 ? (totalReturn / totalTrades) * 100 : 0,
    totalPnL,
  };
}

/**
 * Get recent PCS signals
 */
export async function getRecentPCSSignals(
  limit: number = 20
): Promise<PCSStockScore[]> {
  const db = getClient();
  if (!db) return [];

  const { data, error } = await db
    .from('pcs_signals')
    .select('*')
    .order('scan_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    ticker: row.ticker,
    name: row.ticker,
    price: row.price,
    technicalScore: row.technical_score,
    fundamentalScore: row.fundamental_score,
    analystScore: row.analyst_score,
    ivScore: row.iv_score ?? 0,
    totalScore: row.total_score,
    upsidePotential: row.upside_potential ?? 0,
    signals: row.signals ?? [],
    warnings: row.warnings ?? [],
    scanDate: new Date(row.scan_date),
    sector: row.sector,
    industry: row.industry,
    ivRank: row.iv_rank,
  }));
}
