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
  
  // Signal Continuity (for cron job deduplication)
  is_new_signal: boolean;
  signal_group_id: string | null;
  first_detected_at: string | null;
  last_detected_at: string | null;
  detection_count: number;
  is_active: boolean;
  
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
  // Continuity filters
  is_active?: boolean;
  is_new_signal?: boolean;
  min_detection_count?: number;
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
  
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  const sign = isNegative ? '-' : '';
  
  // Handle billions (1B+)
  const billions = absAmount / 1_000_000_000;
  if (billions >= 1) {
    return `${sign}$${billions.toFixed(2)}B`;
  }
  
  // Handle millions (1M+)
  const millions = absAmount / 1_000_000;
  if (millions >= 1) {
    return `${sign}$${millions.toFixed(1)}M`;
  }
  
  // Handle thousands (1K+)
  const thousands = absAmount / 1_000;
  if (thousands >= 1) {
    return `${sign}$${thousands.toFixed(0)}K`;
  }
  
  // Handle smaller amounts (< 1K)
  return `${sign}$${absAmount.toFixed(0)}`;
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

// Helper function to get time since last detection
export function getTimeSinceDetection(lastDetectedAt: string | null): string {
  if (!lastDetectedAt) return 'Unknown';
  
  const now = new Date();
  const detected = new Date(lastDetectedAt);
  const diffMs = now.getTime() - detected.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

// Helper function to get active status badge color
export function getActiveStatusColor(isActive: boolean): string {
  return isActive
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

// Helper function to format detection count
export function formatDetectionCount(count: number): string {
  if (count === 1) return 'First detection';
  if (count === 2) return 'Detected 2x';
  return `Detected ${count}x`;
}

// Grouped ticker data for table display
export interface GroupedTickerSignals {
  ticker: string;
  signals: UnusualOptionsSignal[];
  signalCount: number;
  totalPremiumFlow: number;
  highestGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  callCount: number;
  putCount: number;
  dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  avgConfidence: number;
  hasHighConviction: boolean;
  latestDetection: string;
}

// Aggregated signal data for smart summary view
export interface SignalsByStrike {
  strike: number;
  signals: UnusualOptionsSignal[];
  signalCount: number;
  totalPremiumFlow: number;
  callCount: number;
  putCount: number;
  avgScore: number;
  highestGrade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface SignalsByExpiry {
  expiry: string;
  signals: UnusualOptionsSignal[];
  signalCount: number;
  totalPremiumFlow: number;
  callCount: number;
  putCount: number;
  daysToExpiry: number;
}

export interface SignalsByDate {
  date: string;
  signals: UnusualOptionsSignal[];
  signalCount: number;
  totalPremiumFlow: number;
  callCount: number;
  putCount: number;
}

export interface AggregatedSignalSummary {
  totalSignals: number;
  totalPremiumFlow: number;
  callCount: number;
  putCount: number;
  highConvictionCount: number;
  dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  avgConfidence: number;
  dateRange: { earliest: string; latest: string };
  topStrikes: SignalsByStrike[];
  topExpiries: SignalsByExpiry[];
  detectionFlags: {
    volumeAnomaly: number;
    oiSpike: number;
    premiumFlow: number;
    sweep: number;
    blockTrade: number;
  };
}

// Helper function to group signals by ticker
export function groupSignalsByTicker(
  signals: UnusualOptionsSignal[]
): GroupedTickerSignals[] {
  const grouped = new Map<string, UnusualOptionsSignal[]>();
  
  // Group signals by ticker
  signals.forEach(signal => {
    const existing = grouped.get(signal.ticker) || [];
    existing.push(signal);
    grouped.set(signal.ticker, existing);
  });
  
  // Transform to GroupedTickerSignals
  const result: GroupedTickerSignals[] = [];
  
  grouped.forEach((tickerSignals, ticker) => {
    const totalPremiumFlow = tickerSignals.reduce(
      (sum, s) => sum + (s.premium_flow || 0), 0
    );
    
    const callCount = tickerSignals.filter(
      s => s.option_type === 'call'
    ).length;
    const putCount = tickerSignals.length - callCount;
    
    // Determine highest grade (S > A > B > C > D > F)
    const gradeOrder = { 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
    const highestGrade = tickerSignals.reduce((best, signal) => {
      return gradeOrder[signal.grade] > gradeOrder[best] ? signal.grade : best;
    }, 'F' as 'S' | 'A' | 'B' | 'C' | 'D' | 'F');
    
    // Determine dominant sentiment
    const bullishCount = tickerSignals.filter(
      s => s.sentiment === 'BULLISH'
    ).length;
    const bearishCount = tickerSignals.filter(
      s => s.sentiment === 'BEARISH'
    ).length;
    let dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishCount > bearishCount) {
      dominantSentiment = 'BULLISH';
    } else if (bearishCount > bullishCount) {
      dominantSentiment = 'BEARISH';
    }
    
    // Calculate average confidence
    const confidences = tickerSignals
      .map(s => s.confidence)
      .filter((c): c is number => c !== null);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;
    
    // Check if has high conviction (S or A grade)
    const hasHighConviction = tickerSignals.some(
      s => s.grade === 'S' || s.grade === 'A'
    );
    
    // Get latest detection timestamp
    const latestDetection = tickerSignals.reduce((latest, signal) => {
      return signal.detection_timestamp > latest 
        ? signal.detection_timestamp 
        : latest;
    }, tickerSignals[0].detection_timestamp);
    
    result.push({
      ticker,
      signals: tickerSignals.sort(
        (a, b) => (b.premium_flow || 0) - (a.premium_flow || 0)
      ),
      signalCount: tickerSignals.length,
      totalPremiumFlow,
      highestGrade,
      callCount,
      putCount,
      dominantSentiment,
      avgConfidence,
      hasHighConviction,
      latestDetection
    });
  });
  
  return result;
}

// Helper function to create aggregated summary from signals
export function createAggregatedSummary(
  signals: UnusualOptionsSignal[]
): AggregatedSignalSummary {
  if (signals.length === 0) {
    return {
      totalSignals: 0,
      totalPremiumFlow: 0,
      callCount: 0,
      putCount: 0,
      highConvictionCount: 0,
      dominantSentiment: 'NEUTRAL',
      avgConfidence: 0,
      dateRange: { earliest: '', latest: '' },
      topStrikes: [],
      topExpiries: [],
      detectionFlags: {
        volumeAnomaly: 0,
        oiSpike: 0,
        premiumFlow: 0,
        sweep: 0,
        blockTrade: 0,
      },
    };
  }

  // Basic metrics
  const totalSignals = signals.length;
  const totalPremiumFlow = signals.reduce(
    (sum, s) => sum + (s.premium_flow || 0), 
    0
  );
  const callCount = signals.filter(s => s.option_type === 'call').length;
  const putCount = signals.length - callCount;
  const highConvictionCount = signals.filter(
    s => s.grade === 'S' || s.grade === 'A'
  ).length;

  // Determine dominant sentiment
  const bullishCount = signals.filter(
    s => s.sentiment === 'BULLISH'
  ).length;
  const bearishCount = signals.filter(
    s => s.sentiment === 'BEARISH'
  ).length;
  let dominantSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (bullishCount > bearishCount) {
    dominantSentiment = 'BULLISH';
  } else if (bearishCount > bullishCount) {
    dominantSentiment = 'BEARISH';
  }

  // Calculate average confidence
  const confidences = signals
    .map(s => s.confidence)
    .filter((c): c is number => c !== null);
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0;

  // Date range
  const timestamps = signals.map(s => s.detection_timestamp).sort();
  const dateRange = {
    earliest: timestamps[0],
    latest: timestamps[timestamps.length - 1],
  };

  // Group by strike
  const strikeMap = new Map<number, UnusualOptionsSignal[]>();
  signals.forEach(signal => {
    const existing = strikeMap.get(signal.strike) || [];
    existing.push(signal);
    strikeMap.set(signal.strike, existing);
  });

  const gradeOrder = { 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
  const topStrikes: SignalsByStrike[] = Array.from(strikeMap.entries())
    .map(([strike, strikeSignals]) => ({
      strike,
      signals: strikeSignals,
      signalCount: strikeSignals.length,
      totalPremiumFlow: strikeSignals.reduce(
        (sum, s) => sum + (s.premium_flow || 0), 
        0
      ),
      callCount: strikeSignals.filter(
        s => s.option_type === 'call'
      ).length,
      putCount: strikeSignals.filter(
        s => s.option_type === 'put'
      ).length,
      avgScore: strikeSignals.reduce(
        (sum, s) => sum + s.overall_score, 
        0
      ) / strikeSignals.length,
      highestGrade: strikeSignals.reduce((best, signal) => {
        return gradeOrder[signal.grade] > gradeOrder[best] 
          ? signal.grade 
          : best;
      }, 'F' as 'S' | 'A' | 'B' | 'C' | 'D' | 'F'),
    }))
    .sort((a, b) => b.totalPremiumFlow - a.totalPremiumFlow)
    .slice(0, 5);

  // Group by expiry
  const expiryMap = new Map<string, UnusualOptionsSignal[]>();
  signals.forEach(signal => {
    const existing = expiryMap.get(signal.expiry) || [];
    existing.push(signal);
    expiryMap.set(signal.expiry, existing);
  });

  const topExpiries: SignalsByExpiry[] = Array.from(expiryMap.entries())
    .map(([expiry, expirySignals]) => ({
      expiry,
      signals: expirySignals,
      signalCount: expirySignals.length,
      totalPremiumFlow: expirySignals.reduce(
        (sum, s) => sum + (s.premium_flow || 0), 
        0
      ),
      callCount: expirySignals.filter(
        s => s.option_type === 'call'
      ).length,
      putCount: expirySignals.filter(
        s => s.option_type === 'put'
      ).length,
      daysToExpiry: expirySignals[0]?.days_to_expiry || 0,
    }))
    .sort((a, b) => b.totalPremiumFlow - a.totalPremiumFlow)
    .slice(0, 5);

  // Detection flags
  const detectionFlags = {
    volumeAnomaly: signals.filter(s => s.has_volume_anomaly).length,
    oiSpike: signals.filter(s => s.has_oi_spike).length,
    premiumFlow: signals.filter(s => s.has_premium_flow).length,
    sweep: signals.filter(s => s.has_sweep).length,
    blockTrade: signals.filter(s => s.has_block_trade).length,
  };

  return {
    totalSignals,
    totalPremiumFlow,
    callCount,
    putCount,
    highConvictionCount,
    dominantSentiment,
    avgConfidence,
    dateRange,
    topStrikes,
    topExpiries,
    detectionFlags,
  };
}

// Helper function to group signals by strike
export function groupSignalsByStrike(
  signals: UnusualOptionsSignal[]
): SignalsByStrike[] {
  const strikeMap = new Map<number, UnusualOptionsSignal[]>();
  
  signals.forEach(signal => {
    const existing = strikeMap.get(signal.strike) || [];
    existing.push(signal);
    strikeMap.set(signal.strike, existing);
  });

  const gradeOrder = { 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
  
  return Array.from(strikeMap.entries())
    .map(([strike, strikeSignals]) => ({
      strike,
      signals: strikeSignals.sort(
        (a, b) => (b.premium_flow || 0) - (a.premium_flow || 0)
      ),
      signalCount: strikeSignals.length,
      totalPremiumFlow: strikeSignals.reduce(
        (sum, s) => sum + (s.premium_flow || 0), 
        0
      ),
      callCount: strikeSignals.filter(
        s => s.option_type === 'call'
      ).length,
      putCount: strikeSignals.filter(
        s => s.option_type === 'put'
      ).length,
      avgScore: strikeSignals.reduce(
        (sum, s) => sum + s.overall_score, 
        0
      ) / strikeSignals.length,
      highestGrade: strikeSignals.reduce((best, signal) => {
        return gradeOrder[signal.grade] > gradeOrder[best] 
          ? signal.grade 
          : best;
      }, 'F' as 'S' | 'A' | 'B' | 'C' | 'D' | 'F'),
    }))
    .sort((a, b) => b.totalPremiumFlow - a.totalPremiumFlow);
}

// Helper function to group signals by expiry
export function groupSignalsByExpiry(
  signals: UnusualOptionsSignal[]
): SignalsByExpiry[] {
  const expiryMap = new Map<string, UnusualOptionsSignal[]>();
  
  signals.forEach(signal => {
    const existing = expiryMap.get(signal.expiry) || [];
    existing.push(signal);
    expiryMap.set(signal.expiry, existing);
  });

  return Array.from(expiryMap.entries())
    .map(([expiry, expirySignals]) => ({
      expiry,
      signals: expirySignals.sort(
        (a, b) => (b.premium_flow || 0) - (a.premium_flow || 0)
      ),
      signalCount: expirySignals.length,
      totalPremiumFlow: expirySignals.reduce(
        (sum, s) => sum + (s.premium_flow || 0), 
        0
      ),
      callCount: expirySignals.filter(
        s => s.option_type === 'call'
      ).length,
      putCount: expirySignals.filter(
        s => s.option_type === 'put'
      ).length,
      daysToExpiry: expirySignals[0]?.days_to_expiry || 0,
    }))
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

// Helper function to group signals by date
export function groupSignalsByDate(
  signals: UnusualOptionsSignal[]
): SignalsByDate[] {
  const dateMap = new Map<string, UnusualOptionsSignal[]>();
  
  signals.forEach(signal => {
    const date = signal.detection_timestamp.split('T')[0];
    const existing = dateMap.get(date) || [];
    existing.push(signal);
    dateMap.set(date, existing);
  });

  return Array.from(dateMap.entries())
    .map(([date, dateSignals]) => ({
      date,
      signals: dateSignals.sort(
        (a, b) => (b.premium_flow || 0) - (a.premium_flow || 0)
      ),
      signalCount: dateSignals.length,
      totalPremiumFlow: dateSignals.reduce(
        (sum, s) => sum + (s.premium_flow || 0), 
        0
      ),
      callCount: dateSignals.filter(
        s => s.option_type === 'call'
      ).length,
      putCount: dateSignals.filter(
        s => s.option_type === 'put'
      ).length,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

