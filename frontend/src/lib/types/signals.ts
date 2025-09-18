// Database table interface (matches volatility_squeeze_signals table)
export interface VolatilitySqueezeSignalDB {
  idx: number;
  id: string;
  symbol: string;
  scan_date: string;
  scan_timestamp: string;
  close_price: string | number; // Can be string in JSON
  open_price: string | number | null;
  high_price: string | number | null;
  low_price: string | number | null;
  volume: number | null;
  price_vs_20d_high: string | number | null;
  price_vs_20d_low: string | number | null;
  bb_width: string | number;
  bb_width_percentile: string | number;
  bb_width_change: string | number | null;
  is_squeeze: boolean;
  is_expansion: boolean;
  bb_upper: string | number | null;
  bb_middle: string | number | null;
  bb_lower: string | number | null;
  kc_upper: string | number | null;
  kc_middle: string | number | null;
  kc_lower: string | number | null;
  true_range: string | number | null;
  atr_20: string | number | null;
  range_vs_atr: string | number | null;
  trend_direction: "bullish" | "bearish" | "sideways" | null;
  ema_short: string | number | null;
  ema_long: string | number | null;
  volume_ratio: string | number | null;
  avg_volume: number | null;
  rsi: string | number | null;
  macd: string | number | null;
  macd_signal: string | number | null;
  adx: string | number | null;
  di_plus: string | number | null;
  di_minus: string | number | null;
  signal_strength: string | number;
  technical_score: string | number;
  overall_score: string | number;
  opportunity_rank: "A" | "B" | "C" | "D" | "F" | null;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" | "WATCH" | "PASS" | null;
  stop_loss_price: string | number | null;
  position_size_pct: string | number | null;
  market_regime: string | null;
  market_volatility: string | number | null;
  ai_analysis: string | null;
  ai_confidence: string | number | null;
  signal_status: "NEW" | "ACTIVE" | "EXPIRED" | "TRIGGERED" | null;
  days_in_squeeze: number | null;
  first_detected_date: string | null;
  last_active_date: string | null;
  is_actionable: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced interface with computed fields from signal_analysis view
export interface VolatilitySqueezeSignal extends VolatilitySqueezeSignalDB {
  days_since_scan: number;
  stop_loss_distance_pct: string | number | null;
  squeeze_category: "Extremely Tight" | "Very Tight" | "Tight" | "Normal";
  signal_quality: "Exceptional" | "Excellent" | "Very Good" | "Good" | "Fair";
  total_days_tracked: number | null;
}

export interface SignalFilters {
  recommendation?: string[];
  squeeze_category?: string[];
  signal_quality?: string[];
  opportunity_rank?: string[];
  signal_status?: string[];
  trend_direction?: string[];
  is_actionable?: boolean;
  min_overall_score?: number;
  max_overall_score?: number;
  min_score?: number;
  max_score?: number;
}

export interface SignalSortConfig {
  field: keyof VolatilitySqueezeSignal;
  direction: "asc" | "desc";
}

export interface SignalStats {
  total_signals: number;
  actionable_signals: number;
  bullish_signals: number;
  bearish_signals: number;
  average_score?: number;
  latest_scan_date?: string;
}

// Helper function to convert string numbers to actual numbers
export function parseNumericField(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}