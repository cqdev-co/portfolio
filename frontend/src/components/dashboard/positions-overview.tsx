'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import type { PositionWithMarketData } from '@/lib/types/positions';
import { usePositionAnnotations } from './daily-briefing';

// ============================================================================
// Types
// ============================================================================

export interface SpreadDisplay {
  id: string;
  symbol: string;
  legs: PositionWithMarketData[];
  longLeg?: PositionWithMarketData;
  shortLeg?: PositionWithMarketData;
  netEntryPrice: number;
  netCurrentPrice: number;
  underlyingPrice: number;
  quantity: number;
  pnl: number;
  pnl_percent: number;
  expiration_date?: string;
  entry_date?: string;
}

interface PositionsOverviewProps {
  positions: PositionWithMarketData[];
  spreads: SpreadDisplay[];
  hasMarketData: boolean;
  loading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** Calculate DTE (Days To Expiration) */
function getDTE(expirationDate: string | undefined | null): number | null {
  if (!expirationDate) return null;
  const exp = new Date(expirationDate);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Get action badge for a spread based on metrics */
function getSpreadAction(spread: SpreadDisplay): {
  label: string;
  variant: 'default' | 'destructive' | 'outline' | 'secondary';
  icon: React.ElementType;
} | null {
  const dte = getDTE(spread.expiration_date);
  const pnlPct = spread.pnl_percent;

  // Profit target hit (>50% of max profit)
  if (pnlPct >= 50) {
    return {
      label: 'Take Profit',
      variant: 'default',
      icon: CheckCircle2,
    };
  }

  // DTE warning
  if (dte !== null && dte <= 7 && dte > 0) {
    return {
      label: 'Expiring Soon',
      variant: 'destructive',
      icon: AlertTriangle,
    };
  }

  // Expired
  if (dte !== null && dte <= 0) {
    return {
      label: 'EXPIRED',
      variant: 'destructive',
      icon: AlertTriangle,
    };
  }

  // Significant loss
  if (pnlPct <= -30) {
    return {
      label: 'Review',
      variant: 'destructive',
      icon: AlertTriangle,
    };
  }

  // Moderate loss
  if (pnlPct <= -15) {
    return {
      label: 'Watch',
      variant: 'secondary',
      icon: Clock,
    };
  }

  return null;
}

// ============================================================================
// Skeleton
// ============================================================================

function PositionsSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="flex gap-3">
              <div className="h-4 w-12 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            </div>
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

export function PositionsOverview({
  positions,
  spreads,
  hasMarketData,
  loading,
}: PositionsOverviewProps) {
  const annotations = usePositionAnnotations();

  // Filter standalone positions (not part of spreads)
  const standalonePositions = useMemo(
    () => positions.filter((p) => !p.spread_id),
    [positions]
  );

  if (loading) {
    return <PositionsSkeleton />;
  }

  const totalItems = standalonePositions.length + spreads.length;

  if (totalItems === 0) {
    return (
      <Card className="p-6 text-center">
        <TrendingUp className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">No open positions</p>
        <p className="text-xs text-muted-foreground">
          Add positions from the Positions page to see them here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Spreads */}
      {spreads.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Spreads ({spreads.length})
          </h3>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Symbol</TableHead>
                  <TableHead className="text-xs">Strategy</TableHead>
                  <TableHead className="text-xs text-right">DTE</TableHead>
                  <TableHead className="text-xs text-right">Entry</TableHead>
                  <TableHead className="text-xs text-right">Current</TableHead>
                  <TableHead className="text-xs text-right">P&L</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spreads.map((spread) => {
                  const dte = getDTE(spread.expiration_date);
                  const action = getSpreadAction(spread);

                  return (
                    <TableRow key={spread.id}>
                      <TableCell className="py-2">
                        <div className="font-medium text-sm">
                          {spread.symbol}
                        </div>
                        {spread.underlyingPrice > 0 && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            @ ${spread.underlyingPrice.toFixed(2)}
                          </div>
                        )}
                        {annotations[spread.symbol] && (
                          <div className="flex items-start gap-1 mt-1">
                            <Sparkles className="h-2.5 w-2.5 text-primary shrink-0 mt-0.5" />
                            <span className="text-[10px] text-muted-foreground leading-tight italic">
                              {annotations[spread.symbol]}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        >
                          {spread.longLeg?.option_type?.toUpperCase()} DEBIT
                        </Badge>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ${spread.longLeg?.strike_price} / $
                          {spread.shortLeg?.strike_price}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {dte !== null ? (
                          <span
                            className={cn(
                              'text-xs font-mono',
                              dte <= 7
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : dte <= 21
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {dte}d
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2 font-mono text-xs">
                        ${spread.netEntryPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right py-2 font-mono text-xs">
                        {hasMarketData ? (
                          `$${spread.netCurrentPrice.toFixed(2)}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {hasMarketData ? (
                          <div>
                            <div
                              className={cn(
                                'text-xs font-mono font-semibold',
                                spread.pnl >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {spread.pnl >= 0 ? '+' : ''}$
                              {spread.pnl.toFixed(0)}
                            </div>
                            <div
                              className={cn(
                                'text-[10px] font-mono',
                                spread.pnl_percent >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {spread.pnl_percent >= 0 ? '+' : ''}
                              {spread.pnl_percent.toFixed(1)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        {action ? (
                          <Badge
                            variant={action.variant}
                            className="text-[10px] gap-1"
                          >
                            <action.icon className="h-3 w-3" />
                            {action.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Hold
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Standalone Positions */}
      {standalonePositions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Positions ({standalonePositions.length})
          </h3>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Symbol</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Qty</TableHead>
                  <TableHead className="text-xs text-right">Entry</TableHead>
                  <TableHead className="text-xs text-right">Current</TableHead>
                  <TableHead className="text-xs text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standalonePositions.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="py-2 font-medium text-sm">
                      {pos.symbol}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {pos.position_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs">
                      {pos.quantity}
                    </TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs">
                      ${pos.entry_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs">
                      {hasMarketData ? (
                        `$${pos.current_price.toFixed(2)}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      {hasMarketData ? (
                        <div>
                          <div
                            className={cn(
                              'text-xs font-mono font-semibold',
                              pos.pnl >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(0)}
                          </div>
                          <div
                            className={cn(
                              'text-[10px] font-mono',
                              pos.pnl_percent >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {pos.pnl_percent >= 0 ? '+' : ''}
                            {pos.pnl_percent.toFixed(1)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
