'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Gauge,
} from 'lucide-react';
import type { PositionWithMarketData } from '@/lib/types/positions';
import type { SpreadDisplay } from './positions-overview';

// ============================================================================
// Types
// ============================================================================

interface RiskStatusProps {
  positions: PositionWithMarketData[];
  spreads: SpreadDisplay[];
  loading?: boolean;
}

interface RiskMetrics {
  maxSingleExposure: number; // % of portfolio in one ticker
  sectorConcentration: string; // most concentrated sector
  avgDTE: number;
  positionsAtRisk: number; // positions needing attention
  circuitBreakerStatus: 'green' | 'yellow' | 'red';
  circuitBreakerLabel: string;
}

// ============================================================================
// Helpers
// ============================================================================

function calculateRiskMetrics(
  positions: PositionWithMarketData[],
  spreads: SpreadDisplay[]
): RiskMetrics {
  const standalone = positions.filter((p) => !p.spread_id);
  const allItems = [
    ...standalone.map((p) => p.symbol),
    ...spreads.map((s) => s.symbol),
  ];

  // Calculate ticker exposure
  const tickerCounts = new Map<string, number>();
  for (const sym of allItems) {
    tickerCounts.set(sym, (tickerCounts.get(sym) || 0) + 1);
  }
  const maxTickerCount = Math.max(...Array.from(tickerCounts.values()), 0);
  const maxSingleExposure =
    allItems.length > 0 ? (maxTickerCount / allItems.length) * 100 : 0;

  // Most common ticker (proxy for sector concentration)
  let sectorConcentration = 'N/A';
  let maxCount = 0;
  tickerCounts.forEach((count, sym) => {
    if (count > maxCount) {
      maxCount = count;
      sectorConcentration = sym;
    }
  });

  // Average DTE for spreads
  const dtes = spreads
    .map((s) => {
      if (!s.expiration_date) return null;
      const exp = new Date(s.expiration_date);
      const now = new Date();
      return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    })
    .filter((d): d is number => d !== null);
  const avgDTE =
    dtes.length > 0 ? dtes.reduce((a, b) => a + b, 0) / dtes.length : 0;

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

  // Circuit breaker (simplified: based on portfolio-level drawdown)
  const totalPnlPct =
    allItems.length > 0
      ? ((spreads.reduce((s, sp) => s + sp.pnl, 0) +
          standalone.reduce((s, p) => s + p.pnl, 0)) /
          Math.max(
            spreads.reduce(
              (s, sp) => s + sp.netEntryPrice * sp.quantity * 100,
              0
            ) +
              standalone.reduce(
                (s, p) => s + p.entry_price * Math.abs(p.quantity),
                0
              ),
            1
          )) *
        100
      : 0;

  let circuitBreakerStatus: 'green' | 'yellow' | 'red' = 'green';
  let circuitBreakerLabel = 'All Clear';
  if (totalPnlPct <= -15 || positionsAtRisk >= 3) {
    circuitBreakerStatus = 'red';
    circuitBreakerLabel = 'Pause Trading';
  } else if (totalPnlPct <= -8 || positionsAtRisk >= 2) {
    circuitBreakerStatus = 'yellow';
    circuitBreakerLabel = 'Reduce Size';
  }

  return {
    maxSingleExposure,
    sectorConcentration,
    avgDTE,
    positionsAtRisk,
    circuitBreakerStatus,
    circuitBreakerLabel,
  };
}

// ============================================================================
// Skeleton
// ============================================================================

function RiskSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-5 w-24 rounded bg-muted animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function RiskStatus({ positions, spreads, loading }: RiskStatusProps) {
  if (loading) {
    return <RiskSkeleton />;
  }

  const standalone = positions.filter((p) => !p.spread_id);
  if (standalone.length === 0 && spreads.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Risk Status</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-3">
          No positions to analyze
        </p>
      </Card>
    );
  }

  const metrics = calculateRiskMetrics(positions, spreads);

  const cbIcon =
    metrics.circuitBreakerStatus === 'green'
      ? ShieldCheck
      : metrics.circuitBreakerStatus === 'yellow'
        ? ShieldAlert
        : AlertOctagon;

  const cbColor =
    metrics.circuitBreakerStatus === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : metrics.circuitBreakerStatus === 'yellow'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const cbBgColor =
    metrics.circuitBreakerStatus === 'green'
      ? 'bg-emerald-500/10'
      : metrics.circuitBreakerStatus === 'yellow'
        ? 'bg-amber-500/10'
        : 'bg-red-500/10';

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Risk Status</h3>
      </div>

      {/* Circuit Breaker Status - Prominent */}
      <div
        className={cn('rounded-md p-3 mb-3 flex items-center gap-3', cbBgColor)}
      >
        {(() => {
          const CbIcon = cbIcon;
          return <CbIcon className={cn('h-5 w-5', cbColor)} />;
        })()}
        <div>
          <div className={cn('text-sm font-semibold', cbColor)}>
            {metrics.circuitBreakerLabel}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Circuit Breaker Status
          </div>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Gauge className="h-3 w-3" />
            Max Single Exposure
          </span>
          <span
            className={cn(
              'text-xs font-mono font-semibold',
              metrics.maxSingleExposure > 30
                ? 'text-red-600 dark:text-red-400'
                : metrics.maxSingleExposure > 20
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
            )}
          >
            {metrics.maxSingleExposure.toFixed(0)}%
            {metrics.sectorConcentration !== 'N/A' && (
              <span className="text-muted-foreground ml-1">
                ({metrics.sectorConcentration})
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Avg DTE</span>
          <span
            className={cn(
              'text-xs font-mono font-semibold',
              metrics.avgDTE <= 14
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-foreground'
            )}
          >
            {metrics.avgDTE > 0 ? `${metrics.avgDTE.toFixed(0)} days` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Positions at Risk
          </span>
          <Badge
            variant={metrics.positionsAtRisk > 0 ? 'destructive' : 'outline'}
            className="text-[10px]"
          >
            {metrics.positionsAtRisk}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
