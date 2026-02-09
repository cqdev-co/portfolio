'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Zap,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Signal {
  id: string;
  strategy: string;
  ticker: string;
  signal_date: string;
  score_normalized: number;
  grade: string;
  direction: string;
  price: number;
  headline: string | null;
  top_signals: string[] | null;
  sector: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

const STRATEGY_LABELS: Record<string, { label: string; color: string }> = {
  cds: {
    label: 'CDS',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  pcs: {
    label: 'PCS',
    color:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  },
  penny: {
    label: 'PENNY',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
};

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Skeleton
// ============================================================================

function HighlightsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SignalHighlights() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [strategyFilter, setStrategyFilter] = useState<string>('all');

  // Fetch signals from unified table
  useEffect(() => {
    async function fetchSignals() {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);

        const { data, error } = await supabase
          .from('signals')
          .select('*')
          .gte('signal_date', cutoff.toISOString().split('T')[0])
          .order('score_normalized', { ascending: false })
          .limit(50);

        if (error) {
          console.error('[SignalHighlights] Query error:', error);
        } else {
          setSignals((data as Signal[]) || []);
        }
      } catch (err) {
        console.error('[SignalHighlights] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, []);

  // Multi-strategy convergence detection
  const convergence = useMemo(() => {
    const tickerStrategies = new Map<string, Set<string>>();
    for (const s of signals) {
      const existing = tickerStrategies.get(s.ticker) || new Set();
      existing.add(s.strategy);
      tickerStrategies.set(s.ticker, existing);
    }
    return Array.from(tickerStrategies.entries())
      .filter(([, strategies]) => strategies.size > 1)
      .map(([ticker, strategies]) => ({
        ticker,
        strategies: Array.from(strategies),
      }));
  }, [signals]);

  // Top signals: S and A grade only
  const topSignals = useMemo(
    () => signals.filter((s) => ['S', 'A'].includes(s.grade)).slice(0, 5),
    [signals]
  );

  // Filtered signals for expanded view
  const filteredSignals = useMemo(() => {
    if (strategyFilter === 'all') return signals;
    return signals.filter((s) => s.strategy === strategyFilter);
  }, [signals, strategyFilter]);

  // Available strategies for filter tabs
  const strategies = useMemo(
    () => Array.from(new Set(signals.map((s) => s.strategy))),
    [signals]
  );

  if (loading) {
    return <HighlightsSkeleton />;
  }

  if (signals.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">Signal Highlights</h2>
        </div>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            No signals in the last 7 days
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">Signal Highlights</h2>
        <Badge variant="outline" className="text-[10px]">
          {signals.length} this week
        </Badge>
      </div>

      {/* Convergence alerts */}
      {convergence.length > 0 && (
        <Card className="p-3 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              Multi-Strategy Convergence
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {convergence.map(({ ticker, strategies: strats }) => (
              <Badge
                key={ticker}
                variant="outline"
                className="text-[10px] gap-1 border-purple-300 dark:border-purple-700"
              >
                {ticker}
                <span className="text-muted-foreground">
                  ({strats.join(' + ')})
                </span>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Top signals (compact view) */}
      {topSignals.length > 0 && (
        <div className="space-y-1">
          {topSignals.map((signal) => {
            const stratStyle =
              STRATEGY_LABELS[signal.strategy] || STRATEGY_LABELS.cds;
            const isConvergent = convergence.some(
              (c) => c.ticker === signal.ticker
            );

            return (
              <div
                key={signal.id}
                className={cn(
                  'flex items-center justify-between py-2 px-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
                  isConvergent && 'bg-purple-50/30 dark:bg-purple-950/10'
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5',
                      getGradeColor(signal.grade)
                    )}
                  >
                    {signal.grade}
                  </Badge>
                  <span className="text-sm font-medium">{signal.ticker}</span>
                  <Badge
                    variant="outline"
                    className={cn('text-[9px] px-1', stratStyle.color)}
                  >
                    {stratStyle.label}
                  </Badge>
                  {signal.direction === 'bullish' ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : signal.direction === 'bearish' ? (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  ) : null}
                  {isConvergent && (
                    <Layers className="h-3 w-3 text-purple-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {signal.score_normalized.toFixed(0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(signal.signal_date)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No top signals but have lower-grade signals */}
      {topSignals.length === 0 && signals.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          No S/A grade signals this week. {signals.length} lower-grade signals
          available below.
        </p>
      )}

      {/* View all signals toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {expanded ? 'Show less' : `View all ${signals.length} signals`}
      </Button>

      {/* Expanded: full signal list with strategy filter */}
      {expanded && (
        <div className="space-y-3">
          {/* Strategy filter tabs */}
          {strategies.length > 1 && (
            <div className="flex gap-1.5">
              <Button
                variant={strategyFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStrategyFilter('all')}
                className="h-6 text-[10px] px-2"
              >
                All
              </Button>
              {strategies.map((s) => (
                <Button
                  key={s}
                  variant={strategyFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStrategyFilter(s)}
                  className="h-6 text-[10px] px-2"
                >
                  {s.toUpperCase()}
                </Button>
              ))}
            </div>
          )}

          {/* Full signal list */}
          <div className="space-y-1">
            {filteredSignals.map((signal) => {
              const stratStyle =
                STRATEGY_LABELS[signal.strategy] || STRATEGY_LABELS.cds;
              const isConvergent = convergence.some(
                (c) => c.ticker === signal.ticker
              );

              return (
                <div
                  key={signal.id}
                  className={cn(
                    'flex items-center justify-between py-1.5 px-3 rounded-md border bg-card text-xs',
                    isConvergent && 'bg-purple-50/30 dark:bg-purple-950/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-[9px] px-1', stratStyle.color)}
                    >
                      {stratStyle.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] px-1',
                        getGradeColor(signal.grade)
                      )}
                    >
                      {signal.grade}
                    </Badge>
                    <span className="font-medium">{signal.ticker}</span>
                    {signal.direction === 'bullish' ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    ) : signal.direction === 'bearish' ? (
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                    ) : null}
                    {isConvergent && (
                      <Layers className="h-3 w-3 text-purple-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-mono">
                      ${signal.price.toFixed(2)}
                    </span>
                    <span className="text-[10px]">
                      {formatDate(signal.signal_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
