"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Shield, 
  BarChart3,
  Trophy,
  AlertTriangle,
  LineChart
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PerformanceDashboard,
  SignalPerformance,
  SignalLeaderboard,
  PerformanceStats,
  BacktestResults
} from "@/lib/types/performance";
import {
  fetchPerformanceDashboard,
  fetchSignalPerformance,
  fetchSignalLeaderboard,
  calculatePerformanceStats,
  fetchBacktestResults,
  fetchPerformanceHighlights
} from "@/lib/api/performance";

function getReturnColor(returnPct: number) {
  if (returnPct > 0) return "text-green-600 dark:text-green-400";
  if (returnPct < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}


export default function PerformancePage() {
  const [dashboard, setDashboard] = useState<PerformanceDashboard | null>(null);
  const [recentSignals, setRecentSignals] = useState<SignalPerformance[]>([]);
  const [leaderboard, setLeaderboard] = useState<SignalLeaderboard[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null);
  const [highlights, setHighlights] = useState<{
    bestPerformers: SignalPerformance[];
    worstPerformers: SignalPerformance[];
    recentWins: SignalPerformance[];
    activeSignals: SignalPerformance[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('all');

  const loadPerformanceData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        dashboardData,
        signalsData,
        leaderboardData,
        statsData,
        backtestData,
        highlightsData
      ] = await Promise.all([
        fetchPerformanceDashboard(),
        fetchSignalPerformance({ period: selectedPeriod, status: 'closed' }),
        fetchSignalLeaderboard(),
        calculatePerformanceStats({ period: selectedPeriod }),
        fetchBacktestResults(),
        fetchPerformanceHighlights()
      ]);

      setDashboard(dashboardData);
      setRecentSignals(signalsData.slice(0, 20)); // Most recent 20
      setLeaderboard(leaderboardData);
      setStats(statsData);
      setBacktestResults(backtestData);
      setHighlights(highlightsData);
    } catch (error) {
      console.error('Error loading performance data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadPerformanceData();
  }, [loadPerformanceData]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-medium">Strategy Performance & Track Record</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Check if we have any performance data
  const hasPerformanceData = dashboard && (dashboard.total_signals > 0 || dashboard.total_active > 0);
  const hasClosedSignals = dashboard && dashboard.total_closed > 0;

  return (
    <div className="flex flex-col gap-12 max-w-6xl mx-auto">
      {/* Header */}
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 text-sm text-muted-foreground">
          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
          Live Performance Tracking
        </div>
        <h1 className="text-3xl font-light tracking-tight">Strategy Performance</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Transparent, real-time tracking of every volatility squeeze signal. 
          Complete performance attribution with honest win/loss reporting.
        </p>
      </header>

      {/* Period Selector */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/30 border">
          {(['1m', '3m', '6m', '1y', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                selectedPeriod === period
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {period === 'all' ? 'All Time' : period.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* No Data Message */}
      {!hasPerformanceData && (
        <section className="text-center py-16">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 animate-pulse"></div>
              </div>
              <div className="relative flex items-center justify-center h-16 w-16 mx-auto">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-light">Performance Tracking Active</h3>
              <p className="text-muted-foreground leading-relaxed">
                System ready to track signals from the next scanner run. 
                All actionable signals will appear here with complete performance attribution.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/50">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-sm text-blue-700 dark:text-blue-300">Scanner runs every 30 minutes during market hours</span>
            </div>
          </div>
        </section>
      )}

      {/* Performance Overview */}
      {hasPerformanceData && (
        <section className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-2 p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/50">
              <div className="text-3xl font-light text-green-700 dark:text-green-400">
                {stats ? `${(stats.win_rate * 100).toFixed(1)}%` : '0%'}
              </div>
              <div className="text-sm text-green-600 dark:text-green-500 font-medium">Win Rate</div>
            </div>
            
            <div className="text-center space-y-2 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50">
              <div className={cn("text-3xl font-light", stats && getReturnColor(stats.avg_return_per_trade))}>
                {stats ? `${stats.avg_return_per_trade >= 0 ? '+' : ''}${stats.avg_return_per_trade.toFixed(1)}%` : '0%'}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-500 font-medium">Avg Return</div>
            </div>
            
            <div className="text-center space-y-2 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200/50 dark:border-purple-800/50">
              <div className="text-3xl font-light text-purple-700 dark:text-purple-400">
                {stats ? stats.total_trades : dashboard?.total_closed || 0}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-500 font-medium">Total Trades</div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center space-y-1 p-4 rounded-lg bg-muted/30 border border-muted">
              <div className={cn("text-lg font-medium", stats && getReturnColor(stats.best_trade_pct))}>
                {stats ? `+${stats.best_trade_pct.toFixed(1)}%` : '0%'}
              </div>
              <div className="text-xs text-muted-foreground">Best Trade</div>
            </div>
            
            <div className="text-center space-y-1 p-4 rounded-lg bg-muted/30 border border-muted">
              <div className={cn("text-lg font-medium", stats && getReturnColor(-stats.max_drawdown_pct))}>
                {stats ? `-${stats.max_drawdown_pct.toFixed(1)}%` : '0%'}
              </div>
              <div className="text-xs text-muted-foreground">Max Drawdown</div>
            </div>
            
            <div className="text-center space-y-1 p-4 rounded-lg bg-muted/30 border border-muted">
              <div className="text-lg font-medium text-foreground">
                {stats ? `${stats.avg_days_held.toFixed(1)}d` : '0d'}
              </div>
              <div className="text-xs text-muted-foreground">Avg Hold</div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <Tabs defaultValue={hasPerformanceData ? "recent" : "methodology"} className="w-full space-y-8">
        <div className="flex justify-center">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-lg bg-muted/30 p-1 text-muted-foreground">
            <TabsTrigger value="recent" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Recent
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="backtest" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Backtest
            </TabsTrigger>
            <TabsTrigger value="methodology" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              Methodology
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Recent Signals Tab */}
        <TabsContent value="recent" className="space-y-8">
          {!hasClosedSignals && recentSignals.length === 0 ? (
            <div className="text-center py-16">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                  <LineChart className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-light">No Signals Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Performance tracking will begin with the next scanner run. 
                  All signals will appear here with complete attribution.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-light">Recent Signals</h2>
                <p className="text-muted-foreground">Complete track record with entry/exit details</p>
              </div>
              
              <div className="space-y-3">
                {recentSignals.map((signal, index) => (
                  <div 
                    key={signal.id} 
                    className="group p-4 rounded-lg border border-muted hover:border-muted-foreground/20 transition-all duration-200 hover:shadow-sm"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="font-medium text-lg">{signal.symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(signal.entry_date).toLocaleDateString()}
                        </div>
                        <div className="text-sm">
                          ${signal.entry_price.toFixed(2)}
                          {signal.exit_price && (
                            <span className="text-muted-foreground"> → ${signal.exit_price.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {signal.return_pct !== null && signal.return_pct !== undefined ? (
                          <div className={cn("text-sm font-medium px-2 py-1 rounded-md", 
                            signal.return_pct >= 0 
                              ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" 
                              : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                          )}>
                            {signal.return_pct >= 0 ? '+' : ''}{signal.return_pct.toFixed(1)}%
                          </div>
                        ) : (
                          <div className="text-sm px-2 py-1 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                            Active
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground">
                          {signal.days_held ? `${signal.days_held}d` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Performance Highlights */}
        {highlights && hasPerformanceData && (
          <TabsContent value="highlights" className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              {highlights.recentWins.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    <h3 className="font-medium">Recent Wins</h3>
                  </div>
                  <div className="space-y-2">
                    {highlights.recentWins.slice(0, 5).map((signal) => (
                      <div key={signal.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                        <span className="font-medium">{signal.symbol}</span>
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          +{signal.return_pct?.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {highlights.activeSignals.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Activity className="h-4 w-4" />
                    <h3 className="font-medium">Active Signals</h3>
                  </div>
                  <div className="space-y-2">
                    {highlights.activeSignals.slice(0, 5).map((signal) => (
                      <div key={signal.id} className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                        <span className="font-medium">{signal.symbol}</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.floor((Date.now() - new Date(signal.entry_date).getTime()) / (1000 * 60 * 60 * 24))}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-8">
          {leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-light">No Leaderboard Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Symbol rankings will appear once we have at least 3 completed signals per symbol.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-light">Top Performers</h2>
                <p className="text-muted-foreground">Symbols ranked by average return (min. 3 signals)</p>
              </div>
              
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((item, index) => (
                  <div 
                    key={item.symbol} 
                    className="flex items-center justify-between p-4 rounded-lg border border-muted hover:border-muted-foreground/20 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        index < 3 
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <div className="font-medium text-lg">{item.symbol}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.closed_signals} signals
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className={cn("text-sm font-medium", getReturnColor(item.avg_return_pct))}>
                          {item.avg_return_pct >= 0 ? '+' : ''}{item.avg_return_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">avg return</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {item.win_rate.toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">win rate</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">
                          +{item.best_return_pct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">best</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Backtest Results Tab */}
        <TabsContent value="backtest" className="space-y-8">
          {backtestResults ? (
            <div className="space-y-8">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-light">Historical Backtest</h2>
                <p className="text-muted-foreground">Strategy performance across different market conditions (2024)</p>
              </div>

              {/* Key Performance Metrics */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <div className={cn("text-2xl font-light mb-1", getReturnColor(backtestResults.total_return_pct))}>
                    {backtestResults.total_return_pct >= 0 ? '+' : ''}{backtestResults.total_return_pct}%
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Return</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    vs {backtestResults.benchmark_return_pct}% S&P 500
                  </div>
                </div>

                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/50">
                  <div className="text-2xl font-light text-green-700 dark:text-green-400 mb-1">
                    {(backtestResults.win_rate * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-500">Win Rate</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {backtestResults.total_trades} total trades
                  </div>
                </div>

                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200/50 dark:border-purple-800/50">
                  <div className="text-2xl font-light text-purple-700 dark:text-purple-400 mb-1">
                    {backtestResults.sharpe_ratio}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-500">Sharpe Ratio</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Risk-adjusted return
                  </div>
                </div>
              </div>

              {/* Risk Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-muted">
                  <div className="text-lg font-medium text-red-600 dark:text-red-400">
                    {backtestResults.max_drawdown_pct}%
                  </div>
                  <div className="text-xs text-muted-foreground">Max Drawdown</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-muted">
                  <div className="text-lg font-medium">
                    {backtestResults.profit_factor}
                  </div>
                  <div className="text-xs text-muted-foreground">Profit Factor</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-muted">
                  <div className="text-lg font-medium">
                    {backtestResults.calmar_ratio}
                  </div>
                  <div className="text-xs text-muted-foreground">Calmar Ratio</div>
                </div>
                
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-muted">
                  <div className="text-lg font-medium">
                    {backtestResults.avg_days_held.toFixed(1)}d
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Hold</div>
                </div>
              </div>

              {/* Market Regime Performance */}
              <div className="space-y-4">
                <h3 className="text-center text-lg font-light">Market Regime Performance</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <h4 className="font-medium text-green-700 dark:text-green-400">Bull Markets</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Return</span>
                        <span className="text-sm font-medium text-green-600">+{backtestResults.bull_market_performance.return_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                        <span className="text-sm font-medium">{(backtestResults.bull_market_performance.win_rate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Trades</span>
                        <span className="text-sm font-medium">{backtestResults.bull_market_performance.trades}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <h4 className="font-medium text-red-700 dark:text-red-400">Bear Markets</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Return</span>
                        <span className="text-sm font-medium text-green-600">+{backtestResults.bear_market_performance.return_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                        <span className="text-sm font-medium">{(backtestResults.bear_market_performance.win_rate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Trades</span>
                        <span className="text-sm font-medium">{backtestResults.bear_market_performance.trades}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium text-blue-700 dark:text-blue-400">Sideways Markets</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Return</span>
                        <span className="text-sm font-medium text-green-600">+{backtestResults.sideways_market_performance.return_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                        <span className="text-sm font-medium">{(backtestResults.sideways_market_performance.win_rate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Trades</span>
                        <span className="text-sm font-medium">{backtestResults.sideways_market_performance.trades}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-light">Backtest Data Loading</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Historical performance data will be displayed here.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Methodology Tab */}
        <TabsContent value="methodology" className="space-y-8">
          <div className="space-y-8">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-light">Strategy Methodology</h2>
              <p className="text-muted-foreground">Complete transparency of our volatility squeeze approach</p>
            </div>

            {/* Signal Generation */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Target className="h-4 w-4" />
                <h3 className="font-medium">Signal Generation Criteria</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Technical Requirements</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Bollinger Band Width ≤ 20th percentile</div>
                      <div>• BB inside Keltner Channels</div>
                      <div>• Signal strength ≥ 60%</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Volume & Liquidity</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Volume ≥ 0.8x 20-day average</div>
                      <div>• Min $1M daily dollar volume</div>
                      <div>• 252-day lookback period</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Management */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Shield className="h-4 w-4" />
                <h3 className="font-medium">Risk Management</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Position Management</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Max 2% portfolio risk per signal</div>
                      <div>• Max 10 active positions</div>
                      <div>• Max 3 positions per sector</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">Exit Strategy</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Stop loss: 2x ATR (3-5%)</div>
                      <div>• Time limit: 30 days</div>
                      <div>• Exit on expansion</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategy Limitations */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-medium">Strategy Limitations</h3>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">Market Dependencies</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Works best in low-volatility environments</div>
                      <div>• 30-35% false breakout rate</div>
                      <div>• Sensitive to rapid market reversals</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">Risk Factors</div>
                    <div className="space-y-1 text-muted-foreground">
                      <div>• Concentration in specific conditions</div>
                      <div>• Whipsaw risk in volatile markets</div>
                      <div>• Past performance ≠ future results</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Disclosure */}
            <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 border border-yellow-200 dark:border-yellow-800/50">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-yellow-800 dark:text-yellow-200">Risk Disclosure</div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    All trading involves risk of loss. The volatility squeeze strategy has historically 
                    delivered positive returns but may experience periods of underperformance. 
                    Never invest more than you can afford to lose. Consider your risk tolerance 
                    and investment objectives before following any signals.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
