/**
 * Supabase Service
 * Database operations for trades, observations, and performance
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { 
  Trade, 
  TradeType, 
  TradeDirection, 
  TradeStatus, 
  TradeOutcome,
  CloseReason,
  MarketRegime 
} from "../types/index.ts";

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL ?? 
              process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? 
              process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY"
    );
  }

  supabase = createClient(url, key);
  return supabase;
}

export function isConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? 
              process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? 
              process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  return !!(url && key);
}

// ============================================================================
// TRADE OPERATIONS
// ============================================================================

interface DBTrade {
  id: string;
  ticker: string;
  trade_type: string;
  direction: string;
  long_strike: number;
  short_strike: number;
  expiration: string;
  quantity: number;
  open_date: string;
  close_date: string | null;
  days_held: number | null;
  open_premium: number;
  close_premium: number | null;
  max_profit: number | null;
  max_loss: number | null;
  realized_pnl: number | null;
  return_pct: number | null;
  status: string;
  outcome: string | null;
  close_reason: string | null;
  thesis: string | null;
  lessons_learned: string | null;
  entry_score: number | null;
  entry_rsi: number | null;
  market_regime: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function dbToTrade(row: DBTrade): Trade {
  return {
    id: row.id,
    ticker: row.ticker,
    tradeType: row.trade_type as TradeType,
    direction: row.direction as TradeDirection,
    longStrike: row.long_strike,
    shortStrike: row.short_strike,
    expiration: new Date(row.expiration),
    quantity: row.quantity,
    openDate: new Date(row.open_date),
    closeDate: row.close_date ? new Date(row.close_date) : undefined,
    daysHeld: row.days_held ?? undefined,
    openPremium: row.open_premium,
    closePremium: row.close_premium ?? undefined,
    maxProfit: row.max_profit ?? undefined,
    maxLoss: row.max_loss ?? undefined,
    realizedPnl: row.realized_pnl ?? undefined,
    returnPct: row.return_pct ?? undefined,
    status: row.status as TradeStatus,
    outcome: row.outcome as TradeOutcome | undefined,
    closeReason: row.close_reason as CloseReason | undefined,
    thesis: row.thesis ?? undefined,
    lessonsLearned: row.lessons_learned ?? undefined,
    entryScore: row.entry_score ?? undefined,
    entryRsi: row.entry_rsi ?? undefined,
    marketRegime: row.market_regime as MarketRegime | undefined,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get all trades for a specific ticker
 */
export async function getTradesByTicker(ticker: string): Promise<Trade[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("analyst_trades")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .order("open_date", { ascending: false });

    if (error) {
      // Silently return empty if table doesn't exist
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching trades:", error);
      return [];
    }

    return (data as DBTrade[]).map(dbToTrade);
  } catch {
    return [];
  }
}

/**
 * Get all trades
 */
export async function getAllTrades(): Promise<Trade[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("analyst_trades")
      .select("*")
      .order("open_date", { ascending: false });

    if (error) {
      // Silently return empty if table doesn't exist
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching trades:", error);
      return [];
    }

    return (data as DBTrade[]).map(dbToTrade);
  } catch {
    return [];
  }
}

/**
 * Get recent trades (last N)
 */
export async function getRecentTrades(limit: number = 10): Promise<Trade[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("analyst_trades")
      .select("*")
      .order("open_date", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching recent trades:", error);
      return [];
    }

    return (data as DBTrade[]).map(dbToTrade);
  } catch {
    return [];
  }
}

/**
 * Insert a new trade
 */
export async function insertTrade(trade: Omit<Trade, "id" | "createdAt" | "updatedAt" | "daysHeld">): Promise<Trade | null> {
  const client = getClient();

  const dbRecord = {
    ticker: trade.ticker.toUpperCase(),
    trade_type: trade.tradeType,
    direction: trade.direction,
    long_strike: trade.longStrike,
    short_strike: trade.shortStrike,
    expiration: trade.expiration.toISOString().split("T")[0],
    quantity: trade.quantity,
    open_date: trade.openDate.toISOString().split("T")[0],
    close_date: trade.closeDate?.toISOString().split("T")[0] ?? null,
    open_premium: trade.openPremium,
    close_premium: trade.closePremium ?? null,
    max_profit: trade.maxProfit ?? null,
    max_loss: trade.maxLoss ?? null,
    realized_pnl: trade.realizedPnl ?? null,
    return_pct: trade.returnPct ?? null,
    status: trade.status,
    outcome: trade.outcome ?? null,
    close_reason: trade.closeReason ?? null,
    thesis: trade.thesis ?? null,
    lessons_learned: trade.lessonsLearned ?? null,
    entry_score: trade.entryScore ?? null,
    entry_rsi: trade.entryRsi ?? null,
    market_regime: trade.marketRegime ?? null,
    tags: trade.tags ?? [],
  };

  const { data, error } = await client
    .from("analyst_trades")
    .insert(dbRecord)
    .select()
    .single();

  if (error) {
    console.error("Error inserting trade:", error);
    return null;
  }

  return dbToTrade(data as DBTrade);
}

/**
 * Update an existing trade
 */
export async function updateTrade(
  id: string, 
  updates: Partial<Trade>
): Promise<Trade | null> {
  const client = getClient();

  const dbUpdates: Record<string, unknown> = {};
  
  if (updates.closeDate) {
    dbUpdates.close_date = updates.closeDate.toISOString().split("T")[0];
  }
  if (updates.closePremium !== undefined) {
    dbUpdates.close_premium = updates.closePremium;
  }
  if (updates.realizedPnl !== undefined) {
    dbUpdates.realized_pnl = updates.realizedPnl;
  }
  if (updates.returnPct !== undefined) {
    dbUpdates.return_pct = updates.returnPct;
  }
  if (updates.status) {
    dbUpdates.status = updates.status;
  }
  if (updates.outcome) {
    dbUpdates.outcome = updates.outcome;
  }
  if (updates.closeReason) {
    dbUpdates.close_reason = updates.closeReason;
  }
  if (updates.lessonsLearned) {
    dbUpdates.lessons_learned = updates.lessonsLearned;
  }

  const { data, error } = await client
    .from("analyst_trades")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating trade:", error);
    return null;
  }

  return dbToTrade(data as DBTrade);
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface TickerStats {
  ticker: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgDaysHeld: number;
}

/**
 * Get statistics for a specific ticker
 */
export async function getTickerStats(ticker: string): Promise<TickerStats | null> {
  const trades = await getTradesByTicker(ticker);
  
  if (trades.length === 0) return null;

  const closedTrades = trades.filter(t => t.status !== "open");
  const wins = closedTrades.filter(t => t.outcome === "win" || t.outcome === "max_profit").length;
  const losses = closedTrades.filter(t => t.outcome === "loss" || t.outcome === "max_loss").length;
  
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;
  
  const daysHeld = closedTrades
    .filter(t => t.daysHeld !== undefined)
    .map(t => t.daysHeld!);
  const avgDaysHeld = daysHeld.length > 0 
    ? daysHeld.reduce((a, b) => a + b, 0) / daysHeld.length 
    : 0;

  return {
    ticker: ticker.toUpperCase(),
    totalTrades: trades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
    totalPnl,
    avgPnl,
    avgDaysHeld,
  };
}

/**
 * Get overall performance summary
 */
export async function getPerformanceSummary(): Promise<{
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
}> {
  const trades = await getAllTrades();
  
  const openTrades = trades.filter(t => t.status === "open").length;
  const closedTrades = trades.filter(t => t.status !== "open");
  
  const wins = closedTrades.filter(
    t => t.outcome === "win" || t.outcome === "max_profit"
  ).length;
  const losses = closedTrades.filter(
    t => t.outcome === "loss" || t.outcome === "max_loss"
  ).length;
  
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0);
  const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : 0;

  return {
    totalTrades: trades.length,
    openTrades,
    closedTrades: closedTrades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0,
    totalPnl,
    avgPnl,
  };
}

// ============================================================================
// OBSERVATIONS
// ============================================================================

export interface Observation {
  id: string;
  observation: string;
  context: Record<string, unknown>;
  confidence: "hypothesis" | "pattern" | "rule";
  validated: boolean;
  validationNotes?: string;
  tags: string[];
  createdAt: Date;
}

/**
 * Add a new observation
 */
export async function addObservation(
  observation: string,
  context: Record<string, unknown> = {},
  tags: string[] = []
): Promise<Observation | null> {
  const client = getClient();

  const { data, error } = await client
    .from("analyst_observations")
    .insert({
      observation,
      context,
      confidence: "hypothesis",
      validated: false,
      tags,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding observation:", error);
    return null;
  }

  return {
    id: data.id,
    observation: data.observation,
    context: data.context,
    confidence: data.confidence,
    validated: data.validated,
    validationNotes: data.validation_notes,
    tags: data.tags ?? [],
    createdAt: new Date(data.created_at),
  };
}

/**
 * Get observations for a ticker (via tags)
 */
export async function getObservationsForTicker(
  ticker: string
): Promise<Observation[]> {
  const client = getClient();

  const { data, error } = await client
    .from("analyst_observations")
    .select("*")
    .contains("tags", [ticker.toUpperCase()])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching observations:", error);
    return [];
  }

  return data.map((row: {
    id: string;
    observation: string;
    context: Record<string, unknown>;
    confidence: "hypothesis" | "pattern" | "rule";
    validated: boolean;
    validation_notes?: string;
    tags: string[];
    created_at: string;
  }) => ({
    id: row.id,
    observation: row.observation,
    context: row.context,
    confidence: row.confidence,
    validated: row.validated,
    validationNotes: row.validation_notes,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at),
  }));
}

// ============================================================================
// POSITIONS
// ============================================================================

export interface Position {
  id: string;
  ticker: string;
  positionType: "call_debit_spread" | "put_credit_spread" | "stock" | "call_long" | "put_long";
  longStrike?: number;
  shortStrike?: number;
  expiration?: Date;
  quantity: number;
  entryDate: Date;
  entryPrice: number;
  entryUnderlying?: number;
  currentValue?: number;
  unrealizedPnl?: number;
  stopLoss?: number;
  profitTarget?: number;
  notes?: string;
  dte?: number;
}

interface DBPosition {
  id: string;
  ticker: string;
  position_type: string;
  long_strike: number | null;
  short_strike: number | null;
  expiration: string | null;
  quantity: number;
  entry_date: string;
  entry_price: number;
  entry_underlying: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  stop_loss: number | null;
  profit_target: number | null;
  notes: string | null;
}

function dbToPosition(row: DBPosition): Position {
  const expiration = row.expiration ? new Date(row.expiration) : undefined;
  const dte = expiration 
    ? Math.ceil((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;
    
  return {
    id: row.id,
    ticker: row.ticker,
    positionType: row.position_type as Position["positionType"],
    longStrike: row.long_strike ?? undefined,
    shortStrike: row.short_strike ?? undefined,
    expiration,
    quantity: row.quantity,
    entryDate: new Date(row.entry_date),
    entryPrice: row.entry_price,
    entryUnderlying: row.entry_underlying ?? undefined,
    currentValue: row.current_value ?? undefined,
    unrealizedPnl: row.unrealized_pnl ?? undefined,
    stopLoss: row.stop_loss ?? undefined,
    profitTarget: row.profit_target ?? undefined,
    notes: row.notes ?? undefined,
    dte,
  };
}

/**
 * Get all open positions
 */
export async function getPositions(): Promise<Position[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("analyst_positions")
      .select("*")
      .order("expiration", { ascending: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching positions:", error);
      return [];
    }

    return (data as DBPosition[]).map(dbToPosition);
  } catch {
    return [];
  }
}

/**
 * Get positions for a specific ticker
 */
export async function getPositionsByTicker(ticker: string): Promise<Position[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("analyst_positions")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .order("expiration", { ascending: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching positions:", error);
      return [];
    }

    return (data as DBPosition[]).map(dbToPosition);
  } catch {
    return [];
  }
}

/**
 * Add a new position
 */
export async function addPosition(position: Omit<Position, "id" | "dte">): Promise<Position | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dbRecord = {
      ticker: position.ticker.toUpperCase(),
      position_type: position.positionType,
      long_strike: position.longStrike ?? null,
      short_strike: position.shortStrike ?? null,
      expiration: position.expiration?.toISOString().split("T")[0] ?? null,
      quantity: position.quantity,
      entry_date: position.entryDate.toISOString().split("T")[0],
      entry_price: position.entryPrice,
      entry_underlying: position.entryUnderlying ?? null,
      current_value: position.currentValue ?? null,
      unrealized_pnl: position.unrealizedPnl ?? null,
      stop_loss: position.stopLoss ?? null,
      profit_target: position.profitTarget ?? null,
      notes: position.notes ?? null,
    };

    const { data, error } = await client
      .from("analyst_positions")
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error("Error adding position:", error);
      return null;
    }

    return dbToPosition(data as DBPosition);
  } catch (err) {
    console.error("Error adding position:", err);
    return null;
  }
}

/**
 * Remove a position (when closed)
 */
export async function removePosition(id: string): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { error } = await client
      .from("analyst_positions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error removing position:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Update a position
 */
export async function updatePosition(
  id: string,
  updates: Partial<Position>
): Promise<Position | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dbUpdates: Record<string, unknown> = {};
    if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
    if (updates.unrealizedPnl !== undefined) dbUpdates.unrealized_pnl = updates.unrealizedPnl;
    if (updates.stopLoss !== undefined) dbUpdates.stop_loss = updates.stopLoss;
    if (updates.profitTarget !== undefined) dbUpdates.profit_target = updates.profitTarget;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    dbUpdates.last_updated = new Date().toISOString();

    const { data, error } = await client
      .from("analyst_positions")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating position:", error);
      return null;
    }

    return dbToPosition(data as DBPosition);
  } catch {
    return null;
  }
}

// ============================================================================
// AGENT: WATCHLIST
// ============================================================================

export interface WatchlistItem {
  id: string;
  ticker: string;
  targetRsiLow: number;
  targetRsiHigh: number;
  targetIvPercentile: number;
  minCushionPct: number;
  minGrade: string;
  active: boolean;
  notes?: string;
  addedAt: Date;
  updatedAt: Date;
}

interface DBWatchlistItem {
  id: string;
  ticker: string;
  target_rsi_low: number;
  target_rsi_high: number;
  target_iv_percentile: number;
  min_cushion_pct: number;
  min_grade: string;
  active: boolean;
  notes: string | null;
  added_at: string;
  updated_at: string;
}

function dbToWatchlistItem(row: DBWatchlistItem): WatchlistItem {
  return {
    id: row.id,
    ticker: row.ticker,
    targetRsiLow: row.target_rsi_low,
    targetRsiHigh: row.target_rsi_high,
    targetIvPercentile: row.target_iv_percentile,
    minCushionPct: row.min_cushion_pct,
    minGrade: row.min_grade,
    active: row.active,
    notes: row.notes ?? undefined,
    addedAt: new Date(row.added_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Get all watchlist items
 */
export async function getWatchlist(activeOnly: boolean = true): Promise<WatchlistItem[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    let query = client.from("agent_watchlist").select("*");
    if (activeOnly) {
      query = query.eq("active", true);
    }
    query = query.order("ticker", { ascending: true });

    const { data, error } = await query;

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching watchlist:", error);
      return [];
    }

    return (data as DBWatchlistItem[]).map(dbToWatchlistItem);
  } catch {
    return [];
  }
}

/**
 * Add ticker(s) to watchlist
 */
export async function addToWatchlist(
  tickers: string | string[],
  options?: {
    targetRsiLow?: number;
    targetRsiHigh?: number;
    targetIvPercentile?: number;
    minCushionPct?: number;
    minGrade?: string;
    notes?: string;
  }
): Promise<WatchlistItem[]> {
  if (!isConfigured()) return [];
  
  const tickerList = Array.isArray(tickers) ? tickers : [tickers];
  const results: WatchlistItem[] = [];
  
  try {
    const client = getClient();
    
    for (const ticker of tickerList) {
      const dbRecord = {
        ticker: ticker.toUpperCase(),
        target_rsi_low: options?.targetRsiLow ?? 35,
        target_rsi_high: options?.targetRsiHigh ?? 55,
        target_iv_percentile: options?.targetIvPercentile ?? 50,
        min_cushion_pct: options?.minCushionPct ?? 8,
        min_grade: options?.minGrade ?? 'B',
        notes: options?.notes ?? null,
        active: true,
      };

      const { data, error } = await client
        .from("agent_watchlist")
        .upsert(dbRecord, { onConflict: "ticker" })
        .select()
        .single();

      if (error) {
        console.error(`Error adding ${ticker} to watchlist:`, error);
        continue;
      }

      results.push(dbToWatchlistItem(data as DBWatchlistItem));
    }

    return results;
  } catch (err) {
    console.error("Error adding to watchlist:", err);
    return results;
  }
}

/**
 * Remove ticker from watchlist
 */
export async function removeFromWatchlist(ticker: string): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { error } = await client
      .from("agent_watchlist")
      .delete()
      .eq("ticker", ticker.toUpperCase());

    if (error) {
      console.error("Error removing from watchlist:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Configure watchlist item thresholds
 */
export async function configureWatchlistItem(
  ticker: string,
  config: {
    targetRsiLow?: number;
    targetRsiHigh?: number;
    targetIvPercentile?: number;
    minCushionPct?: number;
    minGrade?: string;
    notes?: string;
    active?: boolean;
  }
): Promise<WatchlistItem | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dbUpdates: Record<string, unknown> = {};
    if (config.targetRsiLow !== undefined) dbUpdates.target_rsi_low = config.targetRsiLow;
    if (config.targetRsiHigh !== undefined) dbUpdates.target_rsi_high = config.targetRsiHigh;
    if (config.targetIvPercentile !== undefined) dbUpdates.target_iv_percentile = config.targetIvPercentile;
    if (config.minCushionPct !== undefined) dbUpdates.min_cushion_pct = config.minCushionPct;
    if (config.minGrade !== undefined) dbUpdates.min_grade = config.minGrade;
    if (config.notes !== undefined) dbUpdates.notes = config.notes;
    if (config.active !== undefined) dbUpdates.active = config.active;

    const { data, error } = await client
      .from("agent_watchlist")
      .update(dbUpdates)
      .eq("ticker", ticker.toUpperCase())
      .select()
      .single();

    if (error) {
      console.error("Error configuring watchlist item:", error);
      return null;
    }

    return dbToWatchlistItem(data as DBWatchlistItem);
  } catch {
    return null;
  }
}

// ============================================================================
// AGENT: ALERTS
// ============================================================================

export type AlertType = 
  | "ENTRY_SIGNAL"
  | "EXIT_SIGNAL"
  | "POSITION_RISK"
  | "EARNINGS_WARNING"
  | "NEWS_EVENT"
  | "MACRO_EVENT";

export type AlertPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Alert {
  id: string;
  ticker: string;
  alertType: AlertType;
  priority: AlertPriority;
  headline: string;
  analysis?: string;
  data: Record<string, unknown>;
  aiConviction?: number;
  aiReasoning?: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  createdAt: Date;
}

interface DBAlert {
  id: string;
  ticker: string;
  alert_type: string;
  priority: string;
  headline: string;
  analysis: string | null;
  data: Record<string, unknown>;
  ai_conviction: number | null;
  ai_reasoning: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

function dbToAlert(row: DBAlert): Alert {
  return {
    id: row.id,
    ticker: row.ticker,
    alertType: row.alert_type as AlertType,
    priority: row.priority as AlertPriority,
    headline: row.headline,
    analysis: row.analysis ?? undefined,
    data: row.data,
    aiConviction: row.ai_conviction ?? undefined,
    aiReasoning: row.ai_reasoning ?? undefined,
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Create a new alert
 */
export async function createAlert(alert: {
  ticker: string;
  alertType: AlertType;
  priority: AlertPriority;
  headline: string;
  analysis?: string;
  data?: Record<string, unknown>;
  aiConviction?: number;
  aiReasoning?: string;
}): Promise<Alert | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dbRecord = {
      ticker: alert.ticker.toUpperCase(),
      alert_type: alert.alertType,
      priority: alert.priority,
      headline: alert.headline,
      analysis: alert.analysis ?? null,
      data: alert.data ?? {},
      ai_conviction: alert.aiConviction ?? null,
      ai_reasoning: alert.aiReasoning ?? null,
    };

    const { data, error } = await client
      .from("agent_alerts")
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error("Error creating alert:", error);
      return null;
    }

    return dbToAlert(data as DBAlert);
  } catch (err) {
    console.error("Error creating alert:", err);
    return null;
  }
}

/**
 * Get recent alerts
 */
export async function getRecentAlerts(options?: {
  limit?: number;
  ticker?: string;
  alertType?: AlertType;
  unacknowledgedOnly?: boolean;
}): Promise<Alert[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    let query = client.from("agent_alerts").select("*");
    
    if (options?.ticker) {
      query = query.eq("ticker", options.ticker.toUpperCase());
    }
    if (options?.alertType) {
      query = query.eq("alert_type", options.alertType);
    }
    if (options?.unacknowledgedOnly) {
      query = query.eq("acknowledged", false);
    }
    
    query = query
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    const { data, error } = await query;

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching alerts:", error);
      return [];
    }

    return (data as DBAlert[]).map(dbToAlert);
  } catch {
    return [];
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(id: string): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { error } = await client
      .from("agent_alerts")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error acknowledging alert:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// AGENT: SCAN HISTORY
// ============================================================================

export type ScanType = "WATCHLIST" | "FULL_MARKET" | "POSITION_CHECK" | "BRIEFING";

export interface ScanRecord {
  id: string;
  scanType: ScanType;
  tickersScanned: number;
  opportunitiesFound: number;
  alertsTriggered: number;
  executionTimeMs?: number;
  errors: unknown[];
  createdAt: Date;
}

/**
 * Log a scan result
 */
export async function logScan(scan: {
  scanType: ScanType;
  tickersScanned: number;
  opportunitiesFound: number;
  alertsTriggered: number;
  executionTimeMs?: number;
  errors?: unknown[];
}): Promise<ScanRecord | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dbRecord = {
      scan_type: scan.scanType,
      tickers_scanned: scan.tickersScanned,
      opportunities_found: scan.opportunitiesFound,
      alerts_triggered: scan.alertsTriggered,
      execution_time_ms: scan.executionTimeMs ?? null,
      errors: scan.errors ?? [],
    };

    const { data, error } = await client
      .from("agent_scan_history")
      .insert(dbRecord)
      .select()
      .single();

    if (error) {
      console.error("Error logging scan:", error);
      return null;
    }

    return {
      id: data.id,
      scanType: data.scan_type as ScanType,
      tickersScanned: data.tickers_scanned,
      opportunitiesFound: data.opportunities_found,
      alertsTriggered: data.alerts_triggered,
      executionTimeMs: data.execution_time_ms ?? undefined,
      errors: data.errors,
      createdAt: new Date(data.created_at),
    };
  } catch (err) {
    console.error("Error logging scan:", err);
    return null;
  }
}

// ============================================================================
// AGENT: BRIEFINGS
// ============================================================================

export interface Briefing {
  id: string;
  date: Date;
  marketSummary?: string;
  marketData: Record<string, unknown>;
  watchlistAlerts: unknown[];
  positionUpdates: unknown[];
  calendarEvents: unknown[];
  aiCommentary?: string;
  deliveredDiscord: boolean;
  deliveredAt?: Date;
  createdAt: Date;
}

/**
 * Save a briefing
 */
export async function saveBriefing(briefing: {
  date: Date;
  marketSummary?: string;
  marketData?: Record<string, unknown>;
  watchlistAlerts?: unknown[];
  positionUpdates?: unknown[];
  calendarEvents?: unknown[];
  aiCommentary?: string;
}): Promise<Briefing | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    
    const dateStr = briefing.date.toISOString().split("T")[0];
    
    const dbRecord = {
      date: dateStr,
      market_summary: briefing.marketSummary ?? null,
      market_data: briefing.marketData ?? {},
      watchlist_alerts: briefing.watchlistAlerts ?? [],
      position_updates: briefing.positionUpdates ?? [],
      calendar_events: briefing.calendarEvents ?? [],
      ai_commentary: briefing.aiCommentary ?? null,
    };

    const { data, error } = await client
      .from("agent_briefings")
      .upsert(dbRecord, { onConflict: "date" })
      .select()
      .single();

    if (error) {
      console.error("Error saving briefing:", error);
      return null;
    }

    return {
      id: data.id,
      date: new Date(data.date),
      marketSummary: data.market_summary ?? undefined,
      marketData: data.market_data,
      watchlistAlerts: data.watchlist_alerts,
      positionUpdates: data.position_updates,
      calendarEvents: data.calendar_events,
      aiCommentary: data.ai_commentary ?? undefined,
      deliveredDiscord: data.delivered_discord,
      deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  } catch (err) {
    console.error("Error saving briefing:", err);
    return null;
  }
}

/**
 * Get briefing for a date
 */
export async function getBriefing(date: Date): Promise<Briefing | null> {
  if (!isConfigured()) return null;
  
  try {
    const client = getClient();
    const dateStr = date.toISOString().split("T")[0];
    
    const { data, error } = await client
      .from("agent_briefings")
      .select("*")
      .eq("date", dateStr)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      console.error("Error fetching briefing:", error);
      return null;
    }

    return {
      id: data.id,
      date: new Date(data.date),
      marketSummary: data.market_summary ?? undefined,
      marketData: data.market_data,
      watchlistAlerts: data.watchlist_alerts,
      positionUpdates: data.position_updates,
      calendarEvents: data.calendar_events,
      aiCommentary: data.ai_commentary ?? undefined,
      deliveredDiscord: data.delivered_discord,
      deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  } catch {
    return null;
  }
}

/**
 * Get recent briefings
 */
export async function getRecentBriefings(limit: number = 7): Promise<Briefing[]> {
  if (!isConfigured()) return [];
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("agent_briefings")
      .select("*")
      .order("date", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
        return [];
      }
      console.error("Error fetching briefings:", error);
      return [];
    }

    return data.map((row: {
      id: string;
      date: string;
      market_summary: string | null;
      market_data: Record<string, unknown>;
      watchlist_alerts: unknown[];
      position_updates: unknown[];
      calendar_events: unknown[];
      ai_commentary: string | null;
      delivered_discord: boolean;
      delivered_at: string | null;
      created_at: string;
    }) => ({
      id: row.id,
      date: new Date(row.date),
      marketSummary: row.market_summary ?? undefined,
      marketData: row.market_data,
      watchlistAlerts: row.watchlist_alerts,
      positionUpdates: row.position_updates,
      calendarEvents: row.calendar_events,
      aiCommentary: row.ai_commentary ?? undefined,
      deliveredDiscord: row.delivered_discord,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      createdAt: new Date(row.created_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Mark briefing as delivered
 */
export async function markBriefingDelivered(id: string): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { error } = await client
      .from("agent_briefings")
      .update({
        delivered_discord: true,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Error marking briefing delivered:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// AGENT: CONFIGURATION
// ============================================================================

/**
 * Get configuration value
 */
export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  if (!isConfigured()) return defaultValue;
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("agent_config")
      .select("value")
      .eq("key", key)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Key doesn't exist
        return defaultValue;
      }
      console.error("Error fetching config:", error);
      return defaultValue;
    }

    return data.value as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Set configuration value
 */
export async function setConfig<T>(
  key: string, 
  value: T, 
  description?: string
): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const dbRecord: Record<string, unknown> = {
      key,
      value,
    };
    if (description) {
      dbRecord.description = description;
    }

    const { error } = await client
      .from("agent_config")
      .upsert(dbRecord, { onConflict: "key" });

    if (error) {
      console.error("Error setting config:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get all configuration values
 */
export async function getAllConfig(): Promise<Record<string, unknown>> {
  if (!isConfigured()) return {};
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("agent_config")
      .select("key, value");

    if (error) {
      console.error("Error fetching all config:", error);
      return {};
    }

    const config: Record<string, unknown> = {};
    for (const row of data) {
      config[row.key] = row.value;
    }
    return config;
  } catch {
    return {};
  }
}

// ============================================================================
// AGENT: ALERT COOLDOWNS
// ============================================================================

/**
 * Check if a ticker is in cooldown period
 */
export async function checkAlertCooldown(
  ticker: string, 
  cooldownMs: number
): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { data, error } = await client
      .from("agent_alert_cooldowns")
      .select("last_alert_at")
      .eq("ticker", ticker.toUpperCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No cooldown record = not in cooldown
        return false;
      }
      console.error("Error checking cooldown:", error);
      return false;
    }

    const lastAlert = new Date(data.last_alert_at);
    const elapsed = Date.now() - lastAlert.getTime();
    return elapsed < cooldownMs;
  } catch {
    return false;
  }
}

/**
 * Update alert cooldown for a ticker
 */
export async function updateAlertCooldown(
  ticker: string, 
  alertType: AlertType
): Promise<boolean> {
  if (!isConfigured()) return false;
  
  try {
    const client = getClient();
    
    const { error } = await client
      .from("agent_alert_cooldowns")
      .upsert({
        ticker: ticker.toUpperCase(),
        alert_type: alertType,
        last_alert_at: new Date().toISOString(),
      }, { onConflict: "ticker" });

    if (error) {
      console.error("Error updating cooldown:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

