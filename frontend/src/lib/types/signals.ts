// Database table interface (matches volatility_squeeze_signals table)
export interface VolatilitySqueezeSignalDB {
  id: string;
  symbol: string;
  scan_date: string;
  scan_timestamp: string;
  close_price: number;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  volume: number | null;
  price_vs_20d_high: number | null;
  price_vs_20d_low: number | null;
  bb_width: number;
  bb_width_percentile: number;
  bb_width_change: number | null;
  is_squeeze: boolean;
  is_expansion: boolean;
  bb_upper: number | null;
  bb_middle: number | null;
  bb_lower: number | null;
  kc_upper: number | null;
  kc_middle: number | null;
  kc_lower: number | null;
  true_range: number | null;
  atr_20: number | null;
  range_vs_atr: number | null;
  trend_direction: "bullish" | "bearish" | "sideways" | null;
  ema_short: number | null;
  ema_long: number | null;
  volume_ratio: number | null;
  avg_volume: number | null;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  adx: number | null;
  di_plus: number | null;
  di_minus: number | null;
  signal_strength: number;
  technical_score: number;
  overall_score: number;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" | "WATCH" | "PASS" | null;
  stop_loss_price: number | null;
  position_size_pct: number | null;
  market_regime: string | null;
  market_volatility: number | null;
  ai_analysis: string | null;
  ai_confidence: number | null;
  is_actionable: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced interface with computed fields from signal_analysis view
export interface VolatilitySqueezeSignal extends VolatilitySqueezeSignalDB {
  days_since_scan: number;
  stop_loss_distance_pct: number | null;
  squeeze_category: "Extremely Tight" | "Very Tight" | "Tight" | "Normal";
  signal_quality: "Exceptional" | "Excellent" | "Very Good" | "Good" | "Fair";
}

export interface SignalFilters {
  recommendation?: string[];
  squeeze_category?: string[];
  signal_quality?: string[];
  is_actionable?: boolean;
  min_score?: number;
  max_score?: number;
  trend_direction?: string[];
}

export interface SignalSortConfig {
  field: keyof VolatilitySqueezeSignal;
  direction: "asc" | "desc";
}
