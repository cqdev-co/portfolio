'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  PennyStockSignal,
  PennyStockFilters,
  PennyStockSortConfig,
} from '@/lib/types/penny-stock';
import {
  fetchPennyStockSignals,
  fetchPennyStockStats,
  fetchPerformanceStats,
  subscribeToPennyStockUpdates,
} from '@/lib/api/penny-stock-signals';
import type {
  PennyStockStats,
  PennyStockPerformanceStats,
  OpportunityRank,
} from '@/lib/types/penny-stock';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Target,
  Zap,
  AlertTriangle,
  Globe,
  TrendingUp,
  Calendar,
  Flame,
  Clock,
  Trophy,
  X,
  Check,
} from 'lucide-react';

// Helper function to safely parse numeric values
function safeParseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function to format dollar volume
function formatDollarVolume(amount: number | null): string {
  if (!amount || amount === 0) return '-';

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
    case 'S':
      return 'bg-purple-600 text-white hover:bg-purple-700';
    case 'A':
      return 'bg-green-600 text-white hover:bg-green-700';
    case 'B':
      return 'bg-blue-600 text-white hover:bg-blue-700';
    case 'C':
      return 'bg-yellow-600 text-white hover:bg-yellow-700';
    case 'D':
      return 'bg-red-600 text-white hover:bg-red-700';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

function getSignalStatusColor(status: string) {
  switch (status) {
    case 'NEW':
      return (
        'bg-green-100 text-green-800 dark:bg-green-900 ' + 'dark:text-green-200'
      );
    case 'CONTINUING':
      return (
        'bg-blue-100 text-blue-800 dark:bg-blue-900 ' + 'dark:text-blue-200'
      );
    case 'ENDED':
      return (
        'bg-gray-100 text-gray-800 dark:bg-gray-900 ' + 'dark:text-gray-200'
      );
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

function getRiskLevelColor(risk: string) {
  switch (risk) {
    case 'LOW':
      return (
        'bg-green-100 text-green-800 dark:bg-green-900 ' + 'dark:text-green-200'
      );
    case 'MEDIUM':
      return (
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 ' +
        'dark:text-yellow-200'
      );
    case 'HIGH':
      return (
        'bg-orange-100 text-orange-800 dark:bg-orange-900 ' +
        'dark:text-orange-200'
      );
    case 'EXTREME':
      return 'bg-red-100 text-red-800 dark:bg-red-900 ' + 'dark:text-red-200';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

// Get recommendation badge color - Jan 2026 update
function getRecommendationColor(rec: string) {
  switch (rec) {
    case 'STRONG_BUY':
      return 'bg-green-600 text-white';
    case 'BUY':
      return 'bg-emerald-500 text-white';
    case 'WATCH':
      return 'bg-blue-500 text-white';
    case 'HOLD':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

// Check if volume is in sweet spot (2-3x is optimal per Jan 2026 data)
function isVolumeInSweetSpot(volumeRatio: number | null): boolean {
  if (!volumeRatio) return false;
  return volumeRatio >= 2.0 && volumeRatio <= 3.0;
}

// Check if late entry (price already moved 15%+ in 5 days)
function isLateEntry(priceChange5d: number | null): boolean {
  if (!priceChange5d) return false;
  return priceChange5d > 15;
}

// Check if 52-week position is optimal (25-50% from low)
function is52wPositionOptimal(distanceFromLow: number | null): boolean {
  if (!distanceFromLow) return false;
  return distanceFromLow >= 25 && distanceFromLow <= 50;
}

// Check if green days count is optimal (1 day = 64.8% WR)
function isGreenDaysOptimal(greenDays: number | null): boolean {
  return greenDays === 1;
}

// Get day of week name from date
function getDayOfWeek(dateStr: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// Check if Friday (bonus day) or Wednesday (penalty day)
function getDayOfWeekStatus(dateStr: string): 'bonus' | 'penalty' | 'neutral' {
  const day = new Date(dateStr).getDay();
  if (day === 5) return 'bonus'; // Friday
  if (day === 3) return 'penalty'; // Wednesday
  return 'neutral';
}

// Filter options
const RANK_OPTIONS: OpportunityRank[] = ['S', 'A', 'B', 'C', 'D'];
const RECOMMENDATION_OPTIONS = ['STRONG_BUY', 'BUY', 'WATCH', 'HOLD'];

export default function PennyStockScanner() {
  const [signals, setSignals] = useState<PennyStockSignal[]>([]);
  const [stats, setStats] = useState<PennyStockStats | null>(null);
  const [perfStats, setPerfStats] = useState<PennyStockPerformanceStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<PennyStockFilters>({});
  const [sortConfig, setSortConfig] = useState<PennyStockSortConfig>({
    field: 'overall_score',
    direction: 'desc',
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<PennyStockSignal | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [selectedRanks, setSelectedRanks] = useState<OpportunityRank[]>([]);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [volumeSweetSpot, setVolumeSweetSpot] = useState(false);
  const [breakoutOnly, setBreakoutOnly] = useState(false);

  // Count active filters
  const activeFilterCount =
    selectedRanks.length +
    selectedRecs.length +
    (volumeSweetSpot ? 1 : 0) +
    (breakoutOnly ? 1 : 0);

  // Apply filters
  const applyFilters = useCallback(() => {
    const newFilters: PennyStockFilters = {};
    if (selectedRanks.length > 0) {
      newFilters.opportunity_ranks = selectedRanks;
    }
    if (selectedRecs.length > 0) {
      newFilters.recommendations = selectedRecs;
    }
    if (volumeSweetSpot) {
      newFilters.volume_in_sweet_spot = true;
    }
    if (breakoutOnly) {
      newFilters.is_breakout = true;
    }
    setFilters(newFilters);
    setFiltersOpen(false);
  }, [selectedRanks, selectedRecs, volumeSweetSpot, breakoutOnly]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedRanks([]);
    setSelectedRecs([]);
    setVolumeSweetSpot(false);
    setBreakoutOnly(false);
    setFilters({});
  }, []);

  // Load data
  const loadData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      try {
        setError(null);

        // Load signals, stats, and performance stats in parallel
        const today = new Date().toISOString().split('T')[0];
        const [signalsResponse, statsData, perfData] = await Promise.all([
          fetchPennyStockSignals({
            limit: 100,
            sortBy: sortConfig.field,
            sortOrder: sortConfig.direction,
            filters: { ...filters, scan_date: today },
            searchTerm,
          }),
          fetchPennyStockStats(),
          fetchPerformanceStats(),
        ]);

        if (signalsResponse.error) {
          setError(signalsResponse.error);
        } else {
          setSignals(signalsResponse.data);
        }

        setStats(statsData);
        setPerfStats(perfData);
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to load penny stock signals');
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
    const today = new Date().toISOString().split('T')[0];
    const unsubscribe = subscribeToPennyStockUpdates(
      (payload) => {
        console.log('Real-time update:', payload);
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
        const currentIndex = displaySignals.findIndex(
          (signal) => signal.id === selectedSignal.id
        );

        if (currentIndex === -1) return;

        let nextIndex;
        if (e.key === 'ArrowUp') {
          nextIndex =
            currentIndex > 0 ? currentIndex - 1 : displaySignals.length - 1;
        } else {
          nextIndex =
            currentIndex < displaySignals.length - 1 ? currentIndex + 1 : 0;
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

  const handleSort = (field: keyof PennyStockSignal) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getSortIcon = (field: keyof PennyStockSignal) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'desc' ? (
      <ArrowDown className="h-4 w-4" />
    ) : (
      <ArrowUp className="h-4 w-4" />
    );
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
          <h1 className="text-2xl font-medium mb-3">Penny Stock Scanner</h1>
          <Separator className="mb-4" />
          <div className="flex items-center justify-center py-12">
            <div
              className="animate-spin rounded-full h-8 w-8 
              border-b-2 border-primary"
            ></div>
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
          <Zap className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-medium">
            Professional Penny Stock Scanner
          </h1>
        </div>
        <Separator className="mb-4" />
        <div className="text-compact text-muted-foreground space-y-2">
          <p>
            The <strong>penny stock explosion scanner</strong> identifies
            low-priced stocks showing consolidation patterns and volume surges
            that historically precede 50-200%+ moves. This professional{' '}
            <em>stock scanner</em> uses{' '}
            <strong>volume analysis (50% weight)</strong>,{' '}
            <strong>consolidation detection</strong>, and{' '}
            <strong>breakout confirmation</strong> to spot explosive setups
            before they move.
          </p>
          <p>
            Deploy this <strong>trading tool</strong> to find penny stocks
            breaking out of tight consolidation with strong volume; these
            patterns deliver exceptional risk/reward opportunities. Perfect for{' '}
            <em>day traders</em> and <em>swing traders</em> seeking explosive
            penny stock opportunities under $5.
          </p>
        </div>
      </header>

      {/* Market Conditions & Stats */}
      <section className="space-y-4" aria-labelledby="market-conditions-title">
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
            <span className="font-medium">Active Penny Stock Scanning</span>
          </div>
          <span
            className="text-xs text-muted-foreground"
            title="Scanner status"
          >
            Explosion Setups • Volume Focus
          </span>
        </div>

        {/* Stats Cards - Top Row: Today's Signals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-caption text-muted-foreground">
                Today&apos;s Signals
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

        {/* Performance Stats - Bottom Row: 30-Day Performance */}
        {perfStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <Trophy className="h-3 w-3 text-emerald-600" />
                <span className="text-caption text-emerald-700 dark:text-emerald-300">
                  30-Day Win Rate
                </span>
              </div>
              <p
                className={cn(
                  'text-lg font-bold mt-1',
                  perfStats.win_rate >= 50 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {perfStats.win_rate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                {perfStats.total_closed_trades} trades
              </p>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-blue-600" />
                <span className="text-caption text-blue-700 dark:text-blue-300">
                  Avg Return
                </span>
              </div>
              <p
                className={cn(
                  'text-lg font-bold mt-1',
                  perfStats.avg_return >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {perfStats.avg_return >= 0 ? '+' : ''}
                {perfStats.avg_return.toFixed(2)}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                Avg hold: {perfStats.avg_hold_days.toFixed(1)} days
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-3 w-3 text-green-500" />
                <span className="text-caption text-muted-foreground">
                  Profit Targets
                </span>
              </div>
              <p className="text-lg font-medium mt-1 text-green-600">
                {perfStats.profit_target_hit_rate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                Hit 10%+ target
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-caption text-muted-foreground">
                  Stop Loss Rate
                </span>
              </div>
              <p className="text-lg font-medium mt-1 text-amber-600">
                {perfStats.stop_loss_hit_rate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground">
                Best: +{perfStats.best_return.toFixed(0)}%
              </p>
            </Card>
          </div>
        )}
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
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
            />
            Refresh
          </Button>

          {/* Filters Popover */}
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter Signals</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {/* Rank Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Opportunity Rank
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {RANK_OPTIONS.map((rank) => (
                      <Button
                        key={rank}
                        variant={
                          selectedRanks.includes(rank) ? 'default' : 'outline'
                        }
                        size="sm"
                        className={cn(
                          'h-7 px-2',
                          selectedRanks.includes(rank) &&
                            getOpportunityRankColor(rank)
                        )}
                        onClick={() => {
                          setSelectedRanks((prev) =>
                            prev.includes(rank)
                              ? prev.filter((r) => r !== rank)
                              : [...prev, rank]
                          );
                        }}
                      >
                        {rank}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Recommendation Filter */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Recommendation</Label>
                  <div className="flex flex-wrap gap-2">
                    {RECOMMENDATION_OPTIONS.map((rec) => (
                      <Button
                        key={rec}
                        variant={
                          selectedRecs.includes(rec) ? 'default' : 'outline'
                        }
                        size="sm"
                        className={cn(
                          'h-7 px-2 text-xs',
                          selectedRecs.includes(rec) &&
                            getRecommendationColor(rec)
                        )}
                        onClick={() => {
                          setSelectedRecs((prev) =>
                            prev.includes(rec)
                              ? prev.filter((r) => r !== rec)
                              : [...prev, rec]
                          );
                        }}
                      >
                        {rec.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quick Filters */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Quick Filters</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="volumeSweetSpot"
                        checked={volumeSweetSpot}
                        onCheckedChange={(checked) =>
                          setVolumeSweetSpot(checked === true)
                        }
                      />
                      <label
                        htmlFor="volumeSweetSpot"
                        className="text-xs cursor-pointer flex items-center gap-1"
                      >
                        <DollarSign className="h-3 w-3 text-emerald-500" />
                        Volume Sweet Spot (2-3x)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="breakoutOnly"
                        checked={breakoutOnly}
                        onCheckedChange={(checked) =>
                          setBreakoutOnly(checked === true)
                        }
                      />
                      <label
                        htmlFor="breakoutOnly"
                        className="text-xs cursor-pointer flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3 text-yellow-500" />
                        Breakouts Only
                      </label>
                    </div>
                  </div>
                </div>

                {/* Apply Button */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setFiltersOpen(false)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={applyFilters}>
                    <Check className="h-3 w-3 mr-1" />
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center gap-2">
                    Symbol
                    {getSortIcon('symbol')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('close_price')}
                >
                  <div className="flex items-center gap-2">
                    Price
                    {getSortIcon('close_price')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('overall_score')}
                >
                  <div className="flex items-center gap-2">
                    Score
                    {getSortIcon('overall_score')}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('opportunity_rank')}
                >
                  <div className="flex items-center gap-2">
                    Rank
                    {getSortIcon('opportunity_rank')}
                  </div>
                </TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Signals</TableHead>
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
                    <TooltipProvider delayDuration={100}>
                      <div className="flex items-center gap-2">
                        {signal.symbol}
                        {signal.is_breakout && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Zap className="h-3 w-3 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Breakout detected</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {signal.is_consolidating && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Target className="h-3 w-3 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Consolidating pattern</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {signal.pump_dump_warning && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-red-600">
                              <p>⚠️ Pump & Dump Warning</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {signal.is_high_risk_country && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Globe className="h-3 w-3 text-orange-500" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-orange-600">
                              <p>High-risk country: {signal.country}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        ${safeParseNumber(signal.close_price).toFixed(2)}
                      </span>
                      {signal.volume_ratio && (
                        <span className="text-caption text-green-600">
                          {safeParseNumber(signal.volume_ratio).toFixed(1)}x vol
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {(safeParseNumber(signal.overall_score) * 100).toFixed(0)}
                      %
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
                    {signal.recommendation && (
                      <Badge
                        className={cn(
                          'text-xs',
                          getRecommendationColor(signal.recommendation)
                        )}
                      >
                        {signal.recommendation.replace('_', ' ')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider delayDuration={100}>
                      <div className="flex items-center gap-1">
                        {/* Volume Sweet Spot indicator */}
                        {isVolumeInSweetSpot(
                          safeParseNumber(signal.volume_ratio)
                        ) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DollarSign className="h-3 w-3 text-emerald-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Volume in sweet spot (2-3x)</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* Green Days Optimal indicator */}
                        {isGreenDaysOptimal(signal.consecutive_green_days) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Flame className="h-3 w-3 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Optimal: 1 green day (64.8% WR)</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* 52-Week Position Optimal */}
                        {is52wPositionOptimal(
                          safeParseNumber(signal.distance_from_52w_low)
                        ) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <TrendingUp className="h-3 w-3 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Optimal: 25-50% from 52w low</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* Late Entry Warning */}
                        {isLateEntry(
                          safeParseNumber(signal.price_change_5d)
                        ) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Clock className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-amber-600">
                              <p>
                                ⚠️ Late entry: +
                                {safeParseNumber(
                                  signal.price_change_5d
                                ).toFixed(0)}
                                % in 5d
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* Day of Week indicator */}
                        {getDayOfWeekStatus(signal.scan_date) === 'bonus' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Calendar className="h-3 w-3 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Friday entry (bonus)</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
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
              'fixed top-0 right-0 h-full w-full sm:w-96 ' +
                'bg-background border-l border-border z-50',
              'rounded-l-xl shadow-2xl',
              'transform transition-all duration-200 ease-out',
              sidebarOpen ? 'translate-x-0' : 'translate-x-full'
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
                          '_blank'
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
                      onClick={() =>
                        window.open(
                          `https://robinhood.com/stocks/${selectedSignal.symbol}`,
                          '_blank'
                        )
                      }
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
                        'text-xs',
                        getOpportunityRankColor(selectedSignal.opportunity_rank)
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
                  <Button variant="ghost" size="sm" onClick={closeSidebar}>
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
                        $
                        {safeParseNumber(selectedSignal.close_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Volume Ratio
                      </p>
                      <p className="text-sm font-semibold text-green-600">
                        {safeParseNumber(selectedSignal.volume_ratio).toFixed(
                          1
                        )}
                        x
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
                        ).toFixed(1)}
                        x
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Recommendation & Action */}
                <div className="space-y-2">
                  <h3
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Recommendation
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectedSignal.recommendation && (
                      <Badge
                        className={cn(
                          'text-sm px-3 py-1',
                          getRecommendationColor(selectedSignal.recommendation)
                        )}
                      >
                        {selectedSignal.recommendation.replace('_', ' ')}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {(
                        safeParseNumber(selectedSignal.overall_score) * 100
                      ).toFixed(0)}
                      % score
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Signal Quality Indicators - Jan 2026 */}
                <div className="space-y-2">
                  <h3
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Signal Quality
                  </h3>
                  <div className="space-y-2">
                    {/* Volume Sweet Spot */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Volume Range
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isVolumeInSweetSpot(
                            safeParseNumber(selectedSignal.volume_ratio)
                          )
                            ? 'text-emerald-600'
                            : safeParseNumber(selectedSignal.volume_ratio) > 5
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        )}
                      >
                        {safeParseNumber(selectedSignal.volume_ratio).toFixed(
                          1
                        )}
                        x
                        {isVolumeInSweetSpot(
                          safeParseNumber(selectedSignal.volume_ratio)
                        )
                          ? ' ✓ Sweet Spot'
                          : safeParseNumber(selectedSignal.volume_ratio) > 5
                            ? ' ⚠️ High'
                            : ''}
                      </span>
                    </div>
                    {/* Consecutive Green Days */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        Green Days
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isGreenDaysOptimal(
                            selectedSignal.consecutive_green_days
                          )
                            ? 'text-green-600'
                            : (selectedSignal.consecutive_green_days ?? 0) >= 4
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        )}
                      >
                        {selectedSignal.consecutive_green_days ?? 0} days
                        {isGreenDaysOptimal(
                          selectedSignal.consecutive_green_days
                        )
                          ? ' ✓ Optimal'
                          : (selectedSignal.consecutive_green_days ?? 0) >= 4
                            ? ' ⚠️ Extended'
                            : ''}
                      </span>
                    </div>
                    {/* 52-Week Position */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        From 52w Low
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          is52wPositionOptimal(
                            safeParseNumber(
                              selectedSignal.distance_from_52w_low
                            )
                          )
                            ? 'text-blue-600'
                            : safeParseNumber(
                                  selectedSignal.distance_from_52w_low
                                ) < 15
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        )}
                      >
                        {safeParseNumber(
                          selectedSignal.distance_from_52w_low
                        ).toFixed(0)}
                        %
                        {is52wPositionOptimal(
                          safeParseNumber(selectedSignal.distance_from_52w_low)
                        )
                          ? ' ✓ Optimal'
                          : safeParseNumber(
                                selectedSignal.distance_from_52w_low
                              ) < 15
                            ? ' ⚠️ Near Low'
                            : ''}
                      </span>
                    </div>
                    {/* Late Entry Check */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        5-Day Move
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isLateEntry(
                            safeParseNumber(selectedSignal.price_change_5d)
                          )
                            ? 'text-amber-600'
                            : safeParseNumber(selectedSignal.price_change_5d) >
                                0
                              ? 'text-green-600'
                              : 'text-red-600'
                        )}
                      >
                        {safeParseNumber(selectedSignal.price_change_5d) >= 0
                          ? '+'
                          : ''}
                        {safeParseNumber(
                          selectedSignal.price_change_5d
                        ).toFixed(1)}
                        %
                        {isLateEntry(
                          safeParseNumber(selectedSignal.price_change_5d)
                        )
                          ? ' ⚠️ Late'
                          : ''}
                      </span>
                    </div>
                    {/* Day of Week */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Entry Day
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          getDayOfWeekStatus(selectedSignal.scan_date) ===
                            'bonus'
                            ? 'text-green-600'
                            : getDayOfWeekStatus(selectedSignal.scan_date) ===
                                'penalty'
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                        )}
                      >
                        {getDayOfWeek(selectedSignal.scan_date)}
                        {getDayOfWeekStatus(selectedSignal.scan_date) ===
                        'bonus'
                          ? ' ✓ Bonus'
                          : getDayOfWeekStatus(selectedSignal.scan_date) ===
                              'penalty'
                            ? ' ⚠️'
                            : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Market Comparison */}
                {selectedSignal.market_outperformance !== null && (
                  <>
                    <div className="space-y-2">
                      <h3
                        className="text-xs font-medium text-muted-foreground 
                          uppercase tracking-wide"
                      >
                        Market Comparison
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">vs SPY (5d)</span>
                          <span
                            className={cn(
                              'text-xs font-medium',
                              safeParseNumber(
                                selectedSignal.market_outperformance
                              ) > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            )}
                          >
                            {safeParseNumber(
                              selectedSignal.market_outperformance
                            ) >= 0
                              ? '+'
                              : ''}
                            {safeParseNumber(
                              selectedSignal.market_outperformance
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Signal Analysis */}
                <div className="space-y-2">
                  <h3
                    className="text-xs font-medium text-muted-foreground 
                      uppercase tracking-wide"
                  >
                    Component Scores
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Volume (50%)</span>
                      <span className="text-xs font-semibold">
                        {(
                          safeParseNumber(selectedSignal.volume_score) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Momentum (30%)</span>
                      <span className="text-xs font-semibold">
                        {(
                          safeParseNumber(selectedSignal.momentum_score) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Rel Strength (15%)</span>
                      <span className="text-xs font-semibold">
                        {(
                          safeParseNumber(
                            selectedSignal.relative_strength_score
                          ) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Risk (5%)</span>
                      <span className="text-xs font-semibold">
                        {(
                          safeParseNumber(selectedSignal.risk_score) * 100
                        ).toFixed(0)}
                        %
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Is Breakout</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          selectedSignal.is_breakout
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {selectedSignal.is_breakout ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Is Consolidating</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          selectedSignal.is_consolidating
                            ? 'text-blue-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {selectedSignal.is_consolidating ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {selectedSignal.consolidation_days && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Consolidation Days</span>
                        <span className="text-xs font-medium">
                          {selectedSignal.consolidation_days}
                        </span>
                      </div>
                    )}
                    {selectedSignal.higher_lows_detected && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Higher Lows</span>
                        <span className="text-xs font-medium text-green-600">
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs">5-Day Change</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          safeParseNumber(selectedSignal.price_change_5d) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {safeParseNumber(selectedSignal.price_change_5d) >= 0
                          ? '+'
                          : ''}
                        {safeParseNumber(
                          selectedSignal.price_change_5d
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">10-Day Change</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          safeParseNumber(selectedSignal.price_change_10d) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {safeParseNumber(selectedSignal.price_change_10d) >= 0
                          ? '+'
                          : ''}
                        {safeParseNumber(
                          selectedSignal.price_change_10d
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">20-Day Change</span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          safeParseNumber(selectedSignal.price_change_20d) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {safeParseNumber(selectedSignal.price_change_20d) >= 0
                          ? '+'
                          : ''}
                        {safeParseNumber(
                          selectedSignal.price_change_20d
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Risk Warnings */}
                {(selectedSignal.pump_dump_warning ||
                  selectedSignal.is_high_risk_country) && (
                  <>
                    <div className="space-y-2">
                      <h3
                        className="text-xs font-medium text-red-500
                          uppercase tracking-wide flex items-center gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Risk Warnings
                      </h3>
                      <div className="space-y-2">
                        {selectedSignal.pump_dump_warning && (
                          <div
                            className="flex items-center gap-2 p-2 
                              bg-red-50 dark:bg-red-950 rounded-md"
                          >
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                            <span
                              className="text-xs text-red-700 
                              dark:text-red-300"
                            >
                              Potential pump & dump detected (extreme volume +
                              high score pattern)
                            </span>
                          </div>
                        )}
                        {selectedSignal.is_high_risk_country && (
                          <div
                            className="flex items-center gap-2 p-2 
                              bg-orange-50 dark:bg-orange-950 rounded-md"
                          >
                            <Globe className="h-4 w-4 text-orange-500 shrink-0" />
                            <span
                              className="text-xs text-orange-700 
                              dark:text-orange-300"
                            >
                              High-risk country: {selectedSignal.country}
                              (historically poor performance)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

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
                            $
                            {safeParseNumber(
                              selectedSignal.stop_loss_level
                            ).toFixed(2)}
                          </span>
                        </div>
                        {selectedSignal.position_size_pct && (
                          <div
                            className="flex items-center 
                              justify-between"
                          >
                            <span className="text-xs">Position Size</span>
                            <span className="text-xs font-medium">
                              {safeParseNumber(
                                selectedSignal.position_size_pct
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                        )}
                        {selectedSignal.pump_dump_risk && (
                          <div
                            className="flex items-center 
                              justify-between"
                          >
                            <span className="text-xs">Pump/Dump Risk</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs h-5 px-2',
                                getRiskLevelColor(selectedSignal.pump_dump_risk)
                              )}
                            >
                              {selectedSignal.pump_dump_risk}
                            </Badge>
                          </div>
                        )}
                        {selectedSignal.country && (
                          <div
                            className="flex items-center 
                              justify-between"
                          >
                            <span className="text-xs">Country</span>
                            <span
                              className={cn(
                                'text-xs font-medium',
                                selectedSignal.is_high_risk_country
                                  ? 'text-orange-600'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {selectedSignal.country}
                            </span>
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Scan Date</span>
                      <span className="text-xs">
                        {new Date(
                          selectedSignal.scan_date
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Days Active</span>
                      <span className="text-xs">
                        {selectedSignal.days_active} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Signal Status</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs h-5 px-2',
                          getSignalStatusColor(selectedSignal.signal_status)
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
