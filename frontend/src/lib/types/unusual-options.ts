// Database table interface (matches unusual_options_signals table in Supabase)
export interface UnusualOptionsSignalDB {
  // Identity (note: database uses signal_id as primary key)
  signal_id: string;
  ticker: string;
  option_symbol: string;
  detection_timestamp: string;
  
  // Option Details
  strike: number;
  expiry: string;
  option_type: 'call' | 'put';
  days_to_expiry: number;
  moneyness: 'ITM' | 'ATM' | 'OTM' | null;
  
  // Volume Metrics
  current_volume: number;
  average_volume: number;
  volume_ratio: number | null;
  
  // Open Interest Metrics
  current_oi: number;
  previous_oi: number;
  oi_change_pct: number | null;
  
  // Premium Metrics
  premium_flow: number;
  aggressive_order_pct: number | null;
  
  // Detection Flags
  has_volume_anomaly: boolean;
  has_oi_spike: boolean;
  has_premium_flow: boolean;
  has_sweep: boolean;
  has_block_trade: boolean;
  
  // Scoring
  overall_score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number | null;
  
  // Risk Assessment
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  risk_factors: Record<string, unknown>; // JSONB
  
  // Market Context
  underlying_price: number;
  implied_volatility: number | null;
  iv_rank: number | null;
  market_cap: number | null;
  avg_daily_volume: number | null;
  
  // Directional Bias
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
  put_call_ratio: number | null;
  
  // Additional Context
  days_to_earnings: number | null;
  has_upcoming_catalyst: boolean;
  catalyst_description: string | null;
  
  // Metadata
  data_provider: string | null;
  detection_version: string | null;
  raw_detection_data: Record<string, unknown>; // JSONB
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Enhanced interface for frontend display
export interface UnusualOptionsSignal extends UnusualOptionsSignalDB {
  // Computed display fields (for compatibility with frontend)
  id: string; // Maps to signal_id
  days_since_detection?: number;
  premium_display?: string;
  suspicion_level?: string;
  earnings_proximity?: number | null;
}

export interface UnusualOptionsFilters {
  ticker?: string;
  option_type?: ('call' | 'put')[];
  grade?: ('S' | 'A' | 'B' | 'C' | 'D' | 'F')[];
  risk_level?: ('LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME')[];
  moneyness?: ('ITM' | 'ATM' | 'OTM')[];
  sentiment?: ('BULLISH' | 'BEARISH' | 'NEUTRAL')[];
  min_premium_flow?: number;
  max_premium_flow?: number;
  min_days_to_expiry?: number;
  max_days_to_expiry?: number;
  min_overall_score?: number;
  max_overall_score?: number;
  min_confidence?: number;
  has_volume_anomaly?: boolean;
  has_oi_spike?: boolean;
  has_premium_flow?: boolean;
  has_sweep?: boolean;
  has_block_trade?: boolean;
  detection_date?: string;
}

export interface UnusualOptionsSortConfig {
  field: keyof UnusualOptionsSignal;
  direction: 'asc' | 'desc';
}

export interface UnusualOptionsStats {
  total_signals: number;
  by_grade: {
    S: number;
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  by_type: {
    calls: number;
    puts: number;
  };
  by_risk: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    EXTREME: number;
  };
  total_premium_flow: number;
  average_score: number;
  latest_detection_date: string;
  high_conviction_count: number; // S and A grade
}

// Helper function to format premium flow
export function formatPremiumFlow(amount: number | null): string {
  if (!amount || amount === 0) return '-';
  
  const millions = amount / 1_000_000;
  if (millions >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  
  const thousands = amount / 1_000;
  return `$${thousands.toFixed(0)}K`;
}

// Helper function to get grade color
export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'S': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'A': 'bg-green-500/10 text-green-500 border-green-500/20',
    'B': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'C': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'D': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'F': 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return colors[grade] || colors['F'];
}

// Helper function to get risk level color
export function getRiskLevelColor(riskLevel: string | null): string {
  const colors: Record<string, string> = {
    'LOW': 'bg-green-500/10 text-green-500',
    'MEDIUM': 'bg-yellow-500/10 text-yellow-500',
    'HIGH': 'bg-red-500/10 text-red-500',
  };
  return colors[riskLevel || 'MEDIUM'] || colors['MEDIUM'];
}

// Helper function to parse numeric field
export function parseNumericField(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
}

