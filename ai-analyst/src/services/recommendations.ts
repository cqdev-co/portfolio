/**
 * Recommendation Tracking Service
 *
 * Tracks Victor's recommendations and outcomes for accountability.
 * Enables confidence calibration based on historical accuracy.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { MarketRegime } from '../types/index.ts';

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
    );
  }

  supabase = createClient(url, key);
  return supabase;
}

function isConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  return !!(url && key);
}

// ============================================================================
// TYPES
// ============================================================================

export type RecommendationAction = 'BUY' | 'WAIT' | 'AVOID' | 'SELL' | 'HOLD';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type RecommendationStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'SUPERSEDED';

export interface Recommendation {
  id: string;
  ticker: string;
  action: RecommendationAction;
  confidence: ConfidenceLevel;
  confidenceFactors: string[];
  priceAtRecommendation: number;
  targetPrice?: number;
  stopPrice?: number;
  targetTimeframeDays: number;
  thesis: string;
  keyFactors: Record<string, unknown>;
  // Spread details
  spreadLongStrike?: number;
  spreadShortStrike?: number;
  spreadDebit?: number;
  spreadExpiration?: Date;
  // Market context
  marketRegime?: MarketRegime;
  vixAtRecommendation?: number;
  spyAtRecommendation?: number;
  // Outcome
  status: RecommendationStatus;
  outcomePrice?: number;
  outcomeReturnPct?: number;
  outcomeNotes?: string;
  outcomeDate?: Date;
  wasCorrect?: boolean;
  // Metadata
  conversationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfidenceStats {
  confidence: ConfidenceLevel;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  accuracyPct: number | null;
}

export interface TickerRecommendationHistory {
  ticker: string;
  totalRecommendations: number;
  buyCalls: number;
  passCalls: number;
  correct: number;
  incorrect: number;
  accuracyPct: number | null;
  lastRecommendation?: Date;
}

export interface CalibratedConfidence {
  confidence: ConfidenceLevel;
  sampleSize: number;
  accuracyPct: number | null;
  isReliable: boolean;
}

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

interface DBRecommendation {
  id: string;
  ticker: string;
  action: string;
  confidence: string;
  confidence_factors: string[];
  price_at_recommendation: number;
  target_price: number | null;
  stop_price: number | null;
  target_timeframe_days: number;
  thesis: string;
  key_factors: Record<string, unknown>;
  spread_long_strike: number | null;
  spread_short_strike: number | null;
  spread_debit: number | null;
  spread_expiration: string | null;
  market_regime: string | null;
  vix_at_recommendation: number | null;
  spy_at_recommendation: number | null;
  status: string;
  outcome_price: number | null;
  outcome_return_pct: number | null;
  outcome_notes: string | null;
  outcome_date: string | null;
  was_correct: boolean | null;
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

function dbToRecommendation(row: DBRecommendation): Recommendation {
  return {
    id: row.id,
    ticker: row.ticker,
    action: row.action as RecommendationAction,
    confidence: row.confidence as ConfidenceLevel,
    confidenceFactors: row.confidence_factors ?? [],
    priceAtRecommendation: row.price_at_recommendation,
    targetPrice: row.target_price ?? undefined,
    stopPrice: row.stop_price ?? undefined,
    targetTimeframeDays: row.target_timeframe_days,
    thesis: row.thesis,
    keyFactors: row.key_factors ?? {},
    spreadLongStrike: row.spread_long_strike ?? undefined,
    spreadShortStrike: row.spread_short_strike ?? undefined,
    spreadDebit: row.spread_debit ?? undefined,
    spreadExpiration: row.spread_expiration
      ? new Date(row.spread_expiration)
      : undefined,
    marketRegime: row.market_regime as MarketRegime | undefined,
    vixAtRecommendation: row.vix_at_recommendation ?? undefined,
    spyAtRecommendation: row.spy_at_recommendation ?? undefined,
    status: row.status as RecommendationStatus,
    outcomePrice: row.outcome_price ?? undefined,
    outcomeReturnPct: row.outcome_return_pct ?? undefined,
    outcomeNotes: row.outcome_notes ?? undefined,
    outcomeDate: row.outcome_date ? new Date(row.outcome_date) : undefined,
    wasCorrect: row.was_correct ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Save a new recommendation from Victor
 */
export async function saveRecommendation(rec: {
  ticker: string;
  action: RecommendationAction;
  confidence: ConfidenceLevel;
  confidenceFactors: string[];
  priceAtRecommendation: number;
  targetPrice?: number;
  stopPrice?: number;
  targetTimeframeDays?: number;
  thesis: string;
  keyFactors?: Record<string, unknown>;
  spreadLongStrike?: number;
  spreadShortStrike?: number;
  spreadDebit?: number;
  spreadExpiration?: Date;
  marketRegime?: MarketRegime;
  vixAtRecommendation?: number;
  spyAtRecommendation?: number;
  conversationId?: string;
}): Promise<Recommendation | null> {
  if (!isConfigured()) return null;

  try {
    const client = getClient();

    const dbRecord = {
      ticker: rec.ticker.toUpperCase(),
      action: rec.action,
      confidence: rec.confidence,
      confidence_factors: rec.confidenceFactors,
      price_at_recommendation: rec.priceAtRecommendation,
      target_price: rec.targetPrice ?? null,
      stop_price: rec.stopPrice ?? null,
      target_timeframe_days: rec.targetTimeframeDays ?? 45,
      thesis: rec.thesis,
      key_factors: rec.keyFactors ?? {},
      spread_long_strike: rec.spreadLongStrike ?? null,
      spread_short_strike: rec.spreadShortStrike ?? null,
      spread_debit: rec.spreadDebit ?? null,
      spread_expiration:
        rec.spreadExpiration?.toISOString().split('T')[0] ?? null,
      market_regime: rec.marketRegime ?? null,
      vix_at_recommendation: rec.vixAtRecommendation ?? null,
      spy_at_recommendation: rec.spyAtRecommendation ?? null,
      conversation_id: rec.conversationId ?? null,
    };

    const { data, error } = await client
      .from('analyst_recommendations')
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error('Error saving recommendation:', error);
      return null;
    }

    return dbToRecommendation(data as DBRecommendation);
  } catch (err) {
    console.error('Error saving recommendation:', err);
    return null;
  }
}

/**
 * Get recommendations for a ticker
 */
export async function getRecommendationsForTicker(
  ticker: string,
  limit: number = 10
): Promise<Recommendation[]> {
  if (!isConfigured()) return [];

  try {
    const client = getClient();

    const { data, error } = await client
      .from('analyst_recommendations')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('does not exist')
      ) {
        return [];
      }
      console.error('Error fetching recommendations:', error);
      return [];
    }

    return (data as DBRecommendation[]).map(dbToRecommendation);
  } catch {
    return [];
  }
}

/**
 * Get most recent recommendation for a ticker
 */
export async function getLatestRecommendation(
  ticker: string
): Promise<Recommendation | null> {
  const recs = await getRecommendationsForTicker(ticker, 1);
  return recs[0] ?? null;
}

/**
 * Get all pending recommendations (for outcome tracking)
 */
export async function getPendingRecommendations(): Promise<Recommendation[]> {
  if (!isConfigured()) return [];

  try {
    const client = getClient();

    const { data, error } = await client
      .from('analyst_recommendations')
      .select('*')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending recommendations:', error);
      return [];
    }

    return (data as DBRecommendation[]).map(dbToRecommendation);
  } catch {
    return [];
  }
}

/**
 * Update recommendation outcome
 */
export async function updateRecommendationOutcome(
  id: string,
  currentPrice: number,
  notes?: string
): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    const client = getClient();

    // Use the database function for consistent logic
    const { error } = await client.rpc('update_recommendation_outcome', {
      p_recommendation_id: id,
      p_current_price: currentPrice,
      p_notes: notes ?? null,
    });

    if (error) {
      console.error('Error updating recommendation outcome:', error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Manually set recommendation outcome (override)
 */
export async function setRecommendationOutcome(
  id: string,
  outcome: {
    status: RecommendationStatus;
    wasCorrect: boolean;
    outcomePrice?: number;
    outcomeReturnPct?: number;
    notes?: string;
  }
): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    const client = getClient();

    const { error } = await client
      .from('analyst_recommendations')
      .update({
        status: outcome.status,
        was_correct: outcome.wasCorrect,
        outcome_price: outcome.outcomePrice ?? null,
        outcome_return_pct: outcome.outcomeReturnPct ?? null,
        outcome_notes: outcome.notes ?? null,
        outcome_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', id);

    if (error) {
      console.error('Error setting outcome:', error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CONFIDENCE CALIBRATION
// ============================================================================

/**
 * Get Victor's accuracy stats by confidence level
 */
export async function getConfidenceStats(): Promise<ConfidenceStats[]> {
  if (!isConfigured()) return [];

  try {
    const client = getClient();

    const { data, error } = await client
      .from('analyst_confidence_stats')
      .select('*');

    if (error) {
      if (
        error.code === 'PGRST205' ||
        error.message?.includes('does not exist')
      ) {
        return [];
      }
      console.error('Error fetching confidence stats:', error);
      return [];
    }

    return data.map(
      (row: {
        confidence: string;
        total: number;
        correct: number;
        incorrect: number;
        pending: number;
        accuracy_pct: number | null;
      }) => ({
        confidence: row.confidence as ConfidenceLevel,
        total: row.total,
        correct: row.correct,
        incorrect: row.incorrect,
        pending: row.pending,
        accuracyPct: row.accuracy_pct,
      })
    );
  } catch {
    return [];
  }
}

/**
 * Get calibrated accuracy for a specific confidence level
 */
export async function getCalibratedAccuracy(
  confidence: ConfidenceLevel
): Promise<CalibratedConfidence | null> {
  if (!isConfigured()) return null;

  try {
    const client = getClient();

    const { data, error } = await client.rpc('get_calibrated_accuracy', {
      p_confidence: confidence,
    });

    if (error) {
      console.error('Error getting calibrated accuracy:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const row = data[0];
    return {
      confidence: row.confidence as ConfidenceLevel,
      sampleSize: row.sample_size,
      accuracyPct: row.accuracy_pct,
      isReliable: row.is_reliable,
    };
  } catch {
    return null;
  }
}

/**
 * Get ticker-specific recommendation history
 */
export async function getTickerRecommendationHistory(
  ticker: string
): Promise<TickerRecommendationHistory | null> {
  if (!isConfigured()) return null;

  try {
    const client = getClient();

    const { data, error } = await client
      .from('analyst_ticker_recommendations')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching ticker history:', error);
      return null;
    }

    return {
      ticker: data.ticker,
      totalRecommendations: data.total_recommendations,
      buyCalls: data.buy_calls,
      passCalls: data.pass_calls,
      correct: data.correct,
      incorrect: data.incorrect,
      accuracyPct: data.accuracy_pct,
      lastRecommendation: data.last_recommendation
        ? new Date(data.last_recommendation)
        : undefined,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// FORMATTING FOR AI CONTEXT
// ============================================================================

/**
 * Format confidence calibration for AI context
 * Compact format to save tokens
 */
export function formatConfidenceForAI(stats: ConfidenceStats[]): string {
  if (stats.length === 0) return 'No recommendation history yet.';

  const lines: string[] = ['MY TRACK RECORD:'];

  for (const s of stats) {
    const accuracy = s.accuracyPct !== null ? `${s.accuracyPct}%` : 'N/A';
    const sample = s.correct + s.incorrect;
    lines.push(
      `  ${s.confidence}: ${accuracy} accurate (${sample} settled, ` +
        `${s.pending} pending)`
    );
  }

  return lines.join('\n');
}

/**
 * Format ticker recommendation history for AI context
 */
export function formatTickerHistoryForAI(
  history: TickerRecommendationHistory | null,
  recentRecs: Recommendation[]
): string {
  if (!history && recentRecs.length === 0) {
    return 'No prior recommendations on this ticker.';
  }

  const lines: string[] = [];

  if (history) {
    const accuracy =
      history.accuracyPct !== null ? `${history.accuracyPct}%` : 'N/A';
    lines.push(
      `MY ${history.ticker} HISTORY: ` +
        `${history.totalRecommendations} recs, ` +
        `${history.buyCalls} BUY/${history.passCalls} PASS, ` +
        `${accuracy} accurate`
    );
  }

  if (recentRecs.length > 0) {
    lines.push('Recent calls:');
    for (const rec of recentRecs.slice(0, 3)) {
      const outcome =
        rec.wasCorrect === true ? '✓' : rec.wasCorrect === false ? '✗' : '⏳';
      const date = rec.createdAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      lines.push(
        `  ${outcome} ${rec.action} @ $${rec.priceAtRecommendation.toFixed(0)} ` +
          `(${rec.confidence}) - ${date}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Build confidence recommendation string
 * Used when Victor states his confidence
 */
export function buildConfidenceStatement(
  confidence: ConfidenceLevel,
  calibration: CalibratedConfidence | null
): string {
  if (!calibration || !calibration.isReliable) {
    return `${confidence} confidence`;
  }

  const accuracy = calibration.accuracyPct ?? 50;

  if (confidence === 'HIGH' && accuracy >= 75) {
    return `${confidence} confidence (historically ${accuracy}% accurate)`;
  } else if (confidence === 'HIGH' && accuracy < 75) {
    return (
      `${confidence} confidence (though my HIGH calls are ` +
      `only ${accuracy}% accurate - take with grain of salt)`
    );
  } else if (confidence === 'LOW') {
    return (
      `${confidence} confidence (my LOW conviction calls are ` +
      `${accuracy}% accurate - barely better than coin flip)`
    );
  }

  return `${confidence} confidence (${accuracy}% historical accuracy)`;
}
