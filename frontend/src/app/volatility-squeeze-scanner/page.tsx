"use client";

import { useState, useEffect, useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import type { VolatilitySqueezeSignal, SignalFilters, SignalSortConfig } from "@/lib/types/signals";
import { fetchVolatilitySignals, fetchSignalStats, subscribeToSignalUpdates, type SignalStats } from "@/lib/api/volatility-signals";
import { fetchPerformanceDashboard } from "@/lib/api/performance";
import type { PerformanceDashboard } from "@/lib/types/performance";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Search, TrendingUp, TrendingDown, Activity, RefreshCw, ExternalLink, BarChart3, Shield, Target } from "lucide-react";

// Helper function to safely parse numeric values
function safeParseNumber(value: string | number | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function to generate Yahoo Finance URL
function getYahooFinanceUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${symbol}`;
}

function getRecommendationColor(recommendation: string) {
  switch (recommendation) {
    case "STRONG_BUY":
      return "bg-green-600 text-white hover:bg-green-700";
    case "BUY":
      return "bg-green-500 text-white hover:bg-green-600";
    case "WATCH":
      return "bg-yellow-500 text-white hover:bg-yellow-600";
    case "SELL":
      return "bg-red-500 text-white hover:bg-red-600";
    case "STRONG_SELL":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getSignalQualityColor(quality: string) {
  switch (quality) {
    case "Exceptional":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "Excellent":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Very Good":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
    case "Good":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Fair":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getSqueezeCategoryColor(category: string) {
  switch (category) {
    case "Extremely Tight":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "Very Tight":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "Tight":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "Normal":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getOpportunityRankColor(rank: string) {
  switch (rank) {
    case "A":
      return "bg-green-600 text-white hover:bg-green-700";
    case "B":
      return "bg-blue-600 text-white hover:bg-blue-700";
    case "C":
      return "bg-yellow-600 text-white hover:bg-yellow-700";
    case "D":
      return "bg-orange-600 text-white hover:bg-orange-700";
    case "F":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export default function VolatilitySqueezeScanner() {
  const [signals, setSignals] = useState<VolatilitySqueezeSignal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [performance, setPerformance] = useState<PerformanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters] = useState<SignalFilters>({});
  const [sortConfig, setSortConfig] = useState<SignalSortConfig>({
    field: "overall_score",
    direction: "desc"
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<VolatilitySqueezeSignal | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setError(null);
      
      // Load signals, stats, and performance data in parallel
      const today = new Date().toISOString().split('T')[0];
      const [signalsResponse, statsData, performanceData] = await Promise.all([
        fetchVolatilitySignals({
          limit: 100,
          sortBy: sortConfig.field,
          sortOrder: sortConfig.direction,
          filters: { ...filters, scan_date: today }, // Filter by today's date to avoid duplicates
          searchTerm
        }),
        fetchSignalStats(),
        fetchPerformanceDashboard()
      ]);

      if (signalsResponse.error) {
        setError(signalsResponse.error);
      } else {
        setSignals(signalsResponse.data);
      }
      
      setStats(statsData);
      setPerformance(performanceData);
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load volatility signals");
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, [sortConfig, filters, searchTerm]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time updates
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const unsubscribe = subscribeToSignalUpdates(
      (payload) => {
        console.log('Real-time update:', payload);
        // Reload data when signals are updated
        loadData();
      },
      { scan_date: today }
    );

    return unsubscribe;
  }, [loadData]);

  // Signals are already filtered and sorted by the API
  const displaySignals = signals;

  // Handle keyboard navigation in sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sidebarOpen || !selectedSignal) return;

      if (e.key === 'Escape') {
        closeSidebar();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = displaySignals.findIndex(signal => signal.id === selectedSignal.id);
        
        if (currentIndex === -1) return;

        let nextIndex;
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : displaySignals.length - 1;
        } else {
          nextIndex = currentIndex < displaySignals.length - 1 ? currentIndex + 1 : 0;
        }

        const nextSignal = displaySignals[nextIndex];
        if (nextSignal) {
          setSelectedSignal(nextSignal);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, selectedSignal, displaySignals]);

  const handleSort = (field: keyof VolatilitySqueezeSignal) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const getSortIcon = (field: keyof VolatilitySqueezeSignal) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "desc" ? 
      <ArrowDown className="h-4 w-4" /> : 
      <ArrowUp className="h-4 w-4" />;
  };

  const handleRowClick = (signal: VolatilitySqueezeSignal) => {
    setSelectedSignal(signal);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    // Delay clearing the selected signal to allow for exit animation
    setTimeout(() => setSelectedSignal(null), 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-12">
        <section>
          <h1 className="text-2xl font-medium mb-3">Volatility Squeeze Scanner</h1>
          <Separator className="mb-4" />
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-medium">Professional Volatility Squeeze Scanner</h1>
        </div>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2">
          <p>
            The <strong>volatility squeeze strategy</strong> identifies stocks experiencing unusually low price movement, 
            which often precedes explosive breakouts in either direction. This professional <em>stock market scanner</em> uses {" "}
            <strong>Bollinger Bands</strong> and <strong>Keltner Channels</strong> to detect squeeze conditions with high accuracy.
          </p>
          <p>
            Deploy this <strong>trading tool</strong> when markets are calm and consolidating; these compressed periods 
            historically deliver <strong>1.2-3.3% moves</strong> with exceptional precision. Perfect for {" "} 
            <em>day traders</em> and <em>swing traders</em> seeking high-probability breakout opportunities.
          </p>
        </div>
        
        {/* Performance Metrics */}
        {performance && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Live Performance Tracking</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Win Rate */}
              <div className="group">
                <Link 
                  href="/volatility-squeeze-scanner/performance"
                  className="block p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-all duration-200 hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-xl font-light">
                        {performance.win_rate_all ? `${performance.win_rate_all}%` : '—'}
                      </p>
                    </div>
                    <Target className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              </div>

              {/* Average Return */}
              <div className="group">
                <Link 
                  href="/volatility-squeeze-scanner/performance"
                  className="block p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-all duration-200 hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Avg Return</p>
                      <p className="text-xl font-light">
                        {performance.avg_return_all ? `${performance.avg_return_all > 0 ? '+' : ''}${performance.avg_return_all}%` : '—'}
                      </p>
                    </div>
                    <TrendingUp className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              </div>

              {/* Total Signals */}
              <div className="group">
                <Link 
                  href="/volatility-squeeze-scanner/performance"
                  className="block p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-all duration-200 hover:border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Signals</p>
                      <p className="text-xl font-light">
                        {performance.total_signals || '—'}
                      </p>
                    </div>
                    <BarChart3 className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              </div>
            </div>

            <div className="text-center">
              <Link 
                href="/volatility-squeeze-scanner/performance"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View detailed performance analysis
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Market Conditions & Stats */}
      <section className="space-y-4" aria-labelledby="market-conditions-title">
        <h2 id="market-conditions-title" className="sr-only">Market Conditions and Statistics</h2>
        {/* Simple Market Conditions */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true"></div>
            <span className="text-muted-foreground">Current Market Conditions:</span>
            <span className="font-medium">Favorable for Volatility Squeeze Strategy</span>
          </div>
          <span className="text-xs text-muted-foreground" title="Market volatility indicators">Low Vol Regime • VIX ~20</span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-caption text-muted-foreground">Total Signals</span>
            </div>
            <p className="text-lg font-medium mt-1">{stats?.total_signals || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span className="text-caption text-muted-foreground">Actionable</span>
            </div>
            <p className="text-lg font-medium mt-1">{stats?.actionable_signals || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-caption text-muted-foreground">Bullish</span>
            </div>
            <p className="text-lg font-medium mt-1">{stats?.bullish_signals || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-caption text-muted-foreground">Bearish</span>
            </div>
            <p className="text-lg font-medium mt-1">{stats?.bearish_signals || 0}</p>
          </Card>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="flex flex-col sm:flex-row gap-4" aria-labelledby="search-section-title">
        <h2 id="search-section-title" className="sr-only">Search and Filter Stock Signals</h2>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search stock symbols (e.g., AAPL, GOOGL)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            aria-label="Search for stock symbols"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <p className="text-sm text-destructive">{error}</p>
        </section>
      )}

      {/* Signals Table */}
      <section aria-labelledby="signals-table-title">
        <h2 id="signals-table-title" className="sr-only">Live Volatility Squeeze Signals</h2>
        <div className="rounded-md border" role="region" aria-label="Stock signals data table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("symbol")}
                >
                  <div className="flex items-center gap-2">
                    Symbol
                    {getSortIcon("symbol")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("close_price")}
                >
                  <div className="flex items-center gap-2">
                    Price
                    {getSortIcon("close_price")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("overall_score")}
                >
                  <div className="flex items-center gap-2">
                    Score
                    {getSortIcon("overall_score")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("opportunity_rank")}
                >
                  <div className="flex items-center gap-2">
                    Rank
                    {getSortIcon("opportunity_rank")}
                  </div>
                </TableHead>
                <TableHead>Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySignals.map((signal) => (
                <TableRow 
                  key={signal.id} 
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleRowClick(signal)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {signal.symbol}
                      {signal.is_actionable && (
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">${safeParseNumber(signal.close_price).toFixed(2)}</span>
                      <span className={cn(
                        "text-caption",
                        safeParseNumber(signal.price_vs_20d_high) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {safeParseNumber(signal.price_vs_20d_high) >= 0 ? "+" : ""}{safeParseNumber(signal.price_vs_20d_high).toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{(safeParseNumber(signal.overall_score) * 100).toFixed(0)}%</span>
                      <span className="text-caption text-muted-foreground">
                        {signal.signal_quality}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {signal.opportunity_rank && (
                      <Badge className={getOpportunityRankColor(signal.opportunity_rank)}>
                        {signal.opportunity_rank}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {signal.recommendation && (
                      <Badge className={getRecommendationColor(signal.recommendation)}>
                        {signal.recommendation.replace("_", " ")}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {displaySignals.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No signals found matching your criteria.</p>
          </div>
        )}

      </section>

      {/* Detail Sidebar */}
      {sidebarOpen && selectedSignal && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/10 z-40"
            onClick={closeSidebar}
          />
          
          {/* Sidebar */}
          <div className={cn(
            "fixed top-0 right-0 h-full w-full sm:w-96 bg-background border-l border-border z-50",
            "rounded-l-xl shadow-2xl",
            "transform transition-all duration-200 ease-out",
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          )}>
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(getYahooFinanceUrl(selectedSignal.symbol), '_blank')}
                      className="flex items-center gap-1.5 text-base font-semibold hover:text-blue-600 transition-colors cursor-pointer group"
                      title={`View ${selectedSignal.symbol} on Yahoo Finance`}
                    >
                      <span>{selectedSignal.symbol}</span>
                      <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {selectedSignal.is_actionable && (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                    )}
                  </div>
                  {selectedSignal.recommendation && (
                    <Badge className={cn("text-xs", getRecommendationColor(selectedSignal.recommendation))}>
                      {selectedSignal.recommendation.replace("_", " ")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">↑↓ Navigate</span>
                  <Button variant="ghost" size="sm" onClick={closeSidebar}>
                    ✕
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
                {/* Price & Performance */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Price & Performance</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Current Price</p>
                      <p className="text-sm font-semibold">${safeParseNumber(selectedSignal.close_price).toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">vs 20D High</p>
                      <p className={cn(
                        "text-sm font-semibold",
                        safeParseNumber(selectedSignal.price_vs_20d_high) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {safeParseNumber(selectedSignal.price_vs_20d_high) >= 0 ? "+" : ""}{safeParseNumber(selectedSignal.price_vs_20d_high).toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">vs 20D Low</p>
                      <p className="text-xs font-medium">
                        +{safeParseNumber(selectedSignal.price_vs_20d_low).toFixed(1)}%
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Day Range</p>
                      <p className="text-xs font-medium">
                        ${safeParseNumber(selectedSignal.low_price).toFixed(2)} - ${safeParseNumber(selectedSignal.high_price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Signal Analysis */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signal Analysis</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Overall Score</span>
                      <span className="text-xs font-semibold">{(safeParseNumber(selectedSignal.overall_score) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Signal Strength</span>
                      <span className="text-xs font-semibold">{(safeParseNumber(selectedSignal.signal_strength) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Technical Score</span>
                      <span className="text-xs font-semibold">{(safeParseNumber(selectedSignal.technical_score) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Signal Quality</span>
                      <Badge variant="outline" className={cn("text-xs h-5 px-2", getSignalQualityColor(selectedSignal.signal_quality))}>
                        {selectedSignal.signal_quality}
                      </Badge>
                    </div>
                    {selectedSignal.opportunity_rank && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Opportunity Rank</span>
                        <Badge className={cn("text-xs h-5 px-2", getOpportunityRankColor(selectedSignal.opportunity_rank))}>
                          {selectedSignal.opportunity_rank}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Volatility Squeeze */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Volatility Squeeze</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Squeeze Status</span>
                      <Badge variant="outline" className={cn("text-xs h-5 px-2", getSqueezeCategoryColor(selectedSignal.squeeze_category))}>
                        {selectedSignal.squeeze_category}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">BB Width Percentile</span>
                      <span className="text-xs font-medium">{safeParseNumber(selectedSignal.bb_width_percentile).toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Is Squeeze</span>
                      <span className={cn(
                        "text-xs font-medium",
                        selectedSignal.is_squeeze ? "text-red-600" : "text-green-600"
                      )}>
                        {selectedSignal.is_squeeze ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Is Expansion</span>
                      <span className={cn(
                        "text-xs font-medium",
                        selectedSignal.is_expansion ? "text-green-600" : "text-muted-foreground"
                      )}>
                        {selectedSignal.is_expansion ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Technical Analysis & Risk Management */}
                <div className="space-y-4">
                    {/* Trend & Volume */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trend & Volume</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Trend Direction</span>
                          <div className="flex items-center gap-1">
                            {selectedSignal.trend_direction === "bullish" ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : selectedSignal.trend_direction === "bearish" ? (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                              <div className="h-3 w-3" />
                            )}
                            <span className="text-xs font-medium capitalize">{selectedSignal.trend_direction || "N/A"}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Volume</span>
                          <span className="text-xs font-medium">
                            {selectedSignal.volume ? `${(selectedSignal.volume / 1000000).toFixed(1)}M` : "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Volume Ratio</span>
                          <span className="text-xs font-medium">
                            {safeParseNumber(selectedSignal.volume_ratio) > 0 ? `${safeParseNumber(selectedSignal.volume_ratio).toFixed(1)}x` : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Risk Management */}
                    {selectedSignal.stop_loss_price && (
                      <>
                        <div className="space-y-2">
                          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Management</h3>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs">Stop Loss</span>
                              <span className="text-xs font-medium">${safeParseNumber(selectedSignal.stop_loss_price).toFixed(2)}</span>
                            </div>
                            {safeParseNumber(selectedSignal.stop_loss_distance_pct) > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs">Stop Distance</span>
                                <span className="text-xs font-medium">{safeParseNumber(selectedSignal.stop_loss_distance_pct).toFixed(1)}%</span>
                              </div>
                            )}
                            {safeParseNumber(selectedSignal.position_size_pct) > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs">Position Size</span>
                                <span className="text-xs font-medium">{(safeParseNumber(selectedSignal.position_size_pct) * 100).toFixed(1)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Technical Indicators */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Technical Indicators</h3>
                      <div className="space-y-2">
                        {safeParseNumber(selectedSignal.bb_upper) > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Bollinger Bands</p>
                            <div className="text-xs space-y-0.5">
                              <div className="flex justify-between">
                                <span>Upper:</span>
                                <span>${safeParseNumber(selectedSignal.bb_upper).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Middle:</span>
                                <span>${safeParseNumber(selectedSignal.bb_middle).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Lower:</span>
                                <span>${safeParseNumber(selectedSignal.bb_lower).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {safeParseNumber(selectedSignal.atr_20) > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs">ATR (20)</span>
                            <span className="text-xs font-medium">{safeParseNumber(selectedSignal.atr_20).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Metadata */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scan Info</h3>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Scan Date</span>
                          <span className="text-xs">{new Date(selectedSignal.scan_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Days Since</span>
                          <span className="text-xs">{selectedSignal.days_since_scan} days</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Updated</span>
                          <span className="text-xs">{new Date(selectedSignal.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
