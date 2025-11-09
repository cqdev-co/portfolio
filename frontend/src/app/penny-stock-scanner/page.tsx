"use client";

import { 
  useState, 
  useEffect, 
  useCallback 
} from "react";
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
  PennyStockSignal, 
  PennyStockFilters, 
  PennyStockSortConfig 
} from "@/lib/types/penny-stock";
import { 
  fetchPennyStockSignals, 
  fetchPennyStockStats, 
  subscribeToPennyStockUpdates,
  type PennyStockStats 
} from "@/lib/api/penny-stock-signals";
import { cn } from "@/lib/utils";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Filter, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  RefreshCw, 
  ExternalLink,
  DollarSign,
  Target,
  Zap
} from "lucide-react";

// Helper function to safely parse numeric values
function safeParseNumber(
  value: string | number | null | undefined
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function to format dollar volume
function formatDollarVolume(amount: number | null): string {
  if (!amount || amount === 0) return "-";
  
  const absAmount = Math.abs(amount);
  
  // Handle millions (1M+)
  const millions = absAmount / 1_000_000;
  if (millions >= 1) {
    return `$${millions.toFixed(2)}M`;
  }
  
  // Handle thousands (1K+)
  const thousands = absAmount / 1_000;
  if (thousands >= 1) {
    return `$${thousands.toFixed(1)}K`;
  }
  
  // Handle smaller amounts (< 1K)
  return `$${absAmount.toFixed(0)}`;
}

// Helper function to generate Yahoo Finance URL
function getYahooFinanceUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${symbol}`;
}

function getOpportunityRankColor(rank: string) {
  switch (rank) {
    case "S":
      return "bg-purple-600 text-white hover:bg-purple-700";
    case "A":
      return "bg-green-600 text-white hover:bg-green-700";
    case "B":
      return "bg-blue-600 text-white hover:bg-blue-700";
    case "C":
      return "bg-yellow-600 text-white hover:bg-yellow-700";
    case "D":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getSignalStatusColor(status: string) {
  switch (status) {
    case "NEW":
      return "bg-green-100 text-green-800 dark:bg-green-900 " + 
        "dark:text-green-200";
    case "CONTINUING":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 " + 
        "dark:text-blue-200";
    case "ENDED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 " + 
        "dark:text-gray-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function getRiskLevelColor(risk: string) {
  switch (risk) {
    case "LOW":
      return "bg-green-100 text-green-800 dark:bg-green-900 " + 
        "dark:text-green-200";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 " + 
        "dark:text-yellow-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 " + 
        "dark:text-orange-200";
    case "EXTREME":
      return "bg-red-100 text-red-800 dark:bg-red-900 " + 
        "dark:text-red-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

export default function PennyStockScanner() {
  const [signals, setSignals] = useState<PennyStockSignal[]>([]);
  const [stats, setStats] = useState<PennyStockStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters] = useState<PennyStockFilters>({});
  const [sortConfig, setSortConfig] = 
    useState<PennyStockSortConfig>({
      field: "overall_score",
      direction: "desc"
    });
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = 
    useState<PennyStockSignal | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load data
  const loadData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      try {
        setError(null);
        
        // Load signals and stats in parallel
        const today = new Date().toISOString().split("T")[0];
        const [signalsResponse, statsData] = await Promise.all([
          fetchPennyStockSignals({
            limit: 100,
            sortBy: sortConfig.field,
            sortOrder: sortConfig.direction,
            filters: { ...filters, scan_date: today },
            searchTerm
          }),
          fetchPennyStockStats()
        ]);

        if (signalsResponse.error) {
          setError(signalsResponse.error);
        } else {
          setSignals(signalsResponse.data);
        }
        
        setStats(statsData);
      } catch (error) {
        console.error("Failed to load data:", error);
        setError("Failed to load penny stock signals");
      } finally {
        setLoading(false);
        if (showRefreshing) setRefreshing(false);
      }
    },
    [sortConfig, filters, searchTerm]
  );

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time updates
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const unsubscribe = subscribeToPennyStockUpdates(
      (payload) => {
        console.log("Real-time update:", payload);
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

      if (e.key === "Escape") {
        closeSidebar();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = displaySignals.findIndex(
          (signal) => signal.id === selectedSignal.id
        );
        
        if (currentIndex === -1) return;

        let nextIndex;
        if (e.key === "ArrowUp") {
          nextIndex = currentIndex > 0 
            ? currentIndex - 1 
            : displaySignals.length - 1;
        } else {
          nextIndex = currentIndex < displaySignals.length - 1 
            ? currentIndex + 1 
            : 0;
        }

        const nextSignal = displaySignals[nextIndex];
        if (nextSignal) {
          setSelectedSignal(nextSignal);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, selectedSignal, displaySignals]);

  const handleSort = (field: keyof PennyStockSignal) => {
    setSortConfig((prev) => ({
      field,
      direction: 
        prev.field === field && prev.direction === "desc" 
          ? "asc" 
          : "desc"
    }));
  };

  const getSortIcon = (field: keyof PennyStockSignal) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "desc" ? 
      <ArrowDown className="h-4 w-4" /> : 
      <ArrowUp className="h-4 w-4" />;
  };

  const handleRowClick = (signal: PennyStockSignal) => {
    setSelectedSignal(signal);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setTimeout(() => setSelectedSignal(null), 300);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-12">
        <section>
          <h1 className="text-2xl font-medium mb-3">
            Penny Stock Scanner
          </h1>
          <Separator className="mb-4" />
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 
              border-b-2 border-primary"></div>
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
          <Zap 
            className="h-6 w-6 text-primary" 
            aria-hidden="true" 
          />
          <h1 className="text-2xl font-medium">
            Professional Penny Stock Scanner
          </h1>
        </div>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2">
          <p>
            The <strong>penny stock explosion scanner</strong> identifies 
            low-priced stocks showing consolidation patterns and volume 
            surges that historically precede 50-200%+ moves. This 
            professional <em>stock scanner</em> uses {" "}
            <strong>volume analysis (50% weight)</strong>, {" "}
            <strong>consolidation detection</strong>, and {" "}
            <strong>breakout confirmation</strong> to spot explosive 
            setups before they move.
          </p>
          <p>
            Deploy this <strong>trading tool</strong> to find penny 
            stocks breaking out of tight consolidation with strong 
            volume; these patterns deliver exceptional risk/reward 
            opportunities. Perfect for {" "}
            <em>day traders</em> and <em>swing traders</em> seeking 
            explosive penny stock opportunities under $5.
          </p>
        </div>
      </header>

      {/* Market Conditions & Stats */}
      <section 
        className="space-y-4" 
        aria-labelledby="market-conditions-title"
      >
        <h2 id="market-conditions-title" className="sr-only">
          Market Conditions and Statistics
        </h2>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div 
              className="h-2 w-2 rounded-full bg-green-500" 
              aria-hidden="true"
            ></div>
            <span className="text-muted-foreground">
              Current Market Conditions:
            </span>
            <span className="font-medium">
              Active Penny Stock Scanning
            </span>
          </div>
          <span 
            className="text-xs text-muted-foreground" 
            title="Scanner status"
          >
            Explosion Setups • Volume Focus
          </span>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500">
              </div>
              <span className="text-caption text-muted-foreground">
                Total Signals
              </span>
            </div>
            <p className="text-lg font-medium mt-1">
              {stats?.total_signals || 0}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-purple-500" />
              <span className="text-caption text-muted-foreground">
                Breakouts
              </span>
            </div>
            <p className="text-lg font-medium mt-1">
              {stats?.breakout_count || 0}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-blue-500" />
              <span className="text-caption text-muted-foreground">
                Consolidating
              </span>
            </div>
            <p className="text-lg font-medium mt-1">
              {stats?.consolidation_count || 0}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-green-500" />
              <span className="text-caption text-muted-foreground">
                Avg Vol Ratio
              </span>
            </div>
            <p className="text-lg font-medium mt-1">
              {stats?.avg_volume_ratio.toFixed(1)}x
            </p>
          </Card>
        </div>
      </section>

      {/* Search and Filters */}
      <section 
        className="flex flex-col sm:flex-row gap-4" 
        aria-labelledby="search-section-title"
      >
        <h2 id="search-section-title" className="sr-only">
          Search and Filter Stock Signals
        </h2>
        <div className="relative flex-1">
          <Search 
            className="absolute left-3 top-1/2 transform 
              -translate-y-1/2 h-4 w-4 text-muted-foreground" 
            aria-hidden="true" 
          />
          <Input
            placeholder="Search stock symbols (e.g., AEMD, SNDL)..."
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
            <RefreshCw 
              className={cn(
                "h-4 w-4", 
                refreshing && "animate-spin"
              )} 
            />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section 
          className="bg-destructive/10 border border-destructive/20 
            rounded-md p-4"
        >
          <p className="text-sm text-destructive">{error}</p>
        </section>
      )}

      {/* Signals Table */}
      <section aria-labelledby="signals-table-title">
        <h2 id="signals-table-title" className="sr-only">
          Live Penny Stock Signals
        </h2>
        <div 
          className="rounded-md border" 
          role="region" 
          aria-label="Penny stock signals data table"
        >
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
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySignals.map((signal) => (
                <TableRow 
                  key={signal.id} 
                  className="hover:bg-muted/50 cursor-pointer 
                    transition-colors"
                  onClick={() => handleRowClick(signal)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {signal.symbol}
                      {signal.is_breakout && (
                        <Zap 
                          className="h-3 w-3 text-yellow-500" 
                          title="Breakout" 
                        />
                      )}
                      {signal.is_consolidating && (
                        <Target 
                          className="h-3 w-3 text-blue-500" 
                          title="Consolidating" 
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        ${safeParseNumber(signal.close_price)
                          .toFixed(2)}
                      </span>
                      {signal.volume_ratio && (
                        <span className="text-caption text-green-600">
                          {safeParseNumber(signal.volume_ratio)
                            .toFixed(1)}x vol
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {(safeParseNumber(signal.overall_score) * 100)
                        .toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {signal.opportunity_rank && (
                      <Badge 
                        className={getOpportunityRankColor(
                          signal.opportunity_rank
                        )}
                      >
                        {signal.opportunity_rank}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {signal.signal_status && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs", 
                          getSignalStatusColor(signal.signal_status)
                        )}
                      >
                        {signal.signal_status}
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
            <p className="text-muted-foreground">
              No signals found matching your criteria.
            </p>
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
          <div 
            className={cn(
              "fixed top-0 right-0 h-full w-full sm:w-96 " + 
              "bg-background border-l border-border z-50",
              "rounded-l-xl shadow-2xl",
              "transform transition-all duration-200 ease-out",
              sidebarOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div 
                className="flex items-center justify-between p-4 
                  border-b border-border"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => 
                        window.open(
                          getYahooFinanceUrl(selectedSignal.symbol), 
                          "_blank"
                        )
                      }
                      className="flex items-center gap-1.5 text-base 
                        font-semibold hover:text-blue-600 
                        transition-colors cursor-pointer group"
                      title={`View ${selectedSignal.symbol} on 
                        Yahoo Finance`}
                    >
                      <span>{selectedSignal.symbol}</span>
                      <ExternalLink 
                        className="h-3 w-3 opacity-60 
                          group-hover:opacity-100 transition-opacity" 
                      />
                    </button>
                    <button
                      onClick={() => window.open(
                        `https://robinhood.com/stocks/${selectedSignal.symbol}`,
                        "_blank"
                      )}
                      className="flex items-center hover:scale-110 
                        transition-transform"
                      title={`Trade ${selectedSignal.symbol} on Robinhood`}
                    >
                      <Image 
                        src="/logos/robinhood-svgrepo-com.svg" 
                        alt="Robinhood" 
                        width={16}
                        height={16}
                        className="opacity-70 hover:opacity-100 
                          transition-opacity"
                      />
                    </button>
                    {selectedSignal.is_breakout && (
                      <Zap className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  {selectedSignal.opportunity_rank && (
                    <Badge 
                      className={cn(
                        "text-xs", 
                        getOpportunityRankColor(
                          selectedSignal.opportunity_rank
                        )
                      )}
                    >
                      {selectedSignal.opportunity_rank}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    ↑↓ Navigate
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={closeSidebar}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4 
                  relative"
              >
                {/* Price & Volume */}
                <div className="space-y-2">
                  <h3 
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Price & Volume
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Current Price
                      </p>
                      <p className="text-sm font-semibold">
                        ${safeParseNumber(selectedSignal.close_price)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Volume Ratio
                      </p>
                      <p className="text-sm font-semibold text-green-600">
                        {safeParseNumber(selectedSignal.volume_ratio)
                          .toFixed(1)}x
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Dollar Volume
                      </p>
                      <p className="text-sm font-semibold">
                        {formatDollarVolume(
                          safeParseNumber(selectedSignal.dollar_volume)
                        )}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Volume Spike
                      </p>
                      <p className="text-xs font-medium">
                        {safeParseNumber(
                          selectedSignal.volume_spike_factor
                        ).toFixed(1)}x
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Signal Analysis */}
                <div className="space-y-2">
                  <h3 
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Signal Analysis
                  </h3>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Overall Score</span>
                      <span className="text-xs font-semibold">
                        {(safeParseNumber(
                          selectedSignal.overall_score
                        ) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Volume Score</span>
                      <span className="text-xs font-semibold">
                        {(safeParseNumber(
                          selectedSignal.volume_score
                        ) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Momentum Score</span>
                      <span className="text-xs font-semibold">
                        {(safeParseNumber(
                          selectedSignal.momentum_score
                        ) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">
                        Relative Strength
                      </span>
                      <span className="text-xs font-semibold">
                        {(safeParseNumber(
                          selectedSignal.relative_strength_score
                        ) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pattern Detection */}
                <div className="space-y-2">
                  <h3 
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Pattern Detection
                  </h3>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Is Breakout</span>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          selectedSignal.is_breakout 
                            ? "text-green-600" 
                            : "text-muted-foreground"
                        )}
                      >
                        {selectedSignal.is_breakout ? "Yes" : "No"}
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">
                        Is Consolidating
                      </span>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          selectedSignal.is_consolidating 
                            ? "text-blue-600" 
                            : "text-muted-foreground"
                        )}
                      >
                        {selectedSignal.is_consolidating 
                          ? "Yes" 
                          : "No"}
                      </span>
                    </div>
                    {selectedSignal.consolidation_days && (
                      <div 
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs">
                          Consolidation Days
                        </span>
                        <span className="text-xs font-medium">
                          {selectedSignal.consolidation_days}
                        </span>
                      </div>
                    )}
                    {selectedSignal.higher_lows_detected && (
                      <div 
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs">Higher Lows</span>
                        <span 
                          className="text-xs font-medium text-green-600"
                        >
                          Detected
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Price Movement */}
                <div className="space-y-2">
                  <h3 
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Price Movement
                  </h3>
                  <div className="space-y-2">
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">5-Day Change</span>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          safeParseNumber(
                            selectedSignal.price_change_5d
                          ) >= 0 
                            ? "text-green-600" 
                            : "text-red-600"
                        )}
                      >
                        {safeParseNumber(
                          selectedSignal.price_change_5d
                        ) >= 0 ? "+" : ""}
                        {safeParseNumber(
                          selectedSignal.price_change_5d
                        ).toFixed(1)}%
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">10-Day Change</span>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          safeParseNumber(
                            selectedSignal.price_change_10d
                          ) >= 0 
                            ? "text-green-600" 
                            : "text-red-600"
                        )}
                      >
                        {safeParseNumber(
                          selectedSignal.price_change_10d
                        ) >= 0 ? "+" : ""}
                        {safeParseNumber(
                          selectedSignal.price_change_10d
                        ).toFixed(1)}%
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">20-Day Change</span>
                      <span 
                        className={cn(
                          "text-xs font-medium",
                          safeParseNumber(
                            selectedSignal.price_change_20d
                          ) >= 0 
                            ? "text-green-600" 
                            : "text-red-600"
                        )}
                      >
                        {safeParseNumber(
                          selectedSignal.price_change_20d
                        ) >= 0 ? "+" : ""}
                        {safeParseNumber(
                          selectedSignal.price_change_20d
                        ).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Risk Management */}
                {selectedSignal.stop_loss_level && (
                  <>
                    <div className="space-y-2">
                      <h3 
                        className="text-xs font-medium 
                          text-muted-foreground uppercase tracking-wide"
                      >
                        Risk Management
                      </h3>
                      <div className="space-y-2">
                        <div 
                          className="flex items-center 
                            justify-between"
                        >
                          <span className="text-xs">Stop Loss</span>
                          <span className="text-xs font-medium">
                            ${safeParseNumber(
                              selectedSignal.stop_loss_level
                            ).toFixed(2)}
                          </span>
                        </div>
                        {selectedSignal.position_size_pct && (
                          <div 
                            className="flex items-center 
                              justify-between"
                          >
                            <span className="text-xs">
                              Position Size
                            </span>
                            <span className="text-xs font-medium">
                              {safeParseNumber(
                                selectedSignal.position_size_pct
                              ).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {selectedSignal.pump_dump_risk && (
                          <div 
                            className="flex items-center 
                              justify-between"
                          >
                            <span className="text-xs">
                              Pump/Dump Risk
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs h-5 px-2", 
                                getRiskLevelColor(
                                  selectedSignal.pump_dump_risk
                                )
                              )}
                            >
                              {selectedSignal.pump_dump_risk}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Metadata */}
                <div className="space-y-2">
                  <h3 
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Scan Info
                  </h3>
                  <div className="space-y-1.5">
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Scan Date</span>
                      <span className="text-xs">
                        {new Date(selectedSignal.scan_date)
                          .toLocaleDateString()}
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Days Active</span>
                      <span className="text-xs">
                        {selectedSignal.days_active} days
                      </span>
                    </div>
                    <div 
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs">Signal Status</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs h-5 px-2", 
                          getSignalStatusColor(
                            selectedSignal.signal_status
                          )
                        )}
                      >
                        {selectedSignal.signal_status}
                      </Badge>
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

