/**
 * Chat artifact + suggestion extractor scaffolding.
 *
 * Translates tool outputs collected over the course of an assistant
 * turn into the structured `data-artifact` and `data-suggestions`
 * payloads consumed by the inline `<InsightCard>` / `<ArtifactPanel>`
 * / `<SuggestionChips>` components.
 *
 * Initial pass focuses on the comparison case (e.g. AAPL vs MSFT):
 * when the model has fetched ticker data for two distinct symbols,
 * we synthesise a multi-window "Relative Return Brief". Other turn
 * shapes return `null` and the chat falls back to plain text.
 */

import type {
  ArtifactBlock,
  ArtifactPayload,
  SuggestionChip,
  SuggestionsPayload,
} from './types';

export interface ExecutedToolCall {
  name: string;
  args: Record<string, unknown>;
  output: unknown;
}

export interface ChatExtraction {
  artifact: ArtifactPayload | null;
  suggestions: SuggestionsPayload | null;
  /**
   * Human-readable plan steps the server can stream up-front as
   * `data-thinkingStep` parts. Built from the executed tool calls so
   * the user sees a coherent narration even before the assistant text
   * begins.
   */
  thinkingSteps: { stepId: string; label: string; detail?: string }[];
}

const RETURN_WINDOWS = ['1M', 'YTD', '1Y', '5Y', '10Y', 'MAX'] as const;

type WindowKey = (typeof RETURN_WINDOWS)[number];

interface TickerSummary {
  ticker: string;
  returns: Partial<Record<WindowKey, number>>;
}

/**
 * Best-effort coercion of `get_ticker_data`-shaped output into a
 * compact summary the artifact builder can consume. Defensive about
 * missing fields — tools may return only a subset of the windows.
 */
function summarizeTicker(
  toolName: string,
  args: Record<string, unknown>,
  output: unknown
): TickerSummary | null {
  if (toolName !== 'get_ticker_data' || !output || typeof output !== 'object') {
    return null;
  }

  const ticker = String(
    (args?.ticker as string | undefined) ??
      (output as { ticker?: string }).ticker ??
      ''
  ).toUpperCase();
  if (!ticker) return null;

  const data = output as Record<string, unknown>;
  const performance =
    (data.performance as Record<string, unknown> | undefined) ??
    (data.returns as Record<string, unknown> | undefined) ??
    null;

  const returns: Partial<Record<WindowKey, number>> = {};
  if (performance) {
    const map: Record<string, WindowKey> = {
      '1m': '1M',
      oneMonth: '1M',
      ytd: 'YTD',
      '1y': '1Y',
      oneYear: '1Y',
      '5y': '5Y',
      fiveYear: '5Y',
      '10y': '10Y',
      tenYear: '10Y',
      max: 'MAX',
      maxReturn: 'MAX',
    };
    for (const [key, win] of Object.entries(map)) {
      const v = performance[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        returns[win] = v;
      }
    }
  }

  if (Object.keys(returns).length === 0) {
    return null;
  }
  return { ticker, returns };
}

/**
 * Build a comparison artifact when we have ticker summaries for two
 * distinct symbols. Returns `null` otherwise so the route can keep
 * the response plain text.
 */
function buildComparisonArtifact(
  summaries: TickerSummary[]
): ArtifactPayload | null {
  if (summaries.length < 2) return null;
  const [a, b] = summaries;

  const sharedWindows = RETURN_WINDOWS.filter(
    (w) => a.returns[w] != null && b.returns[w] != null
  );
  if (sharedWindows.length === 0) return null;

  // Find biggest spread window
  let bestWindow: WindowKey = sharedWindows[0];
  let bestSpread = -Infinity;
  let leader = a.ticker;
  for (const w of sharedWindows) {
    const av = a.returns[w] ?? 0;
    const bv = b.returns[w] ?? 0;
    const absSpread = Math.abs(av - bv);
    if (absSpread > bestSpread) {
      bestSpread = absSpread;
      bestWindow = w;
      leader = av >= bv ? a.ticker : b.ticker;
    }
  }

  const longRunWindow = sharedWindows.includes('MAX')
    ? 'MAX'
    : sharedWindows[sharedWindows.length - 1];
  const longRunLeader =
    (a.returns[longRunWindow] ?? 0) >= (b.returns[longRunWindow] ?? 0)
      ? a.ticker
      : b.ticker;

  const avgSpread =
    sharedWindows.reduce(
      (acc, w) => acc + Math.abs((a.returns[w] ?? 0) - (b.returns[w] ?? 0)),
      0
    ) / sharedWindows.length;

  const tableRows = sharedWindows.map((w) => {
    const av = a.returns[w] ?? 0;
    const bv = b.returns[w] ?? 0;
    return {
      period: w,
      values: [av, bv, av - bv] as (string | number)[],
    };
  });

  const points = sharedWindows.map((w) => ({
    x: w,
    values: [a.returns[w] ?? 0, b.returns[w] ?? 0],
  }));

  const blocks: ArtifactBlock[] = [
    {
      type: 'callout',
      tone: 'info',
      text: `On the ${bestWindow} view, ${a.ticker} returned ${(a.returns[bestWindow] ?? 0).toFixed(2)}% versus ${(b.returns[bestWindow] ?? 0).toFixed(2)}% for ${b.ticker}.`,
    },
    {
      type: 'metricGrid',
      items: [
        {
          label: 'Best Window',
          value: bestWindow,
          hint: `${leader} leads here with a ${bestSpread.toFixed(2)} pt spread.`,
        },
        {
          label: 'Long-Run Leader',
          value: longRunLeader,
          hint: `Ahead on the ${longRunWindow} horizon.`,
        },
        {
          label: 'Avg Spread',
          value: `${avgSpread.toFixed(2)} pts`,
          hint: 'Mean absolute gap across windows.',
        },
      ],
    },
    {
      type: 'returnChart',
      series: [
        { name: a.ticker, color: 'var(--chart-1, #3b82f6)' },
        { name: b.ticker, color: 'var(--chart-2, #f97316)' },
      ],
      points,
    },
    {
      type: 'returnTable',
      columns: [a.ticker, b.ticker, 'Spread'],
      rows: tableRows,
    },
  ];

  return {
    artifactId: `cmp-${a.ticker}-${b.ticker}-${Date.now().toString(36)}`,
    title: `${a.ticker} vs ${b.ticker} Relative Return Brief`,
    filename: `${a.ticker}-vs-${b.ticker}-relative-return-brief.pdf`,
    kind: 'pdf',
    summary: `Generated from the live comparison module. Compares returns for ${a.ticker} and ${b.ticker} across ${sharedWindows.join(', ')}.`,
    keyTakeaways: [
      `${a.ticker} creates the strongest separation on the ${bestWindow} horizon.`,
      `Average spread across windows is ${avgSpread.toFixed(2)} pts.`,
      `${longRunLeader} edges ahead on the ${longRunWindow} view.`,
    ],
    hero: {
      label: 'Largest Spread',
      value: `${bestWindow} ${bestSpread >= 0 ? '+' : ''}${bestSpread.toFixed(2)} pts`,
    },
    generatedAt: new Date().toISOString(),
    blocks,
  };
}

function buildComparisonSuggestions(
  summaries: TickerSummary[]
): SuggestionsPayload {
  const [a, b] = summaries;
  const peer = a && a.ticker !== 'NVDA' ? 'NVDA' : 'GOOG';
  const chips: SuggestionChip[] = [
    {
      slash: 'pdf',
      label: 'Generate board-ready PDF',
      prompt: `Generate a board-ready PDF brief from the ${a?.ticker ?? 'this'} vs ${b?.ticker ?? 'comparison'} comparison.`,
    },
    {
      slash: 'deck',
      label: 'Turn into slide deck',
      prompt: `Turn this comparison into a 5-slide deck.`,
    },
    {
      slash: 'mail',
      label: 'Draft email with brief',
      prompt: `Draft an internal email summarising the ${a?.ticker ?? ''} vs ${b?.ticker ?? ''} comparison.`,
    },
    {
      slash: 'compare',
      label: `Compare with ${peer}`,
      prompt: `Now compare ${a?.ticker ?? 'AAPL'} with ${peer} across the same windows.`,
    },
    {
      slash: 'table',
      label: 'Top 5 performing stocks',
      prompt: `Show the top 5 performing stocks across the same return windows.`,
    },
  ];
  return { chips };
}

/**
 * Default extractor entry point. The route hands us every executed
 * tool call from the turn; we decide which artifact / suggestion
 * shape (if any) to emit. Adding new shapes here is the canonical
 * way to extend the chat UI.
 */
export function extractChatArtifact(
  toolCalls: ExecutedToolCall[]
): ChatExtraction {
  const summaries: TickerSummary[] = [];
  for (const tc of toolCalls) {
    const summary = summarizeTicker(tc.name, tc.args, tc.output);
    if (summary && !summaries.some((s) => s.ticker === summary.ticker)) {
      summaries.push(summary);
    }
  }

  const thinkingSteps = buildThinkingSteps(toolCalls, summaries);

  if (summaries.length >= 2) {
    const artifact = buildComparisonArtifact(summaries);
    if (artifact) {
      return {
        artifact,
        suggestions: buildComparisonSuggestions(summaries),
        thinkingSteps,
      };
    }
  }

  return { artifact: null, suggestions: null, thinkingSteps };
}

/**
 * Plan-narration steps derived from the tool calls executed this
 * turn. Each step gets a deterministic id so the route can stream a
 * `running` row and later replace it with the same id but
 * `status: 'done'`.
 */
function buildThinkingSteps(
  toolCalls: ExecutedToolCall[],
  summaries: TickerSummary[]
): { stepId: string; label: string; detail?: string }[] {
  if (toolCalls.length === 0) return [];

  const steps: { stepId: string; label: string; detail?: string }[] = [];

  if (summaries.length >= 2) {
    const [a, b] = summaries;
    steps.push({
      stepId: 'plan-benchmark',
      label: `Using ${b.ticker} as the benchmark company for ${a.ticker}.`,
      detail: `Comparing returns across ${RETURN_WINDOWS.join(', ')} windows.`,
    });
  }

  const grouped = new Map<string, ExecutedToolCall[]>();
  for (const tc of toolCalls) {
    if (!grouped.has(tc.name)) grouped.set(tc.name, []);
    grouped.get(tc.name)!.push(tc);
  }
  for (const [name, calls] of grouped) {
    const detail = calls
      .map((c) => (c.args.ticker as string) ?? (c.args.query as string) ?? '')
      .filter(Boolean)
      .join(', ');
    steps.push({
      stepId: `tool-${name}`,
      label: humanizeToolName(name),
      detail: detail || undefined,
    });
  }

  return steps;
}

function humanizeToolName(name: string): string {
  switch (name) {
    case 'get_ticker_data':
      return 'Pulled live market data.';
    case 'web_search':
      return 'Scanned the open web.';
    case 'get_financials_deep':
      return 'Reviewed the latest financials.';
    case 'get_institutional_holdings':
      return 'Checked institutional ownership.';
    case 'get_unusual_options_activity':
      return 'Inspected unusual options activity.';
    case 'get_trading_regime':
      return 'Read the current trading regime.';
    case 'get_iv_by_strike':
      return 'Sampled IV by strike.';
    case 'calculate_spread':
      return 'Sized a candidate spread.';
    case 'get_sector_flow':
      return 'Surveyed sector flow.';
    case 'get_recent_news':
      return 'Scanned recent headlines.';
    case 'get_sentiment':
      return 'Gauged sentiment.';
    case 'get_earnings_calendar':
      return 'Checked the earnings calendar.';
    case 'get_geopolitical_events':
      return 'Reviewed geopolitical events.';
    default:
      return `Ran ${name}.`;
  }
}
