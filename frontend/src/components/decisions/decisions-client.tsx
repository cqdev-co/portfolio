'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface DecisionToolCall {
  name: string;
  args?: unknown;
  latency_ms?: number;
  ok?: boolean;
  error?: string;
}

interface DecisionCoverageReport {
  checked: string[];
  skipped: string[];
  stale: string[];
  errors: { signal: string; message: string }[];
  latencies?: { signal: string; latency_ms: number; ok: boolean }[];
}

interface DecisionRiskViolation {
  rule: string;
  severity: 'BLOCK' | 'WARN';
  detail: string;
  observed?: string | number | null;
  threshold?: string | number | null;
}

interface DecisionRow {
  id: string;
  created_at: string;
  source: 'frontend' | 'ai-analyst' | 'discord-bot';
  user_id: string | null;
  user_question: string;
  conversation_id: string | null;
  model_id: string;
  prompt_hash: string;
  prompt_variant: string | null;
  tool_calls: DecisionToolCall[] | null;
  final_response: string;
  total_latency_ms: number | null;
  total_tokens: number | null;
  question_class: string | null;
  ticker: string | null;
  recommendation_type: string | null;
  coverage_report: DecisionCoverageReport | null;
  risk_violations: DecisionRiskViolation[] | null;
  confidence: number | null;
}

interface DecisionsResponse {
  rows: DecisionRow[];
  limit: number;
  offset: number;
  count: number;
  error?: string;
  message?: string;
}

interface Filters {
  source: string;
  model_id: string;
  question_class: string;
  ticker: string;
}

const EMPTY_FILTERS: Filters = {
  source: '',
  model_id: '',
  question_class: '',
  ticker: '',
};

const SOURCE_OPTIONS: Array<Filters['source']> = [
  '',
  'frontend',
  'ai-analyst',
  'discord-bot',
];

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

export function DecisionsClient() {
  const [rows, setRows] = useState<DecisionRow[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set('limit', '50');
    return params.toString();
  }, [filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decisions?${queryString}`, {
        cache: 'no-store',
      });
      const body = (await res.json()) as DecisionsResponse;
      if (!res.ok) {
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setRows(body.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decisions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Xylo decisions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every Xylo turn across `/chat`, ai-analyst CLI, and the Discord bot,
            ordered most-recent first.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing\u2026' : 'Refresh'}
        </Button>
      </div>

      <Separator className="mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <FilterField label="Source">
          <select
            value={filters.source}
            onChange={(e) => updateFilter('source', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt || 'any'} value={opt}>
                {opt || 'Any source'}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Model">
          <Input
            value={filters.model_id}
            onChange={(e) => updateFilter('model_id', e.target.value)}
            placeholder="exact match"
          />
        </FilterField>
        <FilterField label="Question class">
          <Input
            value={filters.question_class}
            onChange={(e) => updateFilter('question_class', e.target.value)}
            placeholder="chat / trade-call / \u2026"
          />
        </FilterField>
        <FilterField label="Ticker">
          <Input
            value={filters.ticker}
            onChange={(e) =>
              updateFilter('ticker', e.target.value.toUpperCase())
            }
            placeholder="NVDA"
          />
        </FilterField>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">When</TableHead>
              <TableHead className="w-[110px]">Source</TableHead>
              <TableHead className="w-[180px]">Model</TableHead>
              <TableHead>Question</TableHead>
              <TableHead className="w-[90px] text-right">Coverage</TableHead>
              <TableHead className="w-[70px] text-right">Risk</TableHead>
              <TableHead className="w-[80px] text-right">Conf</TableHead>
              <TableHead className="w-[80px] text-right">Tools</TableHead>
              <TableHead className="w-[100px] text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No decisions match these filters yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <DecisionRowView
                    key={row.id}
                    row={row}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedId((cur) => (cur === row.id ? null : row.id))
                    }
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DecisionRowView({
  row,
  expanded,
  onToggle,
}: {
  row: DecisionRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tools = row.tool_calls ?? [];
  const cov = row.coverage_report;
  const covTotal = cov
    ? cov.checked.length + cov.skipped.length + cov.errors.length
    : 0;
  const risk = row.risk_violations;
  const blocks = risk ? risk.filter((v) => v.severity === 'BLOCK').length : 0;
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <TableCell className="font-mono text-xs whitespace-nowrap">
          {formatTimestamp(row.created_at)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-normal">
            {row.source}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-xs">
          {row.model_id || '\u2014'}
        </TableCell>
        <TableCell className="max-w-md">
          <div className="text-sm">{truncate(row.user_question, 140)}</div>
          {(row.ticker || row.question_class) && (
            <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
              {row.ticker && <span>ticker: {row.ticker}</span>}
              {row.question_class && <span>class: {row.question_class}</span>}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right text-sm">
          {cov ? (
            <span
              className={cov.errors.length > 0 ? 'text-destructive' : undefined}
            >
              {cov.checked.length}/{covTotal}
            </span>
          ) : (
            '\u2014'
          )}
        </TableCell>
        <TableCell className="text-right text-sm">
          {risk == null ? (
            '\u2014'
          ) : blocks > 0 ? (
            <span className="text-destructive">{blocks} block</span>
          ) : risk.length > 0 ? (
            <span className="text-amber-500">{risk.length} warn</span>
          ) : (
            <span className="text-emerald-500">\u2713</span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm">
          {row.confidence == null ? (
            '\u2014'
          ) : (
            <span
              className={
                row.confidence >= 7
                  ? 'text-emerald-500'
                  : row.confidence >= 4
                    ? 'text-amber-500'
                    : 'text-destructive'
              }
            >
              {row.confidence}/10
            </span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm">{tools.length}</TableCell>
        <TableCell className="text-right text-sm">
          {row.total_latency_ms != null
            ? `${(row.total_latency_ms / 1000).toFixed(1)}s`
            : '\u2014'}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9} className="p-4">
            <ExpandedDecision row={row} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandedDecision({ row }: { row: DecisionRow }) {
  const tools = row.tool_calls ?? [];
  return (
    <div className="space-y-4 text-sm">
      <Field label="Question">
        <pre className="whitespace-pre-wrap wrap-break-word font-sans text-sm">
          {row.user_question}
        </pre>
      </Field>

      <Field label="Final response">
        <pre className="whitespace-pre-wrap wrap-break-word font-sans text-sm">
          {row.final_response || '(empty)'}
        </pre>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniField label="Prompt hash" value={row.prompt_hash} />
        <MiniField
          label="Prompt variant"
          value={row.prompt_variant ?? '\u2014'}
        />
        <MiniField
          label="Tokens"
          value={row.total_tokens != null ? String(row.total_tokens) : '\u2014'}
        />
      </div>

      {row.risk_violations && (
        <Field label="Risk gate">
          <div className="space-y-1 text-xs">
            {row.risk_violations.length === 0 ? (
              <span className="text-emerald-500">
                Approved (no violations).
              </span>
            ) : (
              <ul className="space-y-0.5">
                {row.risk_violations.map((v, i) => (
                  <li key={i} className="font-mono text-[11px]">
                    <span
                      className={
                        v.severity === 'BLOCK'
                          ? 'text-destructive'
                          : 'text-amber-500'
                      }
                    >
                      [{v.severity}]
                    </span>{' '}
                    <span className="text-foreground">{v.rule}</span>
                    <span className="text-muted-foreground">: {v.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>
      )}

      {row.coverage_report && (
        <Field label="Coverage">
          <div className="space-y-1 text-xs">
            {row.coverage_report.checked.length > 0 && (
              <div>
                <span className="font-medium text-emerald-500">Checked:</span>{' '}
                <span className="font-mono text-muted-foreground">
                  {row.coverage_report.checked.join(', ')}
                </span>
              </div>
            )}
            {row.coverage_report.skipped.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Skipped:
                </span>{' '}
                <span className="font-mono text-muted-foreground">
                  {row.coverage_report.skipped.join(', ')}
                </span>
              </div>
            )}
            {row.coverage_report.errors.length > 0 && (
              <div>
                <span className="font-medium text-destructive">Errors:</span>
                <ul className="ml-4 mt-0.5">
                  {row.coverage_report.errors.map((e, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-destructive">{e.signal}</span>:{' '}
                      <span className="text-muted-foreground">{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Field>
      )}

      {tools.length > 0 && (
        <Field label={`Tool calls (${tools.length})`}>
          <ul className="space-y-1">
            {tools.map((tc, idx) => (
              <li key={idx} className="text-xs font-mono">
                <span
                  className={cn(
                    'inline-block w-3',
                    tc.ok === false ? 'text-destructive' : 'text-emerald-500'
                  )}
                >
                  {tc.ok === false ? '\u2717' : '\u2713'}
                </span>{' '}
                <span className="font-semibold">{tc.name}</span>
                {tc.latency_ms != null && (
                  <span className="text-muted-foreground">
                    {' '}
                    \u00b7 {tc.latency_ms}ms
                  </span>
                )}
                {tc.args ? (
                  <div className="ml-4 text-muted-foreground">
                    {JSON.stringify(tc.args)}
                  </div>
                ) : null}
                {tc.error ? (
                  <div className="ml-4 text-destructive">{tc.error}</div>
                ) : null}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </div>
      <div className="rounded-md border border-border bg-background px-3 py-2">
        {children}
      </div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-xs mt-1 break-all">{value}</div>
    </div>
  );
}
