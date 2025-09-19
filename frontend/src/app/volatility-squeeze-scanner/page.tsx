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
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Search, TrendingUp, TrendingDown, Activity, RefreshCw, ExternalLink, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

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
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [signals, setSignals] = useState<VolatilitySqueezeSignal[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
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

  // Authentication gating constants
  const MAX_FREE_SIGNALS = 3;
  const isAuthenticated = !!user;
  const shouldShowAllSignals = isAuthenticated;

  // Load data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setError(null);
      
      // Load signals and stats in parallel
      const [signalsResponse, statsData] = await Promise.all([
        fetchVolatilitySignals({
          limit: 100,
          sortBy: sortConfig.field,
          sortOrder: sortConfig.direction,
          filters,
          searchTerm
        }),
        fetchSignalStats()
      ]);

      if (signalsResponse.error) {
        setError(signalsResponse.error);
      } else {
        setSignals(signalsResponse.data);
      }
      
      setStats(statsData);
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
  // For unauthenticated users, only show top 5 signals
  const displaySignals = shouldShowAllSignals ? signals : signals.slice(0, MAX_FREE_SIGNALS);

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

  if (loading || authLoading) {
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
            which often precedes explosive breakouts in either direction. This professional <em>stock market scanner</em> uses 
            <strong>Bollinger Bands</strong> and <strong>Keltner Channels</strong> to detect squeeze conditions with high accuracy.
          </p>
          <p>
            Deploy this <strong>trading tool</strong> when markets are calm and consolidating—these compressed periods 
            historically deliver <strong>1.2-3.3% moves</strong> with exceptional precision. Perfect for 
            <em>day traders</em> and <em>swing traders</em> seeking high-probability breakout opportunities.
          </p>
        </div>
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

        {/* Authentication Gate for Additional Signals */}
        {!isAuthenticated && signals.length > MAX_FREE_SIGNALS && (
          <div className="relative mt-8">
            {/* Blurred preview of additional signals */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent z-20 rounded-md" />
              <div className="blur-sm pointer-events-none select-none opacity-60">
                <Table>
                  <TableBody>
                    {signals.slice(MAX_FREE_SIGNALS, MAX_FREE_SIGNALS + 3).map((signal, index) => (
                      <TableRow key={`preview-${index}`}>
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
            </div>

            {/* Sign-in CTA overlay */}
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <Card className="p-8 text-center max-w-md mx-auto bg-background/95 backdrop-blur-sm border-2 border-primary/20">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Sign In to See the Rest!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  You&apos;re viewing the top {MAX_FREE_SIGNALS} signals. Sign in to access all {signals.length} volatility squeeze opportunities and unlock detailed analysis.
                </p>
                <Button 
                  onClick={signInWithGoogle}
                  className="w-full"
                  size="lg"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign In with Google
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Free account • Access all features instantly
                </p>
              </Card>
            </div>
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

                {/* Premium Sections Container */}
                <div className="relative">
                  {/* Premium content with blur effect */}
                  <div className={cn("space-y-4", !isAuthenticated && "blur-sm select-none pointer-events-none opacity-60")}>
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

                  {/* Overlay for premium sections only */}
                  {!isAuthenticated && (
                    <div className="absolute inset-0 flex items-center justify-center z-50">
                      <Card className="p-6 text-center max-w-xs mx-auto bg-background/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
                        <div className="flex items-center justify-center mb-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Lock className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <h3 className="text-base font-semibold mb-2">Sign In to View Premium Analysis</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                          Get access to detailed technical indicators, risk management data, and comprehensive market insights.
                        </p>
                        <Button 
                          onClick={signInWithGoogle}
                          className="w-full mb-3"
                          size="sm"
                        >
                          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Sign In with Google
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Free account • Access all features instantly
                        </p>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
