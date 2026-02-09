'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import {
  Radio,
  Filter,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface UnifiedSignal {
  id: string;
  strategy: 'cds' | 'pcs' | 'penny';
  ticker: string;
  signal_date: string;
  score_normalized: number;
  grade: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  price: number;
  regime: string | null;
  sector: string | null;
  headline: string | null;
  top_signals: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type StrategyFilter = 'all' | 'cds' | 'penny' | 'pcs';
type GradeFilter = 'all' | 'S' | 'A' | 'B' | 'C';
type DateFilter = '1d' | '3d' | '7d' | '14d' | '30d';

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
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-purple-300 dark:border-purple-700';
    case 'A':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700';
    case 'B':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    case 'C':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700';
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

function getDateCutoff(filter: DateFilter): string {
  const now = new Date();
  const days = { '1d': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30 }[filter];
  now.setDate(now.getDate() - days);
  return now.toISOString().split('T')[0];
}

// ============================================================================
// Skeleton
// ============================================================================

function FeedSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-5 rounded bg-muted animate-pulse" />
        <div className="h-5 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded bg-muted animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2">
            <div className="flex gap-2">
              <div className="h-4 w-12 rounded bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
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

export function SignalFeed() {
  const [signals, setSignals] = useState<UnifiedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>('all');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch signals from unified table
  useEffect(() => {
    async function fetchSignals() {
      setLoading(true);
      try {
        const cutoff = getDateCutoff(dateFilter);

        let query = supabase
          .from('signals')
          .select('*')
          .gte('signal_date', cutoff)
          .order('signal_date', { ascending: false })
          .order('score_normalized', { ascending: false })
          .limit(50);

        if (strategyFilter !== 'all') {
          query = query.eq('strategy', strategyFilter);
        }

        if (gradeFilter !== 'all') {
          query = query.eq('grade', gradeFilter);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[SignalFeed] Query error:', error);
        } else {
          setSignals((data as UnifiedSignal[]) || []);
        }
      } catch (err) {
        console.error('[SignalFeed] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, [strategyFilter, gradeFilter, dateFilter]);

  // Detect multi-strategy convergence
  const convergenceMap = useMemo(() => {
    const tickerStrategies = new Map<string, Set<string>>();
    for (const s of signals) {
      const existing = tickerStrategies.get(s.ticker) || new Set();
      existing.add(s.strategy);
      tickerStrategies.set(s.ticker, existing);
    }
    return new Map(
      Array.from(tickerStrategies.entries()).filter(
        ([, strategies]) => strategies.size > 1
      )
    );
  }, [signals]);

  // Stats
  const stats = useMemo(() => {
    const strategies = new Set(signals.map((s) => s.strategy));
    const highGrade = signals.filter((s) =>
      ['S', 'A'].includes(s.grade)
    ).length;
    return {
      total: signals.length,
      strategies: strategies.size,
      highGrade,
      convergence: convergenceMap.size,
    };
  }, [signals, convergenceMap]);

  if (loading) {
    return <FeedSkeleton />;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Unified Signal Feed</h3>
          <Badge variant="outline" className="text-[10px]">
            {stats.total} signals
          </Badge>
          {stats.convergence > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 gap-1"
            >
              <Layers className="h-3 w-3" />
              {stats.convergence} convergence
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn('h-7 gap-1 text-xs', showFilters && 'bg-muted')}
          >
            <Filter className="h-3 w-3" />
            Filter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 p-0"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-3 space-y-3">
          {/* Strategy filter */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Strategy
            </span>
            <div className="flex gap-1.5 mt-1.5">
              {(['all', 'cds', 'penny', 'pcs'] as const).map((s) => (
                <Button
                  key={s}
                  variant={strategyFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStrategyFilter(s)}
                  className="h-6 text-[10px] px-2"
                >
                  {s === 'all' ? 'All' : s.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          {/* Grade filter */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Min Grade
            </span>
            <div className="flex gap-1.5 mt-1.5">
              {(['all', 'S', 'A', 'B', 'C'] as const).map((g) => (
                <Button
                  key={g}
                  variant={gradeFilter === g ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGradeFilter(g)}
                  className="h-6 text-[10px] px-2"
                >
                  {g === 'all' ? 'All' : g}
                </Button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Date Range
            </span>
            <div className="flex gap-1.5 mt-1.5">
              {(['1d', '3d', '7d', '14d', '30d'] as const).map((d) => (
                <Button
                  key={d}
                  variant={dateFilter === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilter(d)}
                  className="h-6 text-[10px] px-2"
                >
                  {d}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Signal Table */}
      {expanded && (
        <>
          {/* Convergence alerts */}
          {convergenceMap.size > 0 && (
            <Card className="p-3 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2 mb-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  Multi-Strategy Convergence
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(convergenceMap.entries()).map(
                  ([ticker, strategies]) => (
                    <Badge
                      key={ticker}
                      variant="outline"
                      className="text-[10px] gap-1 border-purple-300 dark:border-purple-700"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {ticker}
                      <span className="text-muted-foreground">
                        ({Array.from(strategies).join('+')})
                      </span>
                    </Badge>
                  )
                )}
              </div>
            </Card>
          )}

          {signals.length === 0 ? (
            <Card className="p-6 text-center">
              <Radio className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">No signals found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting the filters or expanding the date range.
              </p>
            </Card>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[60px]">Date</TableHead>
                    <TableHead className="text-xs w-[50px]">Type</TableHead>
                    <TableHead className="text-xs">Ticker</TableHead>
                    <TableHead className="text-xs w-[40px]">Grade</TableHead>
                    <TableHead className="text-xs text-right w-[50px]">
                      Score
                    </TableHead>
                    <TableHead className="text-xs text-right w-[70px]">
                      Price
                    </TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">
                      Signal
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.map((signal) => {
                    const isConvergent = convergenceMap.has(signal.ticker);
                    const stratStyle =
                      STRATEGY_LABELS[signal.strategy] || STRATEGY_LABELS.cds;

                    return (
                      <TableRow
                        key={signal.id}
                        className={cn(
                          isConvergent &&
                            'bg-purple-50/30 dark:bg-purple-950/10'
                        )}
                      >
                        <TableCell className="py-1.5 text-[10px] text-muted-foreground font-mono">
                          {formatDate(signal.signal_date)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant="outline"
                            className={cn('text-[9px] px-1', stratStyle.color)}
                          >
                            {stratStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">
                              {signal.ticker}
                            </span>
                            {signal.direction === 'bullish' ? (
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            ) : signal.direction === 'bearish' ? (
                              <ArrowDownRight className="h-3 w-3 text-red-500" />
                            ) : null}
                            {isConvergent && (
                              <Layers className="h-3 w-3 text-purple-500" />
                            )}
                          </div>
                          {signal.sector && (
                            <span className="text-[10px] text-muted-foreground">
                              {signal.sector}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5',
                              getGradeColor(signal.grade)
                            )}
                          >
                            {signal.grade}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-xs">
                          {signal.score_normalized.toFixed(0)}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-xs">
                          ${signal.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-1.5 hidden sm:table-cell">
                          {signal.headline ? (
                            <span className="text-[10px] text-muted-foreground line-clamp-1">
                              {signal.headline}
                            </span>
                          ) : signal.top_signals &&
                            signal.top_signals.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {signal.top_signals.slice(0, 3).map((s, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[9px]"
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              {signal.regime ? `${signal.regime} regime` : '—'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
