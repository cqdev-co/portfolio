'use client';

import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SectorDataPoint {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface SectorHeatmapProps {
  data: SectorDataPoint[];
  loading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** Get background color intensity based on percent change */
function getHeatColor(changePercent: number): string {
  const abs = Math.abs(changePercent);

  if (changePercent >= 0) {
    if (abs >= 2.0) return 'bg-emerald-600/30 dark:bg-emerald-500/25';
    if (abs >= 1.0) return 'bg-emerald-500/20 dark:bg-emerald-500/15';
    if (abs >= 0.5) return 'bg-emerald-400/15 dark:bg-emerald-500/10';
    if (abs >= 0.1) return 'bg-emerald-300/10 dark:bg-emerald-500/5';
    return 'bg-muted/30';
  } else {
    if (abs >= 2.0) return 'bg-red-600/30 dark:bg-red-500/25';
    if (abs >= 1.0) return 'bg-red-500/20 dark:bg-red-500/15';
    if (abs >= 0.5) return 'bg-red-400/15 dark:bg-red-500/10';
    if (abs >= 0.1) return 'bg-red-300/10 dark:bg-red-500/5';
    return 'bg-muted/30';
  }
}

function getTextColor(changePercent: number): string {
  if (changePercent >= 0.1) return 'text-emerald-600 dark:text-emerald-400';
  if (changePercent <= -0.1) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

/** Short sector name for compact display */
function getShortName(name: string): string {
  const map: Record<string, string> = {
    Technology: 'Tech',
    Financials: 'Fin',
    Energy: 'Energy',
    Healthcare: 'Health',
    'Consumer Discretionary': 'Disc',
    'Consumer Staples': 'Staples',
    Industrials: 'Indust',
    Materials: 'Mats',
    Utilities: 'Utils',
    'Real Estate': 'RE',
    'Communication Services': 'Comm',
  };
  return map[name] || name.slice(0, 5);
}

// ============================================================================
// Skeleton
// ============================================================================

function SectorHeatmapSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="h-4 w-28 rounded bg-muted animate-pulse mb-3" />
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="rounded-md p-2 bg-muted/30 animate-pulse">
            <div className="h-3 w-8 rounded bg-muted mb-1.5" />
            <div className="h-4 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SectorHeatmap({ data, loading }: SectorHeatmapProps) {
  if (loading || data.length === 0) {
    return <SectorHeatmapSkeleton />;
  }

  // Sort by change percent for visual clarity
  const sorted = [...data].sort((a, b) => b.changePercent - a.changePercent);

  const avgChange =
    data.reduce((sum, d) => sum + d.changePercent, 0) / data.length;
  const breadth = data.filter((d) => d.changePercent > 0).length;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Sector Performance</span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            Breadth:{' '}
            <span
              className={cn(
                'font-semibold',
                breadth >= 7
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : breadth >= 4
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
              )}
            >
              {breadth}/11
            </span>
          </span>
          <span>
            Avg:{' '}
            <span
              className={cn('font-semibold font-mono', getTextColor(avgChange))}
            >
              {avgChange >= 0 ? '+' : ''}
              {avgChange.toFixed(2)}%
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {sorted.map((sector) => (
          <div
            key={sector.symbol}
            className={cn(
              'rounded-md p-2 transition-colors cursor-default',
              getHeatColor(sector.changePercent)
            )}
          >
            <div className="text-[10px] text-muted-foreground font-medium truncate">
              {getShortName(sector.name)}
            </div>
            <div
              className={cn(
                'text-xs font-semibold font-mono',
                getTextColor(sector.changePercent)
              )}
            >
              {sector.changePercent >= 0 ? '+' : ''}
              {sector.changePercent.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
