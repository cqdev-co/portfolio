'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { History, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface AnalystTrade {
  id: string;
  ticker: string;
  strategy: string;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  outcome: string | null; // 'win' | 'loss' | 'breakeven' | null (open)
  entry_date: string;
  exit_date: string | null;
  status: string; // 'open' | 'closed'
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Skeleton
// ============================================================================

function PerformanceSkeleton() {
  return (
    <Card className="p-4">
      <div className="h-5 w-32 rounded bg-muted animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex justify-between items-center py-2 border-b last:border-0"
          >
            <div className="flex gap-2">
              <div className="h-4 w-12 rounded bg-muted animate-pulse" />
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
// Stats Summary
// ============================================================================

function TradeStats({ trades }: { trades: AnalystTrade[] }) {
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const wins = closedTrades.filter((t) => t.outcome === 'win').length;
  const losses = closedTrades.filter((t) => t.outcome === 'loss').length;
  const winRate =
    closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  const avgWin =
    wins > 0
      ? closedTrades
          .filter((t) => t.outcome === 'win')
          .reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / wins
      : 0;
  const avgLoss =
    losses > 0
      ? closedTrades
          .filter((t) => t.outcome === 'loss')
          .reduce((sum, t) => sum + (t.pnl_percent || 0), 0) / losses
      : 0;

  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <div className="text-center">
        <div className="text-[10px] text-muted-foreground">Total Trades</div>
        <div className="text-sm font-semibold">{closedTrades.length}</div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-muted-foreground">Win Rate</div>
        <div
          className={cn(
            'text-sm font-semibold',
            winRate >= 50
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          )}
        >
          {winRate.toFixed(0)}%
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-muted-foreground">Avg Win</div>
        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          +{avgWin.toFixed(1)}%
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-muted-foreground">Avg Loss</div>
        <div className="text-sm font-semibold text-red-600 dark:text-red-400">
          {avgLoss.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function PerformanceSection() {
  const [trades, setTrades] = useState<AnalystTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrades() {
      try {
        // Fetch recent trades from analyst_trades table
        const { data, error } = await supabase
          .from('analyst_trades')
          .select('*')
          .order('entry_date', { ascending: false })
          .limit(20);

        if (error) {
          console.error('[Performance] Fetch error:', error);
          // Table might not exist - that's ok, show empty state
          setTrades([]);
        } else {
          setTrades((data as AnalystTrade[]) || []);
        }
      } catch (err) {
        console.error('[Performance] Error:', err);
        setTrades([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTrades();
  }, []);

  if (loading) {
    return <PerformanceSkeleton />;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Trade Journal</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {trades.length} trades
        </Badge>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-6">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No trades recorded yet. Use the AI Analyst CLI to log trades.
          </p>
        </div>
      ) : (
        <>
          {/* Stats summary */}
          <TradeStats trades={trades} />

          {/* Recent trades list */}
          <div className="space-y-1">
            {trades.slice(0, 10).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  {trade.outcome === 'win' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : trade.outcome === 'loss' ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <div className="h-3 w-3 rounded-full bg-amber-400/50" />
                  )}
                  <span className="text-sm font-medium">{trade.ticker}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {trade.strategy || 'CDS'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {trade.pnl !== null ? (
                    <span
                      className={cn(
                        'text-xs font-mono font-semibold',
                        (trade.pnl || 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl?.toFixed(0)}
                    </span>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                    >
                      OPEN
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(trade.entry_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
