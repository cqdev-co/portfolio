'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Zap, ArrowUpRight, ArrowDownRight, Flame, Eye } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface UnusualOptionsSignal {
  id: string;
  ticker: string;
  strike: number;
  expiry: string;
  option_type: 'call' | 'put';
  signal_grade: string;
  premium_flow: number;
  volume: number;
  open_interest: number;
  volume_oi_ratio: number;
  detected_at: string;
  spot_price_at_detection: number;
}

interface PennyStockSignal {
  id: string;
  ticker: string;
  signal_type: string;
  price_at_signal: number;
  volume_at_signal: number;
  score: number;
  detected_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getGradeColor(grade: string): string {
  switch (grade?.toUpperCase()) {
    case 'S':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
    case 'A':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300';
    case 'B':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
    case 'C':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatPremium(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - then) / 60_000);

  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

// ============================================================================
// Skeleton
// ============================================================================

function SignalsSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center py-2 border-b last:border-0"
          >
            <div className="flex gap-2">
              <div className="h-4 w-10 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-4 w-14 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SignalsPanel() {
  const [optionSignals, setOptionSignals] = useState<UnusualOptionsSignal[]>(
    []
  );
  const [pennySignals, setPennySignals] = useState<PennyStockSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSignals() {
      try {
        // Fetch unusual options signals (top 8, recent, high grade)
        const { data: options } = await supabase
          .from('unusual_options_signals')
          .select('*')
          .in('signal_grade', ['S', 'A', 'B'])
          .order('detected_at', { ascending: false })
          .limit(8);

        if (options) {
          setOptionSignals(options as UnusualOptionsSignal[]);
        }

        // Fetch penny stock signals (top 5, recent)
        const { data: pennies } = await supabase
          .from('penny_stock_signals')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(5);

        if (pennies) {
          setPennySignals(pennies as PennyStockSignal[]);
        }
      } catch (err) {
        console.error('[Signals] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, []);

  if (loading) {
    return <SignalsSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Unusual Options Signals */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-medium">Unusual Options Activity</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {optionSignals.length} signals
          </Badge>
        </div>

        {optionSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No recent high-grade signals
          </p>
        ) : (
          <div className="space-y-1">
            {optionSignals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5',
                      getGradeColor(signal.signal_grade)
                    )}
                  >
                    {signal.signal_grade}
                  </Badge>
                  <span className="text-sm font-medium">{signal.ticker}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ${signal.strike}{' '}
                    <span
                      className={cn(
                        signal.option_type === 'call'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {signal.option_type === 'call' ? 'C' : 'P'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatPremium(signal.premium_flow)}
                  </span>
                  {signal.option_type === 'call' ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(signal.detected_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Penny Stock Signals */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-medium">Penny Stock Signals</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {pennySignals.length} signals
          </Badge>
        </div>

        {pennySignals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No recent penny stock signals
          </p>
        ) : (
          <div className="space-y-1">
            {pennySignals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-medium">{signal.ticker}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {signal.signal_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono">
                    ${signal.price_at_signal.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimeAgo(signal.detected_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
