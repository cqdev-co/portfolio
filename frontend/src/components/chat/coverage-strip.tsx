'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckIcon } from './chat-icons';

/**
 * Coverage report shape mirrored from
 * `lib/ai-agent/preflight/types.ts:CoverageReport`. Kept as a local
 * structural type so the chat UI doesn't import server-only modules.
 */
export interface CoverageReportPayload {
  checked: string[];
  skipped: string[];
  stale: string[];
  errors: { signal: string; message: string }[];
  latencies?: { signal: string; latency_ms: number; ok: boolean }[];
  /** Phase 1C: per-signal digests; rendered as compact summary lines. */
  digests?: Record<string, unknown>;
}

/** Best-effort 1-line summary of a digest payload, by signal name. */
function summarizeDigest(signal: string, value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (signal === 'news') {
    const sentiment = v.sentiment as
      | { score?: number; label?: string }
      | undefined;
    const catalysts = v.catalysts as unknown[] | undefined;
    const articles = v.article_count as number | undefined;
    if (sentiment?.score == null) return null;
    const cat = catalysts?.length ? `, ${catalysts.length} catalysts` : '';
    return `${sentiment.score.toFixed(2)} ${sentiment.label} (${articles ?? '?'} articles${cat})`;
  }
  if (signal === 'sentiment') {
    const score = v.score as number | undefined;
    const label = v.label as string | undefined;
    const momentum = v.momentum as number | null | undefined;
    if (score == null) return null;
    const mom = momentum != null ? `, mom ${momentum.toFixed(2)}` : '';
    return `${score.toFixed(2)} ${label ?? ''}${mom}`;
  }
  if (signal === 'earnings') {
    const next = v.next as string | undefined;
    const count = v.count as number | undefined;
    if (!next) return null;
    return `${next}${count ? ` (${count} upcoming)` : ''}`;
  }
  return null;
}

interface CoverageStripProps {
  coverage: CoverageReportPayload;
}

/**
 * Render the per-turn coverage strip above an assistant message.
 *
 * "Checked: regime, calendar, NVDA · Skipped: news (no provider yet)".
 * Click to expand for per-signal latencies + errors.
 *
 * Phase 0/1 of the Xylo roadmap — operator's answer to "what did the
 * agent actually look at this turn?".
 */
function PureCoverageStrip({ coverage }: CoverageStripProps) {
  const [expanded, setExpanded] = useState(false);

  const total =
    coverage.checked.length + coverage.skipped.length + coverage.errors.length;
  const errorCount = coverage.errors.length;
  const staleCount = coverage.stale.length;

  if (total === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border/60 bg-muted/30',
        'px-3 py-1.5 text-xs'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2',
          'text-left text-muted-foreground',
          'hover:text-foreground transition-colors'
        )}
        aria-expanded={expanded}
      >
        <CheckIcon size={12} />
        <span className="font-medium text-foreground">Coverage</span>
        <span>
          {coverage.checked.length}/{total} checked
        </span>
        {errorCount > 0 && (
          <span className="text-destructive">
            {' '}
            \u00b7 {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {staleCount > 0 && (
          <span className="text-amber-500"> \u00b7 {staleCount} stale</span>
        )}
        <span className="ml-auto opacity-60">
          {expanded ? '\u25b2' : '\u25bc'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1 space-y-1.5">
              {coverage.digests && Object.keys(coverage.digests).length > 0 && (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">Digests</div>
                  <ul className="ml-3 space-y-0.5">
                    {Object.entries(coverage.digests).map(
                      ([signal, payload]) => {
                        const summary = summarizeDigest(signal, payload);
                        if (!summary) return null;
                        return (
                          <li key={signal} className="font-mono text-[11px]">
                            <span className="text-foreground">{signal}:</span>{' '}
                            <span className="text-muted-foreground">
                              {summary}
                            </span>
                          </li>
                        );
                      }
                    )}
                  </ul>
                </div>
              )}
              {coverage.checked.length > 0 && (
                <CoverageLine
                  label="Checked"
                  items={coverage.checked}
                  variant="ok"
                  latencies={coverage.latencies}
                />
              )}
              {coverage.skipped.length > 0 && (
                <CoverageLine
                  label="Skipped"
                  items={coverage.skipped}
                  variant="muted"
                />
              )}
              {coverage.stale.length > 0 && (
                <CoverageLine
                  label="Stale"
                  items={coverage.stale}
                  variant="warn"
                />
              )}
              {coverage.errors.length > 0 && (
                <div className="space-y-0.5">
                  <div className="font-medium text-destructive">Errors</div>
                  <ul className="ml-3 space-y-0.5">
                    {coverage.errors.map((e, i) => (
                      <li key={i} className="font-mono text-[11px]">
                        <span className="text-destructive">{e.signal}:</span>{' '}
                        <span className="text-muted-foreground">
                          {e.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CoverageLine({
  label,
  items,
  variant,
  latencies,
}: {
  label: string;
  items: string[];
  variant: 'ok' | 'muted' | 'warn';
  latencies?: { signal: string; latency_ms: number; ok: boolean }[];
}) {
  const colorMap: Record<typeof variant, string> = {
    ok: 'text-emerald-500',
    muted: 'text-muted-foreground',
    warn: 'text-amber-500',
  };

  const findLatency = (signal: string): number | undefined =>
    latencies?.find((l) => l.signal === signal)?.latency_ms;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn('font-medium', colorMap[variant])}>{label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {items
          .map((item) => {
            const ms = findLatency(item);
            return ms != null ? `${item} (${ms}ms)` : item;
          })
          .join(', ')}
      </span>
    </div>
  );
}

export const CoverageStrip = memo(PureCoverageStrip);
