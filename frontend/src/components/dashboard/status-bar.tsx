'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import type { MarketDataPoint } from './market-pulse';
import type { PositionWithMarketData } from '@/lib/types/positions';
import type { SpreadDisplay } from './positions-overview';

// ============================================================================
// Types
// ============================================================================

interface StatusBarProps {
  marketData: MarketDataPoint[];
  positions: PositionWithMarketData[];
  spreads: SpreadDisplay[];
  isMarketOpen: boolean;
  refreshing: boolean;
  positionsCount: number;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  onAskVictor: () => void;
}

// ============================================================================
// Regime detection
// ============================================================================

function getMarketRegime(marketData: MarketDataPoint[]) {
  const spy = marketData.find((d) => d.symbol === 'SPY');
  const vix = marketData.find((d) => d.symbol === '^VIX');

  if (!spy || !vix)
    return {
      label: 'LOADING',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };

  if (vix.price >= 30)
    return {
      label: 'HIGH_VOL',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10',
    };
  if (vix.price >= 25 || spy.changePercent < -1.5)
    return {
      label: 'RISK_OFF',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    };
  if (spy.changePercent > 0.5 && vix.price < 20)
    return {
      label: 'RISK_ON',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  return {
    label: 'NEUTRAL',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  };
}

function getVixRegime(vixPrice: number) {
  if (vixPrice < 15)
    return {
      label: 'CALM',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  if (vixPrice < 20)
    return {
      label: 'NORMAL',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    };
  if (vixPrice < 25)
    return {
      label: 'ELEVATED',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
    };
  if (vixPrice < 30)
    return {
      label: 'HIGH',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    };
  return {
    label: 'EXTREME',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
  };
}

function getCircuitBreaker(
  positions: PositionWithMarketData[],
  spreads: SpreadDisplay[]
): { status: 'green' | 'yellow' | 'red'; label: string } {
  const standalone = positions.filter((p) => !p.spread_id);

  if (standalone.length === 0 && spreads.length === 0) {
    return { status: 'green', label: 'All Clear' };
  }

  // Positions at risk: DTE <= 7 or P&L <= -20%
  const spreadRisk = spreads.filter((s) => {
    const dte = s.expiration_date
      ? Math.ceil(
          (new Date(s.expiration_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      : null;
    return (dte !== null && dte <= 7) || s.pnl_percent <= -20;
  });
  const posRisk = standalone.filter((p) => p.pnl_percent <= -20);
  const positionsAtRisk = spreadRisk.length + posRisk.length;

  // Portfolio-level drawdown
  const totalCost =
    spreads.reduce((s, sp) => s + sp.netEntryPrice * sp.quantity * 100, 0) +
    standalone.reduce((s, p) => s + p.entry_price * Math.abs(p.quantity), 0);
  const totalPnl =
    spreads.reduce((s, sp) => s + sp.pnl, 0) +
    standalone.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  if (totalPnlPct <= -15 || positionsAtRisk >= 3)
    return { status: 'red', label: 'Pause Trading' };
  if (totalPnlPct <= -8 || positionsAtRisk >= 2)
    return { status: 'yellow', label: 'Reduce Size' };
  return { status: 'green', label: 'All Clear' };
}

// ============================================================================
// Component
// ============================================================================

export function StatusBar({
  marketData,
  positions,
  spreads,
  isMarketOpen,
  refreshing,
  positionsCount,
  lastRefreshed,
  onRefresh,
  onAskVictor,
}: StatusBarProps) {
  const regime = marketData.length > 0 ? getMarketRegime(marketData) : null;
  const vix = marketData.find((d) => d.symbol === '^VIX');
  const vixRegime = vix ? getVixRegime(vix.price) : null;
  const circuitBreaker = getCircuitBreaker(positions, spreads);

  const cbDotColor = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500 animate-pulse',
    red: 'bg-red-500 animate-pulse',
  }[circuitBreaker.status];

  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        {/* Left: Title + status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-medium">Fund Dashboard</h1>
          </div>

          {isMarketOpen ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
            >
              MARKET OPEN
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              CLOSED
            </Badge>
          )}

          {regime && regime.label !== 'LOADING' && (
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider',
                regime.bgColor,
                regime.color
              )}
            >
              {(regime.label === 'RISK_OFF' || regime.label === 'HIGH_VOL') && (
                <AlertTriangle className="h-2.5 w-2.5" />
              )}
              {regime.label}
            </div>
          )}

          {vixRegime && (
            <div
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider',
                vixRegime.bgColor,
                vixRegime.color
              )}
            >
              VIX {vixRegime.label}
            </div>
          )}

          {/* Circuit breaker indicator */}
          <div
            className="flex items-center gap-1.5"
            title={circuitBreaker.label}
          >
            <div className={cn('h-2 w-2 rounded-full', cbDotColor)} />
            <span className="text-[10px] text-muted-foreground">
              {circuitBreaker.label}
            </span>
          </div>
        </div>

        {/* Right: Time + action buttons */}
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefreshed.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing || positionsCount === 0}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAskVictor}
            className="h-7 gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask Victor
          </Button>
        </div>
      </div>
      <Separator />
    </header>
  );
}
