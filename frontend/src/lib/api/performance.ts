// API functions for performance tracking data

import { supabase } from '@/lib/supabase';
import type {
  SignalPerformance,
  PerformanceDashboard,
  SignalLeaderboard,
  DailySnapshot,
  StrategyPerformance,
  PerformanceStats,
  BacktestResults,
  PerformanceFilters,
  PerformanceChartData
} from '@/lib/types/performance';

// Fetch performance dashboard overview
export async function fetchPerformanceDashboard(): Promise<PerformanceDashboard | null> {
  try {
    // Try to fetch from the view first
    const { data, error } = await supabase
      .from('performance_dashboard')
      .select('*')
      .single();

    if (error) {
      // If view doesn't exist or has no data, calculate manually from signal_performance table
      console.warn('Performance dashboard view not available, calculating manually:', error.message);
      
      try {
        const { data: performanceData, error: perfError } = await supabase
          .from('signal_performance')
          .select('*');

        if (perfError) {
          console.warn('Signal performance table not available:', perfError.message);
          // Return null to indicate no data available
          return null;
        }

        // Calculate dashboard metrics manually
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const allSignals = performanceData || [];
        const closedSignals = allSignals.filter(s => s.status === 'CLOSED');
        const activeSignals = allSignals.filter(s => s.status === 'ACTIVE');
        
        // 30-day metrics
        const signals30d = allSignals.filter(s => new Date(s.entry_date) >= thirtyDaysAgo);
        const closed30d = signals30d.filter(s => s.status === 'CLOSED');
        const avg30d = closed30d.length > 0 ? 
          closed30d.reduce((sum, s) => sum + (s.return_pct || 0), 0) / closed30d.length : 0;
        const win30d = closed30d.length > 0 ?
          closed30d.filter(s => (s.return_pct || 0) > 0).length / closed30d.length : 0;

        // All-time metrics
        const returns = closedSignals.map(s => s.return_pct || 0).filter(r => r !== 0);
        const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
        const bestReturn = returns.length > 0 ? Math.max(...returns) : 0;
        const worstReturn = returns.length > 0 ? Math.min(...returns) : 0;
        const winRate = closedSignals.length > 0 ?
          closedSignals.filter(s => (s.return_pct || 0) > 0).length / closedSignals.length : 0;

        // Period returns
        const monthSignals = closedSignals.filter(s => 
          s.exit_date && new Date(s.exit_date) >= monthStart
        );
        const monthReturn = monthSignals.reduce((sum, s) => sum + (s.return_pct || 0), 0);

        const yearSignals = closedSignals.filter(s => 
          s.exit_date && new Date(s.exit_date) >= yearStart
        );
        const yearReturn = yearSignals.reduce((sum, s) => sum + (s.return_pct || 0), 0);

        return {
          signals_30d: signals30d.length,
          closed_30d: closed30d.length,
          avg_return_30d: Number(avg30d.toFixed(2)),
          win_rate_30d: Number((win30d * 100).toFixed(1)),
          total_signals: allSignals.length,
          total_closed: closedSignals.length,
          total_active: activeSignals.length,
          avg_return_all: Number(avgReturn.toFixed(2)),
          best_return: Number(bestReturn.toFixed(2)),
          worst_return: Number(worstReturn.toFixed(2)),
          win_rate_all: Number((winRate * 100).toFixed(1)),
          month_return: Number(monthReturn.toFixed(2)),
          year_return: Number(yearReturn.toFixed(2))
        };
      } catch (calcError) {
        console.error('Error calculating dashboard manually:', calcError);
        // Return null to indicate calculation failed
        return null;
      }
    }

    return data;
  } catch (error) {
    console.error('Error in fetchPerformanceDashboard:', error);
    // Return null to indicate error occurred
    return null;
  }
}

// Fetch signal performance data with filtering
export async function fetchSignalPerformance(
  filters: PerformanceFilters = {}
): Promise<SignalPerformance[]> {
  try {
    let query = supabase
      .from('signal_performance')
      .select('*')
      .order('entry_date', { ascending: false });

    // Apply filters
    if (filters.period && filters.period !== 'all') {
      const days = {
        '1m': 30,
        '3m': 90,
        '6m': 180,
        '1y': 365
      }[filters.period];
      
      if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('entry_date', cutoffDate.toISOString().split('T')[0]);
      }
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status.toUpperCase());
    }

    if (filters.symbols && filters.symbols.length > 0) {
      query = query.in('symbol', filters.symbols);
    }

    if (filters.recommendation && filters.recommendation.length > 0) {
      query = query.in('entry_recommendation', filters.recommendation);
    }

    if (filters.min_return !== undefined) {
      query = query.gte('return_pct', filters.min_return);
    }

    if (filters.max_return !== undefined) {
      query = query.lte('return_pct', filters.max_return);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      console.warn('Signal performance table not available:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchSignalPerformance:', error);
    return [];
  }
}

// Fetch signal leaderboard
export async function fetchSignalLeaderboard(): Promise<SignalLeaderboard[]> {
  try {
    const { data, error } = await supabase
      .from('signal_leaderboard')
      .select('*')
      .order('avg_return_pct', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Signal leaderboard view not available:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchSignalLeaderboard:', error);
    return [];
  }
}

// Fetch daily performance snapshots
export async function fetchDailySnapshots(days: number = 90): Promise<DailySnapshot[]> {
  try {
    const { data, error } = await supabase
      .from('daily_performance_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(days);

    if (error) {
      console.warn('Daily performance snapshots table not available:', error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchDailySnapshots:', error);
    return [];
  }
}

// Fetch strategy performance by period
export async function fetchStrategyPerformance(
  periodType: string = 'monthly'
): Promise<StrategyPerformance[]> {
  try {
    const { data, error } = await supabase
      .from('strategy_performance')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(24); // Last 24 periods

    if (error) {
      console.error('Error fetching strategy performance:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchStrategyPerformance:', error);
    return [];
  }
}

// Calculate performance statistics
export async function calculatePerformanceStats(
  filters: PerformanceFilters = {}
): Promise<PerformanceStats | null> {
  try {
    const signals = await fetchSignalPerformance(filters);
    const closedSignals = signals.filter(s => s.status === 'CLOSED' && s.return_pct !== null);
    
    if (closedSignals.length === 0) {
      return null;
    }

    const returns = closedSignals.map(s => s.return_pct!);
    const winningTrades = returns.filter(r => r > 0);
    const losingTrades = returns.filter(r => r < 0);
    
    // Calculate basic metrics
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const avgReturn = totalReturn / returns.length;
    const winRate = winningTrades.length / returns.length;
    
    // Calculate profit factor
    const grossProfit = winningTrades.reduce((sum, r) => sum + r, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, r) => sum + r, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Calculate volatility (standard deviation of returns)
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // Calculate Sharpe ratio (assuming 2% risk-free rate)
    const riskFreeRate = 2; // 2% annual
    const sharpeRatio = volatility > 0 ? (avgReturn - riskFreeRate / 12) / volatility : 0;
    
    // Calculate max drawdown (simplified)
    let maxDrawdown = 0;
    let peak = 0;
    let runningReturn = 0;
    
    for (const returnPct of returns) {
      runningReturn += returnPct;
      if (runningReturn > peak) {
        peak = runningReturn;
      }
      const drawdown = (peak - runningReturn) / peak * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Recent performance (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSignals = closedSignals.filter(s => 
      new Date(s.exit_date!) >= thirtyDaysAgo
    );
    const recentReturns = recentSignals.map(s => s.return_pct!);
    const last30dReturn = recentReturns.reduce((sum, r) => sum + r, 0);
    const last30dWinRate = recentReturns.filter(r => r > 0).length / recentReturns.length || 0;
    
    // Current month/year performance
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentMonthSignals = closedSignals.filter(s => {
      const exitDate = new Date(s.exit_date!);
      return exitDate.getMonth() === currentMonth && exitDate.getFullYear() === currentYear;
    });
    const currentMonthReturn = currentMonthSignals.reduce((sum, s) => sum + s.return_pct!, 0);
    
    const currentYearSignals = closedSignals.filter(s => {
      const exitDate = new Date(s.exit_date!);
      return exitDate.getFullYear() === currentYear;
    });
    const currentYearReturn = currentYearSignals.reduce((sum, s) => sum + s.return_pct!, 0);
    
    // Calculate annualized return
    const avgDaysHeld = closedSignals.reduce((sum, s) => sum + (s.days_held || 0), 0) / closedSignals.length;
    const tradesPerYear = 252 / avgDaysHeld; // Assuming 252 trading days per year
    const annualizedReturn = avgReturn * tradesPerYear;
    
    return {
      total_return_pct: totalReturn,
      annualized_return_pct: annualizedReturn,
      win_rate: winRate,
      profit_factor: profitFactor,
      sharpe_ratio: sharpeRatio,
      max_drawdown_pct: maxDrawdown,
      
      total_trades: closedSignals.length,
      avg_return_per_trade: avgReturn,
      avg_days_held: avgDaysHeld,
      best_trade_pct: Math.max(...returns),
      worst_trade_pct: Math.min(...returns),
      
      last_30d_return: last30dReturn,
      last_30d_win_rate: last30dWinRate,
      current_month_return: currentMonthReturn,
      current_year_return: currentYearReturn,
      
      spy_return_comparison: 0, // Would need S&P 500 data
      alpha: 0, // Would need benchmark comparison
      
      volatility: volatility,
      downside_deviation: 0, // Would need more complex calculation
      calmar_ratio: maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0
    };
  } catch (error) {
    console.error('Error calculating performance stats:', error);
    return null;
  }
}

// Fetch performance chart data
export async function fetchPerformanceChartData(days: number = 90): Promise<PerformanceChartData[]> {
  try {
    const snapshots = await fetchDailySnapshots(days);
    
    return snapshots.map(snapshot => ({
      date: snapshot.snapshot_date,
      portfolio_value: snapshot.portfolio_value,
      benchmark_value: 10000 * (1 + (snapshot.spy_return_pct || 0) / 100), // Simplified
      drawdown_pct: 0, // Would need calculation
      daily_return_pct: snapshot.daily_return_pct
    })).reverse(); // Oldest first for charts
  } catch (error) {
    console.error('Error fetching performance chart data:', error);
    return [];
  }
}

// Fetch recent performance highlights
export async function fetchPerformanceHighlights(): Promise<{
  bestPerformers: SignalPerformance[];
  worstPerformers: SignalPerformance[];
  recentWins: SignalPerformance[];
  activeSignals: SignalPerformance[];
}> {
  try {
    const [allSignals, activeSignals] = await Promise.all([
      fetchSignalPerformance({ status: 'closed' }),
      fetchSignalPerformance({ status: 'active' })
    ]);

    // Sort by performance
    const sortedByReturn = allSignals
      .filter(s => s.return_pct !== null)
      .sort((a, b) => (b.return_pct || 0) - (a.return_pct || 0));

    // Recent wins (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentWins = allSignals
      .filter(s => 
        s.exit_date && 
        new Date(s.exit_date) >= sevenDaysAgo && 
        (s.return_pct || 0) > 0
      )
      .sort((a, b) => (b.return_pct || 0) - (a.return_pct || 0))
      .slice(0, 5);

    return {
      bestPerformers: sortedByReturn.slice(0, 5),
      worstPerformers: sortedByReturn.slice(-5).reverse(),
      recentWins,
      activeSignals: activeSignals.slice(0, 10)
    };
  } catch (error) {
    console.error('Error fetching performance highlights:', error);
    return {
      bestPerformers: [],
      worstPerformers: [],
      recentWins: [],
      activeSignals: []
    };
  }
}

// Subscribe to real-time performance updates
export function subscribeToPerformanceUpdates(
  callback: (payload: unknown) => void
) {
  const subscription = supabase
    .channel('performance_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'signal_performance'
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_performance_snapshots'
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

// Calculate backtest results from actual signal performance data
export async function fetchBacktestResults(): Promise<BacktestResults | null> {
  try {
    // Get all closed signals for backtesting
    const signals = await fetchSignalPerformance({ status: 'closed' });
    
    if (signals.length === 0) {
      console.warn('No closed signals available for backtesting');
      return null;
    }

    // Calculate date range
    const sortedSignals = signals.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    const startDate = sortedSignals[0].entry_date;
    const endDate = sortedSignals[sortedSignals.length - 1].exit_date || new Date().toISOString().split('T')[0];

    // Calculate basic metrics
    const returns = signals.map(s => s.return_pct || 0);
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const avgReturn = totalReturn / returns.length;
    const winningTrades = returns.filter(r => r > 0);
    const losingTrades = returns.filter(r => r < 0);
    const winRate = winningTrades.length / returns.length;

    // Calculate profit factor
    const grossProfit = winningTrades.reduce((sum, r) => sum + r, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, r) => sum + r, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    // Calculate volatility and Sharpe ratio
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const riskFreeRate = 2; // 2% annual
    const sharpeRatio = volatility > 0 ? (avgReturn - riskFreeRate / 12) / volatility : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningReturn = 0;
    
    for (const returnPct of returns) {
      runningReturn += returnPct;
      if (runningReturn > peak) {
        peak = runningReturn;
      }
      const drawdown = peak - runningReturn;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Calculate average days held
    const avgDaysHeld = signals.reduce((sum, s) => sum + (s.days_held || 0), 0) / signals.length;

    // Calculate annualized return (simplified)
    const tradesPerYear = 252 / avgDaysHeld; // Assuming 252 trading days per year
    const annualizedReturn = avgReturn * tradesPerYear;

    // Calculate monthly returns
    const monthlyReturns: Array<{ month: string; return_pct: number; trades: number; win_rate: number }> = [];
    const monthlyData: { [key: string]: { returns: number[], trades: number } } = {};
    
    signals.forEach(signal => {
      if (signal.exit_date) {
        const monthKey = signal.exit_date.substring(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { returns: [], trades: 0 };
        }
        monthlyData[monthKey].returns.push(signal.return_pct || 0);
        monthlyData[monthKey].trades++;
      }
    });

    Object.entries(monthlyData).forEach(([month, data]) => {
      const monthReturn = data.returns.reduce((sum, r) => sum + r, 0);
      const monthWinRate = data.returns.filter(r => r > 0).length / data.returns.length;
      monthlyReturns.push({
        month,
        return_pct: Number(monthReturn.toFixed(2)),
        trades: data.trades,
        win_rate: Number(monthWinRate.toFixed(2))
      });
    });

    // Market regime analysis (simplified - would need market data for proper classification)
    const allSignalsPerformance = {
      return_pct: Number(totalReturn.toFixed(1)),
      win_rate: Number(winRate.toFixed(2)),
      trades: signals.length
    };

    return {
      start_date: startDate,
      end_date: endDate,
      initial_capital: 10000,
      
      final_value: 10000 + (totalReturn * 100), // Simplified calculation
      total_return_pct: Number(totalReturn.toFixed(1)),
      annualized_return_pct: Number(annualizedReturn.toFixed(1)),
      
      max_drawdown_pct: Number((-maxDrawdown).toFixed(1)),
      max_drawdown_duration_days: 0, // Would need time series analysis
      sharpe_ratio: Number(sharpeRatio.toFixed(2)),
      sortino_ratio: Number(sharpeRatio.toFixed(2)), // Simplified
      calmar_ratio: maxDrawdown > 0 ? Number((annualizedReturn / maxDrawdown).toFixed(2)) : 0,
      
      total_trades: signals.length,
      win_rate: Number(winRate.toFixed(2)),
      profit_factor: Number(profitFactor.toFixed(1)),
      avg_return_per_trade: Number(avgReturn.toFixed(1)),
      avg_days_held: Number(avgDaysHeld.toFixed(1)),
      
      monthly_returns: monthlyReturns,
      
      benchmark_return_pct: 0, // Would need S&P 500 data
      alpha: Number(annualizedReturn.toFixed(1)), // Simplified
      beta: 0, // Would need market correlation analysis
      
      // Market regime performance (using all data since we can't classify regimes without market data)
      bull_market_performance: allSignalsPerformance,
      bear_market_performance: allSignalsPerformance,
      sideways_market_performance: allSignalsPerformance
    };
  } catch (error) {
    console.error('Error calculating backtest results:', error);
    return null;
  }
}
