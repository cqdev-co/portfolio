/**
 * Type definitions for Penny Stock Scanner signals and analysis
 */

export type TrendDirection = "bullish" | "bearish" | "neutral";
export type SignalStatus = "NEW" | "CONTINUING" | "ENDED";
export type OpportunityRank = "S" | "A" | "B" | "C" | "D";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

/**
 * Penny Stock Signal with explosion setup detection
 */
export interface PennyStockSignal {
  // Database fields
  id: string;
  symbol: string;
  scan_date: string;
  
  // Price data
  close_price: number;
  
  // Overall assessment
  overall_score: number;
  opportunity_rank: OpportunityRank;
  recommendation: string;
  
  // Component scores
  volume_score: number;
  momentum_score: number;
  relative_strength_score: number;
  risk_score: number;
  
  // Volume metrics (50% weight)
  volume: number;
  avg_volume_20d: number | null;
  volume_ratio: number | null;
  volume_spike_factor: number | null;
  volume_acceleration_2d: number | null;
  volume_acceleration_5d: number | null;
  volume_consistency_score: number | null;
  dollar_volume: number | null;
  
  // Price momentum & consolidation (30% weight)
  is_consolidating: boolean | null;
  consolidation_days: number | null;
  consolidation_range_pct: number | null;
  is_breakout: boolean | null;
  price_change_5d: number | null;
  price_change_10d: number | null;
  price_change_20d: number | null;
  higher_lows_detected: boolean | null;
  consecutive_green_days: number | null;
  
  // Moving averages
  ema_20: number | null;
  ema_50: number | null;
  price_vs_ema20: number | null;
  price_vs_ema50: number | null;
  ema_crossover_signal: boolean | null;
  
  // Relative strength (15% weight)
  market_outperformance: number | null;
  sector_outperformance: number | null;
  distance_from_52w_low: number | null;
  distance_from_52w_high: number | null;
  breaking_resistance: boolean | null;
  
  // Risk & liquidity (5% weight)
  bid_ask_spread_pct: number | null;
  avg_spread_5d: number | null;
  float_shares: number | null;
  is_low_float: boolean | null;
  daily_volatility: number | null;
  atr_20: number | null;
  pump_dump_risk: RiskLevel | null;
  
  // Trend context
  trend_direction: TrendDirection | null;
  
  // Signal metadata
  signal_status: SignalStatus;
  days_active: number;
  
  // Risk management
  stop_loss_level: number | null;
  position_size_pct: number | null;
  
  // Data quality
  data_quality_score: number | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Filters for querying penny stock signals
 */
export interface PennyStockFilters {
  opportunity_rank?: OpportunityRank;
  min_score?: number;
  max_score?: number;
  is_breakout?: boolean;
  is_consolidating?: boolean;
  signal_status?: SignalStatus;
  trend_direction?: TrendDirection;
  min_volume_ratio?: number;
  min_dollar_volume?: number;
  pump_dump_risk?: RiskLevel;
  scan_date?: string;
}

/**
 * Sort configuration for penny stock signals
 */
export interface PennyStockSortConfig {
  field: keyof PennyStockSignal;
  direction: "asc" | "desc";
}

/**
 * Statistics for penny stock signals
 */
export interface PennyStockStats {
  total_signals: number;
  by_rank: Record<OpportunityRank, number>;
  by_status: Record<SignalStatus, number>;
  by_trend: Record<TrendDirection, number>;
  avg_score: number;
  avg_volume_ratio: number;
  breakout_count: number;
  consolidation_count: number;
  latest_scan_date: string;
}

/**
 * API response wrapper for penny stock signals
 */
export interface PennyStockResponse {
  data: PennyStockSignal[];
  error: string | null;
  count?: number;
}

