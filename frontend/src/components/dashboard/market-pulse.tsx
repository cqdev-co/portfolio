'use client';

import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  AlertTriangle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface MarketDataPoint {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

interface MarketPulseProps {
  data: MarketDataPoint[];
  loading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/** Map VIX level to a regime label + color */
function getVixRegime(vix: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (vix < 15)
    return {
      label: 'CALM',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  if (vix < 20)
    return {
      label: 'NORMAL',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
    };
  if (vix < 25)
    return {
      label: 'ELEVATED',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
    };
  if (vix < 30)
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

/** Determine market regime from SPY + VIX data */
function getMarketRegime(
  spy: MarketDataPoint | undefined,
  vix: MarketDataPoint | undefined
): { label: string; color: string; bgColor: string } {
  if (!spy || !vix) {
    return {
      label: 'LOADING',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };
  }

  const vixLevel = vix.price;
  const spyChange = spy.changePercent;

  if (vixLevel >= 30) {
    return {
      label: 'HIGH_VOL',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10',
    };
  }
  if (vixLevel >= 25 || spyChange < -1.5) {
    return {
      label: 'RISK_OFF',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
    };
  }
  if (spyChange > 0.5 && vixLevel < 20) {
    return {
      label: 'RISK_ON',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    };
  }
  return {
    label: 'NEUTRAL',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  };
}

function formatDisplaySymbol(symbol: string): string {
  return symbol === '^VIX' ? 'VIX' : symbol;
}

// ============================================================================
// Shimmer skeleton for loading state
// ============================================================================

function MarketPulseSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md border p-2.5">
            <div className="h-3 w-8 rounded bg-muted animate-pulse mb-2" />
            <div className="h-5 w-16 rounded bg-muted animate-pulse mb-1" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function MarketPulse({ data, loading }: MarketPulseProps) {
  if (loading || data.length === 0) {
    return <MarketPulseSkeleton />;
  }

  const spy = data.find((d) => d.symbol === 'SPY');
  const vix = data.find((d) => d.symbol === '^VIX');
  const vixRegime = vix ? getVixRegime(vix.price) : null;
  const marketRegime = getMarketRegime(spy, vix);

  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Header row: title + regime badges */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Market Pulse</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Market Regime Badge */}
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider',
              marketRegime.bgColor,
              marketRegime.color
            )}
          >
            {marketRegime.label === 'RISK_OFF' ||
            marketRegime.label === 'HIGH_VOL' ? (
              <AlertTriangle className="h-3 w-3" />
            ) : null}
            {marketRegime.label}
          </div>
          {/* VIX Regime Badge */}
          {vixRegime && (
            <div
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider',
                vixRegime.bgColor,
                vixRegime.color
              )}
            >
              VIX {vixRegime.label}
            </div>
          )}
        </div>
      </div>

      {/* Index cards grid */}
      <div className="grid grid-cols-5 gap-2">
        {data.map((point) => {
          const isVix = point.symbol === '^VIX';
          const isPositive = point.changePercent >= 0;
          const displaySymbol = formatDisplaySymbol(point.symbol);

          // VIX has inverse meaning - high VIX is bad
          const sentimentColor = isVix
            ? point.price >= 25
              ? 'text-red-600 dark:text-red-400'
              : point.price >= 20
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            : isPositive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400';

          return (
            <div
              key={point.symbol}
              className="rounded-md border p-2.5 transition-colors hover:bg-accent/50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {displaySymbol}
                </span>
                {isVix ? (
                  <Activity className="h-3 w-3 text-muted-foreground" />
                ) : isPositive ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : point.changePercent < 0 ? (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <div className="text-base font-semibold font-mono">
                $
                {point.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div
                className={cn(
                  'text-[11px] font-mono font-medium',
                  sentimentColor
                )}
              >
                {isPositive ? '+' : ''}
                {point.changePercent.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
