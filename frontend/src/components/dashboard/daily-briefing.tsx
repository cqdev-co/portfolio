'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Check,
  CheckCircle2,
  Lightbulb,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  PositionWithMarketData,
  PositionSummary,
} from '@/lib/types/positions';
import type { MarketDataPoint } from './market-pulse';
import type { SpreadDisplay } from './positions-overview';

// ============================================================================
// Types
// ============================================================================

interface BriefingData {
  briefing: string;
  positionNotes: Record<string, string>;
  actionItems: string[];
  riskAlerts: string[];
  signalHighlights: string[];
  generated_at: string;
  model?: string;
}

interface EconomicEvent {
  date: string;
  title: string;
  impact: string;
}

interface SignalForBriefing {
  strategy: string;
  ticker: string;
  grade: string;
  score: number;
  headline: string | null;
  date: string;
}

export interface DailyBriefingProps {
  marketData: MarketDataPoint[];
  spreads: SpreadDisplay[];
  positions: PositionWithMarketData[];
  summary: PositionSummary | null;
  loading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7)
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deriveMarketRegime(marketData: MarketDataPoint[]): string {
  const spy = marketData.find((d) => d.symbol === 'SPY');
  const vix = marketData.find((d) => d.symbol === '^VIX' || d.symbol === 'VIX');

  if (!spy || !vix) return 'UNKNOWN';

  const vixPrice = vix.price || 0;
  const spyChange = spy.changePercent || 0;

  if (vixPrice >= 30) return 'HIGH_VOL';
  if (spyChange >= 0.5 && vixPrice < 20) return 'RISK_ON';
  if (spyChange <= -0.5 || vixPrice >= 25) return 'RISK_OFF';
  return 'NEUTRAL';
}

// ============================================================================
// Skeleton
// ============================================================================

function BriefingSkeleton() {
  return (
    <Card className="p-5 border-primary/20 bg-linear-to-br from-background to-muted/30">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-5 rounded bg-primary/20 animate-pulse" />
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded bg-muted animate-pulse ml-auto" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
        <div className="h-4 w-4/6 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 rounded bg-muted/50 animate-pulse" />
        <div className="h-16 rounded bg-muted/50 animate-pulse" />
      </div>
    </Card>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DailyBriefing({
  marketData,
  spreads,
  positions,
  summary,
  loading,
}: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());
  const hasFetched = useRef(false);
  const hasGenerated = useRef(false);

  // Toggle action item checked state
  const toggleActionItem = useCallback((index: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      try {
        sessionStorage.setItem(
          'dashboard-checked-actions',
          JSON.stringify(Array.from(next))
        );
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // Load checked actions from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('dashboard-checked-actions');
      if (stored) setCheckedActions(new Set(JSON.parse(stored)));
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Fetch economic calendar events
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/odyssey/economic-calendar');
        if (res.ok) {
          const data = await res.json();
          setEvents(Array.isArray(data) ? data.slice(0, 5) : []);
        }
      } catch {
        // Non-critical, silently fail
      }
    }
    fetchEvents();
  }, []);

  // Typewriter animation
  useEffect(() => {
    if (!briefing?.briefing) return;

    const text = briefing.briefing;
    if (displayedText === text) return;

    setIsTyping(true);
    let idx = 0;

    const interval = setInterval(() => {
      idx += 2; // 2 chars at a time for faster animation
      if (idx >= text.length) {
        setDisplayedText(text);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, idx));
      }
    }, 12);

    return () => clearInterval(interval);
  }, [briefing?.briefing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate briefing
  const generateBriefing = useCallback(async () => {
    if (!summary || marketData.length === 0) return;

    setGenerating(true);
    setError(null);
    setDisplayedText('');

    try {
      // Fetch recent signals from unified signals table
      const { supabase } = await import('@/lib/supabase');
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: signals } = await supabase
        .from('signals')
        .select(
          'strategy, ticker, grade, score_normalized, headline, signal_date'
        )
        .gte('signal_date', threeDaysAgo.toISOString().split('T')[0])
        .order('score_normalized', { ascending: false })
        .limit(15);

      // Detect convergence (tickers appearing in multiple strategies)
      const tickerStrategies = new Map<string, Set<string>>();
      for (const s of signals || []) {
        const existing = tickerStrategies.get(s.ticker) || new Set();
        existing.add(s.strategy);
        tickerStrategies.set(s.ticker, existing);
      }
      const convergence = Array.from(tickerStrategies.entries())
        .filter(([, strategies]) => strategies.size > 1)
        .map(([ticker]) => ticker);

      // Build context
      const vix = marketData.find(
        (d) => d.symbol === '^VIX' || d.symbol === 'VIX'
      );
      const regime = deriveMarketRegime(marketData);

      const context = {
        market: {
          indices: marketData.map((d) => ({
            symbol: d.symbol,
            price: d.price || 0,
            change: d.change || 0,
            changePercent: d.changePercent || 0,
          })),
          regime,
          vixLevel: vix?.price || 0,
        },
        portfolio: {
          totalValue: summary.total_value,
          totalPnl: summary.total_pnl,
          totalPnlPercent: summary.total_pnl_percent,
          positionsCount: summary.positions_count,
          spreadsCount: summary.spreads_count,
          spreads: spreads.map((s) => {
            const expDate = s.expiration_date
              ? new Date(s.expiration_date)
              : null;
            const dte = expDate
              ? Math.ceil(
                  (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              : null;
            return {
              symbol: s.symbol,
              longStrike: s.longLeg?.strike_price || 0,
              shortStrike: s.shortLeg?.strike_price || 0,
              netEntry: s.netEntryPrice,
              netCurrent: s.netCurrentPrice,
              pnl: s.pnl,
              pnlPercent: s.pnl_percent,
              dte,
              underlyingPrice: s.underlyingPrice,
            };
          }),
          standalones: positions
            .filter((p) => !p.spread_id)
            .map((p) => ({
              symbol: p.symbol,
              type: p.position_type,
              quantity: p.quantity,
              entryPrice: p.entry_price,
              currentPrice: p.current_price,
              pnl: p.pnl,
              pnlPercent: p.pnl_percent,
            })),
        },
        signals: {
          recentCount: (signals || []).length,
          topSignals: (signals || []).slice(0, 8).map(
            (s): SignalForBriefing => ({
              strategy: s.strategy,
              ticker: s.ticker,
              grade: s.grade,
              score: s.score_normalized,
              headline: s.headline,
              date: s.signal_date,
            })
          ),
          convergence,
        },
        events: events.slice(0, 5).map((e) => ({
          date: e.date,
          title: e.title,
          impact: e.impact,
        })),
      };

      const res = await fetch('/api/dashboard/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: BriefingData = await res.json();
      setBriefing(data);

      // Reset checked actions for new briefing
      setCheckedActions(new Set());
      try {
        sessionStorage.removeItem('dashboard-checked-actions');
      } catch {
        // Ignore
      }

      // Cache in sessionStorage
      try {
        sessionStorage.setItem(
          'dashboard-briefing',
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // Ignore storage errors
      }
    } catch (err) {
      console.error('[Briefing] Error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to generate briefing'
      );
    } finally {
      setGenerating(false);
    }
  }, [summary, marketData, spreads, positions, events]);

  // Load cached briefing or generate on first render
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const cached = sessionStorage.getItem('dashboard-briefing');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Cache valid for 30 minutes
        if (Date.now() - timestamp < 30 * 60 * 1000) {
          setBriefing(data);
          setDisplayedText(data.briefing || '');
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Auto-generate when data is ready (once)
  useEffect(() => {
    if (
      hasGenerated.current ||
      briefing ||
      loading ||
      !summary ||
      marketData.length === 0
    )
      return;

    hasGenerated.current = true;
    generateBriefing();
  }, [loading, summary, marketData.length, briefing, generateBriefing]);

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return <BriefingSkeleton />;
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-linear-to-br from-background to-primary/3">
      {/* Subtle AI accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-primary/60 via-primary/30 to-transparent" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">
              Victor&apos;s Daily Briefing
            </h3>
            {generating && (
              <Badge variant="outline" className="text-[10px] animate-pulse">
                Generating...
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {briefing?.generated_at && (
              <span className="text-[10px] text-muted-foreground mr-2">
                {new Date(briefing.generated_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                hasGenerated.current = false;
                generateBriefing();
              }}
              disabled={generating || !summary}
              className="h-7 w-7 p-0"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', generating && 'animate-spin')}
              />
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

        {/* Error state */}
        {error && !briefing && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs">{error}</p>
              <p className="text-[10px] mt-1 text-muted-foreground/70">
                AI briefing unavailable. Your dashboard data is still live
                below.
              </p>
            </div>
          </div>
        )}

        {/* Briefing text */}
        {(briefing || generating) && expanded && (
          <div className="space-y-4">
            {/* Main briefing */}
            <p className="text-sm leading-relaxed">
              {generating && !displayedText ? (
                <span className="text-muted-foreground italic">
                  Analyzing market conditions, portfolio, and signals...
                </span>
              ) : (
                <>
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </>
              )}
            </p>

            {/* Action Items + Risk Alerts */}
            {briefing && !isTyping && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Action Items (interactive checkboxes) */}
                {briefing.actionItems.length > 0 && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-medium">Action Items</span>
                      {checkedActions.size > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {checkedActions.size}/{briefing.actionItems.length}{' '}
                          done
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {briefing.actionItems.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs leading-relaxed group"
                        >
                          <button
                            onClick={() => toggleActionItem(i)}
                            className={cn(
                              'shrink-0 mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center transition-all',
                              checkedActions.has(i)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/30 group-hover:border-primary/50'
                            )}
                          >
                            {checkedActions.has(i) && (
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            )}
                          </button>
                          <span
                            className={cn(
                              'text-muted-foreground',
                              checkedActions.has(i) && 'line-through opacity-50'
                            )}
                          >
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk Alerts */}
                {briefing.riskAlerts.length > 0 && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium">Risk Alerts</span>
                    </div>
                    <ul className="space-y-1">
                      {briefing.riskAlerts.map((alert, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground leading-relaxed"
                        >
                          {alert}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Signal Highlights */}
                {briefing.signalHighlights.length > 0 && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">Signals</span>
                    </div>
                    <ul className="space-y-1">
                      {briefing.signalHighlights.map((sig, i) => (
                        <li
                          key={i}
                          className="text-xs text-muted-foreground leading-relaxed"
                        >
                          {sig}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Upcoming Events */}
                {events.length > 0 && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium">
                        Upcoming Events
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {events.slice(0, 4).map((event, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[9px] px-1 shrink-0',
                              event.impact === 'high'
                                ? 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400'
                                : 'border-muted'
                            )}
                          >
                            {formatEventDate(event.date)}
                          </Badge>
                          <span className="text-muted-foreground truncate">
                            {event.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Collapsed state - show one-liner */}
        {briefing && !expanded && (
          <p className="text-xs text-muted-foreground truncate">
            {briefing.briefing.split('.')[0]}.
          </p>
        )}

        {/* No AI - just show events */}
        {!briefing && !generating && !error && events.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {events.slice(0, 3).map((event, i) => (
              <Badge key={i} variant="outline" className="text-[10px] gap-1">
                <Zap className="h-3 w-3" />
                {formatEventDate(event.date)}: {event.title}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Get position annotations from the briefing data.
 * Used by PositionsOverview to show AI notes per position.
 */
export function usePositionAnnotations(): Record<string, string> {
  const [annotations, setAnnotations] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = sessionStorage.getItem('dashboard-briefing');
      if (cached) {
        const { data } = JSON.parse(cached);
        if (data?.positionNotes) return data.positionNotes;
      }
    } catch {
      // Ignore
    }
    return {};
  });

  useEffect(() => {
    // Listen for storage changes (when briefing is generated)
    const handler = () => {
      try {
        const cached = sessionStorage.getItem('dashboard-briefing');
        if (cached) {
          const { data } = JSON.parse(cached);
          if (data?.positionNotes) {
            setAnnotations(data.positionNotes);
          }
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return annotations;
}
