/**
 * API functions for fetching Penny Stock signals from Supabase
 */

import { supabase } from "@/lib/supabase";
import type {
  PennyStockSignal,
  PennyStockFilters,
  PennyStockResponse,
  PennyStockStats,
} from "@/lib/types/penny-stock";

/**
 * Fetch penny stock signals with optional filters
 */
export async function fetchPennyStockSignals(options: {
  limit?: number;
  sortBy?: keyof PennyStockSignal;
  sortOrder?: "asc" | "desc";
  filters?: PennyStockFilters;
  searchTerm?: string;
}): Promise<PennyStockResponse> {
  try {
    const {
      limit = 100,
      sortBy = "overall_score",
      sortOrder = "desc",
      filters = {},
      searchTerm = "",
    } = options;

    let query = supabase
      .from("penny_stock_signals")
      .select("*", { count: "exact" });

    // Apply search filter
    if (searchTerm) {
      query = query.ilike("symbol", `%${searchTerm}%`);
    }

    // Apply filters
    if (filters.opportunity_rank) {
      query = query.eq("opportunity_rank", filters.opportunity_rank);
    }

    if (filters.min_score !== undefined) {
      query = query.gte("overall_score", filters.min_score);
    }

    if (filters.max_score !== undefined) {
      query = query.lte("overall_score", filters.max_score);
    }

    if (filters.is_breakout !== undefined) {
      query = query.eq("is_breakout", filters.is_breakout);
    }

    if (filters.is_consolidating !== undefined) {
      query = query.eq("is_consolidating", filters.is_consolidating);
    }

    if (filters.signal_status) {
      query = query.eq("signal_status", filters.signal_status);
    }

    if (filters.trend_direction) {
      query = query.eq("trend_direction", filters.trend_direction);
    }

    if (filters.min_volume_ratio !== undefined) {
      query = query.gte("volume_ratio", filters.min_volume_ratio);
    }

    if (filters.min_dollar_volume !== undefined) {
      query = query.gte("dollar_volume", filters.min_dollar_volume);
    }

    if (filters.pump_dump_risk) {
      query = query.eq("pump_dump_risk", filters.pump_dump_risk);
    }

    if (filters.scan_date) {
      query = query.eq("scan_date", filters.scan_date);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Apply limit
    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching penny stock signals:", error);
      return {
        data: [],
        error: error.message,
        count: 0,
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    return {
      data: [],
      error: 
        error instanceof Error 
          ? error.message 
          : "Unknown error occurred",
      count: 0,
    };
  }
}

/**
 * Fetch statistics for penny stock signals
 */
export async function fetchPennyStockStats(): 
  Promise<PennyStockStats | null> {
  try {
    // Get all recent signals
    const { data, error } = await supabase
      .from("penny_stock_signals")
      .select("*")
      .gte(
        "scan_date",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      );

    if (error || !data) {
      console.error("Error fetching stats:", error);
      return null;
    }

    // Calculate stats
    const by_rank = {
      S: data.filter((s) => s.opportunity_rank === "S").length,
      A: data.filter((s) => s.opportunity_rank === "A").length,
      B: data.filter((s) => s.opportunity_rank === "B").length,
      C: data.filter((s) => s.opportunity_rank === "C").length,
      D: data.filter((s) => s.opportunity_rank === "D").length,
    };

    const by_status = {
      NEW: data.filter((s) => s.signal_status === "NEW").length,
      CONTINUING: data.filter(
        (s) => s.signal_status === "CONTINUING"
      ).length,
      ENDED: data.filter((s) => s.signal_status === "ENDED").length,
    };

    const by_trend = {
      bullish: data.filter(
        (s) => s.trend_direction === "bullish"
      ).length,
      bearish: data.filter(
        (s) => s.trend_direction === "bearish"
      ).length,
      neutral: data.filter(
        (s) => s.trend_direction === "neutral"
      ).length,
    };

    const avg_score =
      data.reduce((sum, s) => sum + s.overall_score, 0) / 
      data.length || 0;

    const signals_with_volume = data.filter(
      (s) => s.volume_ratio !== null
    );
    const avg_volume_ratio =
      signals_with_volume.reduce(
        (sum, s) => sum + (s.volume_ratio || 0),
        0
      ) / signals_with_volume.length || 0;

    const breakout_count = data.filter(
      (s) => s.is_breakout === true
    ).length;
    const consolidation_count = data.filter(
      (s) => s.is_consolidating === true
    ).length;

    const latest_scan_date =
      data.reduce((latest, s) => {
        return s.scan_date > latest ? s.scan_date : latest;
      }, data[0]?.scan_date || 
        new Date().toISOString().split("T")[0]);

    return {
      total_signals: data.length,
      by_rank,
      by_status,
      by_trend,
      avg_score,
      avg_volume_ratio,
      breakout_count,
      consolidation_count,
      latest_scan_date,
    };
  } catch (error) {
    console.error("Unexpected error fetching stats:", error);
    return null;
  }
}

/**
 * Subscribe to real-time updates for penny stock signals
 */
export function subscribeToPennyStockUpdates(
  callback: (payload: { 
    eventType: string; 
    new: Record<string, unknown>; 
    old: Record<string, unknown>; 
    errors: string[] | null 
  }) => void,
  filters?: PennyStockFilters
): () => void {
  const channel = supabase
    .channel("penny_stock_signals_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "penny_stock_signals",
        filter: filters?.scan_date
          ? `scan_date=eq.${filters.scan_date}`
          : undefined,
      },
      callback
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

