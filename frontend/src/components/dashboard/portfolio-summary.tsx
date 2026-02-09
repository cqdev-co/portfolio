'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Clock,
} from 'lucide-react';
import type { PositionSummary } from '@/lib/types/positions';

// ============================================================================
// Types
// ============================================================================

interface PortfolioSummaryProps {
  summary: PositionSummary | null;
  lastRefreshed: Date | null;
  loading?: boolean;
}

// ============================================================================
// Skeleton
// ============================================================================

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-3">
          <div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" />
          <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Metric Card
// ============================================================================

function MetricCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('h-3 w-3', color || 'text-muted-foreground')} />
        <span className="text-[11px] text-muted-foreground font-medium">
          {label}
        </span>
      </div>
      <div className={cn('text-lg font-semibold font-mono', color)}>
        {value}
      </div>
      {subValue && (
        <div
          className={cn(
            'text-[11px] font-mono',
            color || 'text-muted-foreground'
          )}
        >
          {subValue}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function PortfolioSummary({
  summary,
  lastRefreshed,
  loading,
}: PortfolioSummaryProps) {
  if (loading || !summary) {
    return <SummarySkeleton />;
  }

  const pnlColor =
    summary.total_pnl >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  const winRate =
    summary.winners + summary.losers > 0
      ? (summary.winners / (summary.winners + summary.losers)) * 100
      : 0;

  const winRateColor =
    winRate >= 60
      ? 'text-emerald-600 dark:text-emerald-400'
      : winRate >= 40
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard
          label="Portfolio Value"
          value={`$${summary.total_value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          color="text-foreground"
        />
        <MetricCard
          label="Total P&L"
          value={`${summary.total_pnl >= 0 ? '+' : ''}$${summary.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          subValue={`${summary.total_pnl_percent >= 0 ? '+' : ''}${summary.total_pnl_percent.toFixed(2)}%`}
          icon={summary.total_pnl >= 0 ? TrendingUp : TrendingDown}
          color={pnlColor}
        />
        <MetricCard
          label="Win Rate"
          value={`${winRate.toFixed(0)}%`}
          subValue={`${summary.winners}W / ${summary.losers}L`}
          icon={Target}
          color={winRateColor}
        />
        <MetricCard
          label="Open Positions"
          value={`${summary.positions_count}`}
          subValue={
            summary.spreads_count > 0
              ? `+ ${summary.spreads_count} spreads`
              : undefined
          }
          icon={BarChart3}
        />
        {summary.best_performer && (
          <MetricCard
            label="Best Performer"
            value={summary.best_performer.symbol}
            subValue={`+${summary.best_performer.pnl_percent.toFixed(1)}%`}
            icon={TrendingUp}
            color="text-emerald-600 dark:text-emerald-400"
          />
        )}
        {summary.worst_performer && (
          <MetricCard
            label="Worst Performer"
            value={summary.worst_performer.symbol}
            subValue={`${summary.worst_performer.pnl_percent.toFixed(1)}%`}
            icon={TrendingDown}
            color="text-red-600 dark:text-red-400"
          />
        )}
      </div>

      {lastRefreshed && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Updated {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
