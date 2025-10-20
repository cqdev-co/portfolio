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
import type { UnusualOptionsSignal, UnusualOptionsSortConfig, UnusualOptionsFilters } from "@/lib/types/unusual-options";
import { formatPremiumFlow, getGradeColor } from "@/lib/types/unusual-options";
import { fetchUnusualOptionsSignals, fetchUnusualOptionsStats, subscribeToUnusualOptionsUpdates } from "@/lib/api/unusual-options";
import type { UnusualOptionsStats } from "@/lib/types/unusual-options";
import { cn } from "@/lib/utils";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Target,
  Activity,
  TrendingUp,
  Filter
} from "lucide-react";

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

// Helper function to get option type styling
function getOptionTypeColor(optionType: string) {
  return optionType === 'call' 
    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
    : 'bg-red-500/10 text-red-500 border-red-500/20';
}

// Helper function to get suspicion level based on grade and premium
function getSuspicionLevel(signal: UnusualOptionsSignal): string {
  const factors = [];
  
  if (signal.grade === 'S' || signal.grade === 'A') factors.push('High Conviction');
  if (signal.premium_flow && signal.premium_flow >= 5_000_000) factors.push('LARGE BET');
  if (signal.days_to_expiry && signal.days_to_expiry <= 7) factors.push('URGENT');
  if (signal.aggressive_order_pct && signal.aggressive_order_pct >= 70) factors.push('Aggressive'); // Database stores as percentage (0-100)
  if (signal.moneyness === 'ITM' || signal.moneyness === 'ATM') factors.push('Conviction');
  if (signal.has_sweep) factors.push('Sweep');
  if (signal.has_block_trade) factors.push('Block Trade');
  
  return factors.length > 0 ? factors.join(' | ') : 'Standard';
}

export default function UnusualOptionsScanner() {
  const [signals, setSignals] = useState<UnusualOptionsSignal[]>([]);
  const [stats, setStats] = useState<UnusualOptionsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters] = useState<UnusualOptionsFilters>({});
  const [sortConfig, setSortConfig] = useState<UnusualOptionsSortConfig>({
    field: "premium_flow",
    direction: "desc"
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<UnusualOptionsSignal | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setError(null);
      
      // Load signals and stats in parallel
      const [signalsResponse, statsData] = await Promise.all([
        fetchUnusualOptionsSignals({
          limit: 100,
          sortBy: sortConfig.field,
          sortOrder: sortConfig.direction,
          filters,
          searchTerm
        }),
        fetchUnusualOptionsStats()
      ]);

      if (signalsResponse.error) {
        setError(signalsResponse.error);
      } else {
        setSignals(signalsResponse.data);
      }
      
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load unusual options signals");
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
    const unsubscribe = subscribeToUnusualOptionsUpdates(
      (payload) => {
        console.log('Real-time update:', payload);
        loadData();
      }
    );

    return unsubscribe;
  }, [loadData]);

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
        const currentIndex = signals.findIndex(signal => signal.id === selectedSignal.id);
        
        if (currentIndex === -1) return;

        let nextIndex;
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : signals.length - 1;
        } else {
          nextIndex = currentIndex < signals.length - 1 ? currentIndex + 1 : 0;
        }

        const nextSignal = signals[nextIndex];
        if (nextSignal) {
          setSelectedSignal(nextSignal);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, selectedSignal, signals]);

  const handleSort = (field: keyof UnusualOptionsSignal) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const getSortIcon = (field: keyof UnusualOptionsSignal) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
    return sortConfig.direction === "desc" 
      ? <ArrowDown className="ml-1 h-4 w-4" /> 
      : <ArrowUp className="ml-1 h-4 w-4" />;
  };

  const handleRowClick = (signal: UnusualOptionsSignal) => {
    setSelectedSignal(signal);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedSignal(null);
  };

  const displaySignals = signals;

  if (loading) {
    return (
      <div className="flex flex-col gap-12">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Target className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-medium">Unusual Options Scanner</h1>
          </div>
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
          <Target className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-medium">Unusual Options Scanner</h1>
        </div>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2">
          <p>
            The <strong>unusual options scanner</strong> identifies suspicious options activity that might indicate 
            insider information or smart money positioning. This professional <em>trading tool</em> analyzes {" "}
            <strong>premium flow</strong>, <strong>volume anomalies</strong>, and <strong>open interest spikes</strong> to detect high-conviction signals.
          </p>
          <p>
            Deploy this <strong>insider detection system</strong> to spot large, concentrated bets before major moves; 
            these signals historically precede significant price movements. Perfect for {" "} 
            <em>institutional traders</em> and <em>sophisticated investors</em> seeking edge in options markets.
          </p>
        </div>
        
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>Live Signal Detection</span>
          </div>
          <Button 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
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
            <span className="font-medium">Active Insider Activity Detection</span>
          </div>
          <span className="text-xs text-muted-foreground" title="Options flow indicators">High Flow • Premium Tracking</span>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-caption text-muted-foreground">Total Signals</span>
              </div>
              <p className="text-lg font-medium mt-1">{stats.total_signals || 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <span className="text-caption text-muted-foreground">High Conviction</span>
              </div>
              <p className="text-lg font-medium mt-1">{stats.high_conviction_count || 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-caption text-muted-foreground">Calls</span>
              </div>
              <p className="text-lg font-medium mt-1">{stats.by_type?.calls || 0}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span className="text-caption text-muted-foreground">Puts</span>
              </div>
              <p className="text-lg font-medium mt-1">{stats.by_type?.puts || 0}</p>
            </Card>
          </div>
        )}
      </section>

      {/* Search and Filters */}
      <section className="flex flex-col sm:flex-row gap-4" aria-labelledby="search-section-title">
        <h2 id="search-section-title" className="sr-only">Search and Filter Options Signals</h2>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search tickers (e.g., AAPL, TSLA)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            aria-label="Search for stock tickers"
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
        <h2 id="signals-table-title" className="sr-only">Live Unusual Options Signals</h2>
        <div className="rounded-md border" role="region" aria-label="Options signals data table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("ticker")}
                >
                  <div className="flex items-center gap-2">
                    Ticker
                    {getSortIcon("ticker")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("grade")}
                >
                  <div className="flex items-center gap-2">
                    Grade
                    {getSortIcon("grade")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("premium_flow")}
                >
                  <div className="flex items-center gap-2">
                    Premium Flow
                    {getSortIcon("premium_flow")}
                  </div>
                </TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Suspicion Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySignals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="text-muted-foreground">
                      <p>No unusual options signals found</p>
                      <p className="text-sm">Try refreshing the data</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displaySignals.slice(0, 100).map((signal) => {
                  const suspicionLevel = getSuspicionLevel(signal);
                  const premiumDisplay = formatPremiumFlow(signal.premium_flow);
                  const isSelected = selectedSignal?.id === signal.id;
                  
                  return (
                    <TableRow 
                      key={signal.id}
                      className={cn(
                        "hover:bg-muted/50 cursor-pointer transition-colors",
                        isSelected && "bg-muted"
                      )}
                      onClick={() => handleRowClick(signal)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {signal.ticker}
                          {(signal.grade === 'S' || signal.grade === 'A') && (
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getGradeColor(signal.grade))}
                        >
                          {signal.grade}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-green-600">
                          {premiumDisplay}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getOptionTypeColor(signal.option_type))}
                          >
                            {signal.option_type === 'call' ? 'Call' : 'Put'}
                          </Badge>
                          <span className="text-sm">${safeParseNumber(signal.strike).toFixed(0)}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {suspicionLevel.split(' | ').slice(0, 1)[0] || 'Standard'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Signal Details Sidebar */}
      {sidebarOpen && selectedSignal && (
        <>
          {/* Backdrop */}
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
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(getYahooFinanceUrl(selectedSignal.ticker), '_blank')}
                      className="flex items-center gap-1.5 text-base font-semibold hover:text-blue-600 transition-colors cursor-pointer group"
                      title={`View ${selectedSignal.ticker} on Yahoo Finance`}
                    >
                      <span>{selectedSignal.ticker}</span>
                      <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {(selectedSignal.grade === 'S' || selectedSignal.grade === 'A') && (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                    )}
                  </div>
                  <Badge className={cn("text-xs", getGradeColor(selectedSignal.grade))}>
                    Grade {selectedSignal.grade}
                  </Badge>
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
                {/* Contract Details */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contract Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Option Type</p>
                      <p className="text-sm font-semibold capitalize">{selectedSignal.option_type}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Strike Price</p>
                      <p className="text-sm font-semibold">${safeParseNumber(selectedSignal.strike).toFixed(2)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Days to Expiry</p>
                      <p className="text-xs font-medium">{selectedSignal.days_to_expiry} days</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Moneyness</p>
                      <p className="text-xs font-medium">{selectedSignal.moneyness || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Signal Analysis */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signal Analysis</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Premium Flow</span>
                      <span className="text-xs font-semibold text-green-600">{formatPremiumFlow(selectedSignal.premium_flow)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Overall Score</span>
                      <span className="text-xs font-semibold">{(safeParseNumber(selectedSignal.overall_score) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Confidence</span>
                      <span className="text-xs font-semibold">{selectedSignal.confidence ? `${(selectedSignal.confidence * 100).toFixed(0)}%` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Risk Level</span>
                      <Badge variant="outline" className="text-xs h-5 px-2">
                        {selectedSignal.risk_level}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Volume & OI Analysis */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Volume & Open Interest</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Current Volume</span>
                      <span className="text-xs font-semibold">{selectedSignal.current_volume?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Average Volume</span>
                      <span className="text-xs font-medium">{selectedSignal.average_volume?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Volume Ratio</span>
                      <span className="text-xs font-medium">{selectedSignal.volume_ratio ? `${selectedSignal.volume_ratio.toFixed(1)}x` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Open Interest</span>
                      <span className="text-xs font-semibold">{selectedSignal.current_oi?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">OI Change</span>
                      <span className="text-xs font-medium">
                        {selectedSignal.oi_change_pct ? `${selectedSignal.oi_change_pct > 0 ? '+' : ''}${selectedSignal.oi_change_pct.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Detection Flags */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detection Flags</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedSignal.has_volume_anomaly && (
                      <Badge variant="secondary" className="text-xs">Volume Anomaly</Badge>
                    )}
                    {selectedSignal.has_oi_spike && (
                      <Badge variant="secondary" className="text-xs">OI Spike</Badge>
                    )}
                    {selectedSignal.has_premium_flow && (
                      <Badge variant="secondary" className="text-xs">Premium Flow</Badge>
                    )}
                    {selectedSignal.has_sweep && (
                      <Badge variant="secondary" className="text-xs">Sweep</Badge>
                    )}
                    {selectedSignal.has_block_trade && (
                      <Badge variant="secondary" className="text-xs">Block Trade</Badge>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Market Context */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Market Context</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Underlying Price</span>
                      <span className="text-xs font-semibold">${safeParseNumber(selectedSignal.underlying_price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Implied Volatility</span>
                      <span className="text-xs font-medium">{selectedSignal.implied_volatility ? `${(selectedSignal.implied_volatility * 100).toFixed(1)}%` : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Sentiment</span>
                      <span className="text-xs font-medium">{selectedSignal.sentiment || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Detection Time</span>
                      <span className="text-xs font-medium">
                        {new Date(selectedSignal.detection_timestamp).toLocaleString()}
                      </span>
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

