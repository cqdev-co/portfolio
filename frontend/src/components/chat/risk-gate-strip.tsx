'use client';

import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Risk-gate marker payload mirrored from
 * `lib/ai-agent/risk/types.ts:RiskVerdict`. Kept as a local
 * structural type so the chat UI doesn't import server-only modules.
 */
export interface RiskGatePayload {
  approved: boolean;
  gate_skipped: boolean;
  violations: RiskViolationPayload[];
  recommendation: ParsedRecommendationPayload | null;
  /** Phase 2 PR C: 0-10 confidence score, null for non-actionable turns. */
  confidence: ConfidenceSummary | null;
}

export interface ConfidenceSummary {
  score: number;
  components: {
    coverage_completeness: number;
    signal_agreement: number;
    risk_pass: number;
  };
}

export interface RiskViolationPayload {
  rule: string;
  severity: 'BLOCK' | 'WARN';
  detail: string;
  observed?: string | number | null;
  threshold?: string | number | null;
}

export interface ParsedRecommendationPayload {
  ticker: string;
  action: string;
  spread?: {
    type: string;
    longStrike: number;
    shortStrike: number;
    dte?: number;
    debit?: number;
  };
}

interface RiskGateStripProps {
  verdict: RiskGatePayload;
}

/**
 * Per-turn risk-gate verdict pill rendered above the assistant
 * response. Mirrors the coverage strip's interaction pattern: small
 * pill, click to expand for per-rule details.
 *
 * Phase 2 of the Xylo roadmap — operator's answer to "did the gate
 * approve this recommendation?".
 */
function PureRiskGateStrip({ verdict }: RiskGateStripProps) {
  const [expanded, setExpanded] = useState(false);

  // Don't render if the gate was skipped (no parseable recommendation
  // and no useful info to show); this keeps chat answers clean.
  if (verdict.gate_skipped) {
    return null;
  }

  const blockCount = verdict.violations.filter(
    (v) => v.severity === 'BLOCK'
  ).length;
  const warnCount = verdict.violations.filter(
    (v) => v.severity === 'WARN'
  ).length;

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs',
        verdict.approved
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-destructive/40 bg-destructive/5'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2',
          'text-left transition-colors hover:opacity-80'
        )}
        aria-expanded={expanded}
      >
        <span
          className={cn(
            verdict.approved ? 'text-emerald-500' : 'text-destructive'
          )}
        >
          {verdict.approved ? '\u2713' : '\u2717'}
        </span>
        <span className="font-medium text-foreground">Risk gate</span>
        <span className={verdict.approved ? '' : 'text-destructive'}>
          {verdict.approved ? 'approved' : 'blocked'}
        </span>
        {blockCount > 0 && (
          <span className="text-destructive">
            {' '}
            \u00b7 {blockCount} block{blockCount > 1 ? 's' : ''}
          </span>
        )}
        {warnCount > 0 && (
          <span className="text-amber-500">
            {' '}
            \u00b7 {warnCount} warn{warnCount > 1 ? 's' : ''}
          </span>
        )}
        {verdict.confidence && (
          <span
            className={cn(
              'rounded-sm px-1.5 py-0.5 text-[10px] font-mono ml-1',
              verdict.confidence.score >= 7
                ? 'bg-emerald-500/10 text-emerald-500'
                : verdict.confidence.score >= 4
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-destructive/10 text-destructive'
            )}
            title={`Coverage ${verdict.confidence.components.coverage_completeness}, agreement ${verdict.confidence.components.signal_agreement}, risk pass ${verdict.confidence.components.risk_pass}`}
          >
            {verdict.confidence.score}/10
          </span>
        )}
        {verdict.recommendation && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {formatRec(verdict.recommendation)}
          </span>
        )}
        <span className="opacity-60">{expanded ? '\u25b2' : '\u25bc'}</span>
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
              {verdict.violations.length === 0 ? (
                <div className="text-muted-foreground">
                  No violations against `strategy.config.yaml`.
                </div>
              ) : (
                <ul className="space-y-1">
                  {verdict.violations.map((v, i) => (
                    <li key={i} className="font-mono text-[11px]">
                      <span
                        className={cn(
                          v.severity === 'BLOCK'
                            ? 'text-destructive'
                            : 'text-amber-500'
                        )}
                      >
                        [{v.severity}]
                      </span>{' '}
                      <span className="text-foreground">{v.rule}</span>
                      <span className="text-muted-foreground">
                        : {v.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatRec(rec: ParsedRecommendationPayload): string {
  if (!rec) return '';
  if (rec.spread) {
    const parts = [
      rec.action,
      rec.ticker,
      `$${rec.spread.longStrike}/$${rec.spread.shortStrike}`,
      rec.spread.type.toUpperCase(),
    ];
    if (rec.spread.dte != null) parts.push(`${rec.spread.dte} DTE`);
    if (rec.spread.debit != null) parts.push(`$${rec.spread.debit}`);
    return parts.join(' ');
  }
  return rec.ticker ? `${rec.action} ${rec.ticker}` : rec.action;
}

export const RiskGateStrip = memo(PureRiskGateStrip);
