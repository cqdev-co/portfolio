// Performance tracking types for volatility squeeze signals

export interface SignalPerformance {
  id: string;
  signal_id: string;
  symbol: string;
  
  // Entry data
  entry_date: string;
  entry_price: number;
  entry_score: number;
  entry_recommendation: string;
  
  // Exit data
  exit_date?: string;
  exit_price?: number;
  exit_reason?: 'STOP_LOSS' | 'PROFIT_TARGET' | 'EXPANSION' | 'TIME_LIMIT' | 'MANUAL';
  
  // Performance metrics
  return_pct?: number;
  return_absolute?: number;
  days_held?: number;
  max_favorable_excursion_pct?: number;
  max_adverse_excursion_pct?: number;
  
  // Risk metrics
  stop_loss_price?: number;
  profit_target_price?: number;
  initial_risk_pct?: number;
  
  // Signal context
  bb_width_percentile: number;
  squeeze_category: string;
  trend_direction?: string;
  market_regime?: string;
  
  // Status
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  is_winner?: boolean;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PerformanceDashboard {
  // 30-day metrics
  signals_30d: number;
  closed_30d: number;
  avg_return_30d: number;
  win_rate_30d: number;
  
  // All-time metrics
  total_signals: number;
  total_closed: number;
  total_active: number;
  avg_return_all: number;
  best_return: number;
  worst_return: number;
  win_rate_all: number;
  
  // Current period returns
  month_return: number;
  year_return: number;
}

export interface SignalLeaderboard {
  symbol: string;
  total_signals: number;
  closed_signals: number;
  avg_return_pct: number;
  best_return_pct: number;
  worst_return_pct: number;
  win_rate: number;
  avg_days_held: number;
  last_signal_date: string;
}

export interface DailySnapshot {
  id: string;
  snapshot_date: string;
  portfolio_value: number;
  daily_return_pct: number;
  cumulative_return_pct: number;
  active_positions: number;
  new_signals_today: number;
  signals_closed_today: number;
  unrealized_pnl_pct: number;
  realized_pnl_today_pct: number;
  vix_level?: number;
  spy_return_pct?: number;
  market_regime?: string;
  created_at: string;
}

export interface StrategyPerformance {
  id: string;
  period_start: string;
  period_end: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all_time';
  
  // Basic metrics
  total_signals: number;
  active_signals: number;
  closed_signals: number;
  
  // Win/Loss metrics
  winning_signals: number;
  losing_signals: number;
  win_rate: number;
  
  // Return metrics
  total_return_pct: number;
  average_return_pct: number;
  best_return_pct: number;
  worst_return_pct: number;
  
  // Risk metrics
  max_drawdown_pct: number;
  average_days_held: number;
  sharpe_ratio: number;
  profit_factor: number;
  
  // Strategy-specific metrics
  average_bb_width_percentile: number;
  squeeze_breakout_success_rate: number;
  
  // Benchmark comparison
  spy_return_pct?: number;
  alpha?: number;
  
  // Metadata
  last_updated: string;
  created_at: string;
}

export interface PerformanceFilters {
  period?: 'all' | '1y' | '6m' | '3m' | '1m';
  status?: 'all' | 'active' | 'closed';
  min_return?: number;
  max_return?: number;
  symbols?: string[];
  recommendation?: string[];
}

export interface PerformanceStats {
  // Summary statistics
  total_return_pct: number;
  annualized_return_pct: number;
  win_rate: number;
  profit_factor: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  
  // Trade statistics
  total_trades: number;
  avg_return_per_trade: number;
  avg_days_held: number;
  best_trade_pct: number;
  worst_trade_pct: number;
  
  // Recent performance
  last_30d_return: number;
  last_30d_win_rate: number;
  current_month_return: number;
  current_year_return: number;
  
  // Comparison metrics
  spy_return_comparison: number; // Strategy vs S&P 500
  alpha: number;
  beta?: number;
  
  // Risk metrics
  volatility: number;
  downside_deviation: number;
  calmar_ratio: number;
}

export interface BacktestResults {
  // Test parameters
  start_date: string;
  end_date: string;
  initial_capital: number;
  
  // Performance metrics
  final_value: number;
  total_return_pct: number;
  annualized_return_pct: number;
  
  // Risk metrics
  max_drawdown_pct: number;
  max_drawdown_duration_days: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  
  // Trade statistics
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  avg_return_per_trade: number;
  avg_days_held: number;
  
  // Monthly returns
  monthly_returns: Array<{
    month: string;
    return_pct: number;
    trades: number;
    win_rate: number;
  }>;
  
  // Benchmark comparison
  benchmark_return_pct: number;
  alpha: number;
  beta: number;
  
  // Market regime analysis
  bull_market_performance: {
    return_pct: number;
    win_rate: number;
    trades: number;
  };
  bear_market_performance: {
    return_pct: number;
    win_rate: number;
    trades: number;
  };
  sideways_market_performance: {
    return_pct: number;
    win_rate: number;
    trades: number;
  };
}

export interface PerformanceChartData {
  date: string;
  portfolio_value: number;
  benchmark_value: number;
  drawdown_pct: number;
  daily_return_pct: number;
}
