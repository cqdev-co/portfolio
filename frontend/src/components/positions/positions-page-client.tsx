'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  Plus,
  RefreshCw,
  Sparkles,
  DollarSign,
  Target,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchPositions,
  refreshPositionsWithMarketData,
  calculatePositionSummary,
  deleteSpread,
  type SpreadSummaryData,
} from '@/lib/api/positions';
import type {
  Position,
  PositionWithMarketData,
  PositionSummary,
} from '@/lib/types/positions';
import { PositionsTable } from './positions-table';
import { AddPositionDialog } from './add-position-dialog';
import {
  useGlobalChat,
  buildPositionPrompt,
  buildSpreadPrompt,
  buildPortfolioPrompt,
} from '@/components/chat';

export function PositionsPageClient() {
  const { user } = useAuth();
  const { openChat } = useGlobalChat();
  const [positions, setPositions] = useState<Position[]>([]);
  const [enrichedPositions, setEnrichedPositions] = useState<
    PositionWithMarketData[]
  >([]);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Load positions
  const loadPositions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetchPositions();

      if (response.error) {
        setError(response.error);
        return;
      }

      setPositions(response.data);
      // Basic summary will be recalculated by useEffect with spread data
    } catch (err) {
      console.error('[Positions] Load error:', err);
      setError('Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refresh with market data
  const handleRefresh = useCallback(async () => {
    if (positions.length === 0) return;

    setRefreshing(true);
    try {
      const response = await refreshPositionsWithMarketData(positions);

      if (response.error) {
        setError(response.error);
        return;
      }

      setEnrichedPositions(response.data);
      setSummary(response.summary);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      console.error('[Positions] Refresh error:', err);
      setError('Failed to refresh market data');
    } finally {
      setRefreshing(false);
    }
  }, [positions]);

  // Initial load
  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  // Handle position added
  const handlePositionAdded = useCallback((newPosition: Position) => {
    setPositions((prev) => [newPosition, ...prev]);
    setIsAddDialogOpen(false);
  }, []);

  // Handle position deleted
  const handlePositionDeleted = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
    setEnrichedPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Handle AI click on individual position - opens chat with prompt
  const handlePositionAIClick = useCallback(
    (position: PositionWithMarketData) => {
      const prompt = buildPositionPrompt(position);
      openChat(prompt);
    },
    [openChat]
  );

  // Handle AI click on spread - opens chat with prompt
  const handleSpreadAIClick = useCallback(
    (prompt: string) => {
      openChat(prompt);
    },
    [openChat]
  );

  // Handle delete spread
  const handleSpreadDeleted = useCallback(async (spreadId: string) => {
    try {
      const result = await deleteSpread(spreadId);
      if (result.success) {
        // Remove spread legs from positions
        setPositions((prev) => prev.filter((p) => p.spread_id !== spreadId));
        setEnrichedPositions((prev) =>
          prev.filter((p) => p.spread_id !== spreadId)
        );
      }
    } catch (err) {
      console.error('[Positions] Delete spread error:', err);
      setError('Failed to delete spread');
    }
  }, []);

  // Separate standalone positions from spread legs (always compute)
  const allPositionsEnriched = useMemo(() => {
    if (enrichedPositions.length > 0) {
      return enrichedPositions;
    }
    return positions.map((p) => ({
      ...p,
      current_price: p.entry_price,
      pnl: 0,
      pnl_percent: 0,
    })) as PositionWithMarketData[];
  }, [enrichedPositions, positions]);

  // Filter out spread legs - only show standalone positions
  const standalonePositions = useMemo(
    () => allPositionsEnriched.filter((p) => !p.spread_id),
    [allPositionsEnriched]
  );

  // Check if we have market data (underlying prices fetched)
  const hasMarketData = useMemo(
    () =>
      enrichedPositions.length > 0 &&
      enrichedPositions.some((p) => p.underlying_price !== undefined),
    [enrichedPositions]
  );

  // Create display data for spreads with P&L calculation
  const spreadsDisplay = useMemo(() => {
    // Group spread legs by spread_id
    const spreadLegsMap = new Map<string, PositionWithMarketData[]>();
    for (const pos of allPositionsEnriched) {
      if (pos.spread_id) {
        const existing = spreadLegsMap.get(pos.spread_id) || [];
        existing.push(pos);
        spreadLegsMap.set(pos.spread_id, existing);
      }
    }

    return Array.from(spreadLegsMap.entries()).map(([spreadId, legs]) => {
      // Sort legs: long first, then short
      const sortedLegs = [...legs].sort((a, b) => b.quantity - a.quantity);
      const longLeg = sortedLegs.find((l) => l.quantity > 0);
      const shortLeg = sortedLegs.find((l) => l.quantity < 0);

      // Net entry price (debit paid)
      const netEntryPrice =
        longLeg && shortLeg
          ? longLeg.entry_price - shortLeg.entry_price
          : legs[0]?.entry_price || 0;

      // Calculate current value from actual option prices (fetched from chain)
      // Use NATURAL pricing: to close a debit spread, sell long (bid), buy short (ask)
      const underlyingPrice = longLeg?.underlying_price || 0;
      let netCurrentPrice = netEntryPrice; // Default to entry if no data

      // Check if we have real option prices with bid/ask
      const hasBidAsk =
        longLeg &&
        shortLeg &&
        longLeg.bid !== undefined &&
        longLeg.bid > 0 &&
        shortLeg.ask !== undefined &&
        shortLeg.ask > 0;

      // Fallback: check if mid-prices differ from entry
      const hasMidPrices =
        longLeg &&
        shortLeg &&
        (longLeg.current_price !== longLeg.entry_price ||
          shortLeg.current_price !== shortLeg.entry_price);

      console.log(`[Spreads] ${legs[0]?.symbol} ${spreadId}:`, {
        hasBidAsk,
        hasMidPrices,
        long: longLeg
          ? {
              strike: longLeg.strike_price,
              entry: longLeg.entry_price,
              bid: longLeg.bid,
              ask: longLeg.ask,
              mid: longLeg.current_price,
            }
          : null,
        short: shortLeg
          ? {
              strike: shortLeg.strike_price,
              entry: shortLeg.entry_price,
              bid: shortLeg.bid,
              ask: shortLeg.ask,
              mid: shortLeg.current_price,
            }
          : null,
      });

      if (hasBidAsk && longLeg && shortLeg) {
        // Use spread mid: average of natural close (bid-ask) and natural open (ask-bid)
        // Natural close alone is too pessimistic for deep ITM spreads with wide bid/ask
        const spreadBid = longLeg.bid! - shortLeg.ask!; // worst case (closing)
        const hasFullBidAsk =
          longLeg.ask !== undefined &&
          longLeg.ask > 0 &&
          shortLeg.bid !== undefined &&
          shortLeg.bid > 0;
        if (hasFullBidAsk) {
          const spreadAsk = longLeg.ask! - shortLeg.bid!; // best case
          netCurrentPrice = (spreadBid + spreadAsk) / 2; // spread mid
        } else {
          netCurrentPrice = spreadBid;
        }
        console.log(
          `[Spreads] ${legs[0]?.symbol}: spread mid = $${netCurrentPrice.toFixed(2)} ` +
            `(bid=$${longLeg.bid} - ask=$${shortLeg.ask} = $${(longLeg.bid! - shortLeg.ask!).toFixed(2)})`
        );
      } else if (hasMidPrices && longLeg && shortLeg) {
        // Fallback: use mid-prices (less accurate but better than nothing)
        netCurrentPrice = longLeg.current_price - shortLeg.current_price;
        console.log(
          `[Spreads] ${legs[0]?.symbol}: mid price = ` +
            `$${longLeg.current_price} - $${shortLeg.current_price} = $${netCurrentPrice.toFixed(2)}`
        );
      }

      // Ensure positive for debit spreads (can't be negative in practice)
      netCurrentPrice = Math.max(0, netCurrentPrice);

      // SANITY CHECK: For call debit spreads, value can't exceed the width
      const longStrike = longLeg?.strike_price || 0;
      const shortStrike = shortLeg?.strike_price || 0;
      const spreadWidth = Math.abs(shortStrike - longStrike);

      // If netCurrentPrice exceeds spread width, one leg likely has intrinsic-only
      // pricing (missing time value). Estimate using the other leg's time value.
      if (
        netCurrentPrice > spreadWidth &&
        longLeg &&
        shortLeg &&
        underlyingPrice > 0 &&
        longLeg.bid !== undefined &&
        longLeg.bid > 0
      ) {
        const longIntrinsic = Math.max(0, underlyingPrice - longStrike);
        const longTimeValue = Math.max(
          0,
          longLeg.current_price - longIntrinsic
        );
        const shortIntrinsic = Math.max(0, underlyingPrice - shortStrike);
        const timeValueRatio =
          longIntrinsic > 0 ? shortIntrinsic / longIntrinsic : 0.9;
        const estimatedShortPrice =
          shortIntrinsic + longTimeValue * timeValueRatio;
        netCurrentPrice = longLeg.current_price - estimatedShortPrice;
        console.warn(
          `[Spreads] ${legs[0]?.symbol}: time-value estimation ` +
            `long=$${longLeg.current_price.toFixed(2)} short~=$${estimatedShortPrice.toFixed(2)} ` +
            `net=$${netCurrentPrice.toFixed(2)}`
        );
      }

      if (netCurrentPrice > spreadWidth) {
        console.warn(
          `[Spreads] ${legs[0]?.symbol}: net ${netCurrentPrice.toFixed(2)} ` +
            `exceeds width ${spreadWidth}, capping`
        );
        netCurrentPrice = spreadWidth;
      }

      const quantity = Math.abs(longLeg?.quantity || 1);
      const spreadPnl = (netCurrentPrice - netEntryPrice) * quantity * 100;
      const spreadPnlPercent =
        netEntryPrice > 0
          ? ((netCurrentPrice - netEntryPrice) / netEntryPrice) * 100
          : 0;

      return {
        id: spreadId,
        symbol: legs[0]?.symbol || '',
        legs: sortedLegs,
        longLeg,
        shortLeg,
        netEntryPrice,
        netCurrentPrice,
        underlyingPrice,
        quantity,
        pnl: spreadPnl,
        pnl_percent: spreadPnlPercent,
        expiration_date: legs[0]?.expiration_date,
        entry_date: legs[0]?.entry_date,
      };
    });
  }, [allPositionsEnriched]);

  // Create spread summary data for the summary calculation
  const spreadSummaryData: SpreadSummaryData[] = useMemo(
    () =>
      spreadsDisplay.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        netEntryPrice: s.netEntryPrice,
        netCurrentPrice: s.netCurrentPrice,
        quantity: s.quantity,
      })),
    [spreadsDisplay]
  );

  // Recalculate summary whenever positions or spreads change
  useEffect(() => {
    if (positions.length > 0 || spreadSummaryData.length > 0) {
      const newSummary = calculatePositionSummary(
        allPositionsEnriched,
        spreadSummaryData
      );
      setSummary(newSummary);
    }
  }, [allPositionsEnriched, spreadSummaryData, positions.length]);

  // Combined display positions for the table
  const displayPositions = standalonePositions;

  // Handle AI click for portfolio review - needs spreadsDisplay and standalonePositions
  const handlePortfolioAIClick = useCallback(() => {
    if (!summary) return;

    // Build spreads data for prompt
    const spreadsForPrompt = spreadsDisplay.map((s) => ({
      symbol: s.symbol,
      spreadType: s.longLeg?.option_type
        ? `${s.longLeg.option_type}_debit_spread`
        : 'call_debit_spread',
      longStrike: s.longLeg?.strike_price || 0,
      shortStrike: s.shortLeg?.strike_price || 0,
      quantity: s.quantity,
      netEntryPrice: s.netEntryPrice,
      netCurrentPrice: s.netCurrentPrice,
      pnl: s.pnl,
      pnlPercent: s.pnl_percent,
      expirationDate: s.expiration_date,
      underlyingPrice: s.underlyingPrice,
    }));

    // Build positions data for prompt
    const positionsForPrompt = standalonePositions.map((p) => ({
      symbol: p.symbol,
      positionType: p.position_type,
      quantity: p.quantity,
      entryPrice: p.entry_price,
      currentPrice: p.current_price,
      pnl: p.pnl,
      pnlPercent: p.pnl_percent,
      optionType: p.option_type,
      strikePrice: p.strike_price,
      expirationDate: p.expiration_date,
    }));

    const prompt = buildPortfolioPrompt({
      totalValue: summary.total_value,
      totalPnl: summary.total_pnl,
      totalPnlPercent: summary.total_pnl_percent,
      positionsCount: summary.positions_count,
      spreadsCount: summary.spreads_count,
      winners: summary.winners,
      losers: summary.losers,
      spreads: spreadsForPrompt,
      positions: positionsForPrompt,
    });

    console.log('[Positions] Portfolio AI prompt:', prompt);
    openChat(prompt);
  }, [openChat, summary, spreadsDisplay, standalonePositions]);

  // Not authenticated
  if (!user) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-medium">My Positions</h1>
          </div>
          <Separator className="mb-4" />
        </header>

        <Card className="p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">
            Sign in to track positions
          </h2>
          <p className="text-sm text-muted-foreground">
            Create an account to track your stock and options positions with
            live market data and AI-powered analysis.
          </p>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-medium">My Positions</h1>
          </div>
          <Separator className="mb-4" />
        </header>
        <div className="flex items-center justify-center py-12">
          <div
            className="animate-spin rounded-full h-8 w-8 
            border-b-2 border-primary"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-medium">My Positions</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || positions.length === 0}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={positions.length === 0}
              onClick={handlePortfolioAIClick}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              AI
            </Button>
          </div>
        </div>
        <Separator className="mb-4" />
        <p className="text-sm text-muted-foreground">
          Track your portfolio positions with live market data. Click Refresh to
          update prices, or use AI for position analysis.
        </p>
      </header>

      {/* Summary Cards */}
      {summary && positions.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-green-500" />
              <span className="text-caption text-muted-foreground">
                Total Value
              </span>
            </div>
            <p className="text-lg font-medium mt-1">
              ${summary.total_value.toLocaleString()}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              {summary.total_pnl >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className="text-caption text-muted-foreground">
                Total P&L
              </span>
            </div>
            <p
              className={cn(
                'text-lg font-medium mt-1',
                summary.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {summary.total_pnl >= 0 ? '+' : ''}$
              {summary.total_pnl.toLocaleString()}
              <span className="text-sm ml-1">
                ({summary.total_pnl_percent >= 0 ? '+' : ''}
                {summary.total_pnl_percent.toFixed(2)}%)
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-green-500" />
              <span className="text-caption text-muted-foreground">
                Winners
              </span>
            </div>
            <p className="text-lg font-medium mt-1 text-green-600">
              {summary.winners}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-3 w-3 text-red-500" />
              <span className="text-caption text-muted-foreground">Losers</span>
            </div>
            <p className="text-lg font-medium mt-1 text-red-600">
              {summary.losers}
            </p>
          </Card>
        </section>
      )}

      {/* Last Refreshed & Data Status */}
      {lastRefreshed && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Last refreshed: {lastRefreshed.toLocaleTimeString()}</span>
          {positions.some((p) => p.position_type === 'option') && (
            <span className="text-amber-600 dark:text-amber-400">
              Note: Option prices require manual updates
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-4 border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* Spreads Table */}
      {spreadsDisplay.length > 0 && (
        <TooltipProvider delayDuration={100}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Spreads</h2>
              {!hasMarketData && (
                <span className="text-xs text-muted-foreground">
                  Click Refresh to see P&L
                </span>
              )}
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Entry</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spreadsDisplay.map((spread) => (
                    <TableRow key={spread.id}>
                      <TableCell className="font-medium">
                        <div>
                          {spread.symbol}
                          {spread.underlyingPrice > 0 && (
                            <div className="text-xs text-muted-foreground">
                              @ ${spread.underlyingPrice.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-700 
                                dark:bg-emerald-900 dark:text-emerald-300 w-fit"
                          >
                            {spread.longLeg?.option_type?.toUpperCase()} DEBIT
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            ${spread.longLeg?.strike_price} / $
                            {spread.shortLeg?.strike_price}
                            {spread.expiration_date && (
                              <>
                                {' '}
                                •{' '}
                                {new Date(
                                  spread.expiration_date
                                ).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {spread.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${spread.netEntryPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {hasMarketData ? (
                          `$${spread.netCurrentPrice.toFixed(2)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {hasMarketData ? (
                          <>
                            <div
                              className={cn(
                                'font-mono font-medium',
                                spread.pnl >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              )}
                            >
                              {spread.pnl >= 0 ? '+' : ''}$
                              {spread.pnl.toFixed(0)}
                            </div>
                            <div
                              className={cn(
                                'text-xs',
                                spread.pnl_percent >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              )}
                            >
                              {spread.pnl_percent >= 0 ? '+' : ''}
                              {spread.pnl_percent.toFixed(1)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  const longStrike =
                                    spread.longLeg?.strike_price || 0;
                                  const shortStrike =
                                    spread.shortLeg?.strike_price || 0;
                                  const spreadType = spread.longLeg?.option_type
                                    ? `${spread.longLeg.option_type}_debit_spread`
                                    : 'call_debit_spread';

                                  const prompt = buildSpreadPrompt({
                                    symbol: spread.symbol,
                                    spreadType,
                                    lowerStrike: Math.min(
                                      longStrike,
                                      shortStrike
                                    ),
                                    upperStrike: Math.max(
                                      longStrike,
                                      shortStrike
                                    ),
                                    netEntryPrice: spread.netEntryPrice,
                                    netCurrentPrice: spread.netCurrentPrice,
                                    pnl: spread.pnl,
                                    pnl_percent: spread.pnl_percent,
                                    expiration_date: spread.expiration_date,
                                  });

                                  handleSpreadAIClick(prompt);
                                }}
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Ask Victor about this spread
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive 
                                    hover:text-destructive"
                                onClick={() => handleSpreadDeleted(spread.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </TooltipProvider>
      )}

      {/* Standalone Positions Table */}
      {standalonePositions.length > 0 && (
        <section>
          {spreadsDisplay.length > 0 && (
            <h2 className="text-lg font-medium mb-3">Positions</h2>
          )}
          <PositionsTable
            positions={displayPositions}
            onDelete={handlePositionDeleted}
            onAIClick={handlePositionAIClick}
            hasMarketData={enrichedPositions.length > 0}
          />
        </section>
      )}

      {/* Empty State */}
      {positions.length === 0 && (
        <Card className="p-8 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">No positions yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add your first position to start tracking your portfolio.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        </Card>
      )}

      {/* Add Position Dialog */}
      <AddPositionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onPositionAdded={handlePositionAdded}
      />
    </div>
  );
}
