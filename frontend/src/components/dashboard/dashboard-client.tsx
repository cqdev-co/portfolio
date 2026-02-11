'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  LayoutDashboard,
  Lock,
  LogIn,
  History,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchPositions,
  refreshPositionsWithMarketData,
  calculatePositionSummary,
  type SpreadSummaryData,
} from '@/lib/api/positions';
import type {
  Position,
  PositionWithMarketData,
  PositionSummary,
} from '@/lib/types/positions';

// Dashboard components
import { type MarketDataPoint } from './market-pulse';
import { type SectorDataPoint } from './sector-heatmap';
import { type SpreadDisplay } from './positions-overview';
import { StatusBar } from './status-bar';
import { DailyBriefing } from './daily-briefing';
import { AttentionRequired } from './attention-required';
import { MarketContext } from './market-context';
import { SignalHighlights } from './signal-highlights';
import { PerformanceSection } from './performance-section';

// Chat integration
import { useGlobalChat, buildPortfolioPrompt } from '@/components/chat';

// ============================================================================
// Auth: Only whitelisted emails can see this page
// Configured via NEXT_PUBLIC_WHITELISTED_EMAILS in .env.local (comma-separated)
// ============================================================================
const WHITELISTED_EMAILS: string[] = (
  process.env.NEXT_PUBLIC_WHITELISTED_EMAILS || ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// ============================================================================
// Market hours check (EST)
// ============================================================================
function isMarketHours(): boolean {
  const now = new Date();
  const est = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const day = est.getDay();
  const hour = est.getHours();
  const minute = est.getMinutes();
  const time = hour * 60 + minute;

  // Mon-Fri, 9:30 AM - 4:00 PM EST
  return day >= 1 && day <= 5 && time >= 570 && time <= 960;
}

// ============================================================================
// Component
// ============================================================================

export function DashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const { openChat } = useGlobalChat();

  // Market data state
  const [marketData, setMarketData] = useState<MarketDataPoint[]>([]);
  const [sectorData, setSectorData] = useState<SectorDataPoint[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);

  // Portfolio state
  const [positions, setPositions] = useState<Position[]>([]);
  const [enrichedPositions, setEnrichedPositions] = useState<
    PositionWithMarketData[]
  >([]);
  const [summary, setSummary] = useState<PositionSummary | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeJournalOpen, setTradeJournalOpen] = useState(false);

  // ============================================================================
  // Data fetching
  // ============================================================================

  /** Fetch market indices + sector data */
  const fetchMarketData = useCallback(async () => {
    try {
      const [marketRes, sectorRes] = await Promise.all([
        fetch('/api/odyssey/market-data'),
        fetch('/api/odyssey/sector-data'),
      ]);

      if (marketRes.ok) {
        const data = await marketRes.json();
        setMarketData(Array.isArray(data) ? data : []);
      }

      if (sectorRes.ok) {
        const data = await sectorRes.json();
        setSectorData(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[Dashboard] Market data error:', err);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  /** Fetch portfolio positions */
  const fetchPortfolio = useCallback(async () => {
    if (!user) {
      setPositionsLoading(false);
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
    } catch (err) {
      console.error('[Dashboard] Positions error:', err);
      setError('Failed to load positions');
    } finally {
      setPositionsLoading(false);
    }
  }, [user]);

  /** Refresh positions with live market data */
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
      console.error('[Dashboard] Refresh error:', err);
      setError('Failed to refresh market data');
    } finally {
      setRefreshing(false);
    }
  }, [positions]);

  // ============================================================================
  // Computed data
  // ============================================================================

  const allPositionsEnriched = useMemo(() => {
    if (enrichedPositions.length > 0) return enrichedPositions;
    return positions.map((p) => ({
      ...p,
      current_price: p.entry_price,
      pnl: 0,
      pnl_percent: 0,
    })) as PositionWithMarketData[];
  }, [enrichedPositions, positions]);

  const hasMarketData = useMemo(
    () =>
      enrichedPositions.length > 0 &&
      enrichedPositions.some((p) => p.underlying_price !== undefined),
    [enrichedPositions]
  );

  /** Build spread display data */
  const spreadsDisplay: SpreadDisplay[] = useMemo(() => {
    const spreadLegsMap = new Map<string, PositionWithMarketData[]>();
    for (const pos of allPositionsEnriched) {
      if (pos.spread_id) {
        const existing = spreadLegsMap.get(pos.spread_id) || [];
        existing.push(pos);
        spreadLegsMap.set(pos.spread_id, existing);
      }
    }

    return Array.from(spreadLegsMap.entries()).map(([spreadId, legs]) => {
      const sortedLegs = [...legs].sort((a, b) => b.quantity - a.quantity);
      const longLeg = sortedLegs.find((l) => l.quantity > 0);
      const shortLeg = sortedLegs.find((l) => l.quantity < 0);

      const netEntryPrice =
        longLeg && shortLeg
          ? longLeg.entry_price - shortLeg.entry_price
          : legs[0]?.entry_price || 0;

      let netCurrentPrice = netEntryPrice;
      const underlyingPrice = longLeg?.underlying_price || 0;

      const hasBidAsk =
        longLeg?.bid !== undefined &&
        (longLeg?.bid || 0) > 0 &&
        shortLeg?.ask !== undefined &&
        (shortLeg?.ask || 0) > 0;

      const hasMidPrices =
        longLeg &&
        shortLeg &&
        (longLeg.current_price !== longLeg.entry_price ||
          shortLeg.current_price !== shortLeg.entry_price);

      const longStrike = longLeg?.strike_price || 0;
      const shortStrike = shortLeg?.strike_price || 0;
      const spreadWidth = Math.abs(shortStrike - longStrike);

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
      } else if (hasMidPrices && longLeg && shortLeg) {
        // Fallback: use mid prices
        netCurrentPrice = longLeg.current_price - shortLeg.current_price;

        // Safety net: if one leg has chain data but the other only has intrinsic,
        // the spread value will be inflated by the time value mismatch.
        // Detect this: if netCurrentPrice > spreadWidth, estimate using time value.
        if (
          netCurrentPrice > spreadWidth &&
          underlyingPrice > 0 &&
          longLeg.bid !== undefined &&
          longLeg.bid > 0
        ) {
          // Long leg has chain data but short leg doesn't — estimate short leg
          // by preserving the long leg's time value ratio
          const longIntrinsic = Math.max(0, underlyingPrice - longStrike);
          const longTimeValue = Math.max(
            0,
            longLeg.current_price - longIntrinsic
          );
          const shortIntrinsic = Math.max(0, underlyingPrice - shortStrike);
          // Scale time value: shorter strike has more, higher strike has less
          const timeValueRatio =
            longIntrinsic > 0 ? shortIntrinsic / longIntrinsic : 0.9;
          const estimatedShortPrice =
            shortIntrinsic + longTimeValue * timeValueRatio;
          netCurrentPrice = longLeg.current_price - estimatedShortPrice;
          console.log(
            `[Spread] Time-value estimation for ${legs[0]?.symbol}: ` +
              `long=$${longLeg.current_price.toFixed(2)} (intrinsic=$${longIntrinsic.toFixed(2)}), ` +
              `short est=$${estimatedShortPrice.toFixed(2)} (intrinsic=$${shortIntrinsic.toFixed(2)}), ` +
              `net=$${netCurrentPrice.toFixed(2)}`
          );
        }
      }

      netCurrentPrice = Math.max(0, netCurrentPrice);
      if (netCurrentPrice > spreadWidth) netCurrentPrice = spreadWidth;

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

  /** Spread summary data for the summary calculation */
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

  /** Recalculate summary when positions/spreads change */
  useEffect(() => {
    if (positions.length > 0 || spreadSummaryData.length > 0) {
      const newSummary = calculatePositionSummary(
        allPositionsEnriched,
        spreadSummaryData
      );
      setSummary(newSummary);
    }
  }, [allPositionsEnriched, spreadSummaryData, positions.length]);

  const standalonePositions = useMemo(
    () => allPositionsEnriched.filter((p) => !p.spread_id),
    [allPositionsEnriched]
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial data load
  useEffect(() => {
    fetchMarketData();
    fetchPortfolio();
  }, [fetchMarketData, fetchPortfolio]);

  // Auto-refresh positions when they load
  useEffect(() => {
    if (positions.length > 0 && !lastRefreshed) {
      handleRefresh();
    }
  }, [positions.length, lastRefreshed, handleRefresh]);

  // Auto-refresh market data during market hours (every 60s)
  useEffect(() => {
    if (!isMarketHours()) return;

    const interval = setInterval(() => {
      fetchMarketData();
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // ============================================================================
  // AI integration
  // ============================================================================

  const handleAskVictor = useCallback(() => {
    if (!summary) {
      openChat(
        'Give me a quick morning briefing. What should I be watching today?'
      );
      return;
    }

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

    openChat(prompt);
  }, [openChat, summary, spreadsDisplay, standalonePositions]);

  // ============================================================================
  // Auth gating
  // ============================================================================

  if (authLoading) {
    return (
      <div className="flex flex-col gap-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-medium">Fund Dashboard</h1>
          </div>
          <Separator />
        </header>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-medium">Fund Dashboard</h1>
          </div>
          <Separator />
        </header>
        <Card className="p-8 text-center">
          <LogIn className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">Sign in required</h2>
          <p className="text-sm text-muted-foreground">
            This dashboard is private. Please sign in to continue.
          </p>
        </Card>
      </div>
    );
  }

  if (!WHITELISTED_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return (
      <div className="flex flex-col gap-5">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-medium">Fund Dashboard</h1>
          </div>
          <Separator />
        </header>
        <Card className="p-8 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-medium mb-2">Access restricted</h2>
          <p className="text-sm text-muted-foreground">
            This dashboard is private and restricted to the fund operator.
          </p>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex flex-col gap-5">
      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <StatusBar
        marketData={marketData}
        positions={allPositionsEnriched}
        spreads={spreadsDisplay}
        isMarketOpen={isMarketHours()}
        refreshing={refreshing}
        positionsCount={positions.length}
        lastRefreshed={lastRefreshed}
        onRefresh={handleRefresh}
        onAskVictor={handleAskVictor}
      />

      {/* Error */}
      {error && (
        <Card className="p-3 border-destructive/50 bg-destructive/10">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {/* ── AI Daily Briefing (hero section) ───────────────────────── */}
      <DailyBriefing
        marketData={marketData}
        spreads={spreadsDisplay}
        positions={allPositionsEnriched}
        summary={summary}
        loading={marketLoading || positionsLoading}
      />

      {/* ── Positions: Attention Required + collapsible full list ─── */}
      <AttentionRequired
        positions={allPositionsEnriched}
        spreads={spreadsDisplay}
        hasMarketData={hasMarketData}
        loading={positionsLoading}
      />

      {/* ── Market Context (collapsible — raw data on demand) ──────── */}
      <MarketContext
        marketData={marketData}
        sectorData={sectorData}
        loading={marketLoading}
      />

      {/* ── Signal Highlights (convergence + top signals) ──────────── */}
      <SignalHighlights />

      {/* ── Trade Journal (collapsible) ────────────────────────────── */}
      <div>
        <Button
          variant="ghost"
          onClick={() => setTradeJournalOpen(!tradeJournalOpen)}
          className="w-full justify-start h-auto py-2 px-2 text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5 mr-2 shrink-0" />
          <span className="text-xs font-medium">Trade Journal</span>
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 ml-auto transition-transform',
              tradeJournalOpen && 'rotate-90'
            )}
          />
        </Button>
        {tradeJournalOpen && (
          <div className="mt-2">
            <PerformanceSection />
          </div>
        )}
      </div>
    </div>
  );
}
