"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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
import type { 
  UnusualOptionsSignal, 
  UnusualOptionsFilters, 
  GroupedTickerSignals
} from "@/lib/types/unusual-options";
import { 
  formatPremiumFlow, 
  getGradeColor, 
  groupSignalsByTicker,
  createAggregatedSummary,
  groupSignalsByStrike,
  groupSignalsByExpiry,
  groupSignalsByDate,
  getSpreadBadgeColor,
  formatSpreadType,
  formatSpreadConfidence
} from "@/lib/types/unusual-options";
import { fetchUnusualOptionsSignals, subscribeToUnusualOptionsUpdates } from "@/lib/api/unusual-options";
import type { UnusualOptionsStats } from "@/lib/types/unusual-options";
import { cn } from "@/lib/utils";
import { 
  formatDateEST, 
  formatTimeEST, 
  toLocaleStringEST,
  formatDateWithWeekdayEST
} from "@/lib/utils/timezone";
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
import { PriceChart } from "@/components/unusual-options/price-chart";
import { FilterPanel } from "@/components/unusual-options/filters";

// Helper function to generate Yahoo Finance URL
function getYahooFinanceUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${symbol}`;
}

export default function UnusualOptionsScanner() {
  const [groupedTickers, setGroupedTickers] = useState<GroupedTickerSignals[]>([]);
  const [stats, setStats] = useState<UnusualOptionsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<UnusualOptionsFilters>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ 
    field: keyof GroupedTickerSignals; 
    direction: "asc" | "desc" 
  }>({
    field: "totalPremiumFlow",
    direction: "desc"
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<GroupedTickerSignals | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'strikes' | 'expiries' | 'timeline' | 'all'>('overview');
  const [expandedStrike, setExpandedStrike] = useState<number | null>(null);
  const [expandedExpiry, setExpandedExpiry] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setError(null);
      
      // Load signals with filters applied
      const signalsResponse = await fetchUnusualOptionsSignals({
        limit: 5000, // High limit to capture all active signals
        sortBy: 'premium_flow' as keyof UnusualOptionsSignal,
        sortOrder: 'desc',
        filters,
        searchTerm
      });

      if (signalsResponse.error) {
        setError(signalsResponse.error);
      } else {
        // Group signals by ticker
        const grouped = groupSignalsByTicker(signalsResponse.data);
        
        // Sort grouped data
        const sorted = [...grouped].sort((a, b) => {
          const aVal = a[sortConfig.field];
          const bVal = b[sortConfig.field];
          
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'desc' ? bVal - aVal : aVal - bVal;
          }
          
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortConfig.direction === 'desc' 
              ? bVal.localeCompare(aVal) 
              : aVal.localeCompare(bVal);
          }
          
          return 0;
        });
        
        setGroupedTickers(sorted);
        
        // Calculate stats from filtered signals instead of separate API call
        // This ensures stats reflect the current filters
        const filteredStats = calculateStatsFromSignals(signalsResponse.data);
        setStats(filteredStats);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      setError("Failed to load unusual options signals");
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, [sortConfig, filters, searchTerm]);

  // Helper function to calculate stats from filtered signals
  const calculateStatsFromSignals = (
    signals: UnusualOptionsSignal[]
  ): UnusualOptionsStats => {
    if (signals.length === 0) {
      return {
        total_signals: 0,
        by_grade: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
        by_type: { calls: 0, puts: 0 },
        by_risk: { LOW: 0, MEDIUM: 0, HIGH: 0, EXTREME: 0 },
        total_premium_flow: 0,
        average_score: 0,
        latest_detection_date: new Date().toISOString().split('T')[0],
        high_conviction_count: 0
      };
    }

    const by_grade = {
      S: signals.filter(s => s.grade === 'S').length,
      A: signals.filter(s => s.grade === 'A').length,
      B: signals.filter(s => s.grade === 'B').length,
      C: signals.filter(s => s.grade === 'C').length,
      D: signals.filter(s => s.grade === 'D').length,
      F: signals.filter(s => s.grade === 'F').length,
    };

    const by_type = {
      calls: signals.filter(s => s.option_type === 'call').length,
      puts: signals.filter(s => s.option_type === 'put').length,
    };

    const by_risk = {
      LOW: signals.filter(s => s.risk_level === 'LOW').length,
      MEDIUM: signals.filter(s => s.risk_level === 'MEDIUM').length,
      HIGH: signals.filter(s => s.risk_level === 'HIGH').length,
      EXTREME: signals.filter(s => s.risk_level === 'EXTREME').length,
    };

    const total_premium_flow = signals.reduce(
      (sum, s) => sum + (s.premium_flow || 0), 
      0
    );

    const average_score = signals.reduce(
      (sum, s) => sum + (s.overall_score || 0), 
      0
    ) / signals.length;

    const latest_detection_date = signals
      .map(s => s.detection_timestamp)
      .sort()
      .reverse()[0]?.split('T')[0] || new Date().toISOString().split('T')[0];

    const high_conviction_count = by_grade.S + by_grade.A;

    return {
      total_signals: signals.length,
      by_grade,
      by_type,
      by_risk,
      total_premium_flow,
      average_score,
      latest_detection_date,
      high_conviction_count
    };
  };

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
      if (!sidebarOpen || !selectedTicker) return;

      if (e.key === 'Escape') {
        closeSidebar();
        return;
      }

      // Navigate between tickers with arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        
        const currentIndex = groupedTickers.findIndex(
          t => t.ticker === selectedTicker.ticker
        );
        
        if (currentIndex === -1) return;
        
        let nextIndex: number;
        if (e.key === 'ArrowUp') {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : groupedTickers.length - 1;
        } else {
          nextIndex = currentIndex < groupedTickers.length - 1 ? currentIndex + 1 : 0;
        }
        
        const nextTicker = groupedTickers[nextIndex];
        if (nextTicker) {
          setSelectedTicker(nextTicker);
          setActiveTab('overview');
          setExpandedStrike(null);
          setExpandedExpiry(null);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, selectedTicker, groupedTickers]);

  const handleSort = (field: keyof GroupedTickerSignals) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc"
    }));
  };

  const getSortIcon = (field: keyof GroupedTickerSignals) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="ml-1 h-4 w-4" />;
    return sortConfig.direction === "desc" 
      ? <ArrowDown className="ml-1 h-4 w-4" /> 
      : <ArrowUp className="ml-1 h-4 w-4" />;
  };

  const handleRowClick = (tickerGroup: GroupedTickerSignals) => {
    setSelectedTicker(tickerGroup);
    setActiveTab('overview'); // Default to overview
    setExpandedStrike(null);
    setExpandedExpiry(null);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedTicker(null);
    setActiveTab('overview');
    setExpandedStrike(null);
    setExpandedExpiry(null);
  };

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-blue-500" />
              <span className="text-caption text-muted-foreground">Unique Tickers</span>
            </div>
            <p className="text-lg font-medium mt-1">{groupedTickers.length || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-caption text-muted-foreground">Total Signals</span>
            </div>
            <p className="text-lg font-medium mt-1">{stats?.total_signals || 0}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span className="text-caption text-muted-foreground">High Conviction</span>
            </div>
            <p className="text-lg font-medium mt-1">
              {groupedTickers.filter(t => t.hasHighConviction).length || 0}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-caption text-muted-foreground">Total Premium</span>
            </div>
            <p className="text-lg font-medium mt-1">
              {formatPremiumFlow(
                stats?.total_premium_flow || groupedTickers.reduce((sum, t) => sum + t.totalPremiumFlow, 0)
              )}
            </p>
          </Card>
        </div>
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setFilterPanelOpen(true)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {Object.keys(filters).filter(
              k => filters[k as keyof UnusualOptionsFilters] !== undefined
            ).length > 0 && (
              <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full h-4 w-4 flex items-center justify-center">
                {Object.keys(filters).filter(
                  k => filters[k as keyof UnusualOptionsFilters] !== undefined
                ).length}
              </span>
            )}
          </Button>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <p className="text-sm text-destructive">{error}</p>
        </section>
      )}

      {/* Grouped Tickers Table */}
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
                  onClick={() => handleSort("highestGrade")}
                >
                  <div className="flex items-center gap-2">
                    Grade
                    {getSortIcon("highestGrade")}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("totalPremiumFlow")}
                >
                  <div className="flex items-center gap-2">
                    Premium Flow
                    {getSortIcon("totalPremiumFlow")}
                  </div>
                </TableHead>
                <TableHead>Contract Split</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("signalCount")}
                >
                  <div className="flex items-center gap-2">
                    Signals
                    {getSortIcon("signalCount")}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedTickers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="text-muted-foreground">
                      <p>No unusual options signals found</p>
                      <p className="text-sm">Try refreshing the data</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedTickers.slice(0, 100).map((tickerGroup) => {
                  const premiumDisplay = formatPremiumFlow(
                    tickerGroup.totalPremiumFlow
                  );
                  const isSelected = selectedTicker?.ticker === tickerGroup.ticker;
                  
                  return (
                    <TableRow 
                      key={tickerGroup.ticker}
                      className={cn(
                        "hover:bg-muted/50 cursor-pointer transition-colors",
                        isSelected && "bg-muted"
                      )}
                      onClick={() => handleRowClick(tickerGroup)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {tickerGroup.ticker}
                          {tickerGroup.hasHighConviction && (
                            <div className="h-2 w-2 rounded-full bg-green-500" 
                              title="High Conviction Signal"></div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs", 
                            getGradeColor(tickerGroup.highestGrade)
                          )}
                        >
                          {tickerGroup.highestGrade}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-medium text-green-600">
                          {premiumDisplay}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={cn(
                            "flex items-center gap-1",
                            tickerGroup.callCount > 0 && "text-green-600"
                          )}>
                            {tickerGroup.callCount}C
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span className={cn(
                            "flex items-center gap-1",
                            tickerGroup.putCount > 0 && "text-red-600"
                          )}>
                            {tickerGroup.putCount}P
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {tickerGroup.signalCount} signal{tickerGroup.signalCount !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => loadData(true)}
      />

      {/* Signal Details Sidebar */}
      {sidebarOpen && selectedTicker && (() => {
        const summary = createAggregatedSummary(selectedTicker.signals);
        const strikeGroups = groupSignalsByStrike(selectedTicker.signals);
        const expiryGroups = groupSignalsByExpiry(selectedTicker.signals);
        const dateGroups = groupSignalsByDate(selectedTicker.signals);

        return (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/10 z-40"
              onClick={closeSidebar}
            />
            
            {/* Sidebar */}
            <div className={cn(
              "fixed top-0 right-0 h-full w-full sm:w-[480px] bg-background border-l border-border z-50",
              "rounded-l-xl shadow-2xl flex flex-col",
              "transform transition-all duration-200 ease-out",
              sidebarOpen ? "translate-x-0" : "translate-x-full"
            )}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  {/* Navigation Arrows */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentIndex = groupedTickers.findIndex(
                          t => t.ticker === selectedTicker.ticker
                        );
                        const prevIndex = currentIndex > 0 
                          ? currentIndex - 1 
                          : groupedTickers.length - 1;
                        const prevTicker = groupedTickers[prevIndex];
                        if (prevTicker) {
                          setSelectedTicker(prevTicker);
                          setActiveTab('overview');
                          setExpandedStrike(null);
                          setExpandedExpiry(null);
                        }
                      }}
                      className="h-4 w-5 p-0 hover:bg-muted"
                      title="Previous ticker (↑)"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const currentIndex = groupedTickers.findIndex(
                          t => t.ticker === selectedTicker.ticker
                        );
                        const nextIndex = currentIndex < groupedTickers.length - 1 
                          ? currentIndex + 1 
                          : 0;
                        const nextTicker = groupedTickers[nextIndex];
                        if (nextTicker) {
                          setSelectedTicker(nextTicker);
                          setActiveTab('overview');
                          setExpandedStrike(null);
                          setExpandedExpiry(null);
                        }
                      }}
                      className="h-4 w-5 p-0 hover:bg-muted"
                      title="Next ticker (↓)"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(
                        getYahooFinanceUrl(selectedTicker.ticker), 
                        '_blank'
                      )}
                      className="flex items-center gap-1.5 text-base font-semibold hover:text-blue-600 transition-colors cursor-pointer group"
                      title={`View ${selectedTicker.ticker} on Yahoo Finance`}
                    >
                      <span>{selectedTicker.ticker}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button
                      onClick={() => window.open(
                        `https://robinhood.com/stocks/${selectedTicker.ticker}`,
                        '_blank'
                      )}
                      className="flex items-center hover:scale-110 transition-transform"
                      title={`Trade ${selectedTicker.ticker} on Robinhood`}
                    >
                      <Image 
                        src="/logos/robinhood-svgrepo-com.svg" 
                        alt="Robinhood" 
                        width={16}
                        height={16}
                        className="opacity-70 hover:opacity-100 transition-opacity"
                      />
                    </button>
                    {selectedTicker.hasHighConviction && (
                      <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                    )}
                  </div>
                  <Badge className={cn(
                    "text-xs", 
                    getGradeColor(selectedTicker.highestGrade)
                  )}>
                    {selectedTicker.highestGrade}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {selectedTicker.signalCount}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={closeSidebar}>
                  ✕
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex items-center px-4 py-2 border-b border-border/50 shrink-0 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all relative",
                    activeTab === 'overview'
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Overview
                  {activeTab === 'overview' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('strikes')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all relative",
                    activeTab === 'strikes'
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  By Strike
                  {activeTab === 'strikes' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('expiries')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all relative",
                    activeTab === 'expiries'
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  By Expiry
                  {activeTab === 'expiries' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all relative",
                    activeTab === 'timeline'
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Timeline
                  {activeTab === 'timeline' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-all relative",
                    activeTab === 'all'
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Signals
                  {activeTab === 'all' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Total Premium Flow
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          {formatPremiumFlow(summary.totalPremiumFlow)}
                        </div>
                      </Card>
                      <Card className="p-3 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Sentiment
                        </div>
                        <div className={cn(
                          "text-lg font-bold",
                          summary.dominantSentiment === 'BULLISH' 
                            ? 'text-green-600' 
                            : summary.dominantSentiment === 'BEARISH'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        )}>
                          {summary.dominantSentiment}
                        </div>
                      </Card>
                      <Card className="p-3 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Call/Put Split
                        </div>
                        <div className="text-sm font-semibold">
                          <span className="text-green-600">
                            {summary.callCount}C
                          </span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-red-600">
                            {summary.putCount}P
                          </span>
                        </div>
                      </Card>
                      <Card className="p-3 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          High Conviction
                        </div>
                        <div className="text-lg font-bold text-purple-600">
                          {summary.highConvictionCount}
                        </div>
                      </Card>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Top Strikes */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">
                        Most Active Strikes
                      </h3>
                      <div className="space-y-1.5">
                        {summary.topStrikes.slice(0, 5).map((strike) => (
                          <div 
                            key={strike.strike}
                            className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm border border-transparent hover:border-border/50"
                            onClick={() => {
                              setActiveTab('strikes');
                              setExpandedStrike(strike.strike);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                ${strike.strike}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] font-medium rounded-full px-1.5 py-0", 
                                  getGradeColor(strike.highestGrade)
                                )}
                              >
                                {strike.highestGrade}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {strike.callCount}C/{strike.putCount}P
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-green-600">
                                {formatPremiumFlow(strike.totalPremiumFlow)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {strike.signalCount}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Top Expiries */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">
                        Most Active Expiries
                      </h3>
                      <div className="space-y-1.5">
                        {summary.topExpiries.slice(0, 5).map((expiry) => (
                          <div 
                            key={expiry.expiry}
                            className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm border border-transparent hover:border-border/50"
                            onClick={() => {
                              setActiveTab('expiries');
                              setExpandedExpiry(expiry.expiry);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {formatDateEST(expiry.expiry)}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {expiry.daysToExpiry}d
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">
                                •
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {expiry.callCount}C/{expiry.putCount}P
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-green-600">
                                {formatPremiumFlow(expiry.totalPremiumFlow)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {expiry.signalCount}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Detection Flags Summary */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">
                        Detection Patterns
                      </h3>
                      <div className="grid grid-cols-2 gap-1.5">
                        {summary.detectionFlags.volumeAnomaly > 0 && (
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/30">
                            <span className="text-[10px] font-medium">Vol Anomaly</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold rounded-full">
                              {summary.detectionFlags.volumeAnomaly}
                            </Badge>
                          </div>
                        )}
                        {summary.detectionFlags.oiSpike > 0 && (
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/30">
                            <span className="text-[10px] font-medium">OI Spike</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold rounded-full">
                              {summary.detectionFlags.oiSpike}
                            </Badge>
                          </div>
                        )}
                        {summary.detectionFlags.premiumFlow > 0 && (
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/30">
                            <span className="text-[10px] font-medium">Premium Flow</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold rounded-full">
                              {summary.detectionFlags.premiumFlow}
                            </Badge>
                          </div>
                        )}
                        {summary.detectionFlags.sweep > 0 && (
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/30">
                            <span className="text-[10px] font-medium">Sweep</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold rounded-full">
                              {summary.detectionFlags.sweep}
                            </Badge>
                          </div>
                        )}
                        {summary.detectionFlags.blockTrade > 0 && (
                          <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/30">
                            <span className="text-[10px] font-medium">Block Trade</span>
                            <Badge variant="secondary" className="text-[10px] font-semibold rounded-full">
                              {summary.detectionFlags.blockTrade}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Time Range */}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">Time Range</h3>
                      <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/20 p-2.5 rounded-lg border border-border/30">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">First:</span>
                          <span>{toLocaleStringEST(
                            summary.dateRange.earliest
                          )}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Latest:</span>
                          <span>{toLocaleStringEST(
                            summary.dateRange.latest
                          )}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* By Strike Tab */}
                {activeTab === 'strikes' && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-foreground tracking-tight mb-2">
                      Signals Grouped by Strike Price
                    </h3>
                    {strikeGroups.map((strike) => (
                      <div key={strike.strike} className="border border-border/50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <button
                          onClick={() => setExpandedStrike(
                            expandedStrike === strike.strike 
                              ? null 
                              : strike.strike
                          )}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-base">
                              ${strike.strike}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs font-medium rounded-full", 
                                getGradeColor(strike.highestGrade)
                              )}
                            >
                              {strike.highestGrade}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-medium">
                              {strike.callCount}C / {strike.putCount}P
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-green-600">
                              {formatPremiumFlow(strike.totalPremiumFlow)}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {strike.signalCount}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {expandedStrike === strike.strike ? '▼' : '▶'}
                            </span>
                          </div>
                        </button>
                        {expandedStrike === strike.strike && (
                          <div className="border-t border-border/50 p-4 space-y-2 bg-muted/5">
                            {strike.signals.slice(0, 10).map((signal) => (
                              <div 
                                key={signal.signal_id}
                                className="p-3 bg-background rounded-lg border border-border/50 text-xs space-y-1.5 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium capitalize">
                                    {signal.option_type}
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    {formatPremiumFlow(signal.premium_flow)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>
                                    {signal.days_to_expiry}d to expiry
                                  </span>
                                  <span>
                                    Score: {(
                                      signal.overall_score * 100
                                    ).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                            {strike.signalCount > 10 && (
                              <div className="text-xs text-center text-muted-foreground pt-2">
                                +{strike.signalCount - 10} more signals
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* By Expiry Tab */}
                {activeTab === 'expiries' && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-foreground tracking-tight mb-2">
                      Signals Grouped by Expiration Date
                    </h3>
                    {expiryGroups.map((expiry) => (
                      <div key={expiry.expiry} className="border border-border/50 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <button
                          onClick={() => setExpandedExpiry(
                            expandedExpiry === expiry.expiry 
                              ? null 
                              : expiry.expiry
                          )}
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-base">
                              {formatDateEST(expiry.expiry)}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {expiry.daysToExpiry}d
                            </span>
                            <span className="text-xs text-muted-foreground/50">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {expiry.callCount}C / {expiry.putCount}P
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-green-600">
                              {formatPremiumFlow(expiry.totalPremiumFlow)}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {expiry.signalCount}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {expandedExpiry === expiry.expiry ? '▼' : '▶'}
                            </span>
                          </div>
                        </button>
                        {expandedExpiry === expiry.expiry && (
                          <div className="border-t border-border/50 p-4 space-y-2 bg-muted/5">
                            {expiry.signals.slice(0, 10).map((signal) => (
                              <div 
                                key={signal.signal_id}
                                className="p-3 bg-background rounded-lg border border-border/50 text-xs space-y-1.5 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    ${signal.strike} {signal.option_type}
                                  </span>
                                  <span className="font-semibold text-green-600">
                                    {formatPremiumFlow(signal.premium_flow)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>{signal.moneyness || 'N/A'}</span>
                                  <span>
                                    Score: {(
                                      signal.overall_score * 100
                                    ).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                            {expiry.signalCount > 10 && (
                              <div className="text-xs text-center text-muted-foreground pt-2">
                                +{expiry.signalCount - 10} more signals
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline Tab (with Chart) */}
                {activeTab === 'timeline' && (
                  <div className="space-y-6">
                    {/* Price Chart */}
                    <PriceChart 
                      ticker={selectedTicker.ticker} 
                      signals={selectedTicker.signals}
                      onSignalClick={(signalId) => {
                        // Scroll directly to the signal (no expansion needed)
                        const element = document.getElementById(
                          `signal-${signalId}`
                        );
                        if (element) {
                          element.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'center' 
                          });
                          
                          // Flash highlight with ring and background
                          element.classList.add(
                            'ring-2', 
                            'ring-primary',
                            'bg-primary/5'
                          );
                          
                          setTimeout(() => {
                            element.classList.remove(
                              'ring-2', 
                              'ring-primary',
                              'bg-primary/5'
                            );
                          }, 2000);
                        }
                      }}
                    />
                    
                    <Separator />
                    
                    {/* Timeline Table - Flat List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">
                        Signal Details ({selectedTicker.signalCount})
                      </h3>
                      
                      {/* Flat list with date headers */}
                      <div className="space-y-2">
                        {dateGroups.map((dateGroup) => (
                          <div key={dateGroup.date} className="space-y-2">
                            {/* Date Header */}
                            <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 border-b border-border/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">
                                    {formatDateWithWeekdayEST(dateGroup.date)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {dateGroup.callCount}C / {dateGroup.putCount}P
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-green-600">
                                    {formatPremiumFlow(dateGroup.totalPremiumFlow)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {dateGroup.signalCount} signal{dateGroup.signalCount > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Signal Cards */}
                            <div className="space-y-1.5">
                              {dateGroup.signals.map((signal) => (
                                <div 
                                  key={signal.signal_id}
                                  id={`signal-${signal.signal_id}`}
                                  className="p-3 bg-muted/10 hover:bg-muted/20 rounded-lg border border-border/30 text-xs space-y-1.5 transition-all scroll-mt-20 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm">
                                        ${signal.strike}
                                      </span>
                                      <span className={cn(
                                        "text-xs font-medium capitalize",
                                        signal.option_type === 'call' 
                                          ? 'text-green-500' 
                                          : 'text-red-500'
                                      )}>
                                        {signal.option_type}
                                      </span>
                                      <Badge className={cn(
                                        "text-[9px] px-1.5 py-0 h-4",
                                        getGradeColor(signal.grade)
                                      )}>
                                        {signal.grade}
                                      </Badge>
                                    </div>
                                    <span className="text-xs font-semibold text-green-600">
                                      {formatPremiumFlow(signal.premium_flow)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {formatTimeEST(signal.detection_timestamp)}
                                    </span>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span>
                                        {signal.days_to_expiry}d to expiry
                                      </span>
                                    </div>
                                    <span>
                                      Score: {(signal.overall_score * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  
                                  {/* Moneyness and Volume indicators */}
                                  {signal.moneyness && (
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground/70">
                                        {signal.moneyness}
                                      </span>
                                      {signal.has_sweep && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">
                                          Sweep
                                        </span>
                                      )}
                                      {signal.has_block_trade && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                          Block
                                        </span>
                                      )}
                                      {/* Spread Detection Badge */}
                                      {signal.is_likely_spread && signal.spread_confidence && (
                                        <span 
                                          className={cn(
                                            "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1",
                                            getSpreadBadgeColor(signal.spread_confidence)
                                          )}
                                          title={signal.spread_detection_reason || undefined}
                                        >
                                          ⚠️ {formatSpreadType(signal.spread_type)} ({formatSpreadConfidence(signal.spread_confidence)})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* All Signals Tab */}
                {activeTab === 'all' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-foreground tracking-tight">
                        All Signals ({selectedTicker.signalCount})
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Top 20 by premium flow
                      </span>
                    </div>
                    <div className="space-y-2">
                      {selectedTicker.signals.slice(0, 20).map((signal) => (
                        <div 
                          key={signal.signal_id}
                          className="p-3 border border-border/50 rounded-lg hover:bg-muted/20 transition-all space-y-2 shadow-sm hover:shadow-md"
                        >
                          {/* Header Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                ${signal.strike}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {signal.option_type}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] font-medium rounded-full", 
                                  getGradeColor(signal.grade)
                                )}
                              >
                                {signal.grade}
                              </Badge>
                            </div>
                            <span className="text-sm font-bold text-green-600">
                              {formatPremiumFlow(signal.premium_flow)}
                            </span>
                          </div>

                          {/* Quick Stats Grid */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-muted/30 rounded-lg border border-border/30">
                              <div className="text-[10px] text-muted-foreground font-medium mb-0.5">
                                Score
                              </div>
                              <div className="font-bold text-xs">
                                {(signal.overall_score * 100).toFixed(0)}%
                              </div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded-lg border border-border/30">
                              <div className="text-[10px] text-muted-foreground font-medium mb-0.5">
                                Expiry
                              </div>
                              <div className="font-bold text-xs">
                                {signal.days_to_expiry}d
                              </div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded-lg border border-border/30">
                              <div className="text-[10px] text-muted-foreground font-medium mb-0.5">
                                Vol Ratio
                              </div>
                              <div className="font-bold text-xs">
                                {signal.volume_ratio 
                                  ? `${signal.volume_ratio.toFixed(1)}x` 
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>

                          {/* Detection Flags */}
                          {(signal.has_volume_anomaly || 
                            signal.has_oi_spike || 
                            signal.has_sweep || 
                            signal.has_block_trade ||
                            signal.is_likely_spread) && (
                            <div className="flex flex-wrap gap-1">
                              {signal.has_volume_anomaly && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] font-medium rounded-full"
                                >
                                  Vol Anomaly
                                </Badge>
                              )}
                              {signal.has_oi_spike && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] font-medium rounded-full"
                                >
                                  OI Spike
                                </Badge>
                              )}
                              {signal.has_sweep && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] font-medium rounded-full"
                                >
                                  Sweep
                                </Badge>
                              )}
                              {signal.has_block_trade && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-[10px] font-medium rounded-full"
                                >
                                  Block
                                </Badge>
                              )}
                              {/* Spread Detection Warning */}
                              {signal.is_likely_spread && signal.spread_confidence && (
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] font-medium rounded-full",
                                    getSpreadBadgeColor(signal.spread_confidence)
                                  )}
                                  title={signal.spread_detection_reason || undefined}
                                >
                                  ⚠️ {formatSpreadType(signal.spread_type)} ({formatSpreadConfidence(signal.spread_confidence)})
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Detection Time */}
                          <div className="text-[10px] text-muted-foreground font-medium pt-0.5 border-t border-border/30">
                            {toLocaleStringEST(signal.detection_timestamp)} EST
                          </div>
                        </div>
                      ))}
                      {selectedTicker.signalCount > 20 && (
                        <div className="text-xs text-center text-muted-foreground p-3 border border-border/50 rounded-lg bg-muted/20">
                          <p className="font-medium">Showing top 20 of {selectedTicker.signalCount} signals</p>
                          <p className="text-[10px] mt-1">Use other tabs to explore all signals grouped by strike, expiry, or timeline</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
