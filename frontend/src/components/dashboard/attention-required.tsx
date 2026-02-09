'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Sparkles,
  Crosshair,
} from 'lucide-react';
import type { PositionWithMarketData } from '@/lib/types/positions';
import { PositionsOverview, type SpreadDisplay } from './positions-overview';
import { usePositionAnnotations } from './daily-briefing';

// ============================================================================
// Types
// ============================================================================

interface AttentionRequiredProps {
  positions: PositionWithMarketData[];
  spreads: SpreadDisplay[];
  hasMarketData: boolean;
  loading?: boolean;
}

interface UrgentItem {
  type: 'spread' | 'position';
  id: string;
  symbol: string;
  actionLabel: string;
  actionVariant: 'default' | 'destructive' | 'secondary';
  actionIcon: React.ElementType;
  pnl: number;
  pnl_percent: number;
  dte: number | null;
  detail: string;
  annotation?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getDTE(expirationDate: string | undefined | null): number | null {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate);
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Priority order for sorting urgent items
const ACTION_PRIORITY: Record<string, number> = {
  EXPIRED: 0,
  'Expiring Soon': 1,
  Review: 2,
  'Take Profit': 3,
};

// ============================================================================
// Skeleton
// ============================================================================

function AttentionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function AttentionRequired({
  positions,
  spreads,
  hasMarketData,
  loading,
}: AttentionRequiredProps) {
  const [showAll, setShowAll] = useState(false);
  const annotations = usePositionAnnotations();

  const standalonePositions = useMemo(
    () => positions.filter((p) => !p.spread_id),
    [positions]
  );

  // Categorize all positions into urgent vs on-track
  const { urgent, onTrackCount } = useMemo(() => {
    const urgentItems: UrgentItem[] = [];
    let onTrack = 0;

    // Check spreads
    for (const spread of spreads) {
      const dte = getDTE(spread.expiration_date);
      const pnlPct = spread.pnl_percent;
      const detail = `${spread.longLeg?.strike_price}/${spread.shortLeg?.strike_price} ${(spread.longLeg?.option_type || 'call').toUpperCase()} DEBIT`;

      if (dte !== null && dte <= 0) {
        urgentItems.push({
          type: 'spread',
          id: spread.id,
          symbol: spread.symbol,
          actionLabel: 'EXPIRED',
          actionVariant: 'destructive',
          actionIcon: AlertTriangle,
          pnl: spread.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[spread.symbol],
        });
      } else if (pnlPct >= 50) {
        urgentItems.push({
          type: 'spread',
          id: spread.id,
          symbol: spread.symbol,
          actionLabel: 'Take Profit',
          actionVariant: 'default',
          actionIcon: CheckCircle2,
          pnl: spread.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[spread.symbol],
        });
      } else if (dte !== null && dte <= 7) {
        urgentItems.push({
          type: 'spread',
          id: spread.id,
          symbol: spread.symbol,
          actionLabel: 'Expiring Soon',
          actionVariant: 'destructive',
          actionIcon: Clock,
          pnl: spread.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[spread.symbol],
        });
      } else if (pnlPct <= -30) {
        urgentItems.push({
          type: 'spread',
          id: spread.id,
          symbol: spread.symbol,
          actionLabel: 'Review',
          actionVariant: 'destructive',
          actionIcon: AlertTriangle,
          pnl: spread.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[spread.symbol],
        });
      } else {
        onTrack++;
      }
    }

    // Check standalone positions
    for (const pos of standalonePositions) {
      const dte = getDTE(pos.expiration_date);
      const pnlPct = pos.pnl_percent;
      const detail = `${pos.position_type.toUpperCase()} x${Math.abs(pos.quantity)}`;

      if (dte !== null && dte <= 0) {
        urgentItems.push({
          type: 'position',
          id: pos.id,
          symbol: pos.symbol,
          actionLabel: 'EXPIRED',
          actionVariant: 'destructive',
          actionIcon: AlertTriangle,
          pnl: pos.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[pos.symbol],
        });
      } else if (pnlPct >= 50) {
        urgentItems.push({
          type: 'position',
          id: pos.id,
          symbol: pos.symbol,
          actionLabel: 'Take Profit',
          actionVariant: 'default',
          actionIcon: CheckCircle2,
          pnl: pos.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[pos.symbol],
        });
      } else if (dte !== null && dte <= 7 && dte > 0) {
        urgentItems.push({
          type: 'position',
          id: pos.id,
          symbol: pos.symbol,
          actionLabel: 'Expiring Soon',
          actionVariant: 'destructive',
          actionIcon: Clock,
          pnl: pos.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[pos.symbol],
        });
      } else if (pnlPct <= -30) {
        urgentItems.push({
          type: 'position',
          id: pos.id,
          symbol: pos.symbol,
          actionLabel: 'Review',
          actionVariant: 'destructive',
          actionIcon: AlertTriangle,
          pnl: pos.pnl,
          pnl_percent: pnlPct,
          dte,
          detail,
          annotation: annotations[pos.symbol],
        });
      } else {
        onTrack++;
      }
    }

    // Sort by urgency priority
    urgentItems.sort(
      (a, b) =>
        (ACTION_PRIORITY[a.actionLabel] ?? 99) -
        (ACTION_PRIORITY[b.actionLabel] ?? 99)
    );

    return { urgent: urgentItems, onTrackCount: onTrack };
  }, [spreads, standalonePositions, annotations]);

  const totalPositions = spreads.length + standalonePositions.length;

  if (loading) {
    return <AttentionSkeleton />;
  }

  if (totalPositions === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">Positions</h2>
        </div>
        <Card className="p-6 text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">No open positions</p>
          <p className="text-xs text-muted-foreground">
            Add positions from the Positions page to see them here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">Positions</h2>
        <Badge variant="outline" className="text-[10px]">
          {totalPositions} open
        </Badge>
        {urgent.length > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {urgent.length} need attention
          </Badge>
        )}
      </div>

      {/* Urgent position cards */}
      {urgent.length > 0 && (
        <div className="space-y-2">
          {urgent.map((item) => {
            const ActionIcon = item.actionIcon;
            return (
              <Card
                key={item.id}
                className={cn(
                  'p-3',
                  item.actionVariant === 'destructive' &&
                    'border-red-200 dark:border-red-800/50',
                  item.actionLabel === 'Take Profit' &&
                    'border-emerald-200 dark:border-emerald-800/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Left: Symbol + details */}
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-semibold">{item.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                    {item.dte !== null && item.dte > 0 && (
                      <span
                        className={cn(
                          'text-xs font-mono',
                          item.dte <= 7
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : item.dte <= 21
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                        )}
                      >
                        {item.dte}d
                      </span>
                    )}
                  </div>

                  {/* Right: P&L + action */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {hasMarketData && (
                      <span
                        className={cn(
                          'text-xs font-mono font-semibold',
                          item.pnl >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        )}
                      >
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(0)} (
                        {item.pnl_percent >= 0 ? '+' : ''}
                        {item.pnl_percent.toFixed(1)}%)
                      </span>
                    )}
                    <Badge
                      variant={item.actionVariant}
                      className="text-[10px] gap-1"
                    >
                      <ActionIcon className="h-3 w-3" />
                      {item.actionLabel}
                    </Badge>
                  </div>
                </div>

                {/* AI annotation */}
                {item.annotation && (
                  <div className="flex items-start gap-1 mt-2">
                    <Sparkles className="h-2.5 w-2.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-[10px] text-muted-foreground leading-tight italic">
                      {item.annotation}
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* All positions on track message */}
      {urgent.length === 0 && (
        <Card className="p-3 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              All {totalPositions} positions on track
            </span>
          </div>
        </Card>
      )}

      {/* Toggle to show all positions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowAll(!showAll)}
        className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      >
        {showAll ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {showAll
          ? 'Hide details'
          : urgent.length > 0
            ? `${onTrackCount} other position${onTrackCount !== 1 ? 's' : ''} on track`
            : `View all ${totalPositions} positions`}
      </Button>

      {/* Full positions table (expandable) */}
      {showAll && (
        <PositionsOverview
          positions={positions}
          spreads={spreads}
          hasMarketData={hasMarketData}
        />
      )}
    </div>
  );
}
